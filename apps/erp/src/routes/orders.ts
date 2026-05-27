import { Router } from "express";
import { z } from "zod";
import { prisma, Prisma } from "../lib/prisma";
import { applyChaos } from "../lib/chaos";
import { logger } from "../lib/logger";

const router = Router();

const orderBodySchema = z.object({
  externalRef: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

router.post("/erp/orders", async (req, res, next) => {
  try {
    // 1. Validar body
    const parseResult = orderBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "ERP_INVALID_REQUEST", details: parseResult.error.flatten() });
      return;
    }
    const { externalRef, sku, quantity } = parseResult.data;

    // 2. Idempotência: verificar se já existe pedido com esse externalRef
    const existing = await prisma.erpOrder.findUnique({ where: { externalRef } });
    if (existing) {
      logger.info({ externalRef, status: existing.status }, "Idempotent return for existing order");
      if (existing.status === "INVOICED") {
        res.status(200).json({
          erpOrderId: existing.id,
          externalRef: existing.externalRef,
          status: existing.status,
          invoiceId: existing.invoiceId,
        });
        return;
      }
      if (existing.status === "REJECTED") {
        res.status(200).json({
          erpOrderId: existing.id,
          externalRef: existing.externalRef,
          status: existing.status,
          reason: existing.rejectReason,
        });
        return;
      }
      // status RECEIVED ou outro: retorna estado atual
      res.status(200).json({
        erpOrderId: existing.id,
        externalRef: existing.externalRef,
        status: existing.status,
      });
      return;
    }

    // 3. Verificar se produto existe
    const product = await prisma.erpProduct.findUnique({ where: { sku } });
    if (!product) {
      res.status(404).json({ error: "ERP_PRODUCT_NOT_FOUND" });
      return;
    }

    // 4. Aplicar chaos (passa flaky do produto)
    const chaosResult = await applyChaos(req, product.flaky);
    logger.debug({ chaosResult, sku, externalRef }, "Chaos result");

    if (chaosResult === "temporary_failure") {
      res.status(503).json({ error: "ERP_TEMPORARY_FAILURE" });
      return;
    }

    if (chaosResult === "timeout") {
      // O sleep já ocorreu dentro de applyChaos; responde como falha temporária
      res.status(503).json({ error: "ERP_TEMPORARY_FAILURE" });
      return;
    }

    if (chaosResult === "reject") {
      const rejectedOrder = await prisma.erpOrder.create({
        data: {
          externalRef,
          sku,
          quantity,
          status: "REJECTED",
          rejectReason: "INSUFFICIENT_STOCK_AT_ERP",
        },
      });
      res.status(409).json({
        status: "REJECTED",
        reason: "INSUFFICIENT_STOCK_AT_ERP",
      });
      logger.info({ externalRef, sku, erpOrderId: rejectedOrder.id }, "Order rejected by chaos");
      return;
    }

    // 5. Transação atômica: verificar estoque e decrementar
    const invoiceId = "inv_" + crypto.randomUUID().replace(/-/g, "");

    try {
      const invoicedOrder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Lê produto com lock dentro da transação
        const lockedProduct = await tx.erpProduct.findUnique({ where: { sku } });

        if (!lockedProduct || lockedProduct.stock < quantity) {
          // Cria pedido rejeitado e lança erro para rollback do findUnique
          // mas a criação do ErpOrder deve sobreviver, então fazemos fora do throw
          // Solução: criar a order de rejeição aqui e retornar um sentinel
          const rejected = await tx.erpOrder.create({
            data: {
              externalRef,
              sku,
              quantity,
              status: "REJECTED",
              rejectReason: "INSUFFICIENT_STOCK_AT_ERP",
            },
          });
          return { __rejected: true, order: rejected } as const;
        }

        // Decremento atômico condicional
        const updated = await tx.erpProduct.updateMany({
          where: { sku, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });

        if (updated.count === 0) {
          // Corrida — outro processo decrementou antes
          const rejected = await tx.erpOrder.create({
            data: {
              externalRef,
              sku,
              quantity,
              status: "REJECTED",
              rejectReason: "INSUFFICIENT_STOCK_AT_ERP",
            },
          });
          return { __rejected: true, order: rejected } as const;
        }

        const order = await tx.erpOrder.create({
          data: {
            externalRef,
            sku,
            quantity,
            status: "INVOICED",
            invoiceId,
          },
        });

        return { __rejected: false, order } as const;
      });

      if (invoicedOrder.__rejected) {
        res.status(409).json({
          status: "REJECTED",
          reason: "INSUFFICIENT_STOCK_AT_ERP",
        });
        return;
      }

      logger.info(
        { erpOrderId: invoicedOrder.order.id, externalRef, invoiceId },
        "Order invoiced successfully"
      );

      res.status(201).json({
        erpOrderId: invoicedOrder.order.id,
        externalRef: invoicedOrder.order.externalRef,
        status: "INVOICED",
        invoiceId: invoicedOrder.order.invoiceId,
      });
    } catch (txErr) {
      next(txErr);
    }
  } catch (err) {
    next(err);
  }
});

export default router;
