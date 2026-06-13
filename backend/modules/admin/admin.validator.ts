import z from "zod";

export const SearchQuerySchema = z.object({
  q: z.string().max(100).optional().default(""),
});

export const EnrollSchema = z.strictObject({
  studentId: z.uuid(),
  courseId: z.uuid(),
});

export const EnrollBulkSchema = z
  .strictObject({
    studentIds: z
      .array(z.uuid())
      .min(1, "يجب تحديد طالب واحد على الأقل ومادة واحدة على الأقل.")
      .max(2000),
    courseIds: z
      .array(z.uuid())
      .min(1, "يجب تحديد طالب واحد على الأقل ومادة واحدة على الأقل.")
      .max(2000),
  })
  .refine((v) => v.studentIds.length * v.courseIds.length <= 2000, {
    message: "عدد التسجيلات المطلوبة كبير جداً. يُرجى تقسيمها على دفعات.",
  });

// Non-strict: rows originate from spreadsheets and may carry extra columns.
const ImportRowSchema = z.object({
  rowNum: z.coerce.number().int().nonnegative().max(100_000).optional(),
  studentId: z.coerce.string().max(50).optional(),
  studentName: z.coerce.string().max(255).optional(),
  courseCode: z.coerce.string().max(50).optional(),
  courseName: z.coerce.string().max(255).optional(),
});

export const EnrollImportSchema = z.strictObject({
  rows: z
    .array(ImportRowSchema)
    .min(1, "لا توجد بيانات للاستيراد.")
    .max(5000, "الحد الأقصى للاستيراد الواحد هو 5000 صف."),
});
