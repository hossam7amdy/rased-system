import type { Request, Response } from "express";
import { Router } from "express";
import {
  exportAttendance,
  getCourseAnalytics,
  getStudentAnalytics,
} from "../controllers/analyticsController.ts";
import {
  createSession,
  endSession,
  getActiveSessions,
  getCurrentQR,
  getSessionAttendance,
  getStudentAttendance,
  manualOverride,
  scanQR,
} from "../controllers/attendanceController.ts";
import { getProfile, login, register } from "../controllers/authController.ts";
import { checkRole, verifyToken } from "../middleware/auth.ts";
import adminRouter from "../modules/admin/admin.router.ts";
import coursesRouter from "../modules/courses/courses.router.ts";

const router = Router();

// ============ AUTH ROUTES ============
router.post("/auth/login", login);
router.post(
  "/auth/register",
  verifyToken,
  checkRole("admin", "professor"),
  register,
);
router.get("/auth/profile", verifyToken, getProfile);

// ============ COURSES ROUTES ============
router.use(coursesRouter);

// ============ ADMIN ROUTES ============
router.use(adminRouter);

// ============ ATTENDANCE ROUTES ============
router.get(
  "/attendance/active-sessions",
  verifyToken,
  checkRole("student"),
  getActiveSessions,
);

router.post(
  "/attendance/sessions",
  verifyToken,
  checkRole("professor"),
  createSession,
);
router.patch(
  "/attendance/sessions/:sessionId/end",
  verifyToken,
  checkRole("professor"),
  endSession,
);

router.post("/attendance/scan", verifyToken, checkRole("student"), scanQR);

router.get(
  "/attendance/current-qr/:courseId",
  verifyToken,
  checkRole("professor"),
  getCurrentQR,
);
router.get(
  "/attendance/sessions/:sessionId",
  verifyToken,
  getSessionAttendance,
);
router.get(
  "/attendance/student",
  verifyToken,
  checkRole("student"),
  getStudentAttendance,
);
router.post(
  "/attendance/manual-override",
  verifyToken,
  checkRole("professor"),
  manualOverride,
);

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
