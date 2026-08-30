import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, type AuthenticatedRequest } from "@eve/http";
import {
  changePassword,
  getUserById,
  loginAdmin,
  loginRider,
  logoutAdmin,
  refreshAdminSession,
  registerRider,
  requestPasswordReset,
  resetPassword,
  updateProfile,
} from "./auth.service.js";
import { loginDriver, registerDriver } from "./driver-auth.js";
import {
  changePasswordSchema,
  driverLoginSchema,
  driverRegisterSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "./validation.js";

const skipInVitest = () => Boolean(process.env.VITEST);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInVitest,
});

const driverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInVitest,
});

export const authRouter = Router();

authRouter.post("/register", limiter, async (req, res, next) => {
  try {
    res.status(201).json(await registerRider(registerSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", limiter, async (req, res, next) => {
  try {
    res.status(200).json(await loginRider(loginSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/driver/register", limiter, async (req, res, next) => {
  try {
    res.status(201).json(await registerDriver(driverRegisterSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/driver/login", limiter, async (req, res, next) => {
  try {
    res.status(200).json(await loginDriver(driverLoginSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/admin/login", limiter, async (req, res, next) => {
  try {
    res.status(200).json(await loginAdmin(loginSchema.parse(req.body), {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    }));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/admin/refresh", limiter, async (req, res, next) => {
  try {
    res.status(200).json(
      await refreshAdminSession(refreshTokenSchema.parse(req.body).refreshToken),
    );
  } catch (error) {
    next(error);
  }
});

authRouter.post("/admin/logout", async (req, res, next) => {
  try {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (parsed.success) {
      await logoutAdmin(parsed.data.refreshToken);
    }
    res.status(200).json({ message: "Signed out" });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/forgot-password", limiter, async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await requestPasswordReset(email);
    res.status(200).json({
      message: "If an account exists, a verification code was sent.",
      ...(result.verificationCode ? { verificationCode: result.verificationCode } : {}),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password", limiter, async (req, res, next) => {
  try {
    await resetPassword(resetPasswordSchema.parse(req.body));
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", limiter, requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById((req as AuthenticatedRequest).user.id);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.patch("/me", limiter, requireAuth, async (req, res, next) => {
  try {
    const user = await updateProfile(
      (req as AuthenticatedRequest).user.id,
      updateProfileSchema.parse(req.body),
    );
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/change-password", limiter, requireAuth, async (req, res, next) => {
  try {
    await changePassword(
      (req as AuthenticatedRequest).user.id,
      changePasswordSchema.parse(req.body),
    );
    res.status(200).json({ message: "Password updated" });
  } catch (error) {
    next(error);
  }
});

export const driverAuthRouter = Router();

driverAuthRouter.post("/register", driverLimiter, async (req, res, next) => {
  try {
    res.status(201).json(await registerDriver(driverRegisterSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

driverAuthRouter.post("/login", driverLimiter, async (req, res, next) => {
  try {
    res.status(200).json(await loginDriver(driverLoginSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});
