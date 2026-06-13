import { Router } from "express";
import { checkRole, verifyToken } from "../../middleware/auth.ts";
import { AttendanceService } from "./attendance.service.ts";
import {
  CreateSessionSchema,
  ManualOverrideSchema,
  ScanQRSchema,
} from "./attendance.validator.ts";
import { QRTokenService } from "./qr.service.ts";

const router = Router();

router.get(
  "/attendance/active-sessions",
  verifyToken,
  checkRole("student"),
  async (req, res) => {
    const service = req.resolve(AttendanceService);
    const data = await service.getActiveSessions(req.user!.id);
    return res.json({ success: true, data });
  },
);

router.post(
  "/attendance/sessions",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const payload = req.validBody(CreateSessionSchema);
    const service = req.resolve(AttendanceService);
    const qrTokenService = req.resolve(QRTokenService);
    const session = await service.createSession({
      ...payload,
      professorId: req.user!.id,
    });

    if (req.io) {
      // Best-effort: QR rotation failures must not fail session creation.
      try {
        qrTokenService.startRotation(session.course_id, req.io);
      } catch (qrError) {
        console.error("❌ [QR_SERVICE_ERROR]:", qrError);
      }
    }

    return res.status(201).json({
      success: true,
      message: "تم بدء جلسة التحضير بنجاح.",
      data: { session },
    });
  },
);

router.patch(
  "/attendance/sessions/:sessionId/end",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const { sessionId } = req.params as { sessionId: string };
    const service = req.resolve(AttendanceService);
    await service.endSession(sessionId, req.user!.id);
    return res.json({ success: true, message: "Session ended successfully." });
  },
);

router.post(
  "/attendance/scan",
  verifyToken,
  checkRole("student"),
  async (req, res) => {
    const { token } = req.validBody(ScanQRSchema);
    const service = req.resolve(AttendanceService);
    const result = await service.scanQR({ token, studentId: req.user!.id });

    if (req.io) {
      const payload = {
        studentId: req.user!.id,
        studentName: req.user!.full_name,
        studentUniversityId: req.user!.student_id,
        scannedAt: new Date(),
        sessionId: result.sessionId,
        courseId: result.courseId,
        attendanceStats: {
          attended: result.attended,
          total: result.total,
          percentage: result.percentage,
        },
      };

      req.io.to(result.courseId.toString()).emit("student_attended", payload);
      req.io.to(result.sessionId.toString()).emit("student_attended", payload);
    }

    return res.json({
      success: true,
      message: "تم تسجيل الحضور بنجاح! ✅",
      data: {
        sessionId: result.sessionId,
        courseId: result.courseId,
        attendancePercentage: result.percentage,
      },
    });
  },
);

router.get(
  "/attendance/current-qr/:courseId",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const { courseId } = req.params as { courseId: string };
    const service = req.resolve(AttendanceService);
    const data = await service.getCurrentQR(courseId);
    return res.json({ success: true, data });
  },
);

router.get("/attendance/sessions/:sessionId", verifyToken, async (req, res) => {
  const { sessionId } = req.params as { sessionId: string };
  const service = req.resolve(AttendanceService);
  const records = await service.getSessionAttendance(sessionId);
  return res.json({ success: true, data: { records } });
});

router.get(
  "/attendance/student",
  verifyToken,
  checkRole("student"),
  async (req, res) => {
    const service = req.resolve(AttendanceService);
    const attendance = await service.getStudentAttendance(req.user!.id);
    return res.json({ success: true, data: { attendance } });
  },
);

router.post(
  "/attendance/manual-override",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const payload = req.validBody(ManualOverrideSchema);
    const service = req.resolve(AttendanceService);
    const record = await service.manualOverride({
      ...payload,
      professorId: req.user!.id,
    });
    return res.json({
      success: true,
      message: "Manual attendance recorded.",
      data: { record },
    });
  },
);

export default router;
