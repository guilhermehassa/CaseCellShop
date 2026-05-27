import { Job } from "bullmq";
import { prisma, Prisma } from "../lib/prisma";
import { commitReservation, releaseReservation } from "../modules/orders/orders.repo";
import { logger } from "../lib/logger";
import { env } from "../config/env";

export async function processOrder(job: Job<{ orderId: string }>): Promise<void> {
  const { orderId } = job.data;

  // Carrega o pedido
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  // Idempotente: se já em estado terminal, retorna sem fazer nada
  if (["CONFIRMED", "FAILED", "EXPIRED", "CANCELED"].includes(order.status)) return;

  // Marca como PROCESSING e incrementa contador de tentativas
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  logger.info({ orderId, attempt: job.attemptsMade + 1 }, "order.processing");

  // Chama o ERP com timeout controlado via AbortController
  let resp: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ERP_TIMEOUT_MS);
    try {
      resp = await fetch(`${env.ERP_BASE_URL}/erp/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalRef: orderId,
          sku: order.productId,
          quantity: order.quantity,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (fetchErr: any) {
    // Timeout (AbortError) ou erro de rede (ECONNREFUSED, ENOTFOUND, etc.)
    const errMsg = `NETWORK_ERROR: ${fetchErr.message}`;

    if (job.attemptsMade + 1 >= env.ORDER_MAX_ATTEMPTS) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "FAILED", lastError: errMsg },
        });
        await releaseReservation(tx, orderId);
      });
      logger.info({ orderId, reason: "MAX_ATTEMPTS_NETWORK" }, "order.failed");
      return; // Não relança — esgotou
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "RETRYING", lastError: errMsg },
    });
    logger.info({ orderId, attempt: job.attemptsMade + 1 }, "order.retrying");
    throw fetchErr; // Relança para BullMQ agendar retry com backoff
  }

  // 200/201 — ERP confirmou (ou já havia confirmado: idempotência via externalRef)
  if (resp.status === 200 || resp.status === 201) {
    const data = (await resp.json()) as { erpOrderId: string; invoiceId: string };
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "CONFIRMED",
          erpOrderId: data.erpOrderId,
          invoiceId: data.invoiceId,
        },
      });
      await commitReservation(tx, orderId);
    });
    logger.info({ orderId, erpOrderId: data.erpOrderId }, "order.confirmed");
    return;
  }

  // 409 — ERP rejeitou definitivamente (sem estoque no ERP): sem retry
  if (resp.status === 409) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "FAILED", lastError: "ERP_REJECTED" },
      });
      await releaseReservation(tx, orderId);
    });
    logger.info({ orderId, reason: "ERP_REJECTED" }, "order.failed");
    return; // Não relança — não adianta retry
  }

  // 503 ou outro status transitório: falha temporária
  const tempErr = new Error(`ERP_TEMPORARY_FAILURE: HTTP ${resp.status}`);

  if (job.attemptsMade + 1 >= env.ORDER_MAX_ATTEMPTS) {
    // Tentativas esgotadas: falha definitiva
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "FAILED", lastError: tempErr.message },
      });
      await releaseReservation(tx, orderId);
    });
    logger.info({ orderId, reason: "MAX_ATTEMPTS" }, "order.failed");
    return; // Não relança — esgotou
  }

  // Ainda há tentativas: reagenda com backoff exponencial
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "RETRYING", lastError: tempErr.message },
  });
  logger.info({ orderId, attempt: job.attemptsMade + 1 }, "order.retrying");
  throw tempErr; // Relança para BullMQ agendar retry com backoff
}
