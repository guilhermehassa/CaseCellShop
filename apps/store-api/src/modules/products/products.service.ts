import { ProductDTO } from "@cc/contracts";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { ProductNotFoundError } from "../../lib/errors";

const CACHE_KEY = "products:list";

function rowToDTO(
  row: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    imageUrl: string;
    inventory: { available: number } | null;
  },
): ProductDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.priceCents,
    imageUrl: row.imageUrl,
    availableQuantity: row.inventory?.available ?? 0,
  };
}

export async function listProducts(): Promise<ProductDTO[]> {
  // Cache-aside: tenta o cache primeiro
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      logger.debug("products.list cache hit");
      return JSON.parse(cached) as ProductDTO[];
    }
  } catch (err) {
    logger.warn({ err }, "Redis get failed — falling through to DB");
  }

  // Miss: lê do banco
  const rows = await prisma.product.findMany({
    where: { active: true },
    include: { inventory: true },
    orderBy: { name: "asc" },
  });

  const dtos = rows.map(rowToDTO);

  // Popula cache
  try {
    await redis.set(CACHE_KEY, JSON.stringify(dtos), "EX", env.CACHE_TTL_SECONDS);
    logger.debug("products.list cache populated");
  } catch (err) {
    logger.warn({ err }, "Redis set failed — response served from DB");
  }

  return dtos;
}

export async function getProductById(id: string): Promise<ProductDTO> {
  const cacheKey = `products:id:${id}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug({ productId: id }, "products.byId cache hit");
      return JSON.parse(cached) as ProductDTO;
    }
  } catch (err) {
    logger.warn({ err }, "Redis get failed — falling through to DB");
  }

  const row = await prisma.product.findFirst({
    where: { id, active: true },
    include: { inventory: true },
  });

  if (!row) {
    throw new ProductNotFoundError();
  }

  const dto = rowToDTO(row);

  try {
    await redis.set(cacheKey, JSON.stringify(dto), "EX", env.CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, "Redis set failed — response served from DB");
  }

  return dto;
}

export async function invalidateProductsCache(): Promise<void> {
  try {
    await redis.del(CACHE_KEY);
    logger.debug("products:list cache invalidated");
  } catch (err) {
    logger.warn({ err }, "Failed to invalidate products cache");
  }
}
