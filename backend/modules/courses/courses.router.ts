import type { Request, Response } from "express";
import { Router } from "express";
import { checkRole, verifyToken } from "../../middleware/auth.ts";
import { CreateCourseSchema, EnrollSchema } from "./course.validator.ts";
import { CoursesService } from "./courses.service.ts";

const router = Router();

router.post(
  "/courses",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const professorId = req.user!.id;
    const payload = req.validBody(CreateCourseSchema);
    const service = req.resolve(CoursesService);
    const course = await service.create({ ...payload, professorId });
    return res.status(201).json({
      success: true,
      message: "Course created successfully.",
      data: { course },
    });
  },
);

router.delete(
  "/courses/:courseId",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const { courseId } = req.params as { courseId: string };
    const professorId = req.user!.id;
    const service = req.resolve(CoursesService);
    await service.remove(courseId, professorId);
    return res.json({
      success: true,
      message: "تم حذف المادة وجميع البيانات المرتبطة بها بنجاح.",
    });
  },
);

router.get(
  "/courses/my-courses",
  verifyToken,
  checkRole("student"),
  async (req, res) => {
    const studentId = req.user!.id;
    const service = req.resolve(CoursesService);
    const courses = await service.listForStudent(studentId);
    return res.json({ success: true, courses });
  },
);

router.get("/courses", verifyToken, async (req: Request, res: Response) => {
  const service = req.resolve(CoursesService);
  if (req.user?.role === "professor") {
    const courses = await service.listForProfessor(req.user.id);
    return res.json({ success: true, data: { courses } });
  } else if (req.user?.role === "student") {
    const courses = await service.listForStudent(req.user.id);
    return res.json({ success: true, courses });
  }
  return res.status(403).json({ success: false, message: "Access denied." });
});

router.get("/courses/:courseId", verifyToken, async (req, res) => {
  const { courseId } = req.params as { courseId: string };
  const service = req.resolve(CoursesService);
  const course = await service.getDetails(
    courseId,
    req.user!.id,
    req.user!.role,
  );
  return res.json({ success: true, data: { course } });
});

router.post(
  "/courses/:courseId/enroll",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const { courseId } = req.params as { courseId: string };
    const professorId = req.user!.id;
    const { studentIds } = req.validBody(EnrollSchema);
    const service = req.resolve(CoursesService);
    const enrollments = await service.enroll(courseId, professorId, studentIds);
    return res.json({
      success: true,
      message: `${enrollments.length} student(s) enrolled successfully.`,
      data: { enrollments },
    });
  },
);

router.get(
  "/courses/:courseId/students",
  verifyToken,
  checkRole("professor"),
  async (req, res) => {
    const { courseId } = req.params as { courseId: string };
    const professorId = req.user!.id;
    const service = req.resolve(CoursesService);
    const students = await service.getStudents(courseId, professorId);
    return res.json({ success: true, data: { students } });
  },
);

export default router;
