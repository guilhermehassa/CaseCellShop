import { prisma, Prisma } from "../../lib/prisma";

/**
 * Reserva atômica via UPDATE condicional.
 * Se affected === 0, o estoque era insuficiente no momento exato da operação —
 * duas requisições concorrentes pela última unidade nunca passam ambas.
 */
export async function atomicReserve(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
): Promise<void> {
  const affected = await tx.$executeRaw`
    UPDATE "Inventory"
    SET available = available - ${quantity},
        reserved  = reserved  + ${quantity},
        "updatedAt" = now()
    WHERE "productId" = ${productId}
      AND available >= ${quantity}`;

  if (affected === 0) {
    const inv = await tx.inventory.findUnique({ where: { productId } });
    throw { code: "INSUFFICIENT_STOCK", availableQuantity: inv?.available ?? 0 };
  }
}

/**
 * Commit da reserva (chamado pelo worker após confirmação do ERP).
 * available NÃO volta — a unidade foi vendida; apenas decrementa reserved.
 */
export async function commitReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const res = await tx.reservation.findUnique({ where: { orderId } });
  if (!res) return;

  await tx.inventory.update({
    where: { productId: res.productId },
    data: { reserved: { decrement: res.quantity } },
  });

  await tx.reservation.update({
    where: { orderId },
    data: { status: "COMMITTED" },
  });
}

/**
 * Libera a reserva (falha definitiva ou expiração pelo reaper).
 * Devolve o estoque ao disponível e marca a reserva como RELEASED ou EXPIRED.
 */
export async function releaseReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
  reason: "RELEASED" | "EXPIRED" = "RELEASED",
): Promise<void> {
  const res = await tx.reservation.findUnique({ where: { orderId } });
  if (!res) return;

  await tx.inventory.update({
    where: { productId: res.productId },
    data: {
      available: { increment: res.quantity },
      reserved: { decrement: res.quantity },
    },
  });

  await tx.reservation.update({
    where: { orderId },
    data: { status: reason },
  });
}
