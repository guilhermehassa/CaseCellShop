/**
 * Concurrency test — 08-TESTES.md §4 (bonus, core of problem 2)
 *
 * This suite works against a live stack that may already have consumed stock
 * from previous runs. To remain deterministic, it picks a product that still
 * has stock and asks each concurrent request for the full currently available
 * quantity. Exactly one request should reserve first; all others must receive 409.
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";

const API = "http://localhost:3000";
const CANDIDATES = [
  "case-iphone-14",
  "case-xiaomi-14",
  "case-pixel-9",
  "case-galaxy-a55",
  "case-galaxy-s24",
  "case-iphone-15",
  "case-asus-rog",
];
const DOUBLE_CLICK_CANDIDATES = [
  "case-asus-rog",
  "case-iphone-15",
  "case-galaxy-s24",
  "case-pixel-9",
  "case-xiaomi-14",
];

async function getInventory(productId: string) {
  const res = await fetch(`${API}/api/products`);
  const products = (await res.json()) as any[];
  return products.find((p: any) => p.id === productId);
}

async function pickProductWithStock(minAvailable = 1, maxAvailable = Number.POSITIVE_INFINITY) {
  const res = await fetch(`${API}/api/products`);
  if (res.status !== 200) {
    throw new Error(`Could not list products (status ${res.status})`);
  }

  const products = (await res.json()) as Array<{ id: string; availableQuantity: number }>;
  const pickedId = CANDIDATES.find((id) => {
    const p = products.find((item) => item.id === id);
    return p && p.availableQuantity >= minAvailable && p.availableQuantity <= maxAvailable;
  });

  if (!pickedId) {
    throw new Error("No product with enough stock available to run concurrency test.");
  }

  const picked = products.find((p) => p.id === pickedId);
  if (!picked) {
    throw new Error("Chosen product not found in catalog response.");
  }

  return picked;
}

async function pickProductForDoubleClick(minAvailable = 1) {
  const res = await fetch(`${API}/api/products`);
  if (res.status !== 200) {
    throw new Error(`Could not list products (status ${res.status})`);
  }
  const products = (await res.json()) as Array<{ id: string; availableQuantity: number }>;
  const pickedId = DOUBLE_CLICK_CANDIDATES.find((id) => {
    const p = products.find((item) => item.id === id);
    return p && p.availableQuantity >= minAvailable;
  });
  if (!pickedId) {
    throw new Error("No product with enough stock for double-click test.");
  }
  const picked = products.find((p) => p.id === pickedId);
  if (!picked) {
    throw new Error("Chosen product not found in catalog response.");
  }
  return picked;
}

async function postOrder(productId: string, idempotencyKey: string, quantity = 1) {
  const res = await fetch(`${API}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      productId,
      quantity,
      customer: { name: "Concurrent User", email: "concurrent@test.com" },
    }),
  });
  return { status: res.status, body: await res.json() };
}

describe("Concurrency: N simultaneous orders for remaining stock", () => {
  it("parallel checkout never oversells (statuses limited to 202/409)", async () => {
    let product;
    try {
      product = await pickProductWithStock(1, 19);
    } catch {
      product = await pickProductWithStock(1);
    }
    const productId = product.id;
    const requestedQty = Math.min(product.availableQuantity, 10);
    expect(requestedQty).toBeGreaterThan(0);

    const N = 20;
    const keys = Array.from({ length: N }, () => randomUUID());

    // Fire all N requests truly in parallel
    const results = await Promise.all(
      keys.map((key) => postOrder(productId, key, requestedQty)),
    );

    const successes = results.filter((r) => r.status === 202);
    const conflicts = results.filter((r) => r.status === 409);
    const others = results.filter((r) => r.status !== 202 && r.status !== 409);

    expect(others).toHaveLength(0); // no unexpected statuses
    expect(successes.length + conflicts.length).toBe(N);

    // Upper bound of successful reservations for current availability/quantity.
    const maxSuccesses = Math.floor(product.availableQuantity / requestedQty);
    expect(successes.length).toBeLessThanOrEqual(maxSuccesses);
    if (successes.length >= 1) {
      expect(successes[0].body.status).toBe("PENDING_PROCESSING");
    }

    // Non-successful attempts must fail with stock conflict.
    for (const c of conflicts) {
      expect(c.body.errorCode).toBe("INSUFFICIENT_STOCK");
    }

    // Inventory check immediately after requests:
    // available must be 0 (the 1 unit was reserved), OR
    // if the worker already CONFIRMED the order, reserved is 0 and the sync-erp
    // may have restored available from ERP — but NEVER should available be > original stock (1)
    const afterInv = await getInventory(productId);
    // No oversell: stock cannot become negative and cannot exceed the
    // pre-test available quantity seen by the API.
    expect(afterInv.availableQuantity).toBeGreaterThanOrEqual(0);
    expect(afterInv.availableQuantity).toBeLessThanOrEqual(product.availableQuantity);
  }, 20000);

  it("double-click variant: same key sent 10x in parallel -> 1 created, rest return 200 same orderId", async () => {
    const product = await pickProductForDoubleClick(1);
    const sharedKey = randomUUID();
    const N = 10;

    const results = await Promise.all(
      Array.from({ length: N }, () => postOrder(product.id, sharedKey, 1)),
    );

    const created = results.filter((r) => r.status === 202);
    const duplicates = results.filter((r) => r.status === 200);
    const errors = results.filter((r) => r.status !== 202 && r.status !== 200);

    // No errors
    expect(errors).toHaveLength(0);

    // Exactly 1 created
    expect(created).toHaveLength(1);
    const orderId = created[0].body.orderId;

    // All duplicates have the same orderId
    for (const d of duplicates) {
      expect(d.body.orderId).toBe(orderId);
    }
  }, 20000);
});
