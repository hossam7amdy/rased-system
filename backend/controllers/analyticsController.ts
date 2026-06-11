import ExcelJS from "exceljs";
import type { Request, Response } from "express";
import pool from "../config/database.ts";

const analyticsController = {
	getCourseAnalytics: async (req: Request, res: Response): Promise<void> => {
		try {
			const { courseId } = req.params;
			const professorId = req.user!.id;

			const courseCheck = await pool.query(
				"SELECT * FROM courses WHERE id = $1 AND professor_id = $2",
				[courseId, professorId],
			);

			if (courseCheck.rows.length === 0) {
				res.status(403).json({ success: false, message: "Access denied." });
				return;
			}

			const statsResult = await pool.query(
				`SELECT
          COUNT(DISTINCT s.id) as total_sessions,
          COUNT(DISTINCT e.student_id) as total_students,
          COUNT(DISTINCT ar.id) as total_attendance_records
         FROM courses c
         LEFT JOIN attendance_sessions s ON c.id = s.course_id
         LEFT JOIN enrollments e ON c.id = e.course_id
         LEFT JOIN attendance_records ar ON s.id = ar.session_id
         WHERE c.id = $1`,
				[courseId],
			);

			const stats = statsResult.rows[0] as {
				total_sessions: string;
				total_students: string;
				total_attendance_records: string;
			};
			if (!stats) {
				res.status(404).json({ success: false, message: "Course not found." });
				return;
			}

			const trendResult = await pool.query(
				`SELECT s.id, s.session_name, s.session_date,
                COUNT(ar.id) as attendance_count
         FROM attendance_sessions s
         LEFT JOIN attendance_records ar ON s.id = ar.session_id
         WHERE s.course_id = $1
         GROUP BY s.id, s.session_name, s.session_date
         ORDER BY s.session_date DESC
         LIMIT 10`,
				[courseId],
			);

			const atRiskResult = await pool.query(
				`SELECT u.id, u.full_name, u.student_id,
                COUNT(DISTINCT s.id) as total_sessions,
                COUNT(DISTINCT ar.id) as attended_sessions,
                ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) as attendance_percentage
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         CROSS JOIN attendance_sessions s
         LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
         WHERE e.course_id = $1 AND s.course_id = $1
         GROUP BY u.id, u.full_name, u.student_id
         HAVING COUNT(DISTINCT s.id) > 0
           AND (CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / COUNT(DISTINCT s.id)) < 0.25
         ORDER BY attendance_percentage ASC`,
				[courseId],
			);

			const totalSessions = parseInt(stats.total_sessions, 10);
			const totalStudents = parseInt(stats.total_students, 10);
			const totalAttendance = parseInt(stats.total_attendance_records, 10);

			res.json({
				success: true,
				data: {
					course: courseCheck.rows[0],
					statistics: {
						total_sessions: totalSessions,
						total_students: totalStudents,
						total_attendance: totalAttendance,
						average_attendance:
							totalSessions > 0 && totalStudents > 0
								? Math.round(
										(totalAttendance / (totalSessions * totalStudents)) * 100,
									)
								: 0,
					},
					attendance_trend: trendResult.rows.reverse(),
					at_risk_students: atRiskResult.rows,
				},
			});
		} catch (error) {
			console.error("Get course analytics error:", error);
			res.status(500).json({
				success: false,
				message: "An error occurred while fetching analytics.",
			});
		}
	},

	getStudentAnalytics: async (req: Request, res: Response): Promise<void> => {
		try {
			const studentId = req.user!.id;

			const statsResult = await pool.query(
				`SELECT
          COUNT(DISTINCT e.course_id) as enrolled_courses,
          COUNT(DISTINCT s.id) as total_sessions,
          COUNT(DISTINCT ar.id) as attended_sessions
         FROM enrollments e
         LEFT JOIN attendance_sessions s ON e.course_id = s.course_id
         LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = $1
         WHERE e.student_id = $1`,
				[studentId],
			);

			const stats = statsResult.rows[0] as {
				enrolled_courses: string;
				total_sessions: string;
				attended_sessions: string;
			};
			if (!stats) {
				res.status(404).json({ success: false, message: "Student not found." });
				return;
			}

			const coursesResult = await pool.query(
				`SELECT c.course_name, c.course_code,
                COUNT(DISTINCT s.id) as total_sessions,
                COUNT(DISTINCT ar.id) as attended_sessions,
                ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) as attendance_percentage
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         LEFT JOIN attendance_sessions s ON c.id = s.course_id
         LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = $1
         WHERE e.student_id = $1
         GROUP BY c.id, c.course_name, c.course_code
         ORDER BY attendance_percentage DESC`,
				[studentId],
			);

			const recentResult = await pool.query(
				`SELECT c.course_name, s.session_name, s.session_date, ar.scanned_at
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         JOIN courses c ON s.course_id = c.id
         WHERE ar.student_id = $1
         ORDER BY ar.scanned_at DESC
         LIMIT 10`,
				[studentId],
			);

			const totalSessions = parseInt(stats.total_sessions, 10);
			const attendedSessions = parseInt(stats.attended_sessions, 10);

			res.json({
				success: true,
				data: {
					statistics: {
						enrolled_courses: parseInt(stats.enrolled_courses, 10),
						total_sessions: totalSessions,
						attended_sessions: attendedSessions,
						overall_percentage:
							totalSessions > 0
								? Math.round((attendedSessions / totalSessions) * 100)
								: 0,
					},
					courses: coursesResult.rows,
					recent_attendance: recentResult.rows,
				},
			});
		} catch (error) {
			console.error("Get student analytics error:", error);
			res.status(500).json({
				success: false,
				message: "An error occurred while fetching analytics.",
			});
		}
	},

	exportAttendance: async (req: Request, res: Response): Promise<void> => {
		try {
			const { courseId, sessionId } = req.query as {
				courseId?: string;
				sessionId?: string;
			};
			const professorId = req.user!.id;

			if (!courseId) {
				res.status(400).json({
					success: false,
					message: "Course ID is required.",
				});
				return;
			}

			const courseCheck = await pool.query(
				"SELECT * FROM courses WHERE id = $1 AND professor_id = $2",
				[courseId, professorId],
			);

			if (courseCheck.rows.length === 0) {
				res.status(403).json({ success: false, message: "Access denied." });
				return;
			}

			const course = courseCheck.rows[0] as { course_code: string };

			const workbook = new ExcelJS.Workbook();
			const worksheet = workbook.addWorksheet("Attendance Report");

			if (sessionId) {
				const sessionResult = await pool.query(
					"SELECT * FROM attendance_sessions WHERE id = $1",
					[sessionId],
				);

				if (sessionResult.rows.length === 0) {
					res.status(404).json({
						success: false,
						message: "Session not found.",
					});
					return;
				}

				const attendanceResult = await pool.query(
					`SELECT u.student_id, u.full_name, u.email,
                  ar.scanned_at, ar.is_manual_override
           FROM enrollments e
           JOIN users u ON e.student_id = u.id
           LEFT JOIN attendance_records ar ON ar.student_id = u.id AND ar.session_id = $1
           WHERE e.course_id = $2
           ORDER BY u.full_name`,
					[sessionId, courseId],
				);

				worksheet.columns = [
					{ header: "Student ID", key: "student_id", width: 15 },
					{ header: "Full Name", key: "full_name", width: 30 },
					{ header: "Email", key: "email", width: 30 },
					{ header: "Status", key: "status", width: 15 },
					{ header: "Scan Time", key: "scanned_at", width: 20 },
					{ header: "Manual Override", key: "is_manual_override", width: 15 },
				];

				for (const record of attendanceResult.rows as Array<{
					student_id: string;
					full_name: string;
					email: string;
					scanned_at: Date | null;
					is_manual_override: boolean;
				}>) {
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
				const studentsResult = await pool.query(
					`SELECT u.student_id, u.full_name,
                  COUNT(DISTINCT s.id) as total_sessions,
                  COUNT(DISTINCT ar.id) as attended_sessions,
                  ROUND(CAST(COUNT(DISTINCT ar.id) AS DECIMAL) / NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2) as percentage
           FROM enrollments e
           JOIN users u ON e.student_id = u.id
           LEFT JOIN attendance_sessions s ON e.course_id = s.course_id
           LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
           WHERE e.course_id = $1
           GROUP BY u.id, u.student_id, u.full_name
           ORDER BY u.full_name`,
					[courseId],
				);

				worksheet.columns = [
					{ header: "Student ID", key: "student_id", width: 15 },
					{ header: "Full Name", key: "full_name", width: 30 },
					{ header: "Total Sessions", key: "total_sessions", width: 15 },
					{ header: "Attended", key: "attended_sessions", width: 15 },
					{ header: "Percentage", key: "percentage", width: 15 },
					{ header: "Status", key: "status", width: 15 },
				];

				for (const record of studentsResult.rows as Array<{
					student_id: string;
					full_name: string;
					total_sessions: string;
					attended_sessions: string;
					percentage: string;
				}>) {
					const percentage = parseFloat(record.percentage) || 0;
					worksheet.addRow({
						student_id: record.student_id,
						full_name: record.full_name,
						total_sessions: record.total_sessions,
						attended_sessions: record.attended_sessions,
						percentage: `${percentage}%`,
						status:
							percentage < 25
								? "At Risk"
								: percentage < 75
									? "Warning"
									: "Good",
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
				`attachment; filename="${course.course_code}_attendance.xlsx"`,
			);
			res.send(buffer);
		} catch (error) {
			console.error("Export attendance error:", error);
			res.status(500).json({
				success: false,
				message: "An error occurred while exporting attendance.",
			});
		}
	},
};

export default analyticsController;
export const { getCourseAnalytics, getStudentAnalytics, exportAttendance } =
	analyticsController;
