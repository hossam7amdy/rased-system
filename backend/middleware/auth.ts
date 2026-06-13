import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "../modules/auth/auth.model.ts";
import { type Config, ConfigToken } from "../shared/config/config.ts";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  student_id?: string | null;
}

function isJwtPayload(value: unknown): value is JwtPayload {
  return typeof value === "object" && value !== null && "id" in value;
}

export function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers.authorization;

    console.log(`🌐 [INCOMING_REQUEST] ${req.method} ${req.originalUrl}`);

    if (!authHeader?.startsWith("Bearer ")) {
      console.error("❌ [AUTH_FAILED] No Bearer token found in headers.");
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
      return;
    }

    const token = authHeader.substring(7);
    const { jwt: jwtConfig } = req.resolve(ConfigToken);

    const decoded = jwt.verify(token, jwtConfig.secret);
    if (!isJwtPayload(decoded)) {
      res.status(401).json({ success: false, message: "Invalid token." });
      return;
    }

    req.user = decoded;
    console.log(
      `✅ [AUTH_SUCCESS] User: ${decoded.email} | Role: ${decoded.role}`,
    );
    next();
  } catch (error) {
    const err = error as Error & { name: string };
    console.error(`🔥 [JWT_ERROR] ${err.message}`);

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
    if (!req.user) {
      console.error("❌ [ROLE_ERROR] No user object found in request.");
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.warn(
        `🚫 [ACCESS_DENIED] User ${req.user.email} (Role: ${req.user.role}) tried to access a restricted route. Allowed: [${allowedRoles}]`,
      );
      res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
      return;
    }

    console.log(`🔓 [ACCESS_GRANTED] Role ${req.user.role} is authorized.`);
    next();
  };
}

export function generateToken(
  user: JwtPayload,
  jwtConfig: Config["jwt"],
): string {
  const opts = {
    expiresIn: jwtConfig.expiresIn,
  } as unknown as jwt.SignOptions;
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      student_id: user.student_id,
    },
    jwtConfig.secret,
    opts,
  );
}

export function generateRefreshToken(
  user: Pick<JwtPayload, "id">,
  jwtConfig: Config["jwt"],
): string {
  const opts = {
    expiresIn: jwtConfig.refreshExpiresIn,
  } as unknown as jwt.SignOptions;
  return jwt.sign({ id: user.id }, jwtConfig.refreshSecret, opts);
}
