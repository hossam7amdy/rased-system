import z from "zod";

export const LoginSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1).max(72),
});

export const RegisterSchema = z
  .strictObject({
    email: z.email().max(255),
    password: z.string().min(6).max(72),
    role: z.enum(["professor", "student", "admin"]),
    fullName: z.string().min(1).max(255),
    studentId: z.string().max(50).optional(),
  })
  .refine((v) => v.role !== "student" || !!v.studentId, {
    message: "يجب إدخال الرقم الجامعي للطالب.",
    path: ["studentId"],
  });
