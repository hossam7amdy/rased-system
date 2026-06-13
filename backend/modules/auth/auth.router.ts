import { Router } from "express";
import { checkRole, verifyToken } from "../../middleware/auth.ts";
import { AuthService } from "./auth.service.ts";
import { LoginSchema, RegisterSchema } from "./auth.validator.ts";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.validBody(LoginSchema);
  const service = req.resolve(AuthService);
  const result = await service.login(email, password);
  return res.json({
    success: true,
    message: "تم تسجيل الدخول بنجاح.",
    data: result,
  });
});

router.post(
  "/auth/register",
  verifyToken,
  checkRole("admin", "professor"),
  async (req, res) => {
    const payload = req.validBody(RegisterSchema);
    const service = req.resolve(AuthService);
    const user = await service.register(payload);
    return res.status(201).json({
      success: true,
      message: "تم إنشاء الحساب بنجاح.",
      data: { user },
    });
  },
);

router.get("/auth/profile", verifyToken, async (req, res) => {
  const service = req.resolve(AuthService);
  const user = await service.getProfile(req.user!.id);
  return res.json({ success: true, data: { user } });
});

export default router;
