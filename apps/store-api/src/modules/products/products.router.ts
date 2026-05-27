import { Router, Request, Response, NextFunction } from "express";
import { listProducts, getProductById } from "./products.service";
import { logger } from "../../lib/logger";

export const productsRouter = Router();

// GET /api/products
productsRouter.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const products = await listProducts();
    logger.info({ requestId: req.requestId, count: products.length }, "products.list");
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
productsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await getProductById(req.params.id);
    logger.info({ requestId: req.requestId, productId: req.params.id }, "products.getById");
    res.json(product);
  } catch (err) {
    next(err);
  }
});
