export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  public readonly details?: { field: string; message: string }[];

  constructor(msg: string, details?: { field: string; message: string }[]) {
    super("VALIDATION_ERROR", msg, 400);
    this.details = details;
  }
}

export class ProductNotFoundError extends AppError {
  constructor() {
    super("PRODUCT_NOT_FOUND", "Produto não encontrado.", 404);
  }
}

export class InsufficientStockError extends AppError {
  constructor(public readonly availableQuantity: number) {
    super("INSUFFICIENT_STOCK", "Estoque insuficiente para este produto.", 409);
  }
}

export class IdempotencyReuseError extends AppError {
  constructor() {
    super("IDEMPOTENCY_KEY_REUSED", "Esta chave de idempotência já foi usada com outro pedido.", 422);
  }
}

export class TemporaryError extends AppError {
  constructor() {
    super(
      "TEMPORARY_PROCESSING_ERROR",
      "Não foi possível processar o pedido agora. Tente novamente em alguns instantes.",
      503,
    );
  }
}
