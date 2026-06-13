import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import pool from "../config/database.ts";
import { generateRefreshToken, generateToken } from "../middleware/auth.ts";
import type { User } from "../types/models.ts";

const authController = {
  login: async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "البريد الإلكتروني وكلمة المرور مطلوبان.",
      });
      return;
    }

    const result = await pool.query<User & { password_hash: string }>(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: "بيانات الدخول غير صحيحة.",
      });
      return;
    }

    const user = result.rows[0];
    if (!user) {
      res
        .status(401)
        .json({ success: false, message: "بيانات الدخول غير صحيحة." });
      return;
    }
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: "بيانات الدخول غير صحيحة.",
      });
      return;
    }

    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    const { password_hash: _, ...userData } = user;

    res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح.",
      data: { user: userData, accessToken, refreshToken },
    });
  },

  register: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, role, fullName, studentId } = req.body as {
        email: string;
        password: string;
        role: string;
        fullName: string;
        studentId?: string;
      };

      if (!email || !password || !role || !fullName) {
        res.status(400).json({
          success: false,
          message: "جميع الحقول الأساسية مطلوبة.",
        });
        return;
      }

      if (role === "student" && !studentId) {
        res.status(400).json({
          success: false,
          message: "يجب إدخال الرقم الجامعي للطالب.",
        });
        return;
      }

      const existingUser = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [email],
      );

      if (existingUser.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: "هذا البريد الإلكتروني مسجل بالفعل.",
        });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const finalStudentId = role === "student" && studentId ? studentId : null;

      const result = await pool.query(
        `INSERT INTO users (email, password_hash, role, full_name, student_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, role, full_name, student_id, created_at`,
        [email, passwordHash, role, fullName, finalStudentId],
      );

      res.status(201).json({
        success: true,
        message: "تم إنشاء الحساب بنجاح.",
        data: { user: result.rows[0] },
      });
    } catch (error) {
      console.error("Registration error:", error);

      if (
        (error as NodeJS.ErrnoException & { code?: string }).code === "23505"
      ) {
        res.status(409).json({
          success: false,
          message: "البريد الإلكتروني أو الرقم الجامعي موجود مسبقاً.",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء عملية التسجيل.",
      });
    }
  },

  getProfile: async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const result = await pool.query<User>(
      "SELECT id, email, role, full_name, student_id, created_at FROM users WHERE id = $1",
      [userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "المستخدم غير موجود.",
      });
      return;
    }

    res.json({ success: true, data: { user: result.rows[0] } });
  },
};

export default authController;
export const { login, register, getProfile } = authController;
