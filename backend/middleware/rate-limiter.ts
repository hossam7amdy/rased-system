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

// Tighter limit on login to blunt credential brute-force; the global limiter's
// 1000/min is far too loose for an auth endpoint.
export function loginRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
      success: false,
      message: "Too many login attempts, please try again later.",
    },
  });
}
