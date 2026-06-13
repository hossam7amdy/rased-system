import { inject } from "injectus";
import jwt from "jsonwebtoken";
import { type Config, ConfigToken } from "../../shared/config/config.ts";
import { UnauthorizedError } from "../../shared/errors.ts";
import type { UserRole } from "./auth.model.ts";

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  student_id?: string | null;
}

export function isJwtPayload(value: unknown): value is JwtPayload {
  return typeof value === "object" && value !== null && "id" in value;
}

export class JwtService {
  private readonly jwtConfig: Config["jwt"];

  constructor(config = inject(ConfigToken)) {
    this.jwtConfig = config.jwt;
  }

  signAccess(user: JwtPayload): string {
    const opts = {
      expiresIn: this.jwtConfig.expiresIn,
    } as unknown as jwt.SignOptions;
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        student_id: user.student_id,
      },
      this.jwtConfig.secret,
      opts,
    );
  }

  signRefresh(user: Pick<JwtPayload, "id">): string {
    const opts = {
      expiresIn: this.jwtConfig.refreshExpiresIn,
    } as unknown as jwt.SignOptions;
    return jwt.sign({ id: user.id }, this.jwtConfig.refreshSecret, opts);
  }

  verify(token: string): JwtPayload {
    const decoded = jwt.verify(token, this.jwtConfig.secret);
    if (!isJwtPayload(decoded)) {
      throw new UnauthorizedError("Invalid token.");
    }
    return decoded;
  }
}
