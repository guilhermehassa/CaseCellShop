import { prisma, Prisma } from "../lib/prisma";
import { releaseReservation } from "../modules/orders/orders.repo";
import { logger } from "../lib/logger";

export async function reapReservations(): Promise<void> {
  // Busca todas as reservas ACTIVE com expiresAt já vencido
  const expired = await prisma.reservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    include: { order: true },
  });

  for (const res of expired) {
    // Só expira se o pedido ainda está em estado não-terminal que depende da reserva
    if (!["PENDING_PROCESSING", "RETRYING"].includes(res.order.status)) continue;

    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await releaseReservation(tx, res.orderId, "EXPIRED");
        await tx.order.update({
          where: { id: res.orderId },
          data: { status: "EXPIRED" },
        });
      });
      logger.info({ orderId: res.orderId }, "reservation.expired");
    } catch (err) {
      logger.error({ orderId: res.orderId, err }, "reaper.error");
    }
  }
}
