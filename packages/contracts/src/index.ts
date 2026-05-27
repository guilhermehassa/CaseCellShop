export const ORDER_STATUS = [
  "PENDING_PROCESSING",
  "PROCESSING",
  "RETRYING",
  "CONFIRMED",
  "FAILED",
  "EXPIRED",
  "CANCELED",
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "PRODUCT_NOT_FOUND",
  "ORDER_NOT_FOUND",
  "INSUFFICIENT_STOCK",
  "IDEMPOTENCY_KEY_REUSED",
  "TEMPORARY_PROCESSING_ERROR",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ProductDTO {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  availableQuantity: number;
}

export interface CreateOrderRequest {
  productId: string;
  quantity: number;
  customer: { name: string; email: string };
}

export interface CreateOrderAccepted {
  orderId: string;
  status: OrderStatus;
  message: string;
  requestId: string;
}

export interface OrderStatusResponse {
  orderId: string;
  status: OrderStatus;
  productId: string;
  quantity: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  message?: string;
  requestId: string;
}

export interface ApiErrorBody {
  errorCode: ErrorCode;
  message: string;
  details?: { field: string; message: string }[];
  availableQuantity?: number;
  requestId: string;
}
