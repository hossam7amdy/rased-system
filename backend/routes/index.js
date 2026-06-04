import { Router } from "express";
import pool from "../config/database.js";
import {
  exportAttendance,
  getCourseAnalytics,
  getStudentAnalytics,
} from "../controllers/analyticsController.js";
import {
  createSession,
  endSession,
  getActiveSessions,
  getCurrentQR,
  getSessionAttendance,
  getStudentAttendance,
  manualOverride,
  scanQR,
} from "../controllers/attendanceController.js";
import { getProfile, login, register } from "../controllers/authController.js";
import {
  createCourse,
  deleteCourse,
  enrollStudentInCourse,
  enrollStudents,
  getCourseDetails,
  getCourseStudents,
  getProfessorCourses,
  getStudentCourses,
} from "../controllers/coursesController.js";
import { checkRole, verifyToken } from "../middleware/auth.js";

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
router.post("/courses", verifyToken, checkRole("professor"), createCourse);
router.delete(
  "/courses/:courseId",
  verifyToken,
  checkRole("professor"),
  deleteCourse,
);

// المسار الجديد الذي سيستخدمه الطالب لعرض مواده في الـ Dashboard
router.get(
  "/courses/my-courses",
  verifyToken,
  checkRole("student"),
  getStudentCourses,
);

router.get("/courses", verifyToken, (req, res) => {
  if (req.user.role === "professor") {
    return getProfessorCourses(req, res);
  } else if (req.user.role === "student") {
    return getStudentCourses(req, res);
  }
  return res.status(403).json({ success: false, message: "Access denied." });
});

router.get("/courses/:courseId", verifyToken, getCourseDetails);
router.post(
  "/courses/:courseId/enroll",
  verifyToken,
  checkRole("professor"),
  enrollStudents,
);
router.get(
  "/courses/:courseId/students",
  verifyToken,
  checkRole("professor"),
  getCourseStudents,
);

// ============ ATTENDANCE ROUTES ============
// ملاحظة: يمكنك الإبقاء على active-sessions أو حذفها، لكن الطالب الآن سيعتمد على my-courses
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

// المسار الأهم: معالجة عملية المسح بناءً على المادة أو الجلسة
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

// ============ ADMIN ROUTES ============
import {
  enrollBulk,
  enrollImport,
  getAllCourses,
  getAllStudents,
} from "../controllers/adminController.js";

router.get(
  "/admin/users",
  verifyToken,
  checkRole("admin"),
  async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, email, role, full_name, student_id, created_at FROM users ORDER BY created_at DESC",
      );
      res.json({ success: true, data: { users: result.rows } });
    } catch (_error) {
      res
        .status(500)
        .json({ success: false, message: "Error fetching users." });
    }
  },
);

// Student & course lists (support ?q= search)
router.get("/admin/students", verifyToken, checkRole("admin"), getAllStudents);
router.get("/admin/courses", verifyToken, checkRole("admin"), getAllCourses);

// Single enroll (legacy — kept for backward compat)
router.post(
  "/admin/enroll",
  verifyToken,
  checkRole("admin"),
  enrollStudentInCourse,
);

// Bulk enroll: N students × M courses in one shot
router.post("/admin/enroll-bulk", verifyToken, checkRole("admin"), enrollBulk);

// Excel import: parsed rows from the frontend
router.post(
  "/admin/enroll-import",
  verifyToken,
  checkRole("admin"),
  enrollImport,
);

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
