import type { Request, Response } from "express";
import { Router } from "express";
import {
  exportAttendance,
  getCourseAnalytics,
  getStudentAnalytics,
} from "../controllers/analyticsController.ts";
import { checkRole, verifyToken } from "../middleware/auth.ts";
import adminRouter from "../modules/admin/admin.router.ts";
import attendanceRouter from "../modules/attendance/attendance.router.ts";
import authRouter from "../modules/auth/auth.router.ts";
import coursesRouter from "../modules/courses/courses.router.ts";

const router = Router();

// ============ AUTH ROUTES ============
router.use(authRouter);

// ============ COURSES ROUTES ============
router.use(coursesRouter);

// ============ ADMIN ROUTES ============
router.use(adminRouter);

// ============ ATTENDANCE ROUTES ============
router.use(attendanceRouter);

// ============ ANALYTICS ROUTES ============
router.get(
  "/analytics/course/:courseId",
  verifyToken,
  checkRole("professor"),
  getCourseAnalytics,
);
router.get(
  "/analytics/student",
  verifyToken,
  checkRole("student"),
  getStudentAnalytics,
);
router.get(
  "/analytics/export",
  verifyToken,
  checkRole("professor"),
  exportAttendance,
);

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
