/**
 * Unit tests for processOrder job processor.
 *
 * Strategy: vi.mock prisma and fetch (ERP HTTP calls).
 * BullMQ is NOT spun up — we invoke processOrder directly with a fake Job object.
 *
 * Covers the 4 outcomes from 06-WORKER-FILA-SYNC.md §7 + idempotency guard.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock prisma BEFORE importing process-order -------------------------
// vi.mock is hoisted but the factory must NOT reference variables defined
// in test-file scope. Use vi.fn() directly inside the factory.

vi.mock("../../lib/prisma", () => {
  const mockFindUnique = vi.fn();
  const mockUpdate = vi.fn();
  const mockTransaction = vi.fn();
  return {
    prisma: {
      order: { findUnique: mockFindUnique, update: mockUpdate },
      $transaction: mockTransaction,
    },
    Prisma: {},
  };
});

vi.mock("../../modules/orders/orders.repo", () => ({
  commitReservation: vi.fn(),
  releaseReservation: vi.fn(),
}));

vi.mock("../../config/env", () => ({
  env: {
    ERP_BASE_URL: "http://fake-erp",
    ERP_TIMEOUT_MS: 5000,
    ORDER_MAX_ATTEMPTS: 5,
    ORDER_BACKOFF_MS: 2000,
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---- Import AFTER mock setup -------------------------------------------
import { processOrder } from "../../jobs/process-order";
import { prisma } from "../../lib/prisma";
import { commitReservation, releaseReservation } from "../../modules/orders/orders.repo";

// Type-cast so we can call mockReset / mockResolvedValue on them
const mockPrismaOrderFindUnique = prisma.order.findUnique as ReturnType<typeof vi.fn>;
const mockPrismaOrderUpdate = prisma.order.update as ReturnType<typeof vi.fn>;
const mockPrismaTransaction = (prisma as any).$transaction as ReturnType<typeof vi.fn>;
const mockCommit = commitReservation as ReturnType<typeof vi.fn>;
const mockRelease = releaseReservation as ReturnType<typeof vi.fn>;

// Helper: create a minimal fake BullMQ Job
function makeJob(orderId: string, attemptsMade = 0) {
  return { data: { orderId }, attemptsMade } as any;
}

// Helper: make $transaction call through to its callback (pass-through TX)
function setupPassThroughTx() {
  mockPrismaTransaction.mockImplementation(async (cb: any) =>
    cb({
      order: { update: mockPrismaOrderUpdate },
      inventory: { update: vi.fn() },
      reservation: { findUnique: vi.fn(), update: vi.fn() },
    }),
  );
}

const BASE_ORDER = {
  id: "order-001",
  status: "PENDING_PROCESSING",
  productId: "case-galaxy-s24",
  quantity: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  setupPassThroughTx();
  mockPrismaOrderUpdate.mockResolvedValue({});
  // Reset fetch
  (global as any).fetch = undefined;
});

// ============================================================
// 1. ERP success (201) -> CONFIRMED + commitReservation
// ============================================================
describe("processOrder: ERP success (201)", () => {
  it("marks order CONFIRMED and calls commitReservation", async () => {
    mockPrismaOrderFindUnique.mockResolvedValue({ ...BASE_ORDER });
    (global as any).fetch = vi.fn().mockResolvedValue({
      status: 201,
      json: async () => ({ erpOrderId: "erp_123", invoiceId: "inv_abc" }),
    });

    await processOrder(makeJob("order-001", 0));

    // First update: PROCESSING
    expect(mockPrismaOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSING" }) }),
    );

    // Transaction for CONFIRMED path
    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
    expect(mockCommit).toHaveBeenCalledWith(expect.anything(), "order-001");
    expect(mockRelease).not.toHaveBeenCalled();
  });
});

// ============================================================
// 2. ERP idempotent response (200, already invoiced) -> CONFIRMED
// ============================================================
describe("processOrder: ERP idempotent success (200)", () => {
  it("confirms order via 200 without double-decrement", async () => {
    mockPrismaOrderFindUnique.mockResolvedValue({ ...BASE_ORDER });
    (global as any).fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ erpOrderId: "erp_existing", invoiceId: "inv_existing" }),
    });

    await processOrder(makeJob("order-001", 2));

    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
    expect(mockCommit).toHaveBeenCalledWith(expect.anything(), "order-001");
    expect(mockRelease).not.toHaveBeenCalled();
  });
});

// ============================================================
// 3. ERP temp failure (503) - not last attempt -> RETRYING + throw
// ============================================================
describe("processOrder: ERP temp failure (not last attempt)", () => {
  it("sets RETRYING and re-throws for BullMQ backoff", async () => {
    mockPrismaOrderFindUnique.mockResolvedValue({ ...BASE_ORDER });
    (global as any).fetch = vi.fn().mockResolvedValue({
      status: 503,
      json: async () => ({ error: "ERP_TEMPORARY_FAILURE" }),
    });

    await expect(processOrder(makeJob("order-001", 0))).rejects.toThrow("ERP_TEMPORARY_FAILURE");

    expect(mockPrismaOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RETRYING" }) }),
    );
    expect(mockRelease).not.toHaveBeenCalled();
  });
});

// ============================================================
// 4. ERP temp failure (503) - last attempt -> FAILED + release
// ============================================================
describe("processOrder: ERP temp failure (last attempt)", () => {
  it("sets FAILED, releases reservation, does NOT throw", async () => {
    mockPrismaOrderFindUnique.mockResolvedValue({ ...BASE_ORDER });
    (global as any).fetch = vi.fn().mockResolvedValue({
      status: 503,
      json: async () => ({ error: "ERP_TEMPORARY_FAILURE" }),
    });

    // attemptsMade = ORDER_MAX_ATTEMPTS - 1 = 4 -> this is the last attempt
    await processOrder(makeJob("order-001", 4));

    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledWith(expect.anything(), "order-001");
    expect(mockCommit).not.toHaveBeenCalled();
  });
});

// ============================================================
// 5. ERP reject (409) -> FAILED immediately, no retry
// ============================================================
describe("processOrder: ERP reject (409)", () => {
  it("sets FAILED + releases reservation, does NOT throw", async () => {
    mockPrismaOrderFindUnique.mockResolvedValue({ ...BASE_ORDER });
    (global as any).fetch = vi.fn().mockResolvedValue({
      status: 409,
      json: async () => ({ error: "ERP_REJECTED" }),
    });

    await processOrder(makeJob("order-001", 0));

    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledWith(expect.anything(), "order-001");
    expect(mockCommit).not.toHaveBeenCalled();
  });
});

// ============================================================
// 6. Idempotency: terminal status -> return immediately
// ============================================================
describe("processOrder: idempotency on terminal status", () => {
  it.each(["CONFIRMED", "FAILED", "EXPIRED", "CANCELED"])(
    "returns immediately when order.status = %s (no ERP call, no DB writes)",
    async (status) => {
      mockPrismaOrderFindUnique.mockResolvedValue({ ...BASE_ORDER, status });
      const fakeFetch = vi.fn();
      (global as any).fetch = fakeFetch;

      await processOrder(makeJob("order-001", 0));

      expect(fakeFetch).not.toHaveBeenCalled();
      expect(mockPrismaOrderUpdate).not.toHaveBeenCalled();
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    },
  );
});

// ============================================================
// 7. Order not found -> noop
// ============================================================
describe("processOrder: order not found", () => {
  it("resolves without error when order does not exist", async () => {
    mockPrismaOrderFindUnique.mockResolvedValue(null);

    await expect(processOrder(makeJob("ghost-order", 0))).resolves.toBeUndefined();
    expect(mockPrismaOrderUpdate).not.toHaveBeenCalled();
  });
});

// ============================================================
// 8. Network error (ECONNREFUSED) - not last attempt -> RETRYING + throw
// ============================================================
describe("processOrder: network error (not last attempt)", () => {
  it("sets RETRYING and re-throws", async () => {
    mockPrismaOrderFindUnique.mockResolvedValue({ ...BASE_ORDER });
    (global as any).fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(processOrder(makeJob("order-001", 0))).rejects.toThrow("ECONNREFUSED");

    expect(mockPrismaOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RETRYING" }) }),
    );
    expect(mockRelease).not.toHaveBeenCalled();
  });
});

// ============================================================
// 9. Network error - last attempt -> FAILED + release
// ============================================================
describe("processOrder: network error (last attempt)", () => {
  it("sets FAILED, releases reservation, does NOT throw", async () => {
    mockPrismaOrderFindUnique.mockResolvedValue({ ...BASE_ORDER });
    (global as any).fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await processOrder(makeJob("order-001", 4)); // last attempt

    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledWith(expect.anything(), "order-001");
    expect(mockCommit).not.toHaveBeenCalled();
  });
});
