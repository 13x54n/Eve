import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { prisma } from "../config/prisma.js";
import {
  hasPermission,
  type Permission,
} from "../rbac/permissions.js";
import { verifyAccessToken } from "../utils/jwt.js";
import type {
  AdminStaffRole,
  UserRole,
} from "../utils/jwt.js";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: UserRole;
    staffRole?: AdminStaffRole | null;
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
      staffRole: payload.staffRole ?? null,
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

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authenticatedRequest = req as AuthenticatedRequest;

  if (authenticatedRequest.user?.role !== "ADMIN") {
    res.status(403).json({
      message: "Insufficient permissions",
    });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authenticatedRequest.user.id },
    });

    if (
      !user ||
      !user.isActive ||
      user.accountStatus === "BLOCKED" ||
      user.role !== "ADMIN"
    ) {
      res.status(401).json({
        message: "Invalid or expired token",
      });
      return;
    }

    authenticatedRequest.user.staffRole = user.adminStaffRole;
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(permission: Permission) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const authenticatedRequest = req as AuthenticatedRequest;

    if (
      !hasPermission(
        authenticatedRequest.user?.staffRole,
        permission,
      )
    ) {
      res.status(403).json({
        message: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}
