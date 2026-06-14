import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../shared/errors.ts";
import { LoggerToken } from "../shared/logger/logger.ts";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  req.resolve(LoggerToken).error({ err }, "🔥 Server Error");
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "حدث خطأ في الخادم. يرجى المحاولة لاحقًا."
        : err.message,
  });
}
