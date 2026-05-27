import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockApplyChaos, mockPrisma } = vi.hoisted(() => ({
  mockApplyChaos: vi.fn(),
  mockPrisma: {
    erpProduct: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    erpOrder: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/prisma", () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

vi.mock("../lib/chaos", () => ({
  applyChaos: mockApplyChaos,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { createApp } from "../server";

describe("ERP API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.erpProduct.findMany.mockResolvedValue([
      { sku: "case-iphone-15", stock: 10, active: true },
    ]);
    mockPrisma.erpProduct.findUnique.mockResolvedValue({
      sku: "case-iphone-15",
      stock: 10,
      flaky: false,
    });
    mockPrisma.erpOrder.findUnique.mockResolvedValue(null);
    mockApplyChaos.mockResolvedValue("success");

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        erpProduct: {
          findUnique: vi.fn().mockResolvedValue({
            sku: "case-iphone-15",
            stock: 10,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        erpOrder: {
          create: vi.fn().mockResolvedValue({
            id: "erp-order-1",
            externalRef: "ext-1",
            status: "INVOICED",
            invoiceId: "inv-1",
          }),
        },
      };

      return callback(tx);
    });
  });

  it("GET /health returns ok", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /erp/products returns active products", async () => {
    const app = createApp();
    const res = await request(app).get("/erp/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].sku).toBe("case-iphone-15");
    expect(mockPrisma.erpProduct.findMany).toHaveBeenCalledTimes(1);
  });

  it("POST /erp/orders returns 400 for invalid payload", async () => {
    const app = createApp();
    const res = await request(app).post("/erp/orders").send({
      externalRef: "ext-1",
      sku: "case-iphone-15",
      quantity: 0,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ERP_INVALID_REQUEST");
  });

  it("POST /erp/orders returns idempotent 200 when externalRef already invoiced", async () => {
    mockPrisma.erpOrder.findUnique.mockResolvedValueOnce({
      id: "erp-order-1",
      externalRef: "ext-1",
      status: "INVOICED",
      invoiceId: "inv-1",
    });

    const app = createApp();
    const res = await request(app).post("/erp/orders").send({
      externalRef: "ext-1",
      sku: "case-iphone-15",
      quantity: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("INVOICED");
    expect(res.body.invoiceId).toBe("inv-1");
  });

  it("POST /erp/orders creates invoiced order on success", async () => {
    const app = createApp();
    const res = await request(app).post("/erp/orders").send({
      externalRef: "ext-2",
      sku: "case-iphone-15",
      quantity: 1,
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("INVOICED");
    expect(res.body.invoiceId).toBeDefined();
    expect(mockApplyChaos).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
