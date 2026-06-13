import bcrypt from "bcryptjs";
import { inject } from "injectus";
import { DatabaseError } from "pg";
import { generateRefreshToken, generateToken } from "../../middleware/auth.ts";
import { type Config, ConfigToken } from "../../shared/config/config.ts";
import { Database } from "../../shared/database/database.ts";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../../shared/errors.ts";
import type { LoginResult, RegisterDto } from "./auth.dto.ts";
import type { AuthenticatedUser, User } from "./auth.model.ts";

export class AuthService {
  private readonly db: Database;
  private readonly config: Config;
  constructor(db = inject(Database), config = inject(ConfigToken)) {
    this.db = db;
    this.config = config;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const result = await this.db.query<User>(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );

    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedError("بيانات الدخول غير صحيحة.");
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new UnauthorizedError("بيانات الدخول غير صحيحة.");
    }

    const accessToken = generateToken(user, this.config.jwt);
    const refreshToken = generateRefreshToken(user, this.config.jwt);

    const { password_hash: _password_hash, ...userData } = user;

    return { user: userData, accessToken, refreshToken };
  }

  async register(input: RegisterDto): Promise<AuthenticatedUser> {
    const { email, password, role, fullName, studentId } = input;

    const existingUser = await this.db.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictError("هذا البريد الإلكتروني مسجل بالفعل.");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const finalStudentId = role === "student" && studentId ? studentId : null;

    try {
      const result = await this.db.query(
        `INSERT INTO users (email, password_hash, role, full_name, student_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, role, full_name, student_id, created_at`,
        [email, passwordHash, role, fullName, finalStudentId],
      );

      return result.rows[0] as AuthenticatedUser;
    } catch (error) {
      if (error instanceof DatabaseError && error.code === "23505") {
        throw new ConflictError(
          "البريد الإلكتروني أو الرقم الجامعي موجود مسبقاً.",
        );
      }
      throw error;
    }
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const result = await this.db.query<AuthenticatedUser>(
      "SELECT id, email, role, full_name, student_id, created_at FROM users WHERE id = $1",
      [userId],
    );

    const user = result.rows[0];
    if (!user) {
      throw new NotFoundError("المستخدم غير موجود.");
    }

    return user;
  }
}
