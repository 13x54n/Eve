import type {
  NextFunction,
  Request,
  Response,
} from "express";
import {
  getUserById,
  loginAdmin,
  loginRider,
  registerRider,
  requestPasswordReset,
  resetPassword,
} from "../services/auth.service.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validation/auth.validation.js";
import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware.js";

// controller functions for register
export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await registerRider(data);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginRider(data);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function adminLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginAdmin(data, {
      ip: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authenticatedRequest =
      req as AuthenticatedRequest;

    const user = await getUserById(
      authenticatedRequest.user.id,
    );

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await requestPasswordReset(email);

    res.status(200).json({
      message: "If an account exists, a verification code was sent.",
      ...(result.verificationCode
        ? { verificationCode: result.verificationCode }
        : {}),
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await resetPassword(resetPasswordSchema.parse(req.body));
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
}