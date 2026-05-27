import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createOrder } from "./orders.service";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import type { OrderStatusResponse } from "@cc/contracts";

const router = Router();

// Esquema de validação do body (§4.1)
const createOrderSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
});

// UUID v4 regex
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// POST /api/orders — checkout idempotente, assíncrono (§4.2)
// ---------------------------------------------------------------------------
router.post("/api/orders", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const requestId = req.requestId ?? "req_unknown";

    // 2. Hook de falha temporária determinístico (§6)
    if (env.DEBUG_HOOKS && req.headers["x-debug-force-error"] === "temporary") {
      logger.info({ requestId }, "order.debug_hook_temporary");
      res.status(503).json({
        errorCode: "TEMPORARY_PROCESSING_ERROR",
        message: "Não foi possível processar o pedido agora. Tente novamente em alguns instantes.",
        requestId,
      });
      return;
    }

    // 3a. Validar header Idempotency-Key
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (!idempotencyKey || !UUID_V4.test(idempotencyKey)) {
      res.status(400).json({
        errorCode: "VALIDATION_ERROR",
        message: "Verifique os dados enviados.",
        details: [
          {
            field: "Idempotency-Key",
            message: "Header Idempotency-Key ausente ou inválido (deve ser UUID v4).",
          },
        ],
        requestId,
      });
      return;
    }

    // 3b. Validar body (Zod)
    const parseResult = createOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((e) => ({
        field: e.path.join(".") || "body",
        message: e.message,
      }));
      res.status(400).json({
        errorCode: "VALIDATION_ERROR",
        message: "Verifique os dados enviados.",
        details,
        requestId,
      });
      return;
    }

    const result = await createOrder(idempotencyKey, parseResult.data, requestId);
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders/:id — status do pedido para polling do front (§7)
// ---------------------------------------------------------------------------
router.get("/api/orders/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const requestId = req.requestId ?? "req_unknown";
    const { id } = req.params;

    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      res.status(404).json({
        errorCode: "ORDER_NOT_FOUND",
        message: "Pedido não encontrado.",
        requestId,
      });
      return;
    }

    const messages: Record<string, string> = {
      PENDING_PROCESSING: "Estamos processando seu pedido.",
      PROCESSING: "Estamos processando seu pedido.",
      RETRYING: "Tivemos uma instabilidade e estamos tentando novamente.",
      CONFIRMED: "Pedido confirmado!",
      FAILED: "Não foi possível concluir seu pedido. Nenhuma cobrança foi feita.",
      EXPIRED: "Sua reserva expirou. Tente novamente.",
      CANCELED: "Pedido cancelado.",
    };

    const body: OrderStatusResponse = {
      orderId: order.id,
      status: order.status,
      productId: order.productId,
      quantity: order.quantity,
      totalCents: order.totalCents,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      message: messages[order.status] ?? "",
      requestId,
    };

    logger.info({ orderId: order.id, status: order.status, requestId }, "order.status_polled");
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
});

export default router;
