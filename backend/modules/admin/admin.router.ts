import { Router } from "express";
import { checkRole, verifyToken } from "../../middleware/auth.ts";
import { AdminService } from "./admin.service.ts";
import {
  EnrollBulkSchema,
  EnrollImportSchema,
  EnrollSchema,
  SearchQuerySchema,
  UserIdParamSchema,
} from "./admin.validator.ts";

const router = Router();

router.get(
  "/admin/users",
  verifyToken,
  checkRole("admin"),
  async (req, res) => {
    const service = req.resolve(AdminService);
    const users = await service.listUsers();
    return res.json({ success: true, data: { users } });
  },
);

router.delete(
  "/admin/users/:id",
  verifyToken,
  checkRole("admin"),
  async (req, res) => {
    const { id } = req.validParams(UserIdParamSchema);
    const service = req.resolve(AdminService);
    await service.deleteUser(id, req.user!.id);
    return res.status(204).end();
  },
);

router.get(
  "/admin/students",
  verifyToken,
  checkRole("admin"),
  async (req, res) => {
    const { q } = req.validQuery(SearchQuerySchema);
    const service = req.resolve(AdminService);
    const students = await service.searchStudents(q);
    return res.json({ success: true, data: { students } });
  },
);

router.get(
  "/admin/courses",
  verifyToken,
  checkRole("admin"),
  async (req, res) => {
    const { q } = req.validQuery(SearchQuerySchema);
    const service = req.resolve(AdminService);
    const courses = await service.searchCourses(q);
    return res.json({ success: true, data: { courses } });
  },
);

router.post(
  "/admin/enroll",
  verifyToken,
  checkRole("admin"),
  async (req, res) => {
    const { studentId, courseId } = req.validBody(EnrollSchema);
    const service = req.resolve(AdminService);
    const enrollment = await service.enrollOne(studentId, courseId);
    return res.status(201).json({
      success: true,
      message: "تم ربط الطالب بالكورس بنجاح.",
      data: { enrollment },
    });
  },
);

router.post(
  "/admin/enroll-bulk",
  verifyToken,
  checkRole("admin"),
  async (req, res) => {
    const { studentIds, courseIds } = req.validBody(EnrollBulkSchema);
    const service = req.resolve(AdminService);
    const { enrolled, duplicates, errors } = await service.enrollBulk(
      studentIds,
      courseIds,
    );
    return res.status(201).json({
      success: true,
      message: `تمّ الربط: ${enrolled} تسجيل جديد، ${duplicates} مكرر، ${errors} خطأ.`,
      enrolled,
      duplicates,
      errors,
    });
  },
);

router.post(
  "/admin/enroll-import",
  verifyToken,
  checkRole("admin"),
  async (req, res) => {
    const { rows } = req.validBody(EnrollImportSchema);
    const service = req.resolve(AdminService);
    const { total, enrolled, duplicates, errors, details } =
      await service.enrollImport(rows);
    return res.status(201).json({
      success: true,
      message: `الاستيراد اكتمل: ${enrolled} جديد، ${duplicates} مكرر، ${errors} خطأ.`,
      total,
      enrolled,
      duplicates,
      errors,
      details,
    });
  },
);

export default router;
