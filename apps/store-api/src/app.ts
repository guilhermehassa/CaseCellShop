import express, { Request, Response } from "express";
import { requestIdMiddleware } from "./middleware/requestId";
import { errorHandler } from "./middleware/errorHandler";
import { productsRouter } from "./modules/products/products.router";
import ordersRouter from "./modules/orders/orders.router";

export function createApp(): express.Application {
  const app = express();

  // CORS básico para permitir o front local (Vite em localhost:5173)
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Idempotency-Key, X-Debug-Force-Error, X-Erp-Scenario, Authorization",
    );

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });

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
