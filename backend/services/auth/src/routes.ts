import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, type AuthenticatedRequest } from "@eve/http";
import {
  changePassword,
  exchangeAuth0Session,
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
  auth0ExchangeSchema,
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

const WINDOW_MS = 15 * 60 * 1000;

const credentialLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInVitest,
});

const sessionLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 400,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInVitest,
});

const driverLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 400,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInVitest,
});

export const authRouter = Router();

authRouter.post("/register", credentialLimiter, async (req, res, next) => {
  try {
    res.status(201).json(await registerRider(registerSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", credentialLimiter, async (req, res, next) => {
  try {
    res.status(200).json(await loginRider(loginSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/auth0", sessionLimiter, async (req, res, next) => {
  try {
    res.status(200).json(
      await exchangeAuth0Session("RIDER", auth0ExchangeSchema.parse(req.body).idToken),
    );
  } catch (error) {
    next(error);
  }
});

authRouter.post("/driver/register", credentialLimiter, async (req, res, next) => {
  try {
    res.status(201).json(await registerDriver(driverRegisterSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/driver/login", credentialLimiter, async (req, res, next) => {
  try {
    res.status(200).json(await loginDriver(driverLoginSchema.parse(req.body)));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/driver/auth0", sessionLimiter, async (req, res, next) => {
  try {
    res.status(200).json(
      await exchangeAuth0Session("DRIVER", auth0ExchangeSchema.parse(req.body).idToken),
    );
  } catch (error) {
    next(error);
  }
});

authRouter.post("/admin/login", credentialLimiter, async (req, res, next) => {
  try {
    res.status(200).json(await loginAdmin(loginSchema.parse(req.body), {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    }));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/admin/refresh", sessionLimiter, async (req, res, next) => {
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

authRouter.post("/forgot-password", credentialLimiter, async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    await requestPasswordReset(email);
    res.status(200).json({
      message: "If an account exists, a verification code was sent.",
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password", credentialLimiter, async (req, res, next) => {
  try {
    await resetPassword(resetPasswordSchema.parse(req.body));
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", sessionLimiter, requireAuth, async (req, res, next) => {
  try {
    const session = (req as AuthenticatedRequest).user;
    const user = await getUserById(session.id, session.role);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.patch("/me", sessionLimiter, requireAuth, async (req, res, next) => {
  try {
    const session = (req as AuthenticatedRequest).user;
    const user = await updateProfile(
      session.id,
      updateProfileSchema.parse(req.body),
      session.role,
    );
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/change-password", credentialLimiter, requireAuth, async (req, res, next) => {
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

driverAuthRouter.post("/auth0", driverLimiter, async (req, res, next) => {
  try {
    res.status(200).json(
      await exchangeAuth0Session("DRIVER", auth0ExchangeSchema.parse(req.body).idToken),
    );
  } catch (error) {
    next(error);
  }
});
