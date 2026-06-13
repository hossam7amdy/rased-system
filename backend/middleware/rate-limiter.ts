import rateLimit from "express-rate-limit";

export function rateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    message: {
      success: false,
      message: "Too many requests, please try again later.",
    },
  });
}
