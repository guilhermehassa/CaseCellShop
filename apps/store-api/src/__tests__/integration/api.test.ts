/**
 * Integration tests for POST /api/orders and GET /api/orders/:id
 *
 * Requires the full docker compose stack running on localhost:3000
 * (postgres, redis, erp, api, worker).
 *
 * Covers all 6+1 outcomes from 08-TESTES.md §3:
 *   1.  Listar produtos   -> 200, lista com availableQuantity
 *   2.  Sucesso           -> 202 PENDING_PROCESSING
 *   3.  Quantidade inválida -> 400 VALIDATION_ERROR
 *   4.  Sem Idempotency-Key -> 400 VALIDATION_ERROR
 *   5.  Produto inexistente -> 404 PRODUCT_NOT_FOUND
 *   6.  Estoque insuficiente (case-moto-g84 stock=0) -> 409 INSUFFICIENT_STOCK
 *   7.  Duplicada (mesma key+payload) -> 200 com mesmo orderId
 *   8.  Key reusada (mesmo key, payload diferente) -> 422 IDEMPOTENCY_KEY_REUSED
 *   9.  Falha temporária (X-Debug-Force-Error) -> 503 TEMPORARY_PROCESSING_ERROR
 *   10. Status do pedido -> 200 com todos os campos esperados
 *   11. Worker: order reaches CONFIRMED within 30s
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";

const API = "http://localhost:3000";

const VALID_PRODUCT = "case-galaxy-a55";
const NO_STOCK_PRODUCT = "case-moto-g84";
const MISSING_PRODUCT = "non-existent-sku-xyz";

const VALID_CUSTOMER = { name: "Integration Test", email: "integration@test.com" };

async function postOrder(
  productId: string,
  quantity: number,
  idempotencyKey: string,
  extraHeaders: Record<string, string> = {},
) {
  const res = await fetch(`${API}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      ...extraHeaders,
    },
    body: JSON.stringify({ productId, quantity, customer: VALID_CUSTOMER }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function getOrder(orderId: string) {
  const res = await fetch(`${API}/api/orders/${orderId}`);
  const body = await res.json();
  return { status: res.status, body };
}

function waitForStatus(orderId: string, targetStatus: string, timeoutMs = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = async () => {
      const { body } = await getOrder(orderId);
      if (body.status === targetStatus) return resolve(body);
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timeout waiting for ${targetStatus}, last status: ${body.status}`));
      setTimeout(poll, 2000);
    };
    poll();
  });
}

// -----------------------------------------------------------------------
describe("GET /api/products", () => {
  it("returns 200 with product list including availableQuantity", async () => {
    const res = await fetch(`${API}/api/products`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    const product = body[0];
    expect(product).toHaveProperty("id");
    expect(product).toHaveProperty("availableQuantity");
    expect(typeof product.availableQuantity).toBe("number");
  });
});

// -----------------------------------------------------------------------
describe("POST /api/orders - validation", () => {
  it("400 VALIDATION_ERROR when Idempotency-Key header is absent", async () => {
    const res = await fetch(`${API}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: VALID_PRODUCT, quantity: 1, customer: VALID_CUSTOMER }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("400 VALIDATION_ERROR when Idempotency-Key is not UUID v4", async () => {
    const res = await fetch(`${API}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "not-a-uuid" },
      body: JSON.stringify({ productId: VALID_PRODUCT, quantity: 1, customer: VALID_CUSTOMER }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("400 VALIDATION_ERROR when quantity < 1", async () => {
    const { status, body } = await postOrder(VALID_PRODUCT, 0, randomUUID());
    expect(status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
    expect(body.details).toBeDefined();
  });

  it("400 VALIDATION_ERROR when email is invalid", async () => {
    const res = await fetch(`${API}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify({
        productId: VALID_PRODUCT,
        quantity: 1,
        customer: { name: "X", email: "not-an-email" },
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });
});

// -----------------------------------------------------------------------
describe("POST /api/orders - business errors", () => {
  it("404 PRODUCT_NOT_FOUND for unknown productId", async () => {
    const { status, body } = await postOrder(MISSING_PRODUCT, 1, randomUUID());
    expect(status).toBe(404);
    expect(body.errorCode).toBe("PRODUCT_NOT_FOUND");
  });

  it("409 INSUFFICIENT_STOCK for case-moto-g84 (stock = 0)", async () => {
    const { status, body } = await postOrder(NO_STOCK_PRODUCT, 1, randomUUID());
    expect(status).toBe(409);
    expect(body.errorCode).toBe("INSUFFICIENT_STOCK");
    expect(typeof body.availableQuantity).toBe("number");
    expect(body.availableQuantity).toBe(0);
  });

  it("503 TEMPORARY_PROCESSING_ERROR when X-Debug-Force-Error: temporary", async () => {
    const { status, body } = await postOrder(VALID_PRODUCT, 1, randomUUID(), {
      "X-Debug-Force-Error": "temporary",
    });
    expect(status).toBe(503);
    expect(body.errorCode).toBe("TEMPORARY_PROCESSING_ERROR");
  });
});

// -----------------------------------------------------------------------
describe("POST /api/orders - success path", () => {
  it("202 PENDING_PROCESSING with orderId and message", async () => {
    const key = randomUUID();
    const { status, body } = await postOrder(VALID_PRODUCT, 1, key);
    expect(status).toBe(202);
    expect(body.status).toBe("PENDING_PROCESSING");
    expect(body.orderId).toBeDefined();
    expect(body.message).toBeDefined();
    expect(body.requestId).toBeDefined();
  });

  it("idempotency: same key+payload returns 200 with same orderId", async () => {
    const key = randomUUID();
    const first = await postOrder(VALID_PRODUCT, 1, key);
    expect(first.status).toBe(202);

    const second = await postOrder(VALID_PRODUCT, 1, key);
    expect(second.status).toBe(200);
    expect(second.body.orderId).toBe(first.body.orderId);
  });

  it("idempotency key reuse: same key but different payload returns 422", async () => {
    const key = randomUUID();
    const first = await postOrder(VALID_PRODUCT, 1, key);
    expect(first.status).toBe(202);

    // Same key but different quantity
    const second = await postOrder(VALID_PRODUCT, 2, key);
    expect(second.status).toBe(422);
    expect(second.body.errorCode).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});

// -----------------------------------------------------------------------
describe("GET /api/orders/:id", () => {
  it("404 ORDER_NOT_FOUND for unknown orderId", async () => {
    const { status, body } = await getOrder("non-existent-order-id");
    expect(status).toBe(404);
    expect(body.errorCode).toBe("ORDER_NOT_FOUND");
  });

  it("200 with all expected fields for existing order", async () => {
    const key = randomUUID();
    const created = await postOrder(VALID_PRODUCT, 1, key);
    expect(created.status).toBe(202);

    const { status, body } = await getOrder(created.body.orderId);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      orderId: created.body.orderId,
      productId: VALID_PRODUCT,
      quantity: 1,
      totalCents: expect.any(Number),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      message: expect.any(String),
      requestId: expect.any(String),
    });
    expect(["PENDING_PROCESSING", "PROCESSING", "CONFIRMED"]).toContain(body.status);
  });
});

// -----------------------------------------------------------------------
describe("Worker integration: normal order reaches CONFIRMED", () => {
  it("order transitions to CONFIRMED within 30s", async () => {
    const key = randomUUID();
    const created = await postOrder(VALID_PRODUCT, 1, key);
    expect(created.status).toBe(202);

    const confirmed = await waitForStatus(created.body.orderId, "CONFIRMED", 30000);
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.message).toContain("confirmado");
  }, 35000);
});
