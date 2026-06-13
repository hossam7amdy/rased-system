import { inject } from "injectus";
import { DatabaseError } from "pg";
import { Database } from "../../shared/database/database.ts";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors.ts";
import type {
  CourseDetailDto,
  CourseStudentDto,
  CreateCourseDto,
  ProfessorCourseDto,
  StudentCourseDto,
} from "./course.dto.ts";
import type { Course, Enrollment } from "./course.model.ts";

export class CoursesService {
  private readonly db: Database;
  constructor(db = inject(Database)) {
    this.db = db;
  }

  async create(input: CreateCourseDto): Promise<Course> {
    try {
      const result = await this.db.query(
        `INSERT INTO courses (course_code, course_name, professor_id, semester, academic_year)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          input.courseCode,
          input.courseName,
          input.professorId,
          input.semester,
          input.academicYear,
        ],
      );

      return result.rows[0];
    } catch (error) {
      if (error instanceof DatabaseError && error.code === "23505") {
        throw new ConflictError("Course code already exists.");
      }
      throw error;
    }
  }

  async remove(courseId: string, professorId: string): Promise<void> {
    const result = await this.db.query(
      "DELETE FROM courses WHERE id = $1 AND professor_id = $2 RETURNING *",
      [courseId, professorId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("المادة غير موجودة أو ليس لديك صلاحية لحذفها.");
    }
  }

  async listForProfessor(professorId: string): Promise<ProfessorCourseDto[]> {
    const result = await this.db.query(
      `SELECT c.*,
                COUNT(DISTINCT e.student_id) as student_count,
                COUNT(DISTINCT s.id) as session_count
         FROM courses c
         LEFT JOIN enrollments e ON c.id = e.course_id
         LEFT JOIN attendance_sessions s ON c.id = s.course_id
         WHERE c.professor_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
      [professorId],
    );

    return result.rows;
  }

  async listForStudent(studentId: string): Promise<StudentCourseDto[]> {
    const result = await this.db.query(
      `SELECT c.id, c.course_name, c.course_code, u.full_name as professor_name,
                  COUNT(DISTINCT s.id) as total_sessions,
                  COUNT(DISTINCT ar.id) as attended_sessions
          FROM enrollments e
          JOIN courses c ON e.course_id = c.id
          JOIN users u ON c.professor_id = u.id
          LEFT JOIN attendance_sessions s ON c.id = s.course_id
          LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = $1
          WHERE e.student_id = $1
          GROUP BY c.id, u.full_name, e.enrolled_at
          ORDER BY e.enrolled_at DESC`,
      [studentId],
    );

    return result.rows.map((course) => {
      const totalSessions = parseInt(course.total_sessions as string, 10) || 0;
      const attendedSessions =
        parseInt(course.attended_sessions as string, 10) || 0;
      return {
        ...course,
        total_sessions: totalSessions,
        attended_sessions: attendedSessions,
        attendance_percentage:
          totalSessions > 0
            ? Math.round((attendedSessions / totalSessions) * 100)
            : 0,
      };
    });
  }

  async enroll(
    courseId: string,
    professorId: string,
    studentIds: string[],
  ): Promise<Enrollment[]> {
    await this.assertOwnership(courseId, professorId);

    // Single bulk insert via unnest: one connection, atomic, no pool exhaustion.
    // ON CONFLICT skips already-enrolled students; RETURNING yields only new rows.
    const result = await this.db.query(
      `INSERT INTO enrollments (course_id, student_id)
         SELECT $1::uuid, unnest($2::uuid[])
         ON CONFLICT (course_id, student_id) DO NOTHING
         RETURNING *`,
      [courseId, studentIds],
    );

    return result.rows as Enrollment[];
  }

  async getStudents(
    courseId: string,
    professorId: string,
  ): Promise<CourseStudentDto[]> {
    await this.assertOwnership(courseId, professorId);

    const result = await this.db.query(
      `SELECT u.id, u.full_name, u.student_id, u.email,
                e.enrolled_at,
                COUNT(DISTINCT s.id) as total_sessions,
                COUNT(DISTINCT ar.id) as attended_sessions
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         LEFT JOIN attendance_sessions s ON e.course_id = s.course_id
         LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.student_id = u.id
         WHERE e.course_id = $1
         GROUP BY u.id, e.enrolled_at
         ORDER BY u.full_name`,
      [courseId],
    );

    return result.rows.map((student) => {
      const totalSessions = parseInt(student.total_sessions as string, 10) || 0;
      const attendedSessions =
        parseInt(student.attended_sessions as string, 10) || 0;
      return {
        ...student,
        total_sessions: totalSessions,
        attended_sessions: attendedSessions,
        attendance_percentage:
          totalSessions > 0
            ? Math.round((attendedSessions / totalSessions) * 100)
            : 0,
        is_at_risk:
          totalSessions > 0 && attendedSessions / totalSessions < 0.25,
      };
    });
  }

  async getDetails(
    courseId: string,
    userId: string,
    userRole: string,
  ): Promise<CourseDetailDto> {
    const courseResult = await this.db.query(
      `SELECT c.*, u.full_name as professor_name
         FROM courses c
         JOIN users u ON c.professor_id = u.id
         WHERE c.id = $1`,
      [courseId],
    );

    if (courseResult.rows.length === 0) {
      throw new NotFoundError("Course not found.");
    }

    const course = courseResult.rows[0] as Record<string, unknown>;

    if (userRole === "professor" && course["professor_id"] !== userId) {
      throw new ForbiddenError("Access denied.");
    }

    if (userRole === "student") {
      const enrollmentCheck = await this.db.query(
        "SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2",
        [courseId, userId],
      );

      if (enrollmentCheck.rows.length === 0) {
        throw new ForbiddenError("You are not enrolled in this course.");
      }
    }

    const studentsResult = await this.db.query(
      "SELECT COUNT(*) as count FROM enrollments WHERE course_id = $1",
      [courseId],
    );

    course["enrolled_students"] = parseInt(
      (studentsResult.rows[0] as { count: string }).count,
      10,
    );

    return course as unknown as CourseDetailDto;
  }

  async getOwnedCourse(courseId: string, professorId: string): Promise<Course> {
    const result = await this.db.query(
      "SELECT * FROM courses WHERE id = $1 AND professor_id = $2",
      [courseId, professorId],
    );

    if (result.rows.length === 0) {
      throw new ForbiddenError("Access denied.");
    }

    return result.rows[0];
  }

  private async assertOwnership(
    courseId: string,
    professorId: string,
  ): Promise<void> {
    const courseCheck = await this.db.query(
      "SELECT id FROM courses WHERE id = $1 AND professor_id = $2",
      [courseId, professorId],
    );

    if (courseCheck.rows.length === 0) {
      throw new ForbiddenError("Access denied.");
    }
  }
}
