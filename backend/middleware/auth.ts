import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../modules/auth/auth.model.ts";
import { type JwtPayload, JwtService } from "../modules/auth/jwt.service.ts";
import { LoggerToken } from "../shared/logger/logger.ts";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const logger = req.resolve(LoggerToken);
  try {
    const authHeader = req.headers.authorization;

    logger.debug(
      { method: req.method, url: req.originalUrl },
      "🌐 [INCOMING_REQUEST]",
    );

    if (!authHeader?.startsWith("Bearer ")) {
      logger.warn("❌ [AUTH_FAILED] no Bearer token in headers");
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = req.resolve(JwtService).verify(token);

    req.user = decoded;
    logger.debug(
      { email: decoded.email, role: decoded.role },
      "✅ [AUTH_SUCCESS]",
    );
    next();
  } catch (error) {
    const err = error as Error & { name: string };
    logger.warn({ err }, "🔥 [JWT_ERROR]");

    if (err.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
      return;
    }

    res.status(401).json({ success: false, message: "Invalid token." });
  }
}

export function checkRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const logger = req.resolve(LoggerToken);
    if (!req.user) {
      logger.warn("❌ [ROLE_ERROR] no user object in request");
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        { email: req.user.email, role: req.user.role, allowedRoles },
        "🚫 [ACCESS_DENIED] insufficient permissions",
      );
      res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
      return;
    }

    logger.debug({ role: req.user.role }, "🔓 [ACCESS_GRANTED]");
    next();
  };
}
