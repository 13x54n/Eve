import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import type { UserRole } from "../utils/jwt.js";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: UserRole;
  };
};

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Authentication required",
    });
    return;
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const payload = verifyAccessToken(token);

    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      role: payload.role,
    };

    next();
  } catch {
    res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const authenticatedRequest =
      req as AuthenticatedRequest;

    if (
      !authenticatedRequest.user ||
      !roles.includes(authenticatedRequest.user.role)
    ) {
      res.status(403).json({
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}