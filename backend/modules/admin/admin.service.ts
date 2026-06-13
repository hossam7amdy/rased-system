import { inject } from "injectus";
import { Database } from "../../shared/database/database.ts";
import { withTransaction } from "../../shared/database/with-transaction.ts";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors.ts";
import type { BulkCounts, ImportResult } from "./admin.dto.ts";
import type {
  AdminCourseRow,
  AdminStudentRow,
  AdminUserRow,
  Enrollment,
  ImportDetail,
  ImportRow,
} from "./admin.model.ts";

export class AdminService {
  private readonly db;
  constructor(db = inject(Database)) {
    this.db = db;
  }

  async searchStudents(q: string): Promise<AdminStudentRow[]> {
    const search = `%${q.trim().toLowerCase()}%`;

    const result = await this.db.query(
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

    return result.rows;
  }

  async searchCourses(q: string): Promise<AdminCourseRow[]> {
    const search = `%${q.trim().toLowerCase()}%`;

    const result = await this.db.query(
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

    return result.rows;
  }

  async listUsers(): Promise<AdminUserRow[]> {
    const result = await this.db.query(
      "SELECT id, email, role, full_name, student_id, created_at FROM users ORDER BY created_at DESC",
    );

    return result.rows;
  }

  async deleteUser(id: string, requesterId: string): Promise<void> {
    if (id === requesterId) {
      throw new ForbiddenError("لا يمكنك حذف حسابك الخاص.");
    }

    await withTransaction(this.db, async (client) => {
      const target = await client.query(
        "SELECT role FROM users WHERE id = $1",
        [id],
      );

      if (target.rows.length === 0) {
        throw new NotFoundError("المستخدم غير موجود.");
      }

      if (target.rows[0].role === "admin") {
        const admins = await client.query(
          "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'",
        );

        if (admins.rows[0].count <= 1) {
          throw new ForbiddenError("لا يمكن حذف آخر مسؤول.");
        }
      }

      await client.query("DELETE FROM users WHERE id = $1", [id]);
    });
  }

  async enrollOne(studentId: string, courseId: string): Promise<Enrollment> {
    const result = await this.db.query(
      `INSERT INTO enrollments (course_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT (course_id, student_id) DO NOTHING
           RETURNING *`,
      [courseId, studentId],
    );

    if (result.rows.length === 0) {
      throw new ConflictError("هذا الطالب مسجل بالفعل في هذا الكورس.");
    }

    return result.rows[0];
  }

  async enrollBulk(
    studentIds: string[],
    courseIds: string[],
  ): Promise<BulkCounts> {
    let enrolled = 0;
    let duplicates = 0;
    let errors = 0;

    await withTransaction(this.db, async (client) => {
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
    });

    return { enrolled, duplicates, errors };
  }

  async enrollImport(rows: ImportRow[]): Promise<ImportResult> {
    const [studentsRes, coursesRes] = await Promise.all([
      this.db.query(
        `SELECT id, student_id, full_name FROM users WHERE role = 'student'`,
      ),
      this.db.query(`SELECT id, course_code, course_name FROM courses`),
    ]);

    const studentByUnivId = new Map<string, string>(
      (
        studentsRes.rows as Array<{
          id: string;
          student_id: string | null;
          full_name: string;
        }>
      )
        .filter((s) => s.student_id)
        .map((s) => [s.student_id!.trim().toLowerCase(), s.id]),
    );
    const studentByName = new Map<string, string>(
      (studentsRes.rows as Array<{ id: string; full_name: string }>)
        .filter((s) => s.full_name)
        .map((s) => [s.full_name.trim().toLowerCase(), s.id]),
    );
    const courseByCode = new Map<string, string>(
      (
        coursesRes.rows as Array<{
          id: string;
          course_code: string | null;
          course_name: string;
        }>
      )
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
      const {
        rowNum,
        studentId: rawSid,
        studentName,
        courseCode: rawCode,
        courseName,
      } = row;

      const sid =
        rawSid !== undefined ? String(rawSid).trim().toLowerCase() : undefined;
      const sname =
        studentName !== undefined
          ? String(studentName).trim().toLowerCase()
          : undefined;
      const studentDbId =
        (sid ? studentByUnivId.get(sid) : undefined) ??
        (sname ? studentByName.get(sname) : undefined);

      const code =
        rawCode !== undefined
          ? String(rawCode).trim().toLowerCase()
          : undefined;
      const cname =
        courseName !== undefined
          ? String(courseName).trim().toLowerCase()
          : undefined;
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

      toInsert.push({
        courseId: courseDbId,
        studentId: studentDbId,
        rowNum: rowNum ?? 0,
        detail,
      });
    }

    let enrolled = 0;
    let duplicates = 0;
    let errors = 0;

    await withTransaction(this.db, async (client) => {
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
          console.error(
            `[Admin] import row ${detail.rowNum}:`,
            (rowErr as Error).message,
          );
        }
        details.push(detail);
      }
    });

    return { total: rows.length, enrolled, duplicates, errors, details };
  }
}
