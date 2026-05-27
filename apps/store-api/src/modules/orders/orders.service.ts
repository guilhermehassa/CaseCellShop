import { prisma, Prisma } from "../../lib/prisma";
import { requestHash } from "../../lib/hash";
import { atomicReserve } from "./orders.repo";
import { enqueueOrder } from "../../queue/orderQueue";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import {
  ProductNotFoundError,
  InsufficientStockError,
  IdempotencyReuseError,
} from "../../lib/errors";
import type { CreateOrderRequest, CreateOrderAccepted } from "@cc/contracts";

export async function createOrder(
  idempotencyKey: string,
  body: CreateOrderRequest,
  requestId: string,
): Promise<{ status: 202 | 200; body: CreateOrderAccepted }> {
  // 4. Hash estável do payload normalizado
  const hash = requestHash(body);

  // 5. Verificar idempotência — SELECT antes da transação
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: idempotencyKey },
    include: { order: true },
  });

  if (existing) {
    if (existing.requestHash === hash) {
      logger.info(
        { orderId: existing.orderId, idempotencyKey, requestId },
        "order.duplicate",
      );
      return {
        status: 200,
        body: {
          orderId: existing.orderId,
          status: existing.order.status,
          message: "Esta tentativa de compra já foi recebida anteriormente.",
          requestId,
        },
      };
    }
    throw new IdempotencyReuseError();
  }

  // 6. Verificar produto (active=true)
  const product = await prisma.product.findFirst({
    where: { id: body.productId, active: true },
  });
  if (!product) throw new ProductNotFoundError();

  // 7. Transação: reserva atômica + Order + Reservation + IdempotencyKey
  const ttlMs = env.RESERVATION_TTL_MINUTES * 60 * 1000;

  let order: { id: string; status: string };

  try {
    order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // a. Reserva atômica — UPDATE condicional (nunca falha silenciosamente)
      try {
        await atomicReserve(tx, body.productId, body.quantity);
      } catch (e: any) {
        if (e.code === "INSUFFICIENT_STOCK") {
          throw new InsufficientStockError(e.availableQuantity);
        }
        throw e;
      }

      // b. Criar Order
      const newOrder = await tx.order.create({
        data: {
          productId: body.productId,
          quantity: body.quantity,
          unitPriceCents: product.priceCents,
          totalCents: product.priceCents * body.quantity,
          customerName: body.customer.name,
          customerEmail: body.customer.email,
          status: "PENDING_PROCESSING",
        },
      });

      // c. Criar Reservation
      await tx.reservation.create({
        data: {
          orderId: newOrder.id,
          productId: body.productId,
          quantity: body.quantity,
          status: "ACTIVE",
          expiresAt: new Date(Date.now() + ttlMs),
        },
      });

      // d. Criar IdempotencyKey (PK — colisão simultânea provoca conflito P2002)
      await tx.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          requestHash: hash,
          orderId: newOrder.id,
        },
      });

      return newOrder;
    });
  } catch (err: any) {
    // Corrida de inserção: outra requisição com a mesma key venceu a transação
    if (err?.code === "P2002" && err?.meta?.target?.includes("key")) {
      const race = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
        include: { order: true },
      });
      if (race && race.requestHash === hash) {
        logger.info(
          { orderId: race.orderId, idempotencyKey, requestId },
          "order.duplicate_race",
        );
        return {
          status: 200,
          body: {
            orderId: race.orderId,
            status: race.order.status,
            message: "Esta tentativa de compra já foi recebida anteriormente.",
            requestId,
          },
        };
      }
      throw new IdempotencyReuseError();
    }
    // Propaga InsufficientStockError e demais erros conhecidos
    throw err;
  }

  // 8. Enqueue fora da transação — se falhar, o reaper recupera pedidos órfãos
  try {
    await enqueueOrder(order.id);
  } catch (err) {
    logger.error({ orderId: order.id, requestId, err }, "order.enqueue_failed");
    // Não lança: pedido foi criado; o reservation-reaper irá reenfileirar
  }

  // 9. Resposta 202 — aceito para processamento assíncrono
  logger.info(
    { orderId: order.id, idempotencyKey, requestId, productId: body.productId },
    "order.received",
  );

  return {
    status: 202,
    body: {
      orderId: order.id,
      status: "PENDING_PROCESSING",
      message: "Pedido recebido e está sendo processado.",
      requestId,
    },
  };
}
