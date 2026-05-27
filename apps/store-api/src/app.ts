import express, { Request, Response } from "express";
import { requestIdMiddleware } from "./middleware/requestId";
import { errorHandler } from "./middleware/errorHandler";
import { productsRouter } from "./modules/products/products.router";
import ordersRouter from "./modules/orders/orders.router";

export function createApp(): express.Application {
  const app = express();

  // Parsers
  app.use(express.json());

  // Request ID em todas as requisições
  app.use(requestIdMiddleware);

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Rotas de domínio
  app.use("/api/products", productsRouter);
  app.use(ordersRouter);

  // Error handler (deve ser o último middleware)
  app.use(errorHandler);

  return app;
}
