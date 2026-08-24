import type {
  NextFunction,
  Request,
  Response,
} from "express";
import {
  getUserById,
  loginRider,
  registerRider,
} from "../services/auth.service.js";
import {
  loginSchema,
  registerSchema,
} from "../validation/auth.validation.js";
import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware.js";

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