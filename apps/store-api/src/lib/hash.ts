import crypto from "crypto";

export function requestHash(payload: {
  productId: string;
  quantity: number;
  customer: { name: string; email: string };
}): string {
  const canonical = JSON.stringify({
    productId: payload.productId,
    quantity: payload.quantity,
    customerEmail: payload.customer.email,
    customerName: payload.customer.name,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
