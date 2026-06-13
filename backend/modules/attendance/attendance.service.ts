import { inject } from "injectus";
import cacheClient from "../../config/redis.ts";
import qrTokenService, {
  ROTATION_INTERVAL_MS,
} from "../../services/qrTokenService.ts";
import { Database } from "../../shared/database/database.ts";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors.ts";
import TokenEncryption from "../../utils/tokenEncryption.ts";
import type {
  ActiveSessionDto,
  CreateSessionDto,
  CurrentQrDto,
  ManualOverrideDto,
  ScanQRDto,
  ScanResultDto,
  SessionAttendanceRecordDto,
} from "./attendance.dto.ts";
import type {
  AttendanceRecord,
  AttendanceSession,
} from "./attendance.model.ts";

export class AttendanceService {
  private readonly db;
  constructor(db = inject(Database)) {
    this.db = db;
  }

  async createSession(input: CreateSessionDto): Promise<AttendanceSession> {
    await this.assertCourseOwnership(input.courseId, input.professorId);

    await this.db.query(
      "UPDATE attendance_sessions SET is_active = false WHERE course_id = $1 AND is_active = true",
      [input.courseId],
    );

    const finalDate =
      input.sessionDate ?? new Date().toLocaleDateString("en-CA");

    const result = await this.db.query(
      `INSERT INTO attendance_sessions
         (course_id, session_name, session_date, start_time, is_active)
         VALUES ($1, $2, $3, NOW(), true)
         RETURNING *`,
      [input.courseId, input.sessionName ?? "محاضرة جديدة", finalDate],
    );

    return result.rows[0];
  }

  async endSession(sessionId: string, professorId: string): Promise<string> {
    const courseId = await this.assertSessionOwnership(sessionId, professorId);

    qrTokenService.stopRotation(courseId);

    await this.db.query(
      `UPDATE attendance_sessions
         SET is_active = false, end_time = NOW()
         WHERE id = $1`,
      [sessionId],
    );

    return courseId;
  }

  async scanQR(input: ScanQRDto): Promise<ScanResultDto> {
    const validation = await qrTokenService.validateToken(input.token);

    if (!validation.valid) {
      throw new BadRequestError(validation.message ?? "رمز غير صالح.");
    }

    const courseId = validation.courseId!;

    const enrollmentCheck = await this.db.query(
      "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
      [input.studentId, courseId],
    );

    if (enrollmentCheck.rows.length === 0) {
      throw new ForbiddenError("عذراً, أنت غير مسجل في هذه المادة.");
    }

    const activeSession = await this.db.query(
      "SELECT id FROM attendance_sessions WHERE course_id = $1 AND is_active = true LIMIT 1",
      [courseId],
    );

    if (activeSession.rows.length === 0) {
      throw new BadRequestError("لا توجد جلسة نشطة لهذه المادة حالياً.");
    }

    const sessionId = (activeSession.rows[0] as { id: string }).id;

    const duplicateCheck = await this.db.query(
      "SELECT id FROM attendance_records WHERE student_id = $1 AND session_id = $2",
      [input.studentId, sessionId],
    );

    if (duplicateCheck.rows.length > 0) {
      throw new ConflictError("تم تسجيل حضورك في هذه المحاضرة مسبقاً.");
    }

    await this.db.query(
      `INSERT INTO attendance_records (session_id, course_id, student_id, scanned_at, status)
         VALUES ($1, $2, $3, NOW(), 'present')`,
      [sessionId, courseId, input.studentId],
    );

    const statsResult = await this.db.query(
      `SELECT
           COUNT(DISTINCT s.id)  AS total_sessions,
           COUNT(DISTINCT ar.id) AS attended_sessions
         FROM attendance_sessions s
         LEFT JOIN attendance_records ar
           ON s.id = ar.session_id AND ar.student_id = $1
         WHERE s.course_id = $2`,
      [input.studentId, courseId],
    );

    const statsRow = statsResult.rows[0] as {
      total_sessions: string;
      attended_sessions: string;
    };
    const total = parseInt(statsRow?.total_sessions ?? "0", 10);
    const attended = parseInt(statsRow?.attended_sessions ?? "0", 10);
    const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

    return { sessionId, courseId, attended, total, percentage };
  }

  async getActiveSessions(studentId: string): Promise<ActiveSessionDto[]> {
    const result = await this.db.query(
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

    return result.rows;
  }

  async getSessionAttendance(
    sessionId: string,
  ): Promise<SessionAttendanceRecordDto[]> {
    const records = await this.db.query(
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

    return records.rows.map((r) => {
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
  }

  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    const result = await this.db.query(
      `SELECT ar.*, s.session_name, s.session_date, c.course_name, c.course_code
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         JOIN courses c ON s.course_id = c.id
         WHERE ar.student_id = $1
         ORDER BY s.session_date DESC`,
      [studentId],
    );

    return result.rows;
  }

  async manualOverride(input: ManualOverrideDto): Promise<AttendanceRecord> {
    const courseId = await this.assertSessionOwnership(
      input.sessionId,
      input.professorId,
    );

    const existing = await this.db.query(
      "SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2",
      [input.sessionId, input.studentId],
    );

    if (existing.rows.length > 0) {
      throw new ConflictError("Student already attended.");
    }

    const result = await this.db.query(
      `INSERT INTO attendance_records
         (session_id, course_id, student_id, is_manual_override, override_reason, scanned_at, status)
         VALUES ($1, $2, $3, true, $4, NOW(), 'present')
         RETURNING *`,
      [
        input.sessionId,
        courseId,
        input.studentId,
        input.reason ?? "Manual override",
      ],
    );

    return result.rows[0];
  }

  async getCurrentQR(courseId: string): Promise<CurrentQrDto> {
    const token = await cacheClient.get(`active_qr_session_${courseId}`);

    if (!token) {
      throw new NotFoundError("لا توجد جلسة QR نشطة لهذه المادة.");
    }

    const { t: generatedAt } = TokenEncryption.decrypt(token);
    const remainingSeconds = Math.max(
      0,
      Math.round((ROTATION_INTERVAL_MS - (Date.now() - generatedAt)) / 1000),
    );

    return { token, remainingSeconds };
  }

  private async assertCourseOwnership(
    courseId: string,
    professorId: string,
  ): Promise<void> {
    const courseCheck = await this.db.query(
      "SELECT id FROM courses WHERE id = $1 AND professor_id = $2",
      [courseId, professorId],
    );

    if (courseCheck.rows.length === 0) {
      throw new ForbiddenError("غير مسموح لك بإنشاء جلسة لهذه المادة.");
    }
  }

  private async assertSessionOwnership(
    sessionId: string,
    professorId: string,
  ): Promise<string> {
    const sessionCheck = await this.db.query(
      `SELECT s.id, s.course_id FROM attendance_sessions s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = $1 AND c.professor_id = $2`,
      [sessionId, professorId],
    );

    if (sessionCheck.rows.length === 0) {
      throw new ForbiddenError("Access denied.");
    }

    return (sessionCheck.rows[0] as { course_id: string }).course_id;
  }
}
