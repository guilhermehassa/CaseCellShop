import { Request, Response, NextFunction } from "express";
import { AppError, InsufficientStockError, ValidationError } from "../lib/errors";
import { logger } from "../lib/logger";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? "unknown";

  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      errorCode: err.code,
      message: err.message,
      requestId,
    };

    if (err instanceof ValidationError && err.details) {
      body.details = err.details;
    }

    if (err instanceof InsufficientStockError) {
      body.availableQuantity = err.availableQuantity;
    }

    res.status(err.status).json(body);
    return;
  }

  logger.error({ err, requestId }, "Unhandled error");

  res.status(500).json({
    errorCode: "INTERNAL_ERROR",
    message: "Ocorreu um erro interno. Tente novamente mais tarde.",
    requestId,
  });
}
