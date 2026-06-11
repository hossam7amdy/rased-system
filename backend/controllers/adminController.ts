import type { Request, Response } from "express";
import pool from "../config/database.ts";

interface ImportRow {
	rowNum: number;
	studentId?: string;
	studentName?: string;
	courseCode?: string;
	courseName?: string;
}

interface ImportDetail {
	rowNum: number;
	studentName: string;
	studentId: string;
	courseCode: string;
	status: string;
	message: string;
}

const adminController = {
	getAllStudents: async (req: Request, res: Response): Promise<void> => {
		try {
			const { q = "" } = req.query as { q?: string };
			const search = `%${q.trim().toLowerCase()}%`;

			const result = await pool.query(
				`SELECT id, full_name, student_id, email, created_at
           FROM users
          WHERE role = 'student'
            AND (
              $1 = '%%'
              OR LOWER(full_name)  LIKE $1
              OR LOWER(student_id) LIKE $1
              OR LOWER(email)      LIKE $1
            )
          ORDER BY full_name ASC
          LIMIT 500`,
				[search],
			);

			res.json({ success: true, data: { students: result.rows } });
		} catch (error) {
			console.error("[Admin] getAllStudents error:", error);
			res.status(500).json({
				success: false,
				message: "حدث خطأ أثناء جلب قائمة الطلاب.",
			});
		}
	},

	getAllCourses: async (req: Request, res: Response): Promise<void> => {
		try {
			const { q = "" } = req.query as { q?: string };
			const search = `%${q.trim().toLowerCase()}%`;

			const result = await pool.query(
				`SELECT c.id, c.course_code, c.course_name, c.semester,
                c.academic_year, c.created_at,
                u.full_name AS professor_name
           FROM courses c
           JOIN users u ON c.professor_id = u.id
          WHERE $1 = '%%'
             OR LOWER(c.course_name) LIKE $1
             OR LOWER(c.course_code) LIKE $1
             OR LOWER(u.full_name)   LIKE $1
          ORDER BY c.created_at DESC
          LIMIT 500`,
				[search],
			);

			res.json({ success: true, data: { courses: result.rows } });
		} catch (error) {
			console.error("[Admin] getAllCourses error:", error);
			res.status(500).json({
				success: false,
				message: "حدث خطأ أثناء جلب قائمة الكورسات.",
			});
		}
	},

	enrollBulk: async (req: Request, res: Response): Promise<void> => {
		const { studentIds, courseIds } = req.body as {
			studentIds: string[];
			courseIds: string[];
		};

		if (
			!Array.isArray(studentIds) ||
			studentIds.length === 0 ||
			!Array.isArray(courseIds) ||
			courseIds.length === 0
		) {
			res.status(400).json({
				success: false,
				message: "يجب تحديد طالب واحد على الأقل ومادة واحدة على الأقل.",
			});
			return;
		}

		if (studentIds.length * courseIds.length > 2000) {
			res.status(400).json({
				success: false,
				message: "عدد التسجيلات المطلوبة كبير جداً. يُرجى تقسيمها على دفعات.",
			});
			return;
		}

		const client = await pool.connect();
		let enrolled = 0;
		let duplicates = 0;
		let errors = 0;

		try {
			await client.query("BEGIN");

			for (const studentId of studentIds) {
				for (const courseId of courseIds) {
					try {
						const result = await client.query(
							`INSERT INTO enrollments (course_id, student_id)
               VALUES ($1, $2)
               ON CONFLICT (course_id, student_id) DO NOTHING
               RETURNING id`,
							[courseId, studentId],
						);

						if (result.rows.length > 0) {
							enrolled++;
						} else {
							duplicates++;
						}
					} catch (rowErr) {
						console.error(
							`[Admin] enroll student=${studentId} course=${courseId}:`,
							(rowErr as Error).message,
						);
						errors++;
					}
				}
			}

			await client.query("COMMIT");

			res.status(201).json({
				success: true,
				message: `تمّ الربط: ${enrolled} تسجيل جديد، ${duplicates} مكرر، ${errors} خطأ.`,
				enrolled,
				duplicates,
				errors,
			});
		} catch (txErr) {
			await client.query("ROLLBACK");
			console.error("[Admin] enrollBulk transaction error:", txErr);
			res.status(500).json({
				success: false,
				message: "حدث خطأ أثناء عملية الربط الجماعي.",
			});
		} finally {
			client.release();
		}
	},

	enrollImport: async (req: Request, res: Response): Promise<void> => {
		const { rows } = req.body as { rows: ImportRow[] };

		if (!Array.isArray(rows) || rows.length === 0) {
			res.status(400).json({
				success: false,
				message: "لا توجد بيانات للاستيراد.",
			});
			return;
		}

		if (rows.length > 5000) {
			res.status(400).json({
				success: false,
				message: "الحد الأقصى للاستيراد الواحد هو 5000 صف.",
			});
			return;
		}

		const [studentsRes, coursesRes] = await Promise.all([
			pool.query(
				`SELECT id, student_id, full_name FROM users WHERE role = 'student'`,
			),
			pool.query(`SELECT id, course_code, course_name FROM courses`),
		]);

		const studentByUnivId = new Map<string, string>(
			(studentsRes.rows as Array<{ id: string; student_id: string | null; full_name: string }>)
				.filter((s) => s.student_id)
				.map((s) => [s.student_id!.trim().toLowerCase(), s.id]),
		);
		const studentByName = new Map<string, string>(
			(studentsRes.rows as Array<{ id: string; full_name: string }>)
				.filter((s) => s.full_name)
				.map((s) => [s.full_name.trim().toLowerCase(), s.id]),
		);
		const courseByCode = new Map<string, string>(
			(coursesRes.rows as Array<{ id: string; course_code: string | null; course_name: string }>)
				.filter((c) => c.course_code)
				.map((c) => [c.course_code!.trim().toLowerCase(), c.id]),
		);
		const courseByName = new Map<string, string>(
			(coursesRes.rows as Array<{ id: string; course_name: string }>)
				.filter((c) => c.course_name)
				.map((c) => [c.course_name.trim().toLowerCase(), c.id]),
		);

		interface InsertItem {
			courseId: string;
			studentId: string;
			rowNum: number;
			detail: ImportDetail;
		}

		const toInsert: InsertItem[] = [];
		const details: ImportDetail[] = [];

		for (const row of rows) {
			const { rowNum, studentId: rawSid, studentName, courseCode: rawCode, courseName } = row;

			const sid = rawSid?.trim().toLowerCase();
			const sname = studentName?.trim().toLowerCase();
			const studentDbId =
				(sid ? studentByUnivId.get(sid) : undefined) ??
				(sname ? studentByName.get(sname) : undefined);

			const code = rawCode?.trim().toLowerCase();
			const cname = courseName?.trim().toLowerCase();
			const courseDbId =
				(code ? courseByCode.get(code) : undefined) ??
				(cname ? courseByName.get(cname) : undefined);

			const detail: ImportDetail = {
				rowNum: rowNum ?? 0,
				studentName: studentName ?? rawSid ?? "",
				studentId: rawSid ?? "",
				courseCode: rawCode ?? courseName ?? "",
				status: "",
				message: "",
			};

			if (!studentDbId && !courseDbId) {
				detail.status = "error";
				detail.message = "الطالب والمادة غير موجودَيْن في النظام";
				details.push(detail);
				continue;
			}
			if (!studentDbId) {
				detail.status = "error";
				detail.message = `الطالب غير موجود: ${rawSid ?? studentName}`;
				details.push(detail);
				continue;
			}
			if (!courseDbId) {
				detail.status = "error";
				detail.message = `المادة غير موجودة: ${rawCode ?? courseName}`;
				details.push(detail);
				continue;
			}

			toInsert.push({ courseId: courseDbId, studentId: studentDbId, rowNum: rowNum ?? 0, detail });
		}

		const client = await pool.connect();
		let enrolled = 0;
		let duplicates = 0;
		let errors = 0;

		try {
			await client.query("BEGIN");

			for (const { courseId, studentId, detail } of toInsert) {
				try {
					const result = await client.query(
						`INSERT INTO enrollments (course_id, student_id)
             VALUES ($1, $2)
             ON CONFLICT (course_id, student_id) DO NOTHING
             RETURNING id`,
						[courseId, studentId],
					);

					if (result.rows.length > 0) {
						enrolled++;
						detail.status = "enrolled";
						detail.message = "تم التسجيل";
					} else {
						duplicates++;
						detail.status = "duplicate";
						detail.message = "مسجّل مسبقاً";
					}
				} catch (rowErr) {
					errors++;
					detail.status = "error";
					detail.message = (rowErr as Error).message;
					console.error(`[Admin] import row ${detail.rowNum}:`, (rowErr as Error).message);
				}
				details.push(detail);
			}

			await client.query("COMMIT");

			res.status(201).json({
				success: true,
				message: `الاستيراد اكتمل: ${enrolled} جديد، ${duplicates} مكرر، ${errors} خطأ.`,
				total: rows.length,
				enrolled,
				duplicates,
				errors,
				details,
			});
		} catch (txErr) {
			await client.query("ROLLBACK");
			console.error("[Admin] enrollImport transaction error:", txErr);
			res.status(500).json({
				success: false,
				message: "فشل الاستيراد بسبب خطأ في قاعدة البيانات.",
			});
		} finally {
			client.release();
		}
	},
};

export default adminController;
export const { getAllStudents, getAllCourses, enrollBulk, enrollImport } =
	adminController;
