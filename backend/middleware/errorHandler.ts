import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("🔥 Server Error:", err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "حدث خطأ في الخادم. يرجى المحاولة لاحقًا."
        : (err as Error).message,
  });
};
