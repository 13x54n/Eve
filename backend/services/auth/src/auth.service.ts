import { createHash, randomInt } from "node:crypto";
import { prisma } from "@eve/db";
import {
  createAccessToken,
  hashPassword,
  listPermissions,
  verifyPassword,
  type AdminStaffRole,
  type UserRole,
} from "@eve/shared";
import { verificationCodeSender } from "./verification-code.js";

const resetCodeLifetimeMs = 10 * 60 * 1000;

function hashResetCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  adminStaffRole?: AdminStaffRole | null;
  accountStatus?: string;
  isActive: boolean;
  flagged?: boolean;
  city?: string | null;
  mfaEnabled?: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
};

export function sanitizeUser(user: UserRecord) {
  const staffRole = user.adminStaffRole ?? null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    adminStaffRole: staffRole,
    accountStatus: user.accountStatus ?? "ACTIVE",
    isActive: user.isActive,
    flagged: user.flagged ?? false,
    city: user.city ?? null,
    mfaEnabled: user.mfaEnabled ?? false,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    permissions:
      user.role === "ADMIN" ? listPermissions(staffRole) : [],
  };
}

function conflict(message: string): never {
  const error = new Error(message);
  error.name = "ConflictError";
  throw error;
}

function normalizePhone(phone: string | null | undefined) {
  const trimmed = phone?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

export async function registerRider(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (existingUser) {
    conflict("Unable to create account with these details");
  }

  const phone = normalizePhone(input.phone);
  if (phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      conflict("Unable to create account with these details");
    }
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone,
      passwordHash,
      role: "RIDER",
      riderProfile: { create: {} },
    },
  });

  return {
    accessToken: createAccessToken(user),
    user: sanitizeUser(user),
  };
}

export async function loginRider(input: {
  email: string;
  password: string;
}) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (!user || !user.isActive) {
    const error = new Error("Invalid email or password");
    error.name = "UnauthorizedError";
    throw error;
  }

  const passwordIsValid = await verifyPassword(
    user.passwordHash,
    input.password,
  );

  if (!passwordIsValid) {
    const error = new Error("Invalid email or password");
    error.name = "UnauthorizedError";
    throw error;
  }

  return {
    accessToken: createAccessToken(user),
    user: sanitizeUser(user),
  };
}

export async function loginAdmin(
  input: {
    email: string;
    password: string;
  },
  context: {
    ip?: string;
    userAgent?: string;
  } = {},
) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  const passwordIsValid = user
    ? await verifyPassword(user.passwordHash, input.password)
    : false;

  if (
    !user ||
    !user.isActive ||
    user.role !== "ADMIN" ||
    user.accountStatus === "BLOCKED" ||
    !passwordIsValid
  ) {
    if (user?.role === "ADMIN") {
      await prisma.adminLoginEvent.create({
        data: {
          userId: user.id,
          ip: context.ip,
          userAgent: context.userAgent,
          success: false,
        },
      });
    }

    const error = new Error("Invalid email or password");
    error.name = "UnauthorizedError";
    throw error;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    prisma.adminLoginEvent.create({
      data: {
        userId: user.id,
        ip: context.ip,
        userAgent: context.userAgent,
        success: true,
      },
    }),
    prisma.adminSession.create({
      data: {
        userId: user.id,
        ip: context.ip,
        userAgent: context.userAgent,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "admin.login",
        entity: "User",
        entityId: user.id,
        ip: context.ip,
      },
    }),
  ]);

  return {
    accessToken: createAccessToken(user),
    user: sanitizeUser(user),
  };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
    },
  });

  if (!user) {
    const error = new Error("User not found");
    error.name = "NotFoundError";
    throw error;
  }

  return sanitizeUser(user);
}

export async function updateProfile(
  userId: string,
  input: { name: string; email: string; phone?: string | null },
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
  });

  if (!user) {
    const error = new Error("User not found");
    error.name = "NotFoundError";
    throw error;
  }

  const email = input.email.trim().toLowerCase();
  const phone = input.phone === undefined ? user.phone : input.phone;

  if (email !== user.email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) conflict("An account with this email already exists");
  }

  if (phone && phone !== user.phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) conflict("An account with this phone number already exists");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name.trim(),
      email,
      phone,
    },
  });

  return sanitizeUser(updated);
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    return { verificationCode: undefined };
  }

  await prisma.passwordResetCode.deleteMany({ where: { userId: user.id } });

  const code = randomInt(100000, 1000000).toString();
  await prisma.passwordResetCode.create({
    data: {
      userId: user.id,
      codeHash: hashResetCode(code),
      expiresAt: new Date(Date.now() + resetCodeLifetimeMs),
    },
  });

  await verificationCodeSender.sendCode({ email: user.email, code });

  return {
    verificationCode:
      process.env.NODE_ENV === "production" ? undefined : code,
  };
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const resetCode = user
    ? await prisma.passwordResetCode.findFirst({
        where: {
          userId: user.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (!user || !user.isActive || !resetCode ||
      resetCode.codeHash !== hashResetCode(input.code)) {
    const error = new Error("Invalid or expired verification code");
    error.name = "UnauthorizedError";
    throw error;
  }

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { consumedAt: new Date() },
    }),
  ]);
}