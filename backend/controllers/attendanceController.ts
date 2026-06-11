import ExcelJS from "exceljs";
import type { Request, Response } from "express";
import pool from "../config/database.ts";
import cacheClient from "../config/redis.ts";
import qrTokenService, {
  ROTATION_INTERVAL_MS,
} from "../services/qrTokenService.ts";
import TokenEncryption from "../utils/tokenEncryption.ts";

const attendanceController = {
  createSession: async (req: Request, res: Response): Promise<void> => {
    try {
      const { courseId, sessionName, sessionDate } = req.body as {
        courseId: string;
        sessionName?: string;
        sessionDate?: string;
      };

      if (!courseId) {
        res.status(400).json({
          success: false,
          message: "معرف المادة مطلوب.",
        });
        return;
      }

      const professorId = req.user!.id;

      console.log(
        `🚀 [ATTEMPT_START] Professor: ${professorId} | Course: ${courseId}`,
      );

      const courseCheck = await pool.query(
        "SELECT id FROM courses WHERE id = $1 AND professor_id = $2",
        [courseId, professorId],
      );

      if (courseCheck.rows.length === 0) {
        console.warn(
          `⚠️ [AUTH_DENIED] Professor ${professorId} tried to access course ${courseId}`,
        );
        res.status(403).json({
          success: false,
          message: "غير مسموح لك بإنشاء جلسة لهذه المادة.",
        });
        return;
      }

      await pool.query(
        "UPDATE attendance_sessions SET is_active = false WHERE course_id = $1 AND is_active = true",
        [courseId],
      );

      const finalDate = sessionDate ?? new Date().toLocaleDateString("en-CA");

      const result = await pool.query(
        `INSERT INTO attendance_sessions
         (course_id, session_name, session_date, start_time, is_active)
         VALUES ($1, $2, $3, NOW(), true)
         RETURNING *`,
        [courseId, sessionName ?? "محاضرة جديدة", finalDate],
      );

      const session = result.rows[0];
      console.log(
        `✅ [SESSION_CREATED] ID: ${(session as { id: string }).id} | Course: ${courseId}`,
      );

      if (req.io) {
        try {
          qrTokenService.startRotation(courseId, req.io);
          console.log(`🔄 [QR_ROTATION] Started using CourseID: ${courseId}`);
        } catch (qrError) {
          console.error("❌ [QR_SERVICE_ERROR]:", qrError);
        }
      }

      res.status(201).json({
        success: true,
        message: "تم بدء جلسة التحضير بنجاح.",
        data: { session },
      });
    } catch (error) {
      console.error("🔥 [CREATE_SESSION_ERROR]:", error);
      res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء إنشاء الجلسة.",
      });
    }
  },

  endSession: async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const professorId = req.user!.id;

      const sessionCheck = await pool.query(
        `SELECT s.id, s.course_id FROM attendance_sessions s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = $1 AND c.professor_id = $2`,
        [sessionId, professorId],
      );

      if (sessionCheck.rows.length === 0) {
        res.status(403).json({ success: false, message: "Access denied." });
        return;
      }

      const courseId = (sessionCheck.rows[0] as { course_id: string })
        .course_id;
      qrTokenService.stopRotation(courseId);

      await pool.query(
        `UPDATE attendance_sessions
         SET is_active = false, end_time = NOW()
         WHERE id = $1`,
        [sessionId],
      );

      res.json({ success: true, message: "Session ended successfully." });
    } catch (error) {
      console.error("❌ End session error:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while ending the session.",
      });
    }
  },

  scanQR: async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.body as { token: string };
      const studentId = req.user!.id;

      const validation = await qrTokenService.validateToken(token);

      if (!validation.valid) {
        console.error(`❌ [REJECTED] ${validation.message}`);
        res.status(400).json({
          success: false,
          message: validation.message,
        });
        return;
      }

      const courseId = validation.courseId;
      console.log(
        `🚀 محاولة تحضير: الطالب ${req.user!.email} في المادة ${courseId}`,
      );

      const enrollmentCheck = await pool.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
        [studentId, courseId],
      );

      if (enrollmentCheck.rows.length === 0) {
        res.status(403).json({
          success: false,
          message: "عذراً، أنت غير مسجل في هذه المادة.",
        });
        return;
      }

      const activeSession = await pool.query(
        "SELECT id FROM attendance_sessions WHERE course_id = $1 AND is_active = true LIMIT 1",
        [courseId],
      );

      if (activeSession.rows.length === 0) {
        res.status(400).json({
          success: false,
          message: "لا توجد جلسة نشطة لهذه المادة حالياً.",
        });
        return;
      }

      const sessionId = (activeSession.rows[0] as { id: string }).id;

      const duplicateCheck = await pool.query(
        "SELECT id FROM attendance_records WHERE student_id = $1 AND session_id = $2",
        [studentId, sessionId],
      );

      if (duplicateCheck.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: "تم تسجيل حضورك في هذه المحاضرة مسبقاً.",
        });
        return;
      }

      await pool.query(
        `INSERT INTO attendance_records (session_id, course_id, student_id, scanned_at, status)
         VALUES ($1, $2, $3, NOW(), 'present')`,
        [sessionId, courseId, studentId],
      );

      const statsResult = await pool.query(
        `SELECT
           COUNT(DISTINCT s.id)  AS total_sessions,
           COUNT(DISTINCT ar.id) AS attended_sessions
         FROM attendance_sessions s
         LEFT JOIN attendance_records ar
           ON s.id = ar.session_id AND ar.student_id = $1
         WHERE s.course_id = $2`,
        [studentId, courseId],
      );

      const statsRow = statsResult.rows[0] as {
        total_sessions: string;
        attended_sessions: string;
      };
      const total = parseInt(statsRow?.total_sessions ?? "0", 10);
      const attended = parseInt(statsRow?.attended_sessions ?? "0", 10);
      const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

      if (req.io) {
        const payload = {
          studentId,
          studentName: req.user!.full_name,
          studentUniversityId: req.user!.student_id,
          scannedAt: new Date(),
          sessionId,
          courseId,
          attendanceStats: { attended, total, percentage },
        };

        req.io.to(courseId!.toString()).emit("student_attended", payload);
        req.io.to(sessionId.toString()).emit("student_attended", payload);

        console.log(
          `📡 [SOCKET_EMIT] → room course:${courseId} & session:${sessionId}`,
        );
      }

      res.json({
        success: true,
        message: "تم تسجيل الحضور بنجاح! ✅",
        data: { sessionId, courseId, attendancePercentage: percentage },
      });
    } catch (error) {
      console.error("🔥 Scan Error:", error);
      res.status(500).json({
        success: false,
        message: "فشل عملية المسح: الرمز غير صالح أو منتهي",
      });
    }
  },

  getActiveSessions: async (req: Request, res: Response): Promise<void> => {
    try {
      const studentId = req.user!.id;

      const result = await pool.query(
        `SELECT
           s.id,
           s.session_name,
           s.session_date,
           c.course_name,
           c.course_code
         FROM attendance_sessions s
         JOIN courses c ON s.course_id = c.id
         JOIN enrollments e ON c.id = e.course_id
         WHERE e.student_id = $1
           AND s.is_active = true`,
        [studentId],
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error("❌ Error fetching active sessions:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  },

  getSessionAttendance: async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;

      const records = await pool.query(
        `SELECT
           ar.id,
           ar.scanned_at,
           ar.is_manual_override,
           u.id          AS student_db_id,
           u.full_name,
           u.student_id  AS university_id,
           u.email,
           (
             SELECT COUNT(DISTINCT ar2.id)
             FROM attendance_records ar2
             JOIN attendance_sessions s2 ON ar2.session_id = s2.id
             WHERE ar2.student_id = u.id AND s2.course_id = s.course_id
           ) AS total_attended,
           (
             SELECT COUNT(DISTINCT s3.id)
             FROM attendance_sessions s3
             WHERE s3.course_id = s.course_id
           ) AS total_sessions
         FROM attendance_records ar
         JOIN users u               ON ar.student_id = u.id
         JOIN attendance_sessions s ON ar.session_id = s.id
         WHERE ar.session_id = $1
         ORDER BY ar.scanned_at DESC`,
        [sessionId],
      );

      const recordsWithPercentage = records.rows.map((r) => {
        const totalSessions =
          parseInt((r as { total_sessions: string }).total_sessions, 10) || 0;
        const totalAttended =
          parseInt((r as { total_attended: string }).total_attended, 10) || 0;
        return {
          ...r,
          total_sessions: totalSessions,
          total_attended: totalAttended,
          attendance_percentage:
            totalSessions > 0
              ? Math.round((totalAttended / totalSessions) * 100)
              : 0,
        };
      });

      res.json({ success: true, data: { records: recordsWithPercentage } });
    } catch (error) {
      console.error("❌ Get attendance error:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching records." });
    }
  },

  getStudentAttendance: async (req: Request, res: Response): Promise<void> => {
    try {
      const studentId = req.user!.id;

      const result = await pool.query(
        `SELECT ar.*, s.session_name, s.session_date, c.course_name, c.course_code
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         JOIN courses c ON s.course_id = c.id
         WHERE ar.student_id = $1
         ORDER BY s.session_date DESC`,
        [studentId],
      );

      res.json({ success: true, data: { attendance: result.rows } });
    } catch (error) {
      console.error("❌ Student history error:", error);
      res
        .status(500)
        .json({ success: false, message: "Error fetching history." });
    }
  },

  manualOverride: async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId, studentId, reason } = req.body as {
        sessionId: string;
        studentId: string;
        reason?: string;
      };

      if (!sessionId || !studentId) {
        res.status(400).json({
          success: false,
          message: "معرف الجلسة ومعرف الطالب مطلوبان.",
        });
        return;
      }

      const professorId = req.user!.id;

      const sessionCheck = await pool.query(
        `SELECT s.id, s.course_id FROM attendance_sessions s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = $1 AND c.professor_id = $2`,
        [sessionId, professorId],
      );

      if (sessionCheck.rows.length === 0) {
        res.status(403).json({ success: false, message: "Access denied." });
        return;
      }

      const courseId = (sessionCheck.rows[0] as { course_id: string })
        .course_id;

      const existing = await pool.query(
        "SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2",
        [sessionId, studentId],
      );

      if (existing.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: "Student already attended.",
        });
        return;
      }

      const result = await pool.query(
        `INSERT INTO attendance_records
         (session_id, course_id, student_id, is_manual_override, override_reason, scanned_at, status)
         VALUES ($1, $2, $3, true, $4, NOW(), 'present')
         RETURNING *`,
        [sessionId, courseId, studentId, reason ?? "Manual override"],
      );

      res.json({
        success: true,
        message: "Manual attendance recorded.",
        data: { record: result.rows[0] },
      });
    } catch (error) {
      console.error("❌ Manual override error:", error);
      res.status(500).json({
        success: false,
        message: "Error in manual override.",
      });
    }
  },

  getCurrentQR: async (req: Request, res: Response): Promise<void> => {
    try {
      const { courseId } = req.params;
      const token = await cacheClient.get(`active_qr_session_${courseId}`);

      if (!token) {
        res.status(404).json({
          success: false,
          message: "لا توجد جلسة QR نشطة لهذه المادة.",
        });
        return;
      }

      const { t: generatedAt } = TokenEncryption.decrypt(token);
      const remainingSeconds = Math.max(
        0,
        Math.round((ROTATION_INTERVAL_MS - (Date.now() - generatedAt)) / 1000),
      );

      res.json({ success: true, data: { token, remainingSeconds } });
    } catch (error) {
      console.error("❌ Get current QR error:", error);
      res.status(500).json({ success: false, message: "Error fetching QR." });
    }
  },

  exportAttendance: async (req: Request, res: Response): Promise<void> => {
    try {
      const { courseId } = req.params;
      const professorId = req.user!.id;

      const courseInfo = await pool.query(
        "SELECT * FROM courses WHERE id = $1 AND professor_id = $2",
        [courseId, professorId],
      );

      if (courseInfo.rows.length === 0) {
        res.status(403).send("Forbidden");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Attendance Report");

      worksheet.columns = [
        { header: "Student ID", key: "student_id", width: 15 },
        { header: "Name", key: "full_name", width: 30 },
        { header: "Total Sessions", key: "total", width: 15 },
        { header: "Attended", key: "attended", width: 15 },
        { header: "Percentage", key: "percentage", width: 15 },
      ];

      const stats = await pool.query(
        `SELECT u.student_id, u.full_name,
                COUNT(DISTINCT s.id)  AS total_sessions,
                COUNT(DISTINCT ar.id) AS attended_sessions
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         LEFT JOIN attendance_sessions s  ON e.course_id = s.course_id
         LEFT JOIN attendance_records ar  ON s.id = ar.session_id AND ar.student_id = u.id
         WHERE e.course_id = $1
         GROUP BY u.id, u.student_id, u.full_name
         ORDER BY u.full_name`,
        [courseId],
      );

      for (const row of stats.rows as Array<{
        student_id: string;
        full_name: string;
        total_sessions: number;
        attended_sessions: number;
      }>) {
        const perc =
          row.total_sessions > 0
            ? (row.attended_sessions / row.total_sessions) * 100
            : 0;
        worksheet.addRow({
          student_id: row.student_id,
          full_name: row.full_name,
          total: row.total_sessions,
          attended: row.attended_sessions,
          percentage: `${perc.toFixed(1)}%`,
        });
      }

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Course_${courseId}.xlsx`,
      );

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("❌ Export error:", error);
      res.status(500).send("Error generating report");
    }
  },
};

export default attendanceController;
export const {
  createSession,
  endSession,
  scanQR,
  getActiveSessions,
  getSessionAttendance,
  getStudentAttendance,
  manualOverride,
  getCurrentQR,
  exportAttendance,
} = attendanceController;
