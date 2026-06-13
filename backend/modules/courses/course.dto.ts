import type { output } from "zod";
import type { Course } from "./course.model.ts";
import type { CreateCourseSchema, EnrollSchema } from "./course.validator.ts";

export type CreateCourseDto = output<typeof CreateCourseSchema> & {
  professorId: string;
};

export type EnrollDto = output<typeof EnrollSchema>;

export interface ProfessorCourseDto extends Course {
  student_count: string;
  session_count: string;
}

export interface StudentCourseDto {
  id: string;
  course_name: string;
  course_code: string;
  professor_name: string;
  total_sessions: number;
  attended_sessions: number;
  attendance_percentage: number;
}

export interface CourseDetailDto extends Course {
  professor_name: string;
  enrolled_students: number;
}

export interface CourseStudentDto {
  id: string;
  full_name: string;
  student_id: string | null;
  email: string;
  enrolled_at: Date;
  total_sessions: number;
  attended_sessions: number;
  attendance_percentage: number;
  is_at_risk: boolean;
}
