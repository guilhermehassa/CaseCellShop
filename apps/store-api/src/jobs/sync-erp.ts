import { env } from "../config/env";
import { logger } from "../lib/logger";
import { prisma, Prisma } from "../lib/prisma";
import { invalidateProductsCache } from "../modules/products/products.service";

interface ErpProduct {
  sku: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  active: boolean;
  stock: number;
}

export async function syncErp(): Promise<void> {
  logger.info("sync-erp started");

  const url = `${env.ERP_BASE_URL}/erp/products`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ERP responded with status ${response.status} for GET ${url}`);
  }

  const products: ErpProduct[] = (await response.json()) as ErpProduct[];

  let count = 0;

  for (const p of products) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Upsert produto
      await tx.product.upsert({
        where: { id: p.sku },
        create: {
          id: p.sku,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          imageUrl: p.imageUrl,
          active: p.active,
          lastSyncedAt: new Date(),
        },
        update: {
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          imageUrl: p.imageUrl,
          active: p.active,
          lastSyncedAt: new Date(),
        },
      });

      // Lê reservas correntes para calcular disponível
      const inv = await tx.inventory.findUnique({ where: { productId: p.sku } });
      const reservedAtual = inv?.reserved ?? 0;
      const novoAvailable = Math.max(0, p.stock - reservedAtual);

      // Upsert inventário
      await tx.inventory.upsert({
        where: { productId: p.sku },
        create: {
          productId: p.sku,
          available: novoAvailable,
          reserved: reservedAtual,
        },
        update: {
          available: novoAvailable,
          reserved: reservedAtual,
        },
      });
    });

    count++;
  }

  // Invalida cache do catálogo para forçar releitura
  await invalidateProductsCache();

  logger.info({ count }, "sync.completed");
}
