import { inject } from "injectus";
import { Database } from "../../shared/database/database.ts";
import { NotFoundError } from "../../shared/errors.ts";
import { CoursesService } from "../courses/courses.service.ts";
import type {
  CourseAnalyticsDto,
  CourseExportResult,
  SessionExportResult,
  StudentAnalyticsDto,
} from "./analytics.dto.ts";

export class AnalyticsService {
  private readonly db: Database;
  private readonly courses: CoursesService;
  constructor(db = inject(Database), courses = inject(CoursesService)) {
    this.db = db;
    this.courses = courses;
  }

  async getCourseAnalytics(
    courseId: string,
    professorId: string,
  ): Promise<CourseAnalyticsDto> {
    const course = await this.courses.getOwnedCourse(courseId, professorId);

    const statsResult = await this.db.query(
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

    const trendResult = await this.db.query(
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

    const atRiskResult = await this.db.query(
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

    return {
      course,
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
    };
  }

  async getStudentAnalytics(studentId: string): Promise<StudentAnalyticsDto> {
    const statsResult = await this.db.query(
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

    const coursesResult = await this.db.query(
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

    const recentResult = await this.db.query(
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

    return {
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
    };
  }

  async getSessionExport(
    courseId: string,
    sessionId: string,
    professorId: string,
  ): Promise<SessionExportResult> {
    const course = await this.courses.getOwnedCourse(courseId, professorId);

    const sessionResult = await this.db.query(
      "SELECT * FROM attendance_sessions WHERE id = $1",
      [sessionId],
    );

    if (sessionResult.rows.length === 0) {
      throw new NotFoundError("Session not found.");
    }

    const attendanceResult = await this.db.query(
      `SELECT u.student_id, u.full_name, u.email,
                ar.scanned_at, ar.is_manual_override
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         LEFT JOIN attendance_records ar ON ar.student_id = u.id AND ar.session_id = $1
         WHERE e.course_id = $2
         ORDER BY u.full_name`,
      [sessionId, courseId],
    );

    return { course, rows: attendanceResult.rows };
  }

  async getCourseExport(
    courseId: string,
    professorId: string,
  ): Promise<CourseExportResult> {
    const course = await this.courses.getOwnedCourse(courseId, professorId);

    const studentsResult = await this.db.query(
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

    return { course, rows: studentsResult.rows };
  }
}
