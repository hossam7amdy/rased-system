import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../shared/errors.ts";

export function errorHandler(
  err: Error,
  _req: Request,
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

  console.error("🔥 Server Error:", err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "حدث خطأ في الخادم. يرجى المحاولة لاحقًا."
        : err.message,
  });
}
