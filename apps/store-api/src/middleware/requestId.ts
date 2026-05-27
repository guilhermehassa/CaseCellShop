import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = `req_${crypto.randomUUID()}`;
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
