import z from "zod";

export const CreateCourseSchema = z.strictObject({
  courseCode: z.string().min(3).max(20),
  courseName: z.string().min(3).max(255),
  semester: z.string().min(3).max(50),
  academicYear: z.string().min(4).max(10),
});

export const EnrollSchema = z.strictObject({
  studentIds: z
    .array(z.uuid())
    .min(1, "يجب تحديد طالب واحد على الأقل.")
    .max(2000),
});
