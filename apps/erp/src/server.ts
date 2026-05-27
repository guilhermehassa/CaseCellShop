import express, { Request, Response, NextFunction } from "express";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";

export function createApp() {
  const app = express();

  // Middleware: parse JSON
  app.use(express.json());

  // Middleware: request ID
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { requestId: string }).requestId =
      "req_" + crypto.randomUUID().replace(/-/g, "");
    next();
  });

  // Middleware: request logger
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info(
        {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          durationMs: Date.now() - start,
          requestId: (req as Request & { requestId?: string }).requestId,
        },
        "request completed"
      );
    });
    next();
  });

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Rotas ERP
  app.use(productsRouter);
  app.use(ordersRouter);

  // Error handler global
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: err.message, stack: err.stack }, "Unhandled error");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(env.ERP_PORT, () => {
    logger.info({ port: env.ERP_PORT }, "ERP server started");
  });
}
