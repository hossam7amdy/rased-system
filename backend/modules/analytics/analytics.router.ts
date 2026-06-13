import ExcelJS from "exceljs";
import { Router } from "express";
import { checkRole, verifyToken } from "../../middleware/auth.ts";
import { AnalyticsService } from "./analytics.service.ts";
import { ExportQuerySchema } from "./analytics.validator.ts";

const router = Router();

router.get(
  "/analytics/course/:courseId",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const { courseId } = req.params as { courseId: string };
    const professorId = req.user!.id;
    const service = req.resolve(AnalyticsService);
    const data = await service.getCourseAnalytics(courseId, professorId);
    return res.json({ success: true, data });
  },
);

router.get(
  "/analytics/student",
  verifyToken,
  checkRole("student"),
  async (req, res) => {
    const studentId = req.user!.id;
    const service = req.resolve(AnalyticsService);
    const data = await service.getStudentAnalytics(studentId);
    return res.json({ success: true, data });
  },
);

router.get(
  "/analytics/export",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const { courseId, sessionId } = req.validQuery(ExportQuerySchema);
    const professorId = req.user!.id;
    const service = req.resolve(AnalyticsService);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance Report");

    let courseCode: string;

    if (sessionId) {
      const { course, rows } = await service.getSessionExport(
        courseId,
        sessionId,
        professorId,
      );
      courseCode = course.course_code;

      worksheet.columns = [
        { header: "Student ID", key: "student_id", width: 15 },
        { header: "Full Name", key: "full_name", width: 30 },
        { header: "Email", key: "email", width: 30 },
        { header: "Status", key: "status", width: 15 },
        { header: "Scan Time", key: "scanned_at", width: 20 },
        { header: "Manual Override", key: "is_manual_override", width: 15 },
      ];

      for (const record of rows) {
        worksheet.addRow({
          student_id: record.student_id,
          full_name: record.full_name,
          email: record.email,
          status: record.scanned_at ? "Present" : "Absent",
          scanned_at: record.scanned_at
            ? new Date(record.scanned_at).toLocaleString()
            : "-",
          is_manual_override: record.is_manual_override ? "Yes" : "No",
        });
      }
    } else {
      const { course, rows } = await service.getCourseExport(
        courseId,
        professorId,
      );
      courseCode = course.course_code;

      worksheet.columns = [
        { header: "Student ID", key: "student_id", width: 15 },
        { header: "Full Name", key: "full_name", width: 30 },
        { header: "Total Sessions", key: "total_sessions", width: 15 },
        { header: "Attended", key: "attended_sessions", width: 15 },
        { header: "Percentage", key: "percentage", width: 15 },
        { header: "Status", key: "status", width: 15 },
      ];

      for (const record of rows) {
        const percentage = parseFloat(record.percentage) || 0;
        worksheet.addRow({
          student_id: record.student_id,
          full_name: record.full_name,
          total_sessions: record.total_sessions,
          attended_sessions: record.attended_sessions,
          percentage: `${percentage}%`,
          status:
            percentage < 25 ? "At Risk" : percentage < 75 ? "Warning" : "Good",
        });
      }
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4CAF50" },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${courseCode}_attendance.xlsx"`,
    );
    return res.send(buffer);
  },
);

export default router;
