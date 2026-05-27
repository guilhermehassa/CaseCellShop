import { describe, it, expect } from "vitest";
import {
  ValidationError,
  ProductNotFoundError,
  InsufficientStockError,
  IdempotencyReuseError,
  TemporaryError,
} from "../../lib/errors";

describe("AppError subclasses — HTTP status and errorCode mapping", () => {
  it("ValidationError -> 400 VALIDATION_ERROR", () => {
    const e = new ValidationError("invalid");
    expect(e.status).toBe(400);
    expect(e.code).toBe("VALIDATION_ERROR");
  });

  it("ProductNotFoundError -> 404 PRODUCT_NOT_FOUND", () => {
    const e = new ProductNotFoundError();
    expect(e.status).toBe(404);
    expect(e.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("InsufficientStockError -> 409 INSUFFICIENT_STOCK + carries availableQuantity", () => {
    const e = new InsufficientStockError(3);
    expect(e.status).toBe(409);
    expect(e.code).toBe("INSUFFICIENT_STOCK");
    expect(e.availableQuantity).toBe(3);
  });

  it("IdempotencyReuseError -> 422 IDEMPOTENCY_KEY_REUSED", () => {
    const e = new IdempotencyReuseError();
    expect(e.status).toBe(422);
    expect(e.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("TemporaryError -> 503 TEMPORARY_PROCESSING_ERROR", () => {
    const e = new TemporaryError();
    expect(e.status).toBe(503);
    expect(e.code).toBe("TEMPORARY_PROCESSING_ERROR");
  });
});
