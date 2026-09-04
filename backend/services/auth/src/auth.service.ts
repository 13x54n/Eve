import { createHash, randomBytes, randomInt } from "node:crypto";
import { getDriverProfile, prisma, sanitizeDriverUser } from "@eve/db";
import {
  createAccessToken,
  fail,
  hashPassword,
  listPermissions,
  verifyPassword,
  type AdminStaffRole,
  type AdminStaffTitle,
  type UserRole,
} from "@eve/shared";
import { verifyPrivyIdentityToken } from "./privy.js";
import { verificationCodeSender } from "./verification-code.js";

const resetCodeLifetimeMs = 10 * 60 * 1000;
const adminRefreshTtlMs = 7 * 24 * 60 * 60 * 1000;

function hashResetCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function createRefreshToken() {
  return randomBytes(32).toString("hex");
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function unauthorized(message = "Invalid or expired token"): never {
  const error = new Error(message);
  error.name = "UnauthorizedError";
  throw error;
}

type UserRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ethereumWallet?: string | null;
  solanaWallet?: string | null;
  role: UserRole;
  adminStaffRole?: AdminStaffRole | null;
  adminStaffTitle?: AdminStaffTitle | null;
  accountStatus?: string;
  isActive: boolean;
  flagged?: boolean;
  city?: string | null;
  mfaEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
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
    ethereumWallet: user.ethereumWallet ?? null,
    solanaWallet: user.solanaWallet ?? null,
    role: user.role,
    adminStaffRole: staffRole,
    adminStaffTitle: user.adminStaffTitle ?? null,
    accountStatus: user.accountStatus ?? "ACTIVE",
    isActive: user.isActive,
    flagged: user.flagged ?? false,
    city: user.city ?? null,
    mfaEnabled: user.mfaEnabled ?? false,
    pushNotificationsEnabled: user.pushNotificationsEnabled ?? true,
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

  if (!user || !user.isActive || !user.passwordHash) {
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

  const passwordIsValid = user?.passwordHash
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

  const refreshToken = createRefreshToken();

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
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + adminRefreshTtlMs),
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
    refreshToken,
    user: sanitizeUser(user),
  };
}

export async function refreshAdminSession(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  const now = new Date();

  if (!session || session.revokedAt != null || session.expiresAt <= now) {
    if (session && !session.revokedAt) {
      await prisma.adminSession.update({
        where: { id: session.id },
        data: { revokedAt: now },
      });
    }

    unauthorized();
  }

  const { user } = session;

  if (
    !user.isActive ||
    user.role !== "ADMIN" ||
    user.accountStatus === "BLOCKED"
  ) {
    await prisma.adminSession.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    unauthorized();
  }

  const nextRefreshToken = createRefreshToken();
  await prisma.adminSession.update({
    where: { id: session.id },
    data: {
      tokenHash: hashRefreshToken(nextRefreshToken),
      lastUsedAt: now,
    },
  });

  return {
    accessToken: createAccessToken(user),
    refreshToken: nextRefreshToken,
    user: sanitizeUser(user),
  };
}

export async function logoutAdmin(refreshToken: string) {
  await prisma.adminSession.updateMany({
    where: {
      tokenHash: hashRefreshToken(refreshToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

function withSessionRole(user: UserRecord, sessionRole?: UserRole) {
  const sanitized = sanitizeUser(user);
  if (sessionRole === "RIDER" || sessionRole === "DRIVER") {
    return { ...sanitized, role: sessionRole };
  }
  return sanitized;
}

export async function getUserById(userId: string, sessionRole?: UserRole) {
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

  return withSessionRole(user, sessionRole);
}

export async function updateProfile(
  userId: string,
  input: {
    name: string;
    email?: string | null;
    phone?: string | null;
    pushNotificationsEnabled?: boolean;
  },
  sessionRole?: UserRole,
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
  });

  if (!user) {
    const error = new Error("User not found");
    error.name = "NotFoundError";
    throw error;
  }

  const email = input.email === undefined ? user.email : input.email;
  const phone = input.phone === undefined ? user.phone : input.phone;

  if (email && email !== user.email) {
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
      ...(input.pushNotificationsEnabled === undefined
        ? {}
        : { pushNotificationsEnabled: input.pushNotificationsEnabled }),
    },
  });

  return withSessionRole(updated, sessionRole);
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
  });
  if (!user) {
    const error = new Error("User not found");
    error.name = "NotFoundError";
    throw error;
  }
  if (!user.passwordHash) {
    fail("This account does not have a password to change", "UnauthorizedError");
  }
  const valid = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!valid) {
    const error = new Error("Current password is incorrect");
    error.name = "UnauthorizedError";
    throw error;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    return;
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

  if (!user.email) {
    return;
  }

  await verificationCodeSender.sendCode({ email: user.email, code });
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

function displayNameFromPrivy(input: {
  name?: string;
  email?: string;
  phone?: string;
  fallback: string;
}) {
  const named = input.name?.trim();
  if (named) return named;
  if (input.email) return input.email.split("@")[0] || input.fallback;
  if (input.phone) return input.phone;
  return input.fallback;
}

const pendingDriverProfile = {
  approvalStatus: "PENDING" as const,
  presence: "OFFLINE" as const,
  rating: 5.0,
  acceptanceRate: 100,
  cancellationRate: 0,
  onlineHours: 0,
  earningsTotal: 0,
};

async function createPrivyDriver(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  privyDid: string;
  ethereumWallet?: string | null;
  solanaWallet?: string | null;
}) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      privyDid: input.privyDid,
      ethereumWallet: input.ethereumWallet ?? null,
      solanaWallet: input.solanaWallet ?? null,
      role: "DRIVER",
      accountStatus: "PENDING",
      driverProfile: { create: pendingDriverProfile },
    },
  });
}

async function ensureMobileProfile(
  userId: string,
  role: "RIDER" | "DRIVER",
  city?: string | null,
) {
  if (role === "DRIVER") {
    await prisma.driverProfile.upsert({
      where: { userId },
      create: { userId, city: city ?? undefined, ...pendingDriverProfile },
      update: {},
    });
    return;
  }

  await prisma.riderProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

function rejectAdminOnMobile(user: { role: UserRole }) {
  if (user.role === "ADMIN") {
    fail("This account is registered for a different app", "ForbiddenError");
  }
}

function sessionUser<T extends { role: string }>(user: T, role: "RIDER" | "DRIVER") {
  return { ...user, role };
}

export async function exchangePrivySession(
  role: "RIDER" | "DRIVER",
  identityToken: string,
  wallets?: { ethereumWallet?: string; solanaWallet?: string },
) {
  const claims = await verifyPrivyIdentityToken(identityToken);
  const email = claims.email?.trim().toLowerCase();
  const phone = claims.phone?.trim() || null;
  const ethereumWallet = claims.ethereumWallet ?? wallets?.ethereumWallet ?? null;
  const solanaWallet = claims.solanaWallet ?? wallets?.solanaWallet ?? null;

  let user = await prisma.user.findUnique({ where: { privyDid: claims.privyDid } });

  if (!user && phone) {
    const byPhone = await prisma.user.findUnique({ where: { phone } });
    if (byPhone) {
      rejectAdminOnMobile(byPhone);
      user = await prisma.user.update({
        where: { id: byPhone.id },
        data: {
          privyDid: claims.privyDid,
          lastLoginAt: new Date(),
          ...(email && !byPhone.email ? { email } : {}),
          ...(ethereumWallet ? { ethereumWallet } : {}),
          ...(solanaWallet ? { solanaWallet } : {}),
        },
      });
    }
  }

  if (!user && email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      rejectAdminOnMobile(byEmail);
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          privyDid: claims.privyDid,
          lastLoginAt: new Date(),
          ...(phone && !byEmail.phone ? { phone } : {}),
          ...(ethereumWallet ? { ethereumWallet } : {}),
          ...(solanaWallet ? { solanaWallet } : {}),
        },
      });
    }
  }

  if (!user) {
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        fail("An account with this email already exists", "ConflictError");
      }
    }
    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        fail("An account with this phone number already exists", "ConflictError");
      }
    }

    const name = displayNameFromPrivy({
      name: claims.name,
      email,
      phone: phone ?? undefined,
      fallback: role === "DRIVER" ? "Driver" : "Rider",
    });
    user =
      role === "DRIVER"
        ? await createPrivyDriver({
            name,
            email,
            phone,
            privyDid: claims.privyDid,
            ethereumWallet,
            solanaWallet,
          })
        : await prisma.user.create({
            data: {
              name,
              email,
              phone,
              privyDid: claims.privyDid,
              ethereumWallet,
              solanaWallet,
              role: "RIDER",
              riderProfile: { create: {} },
            },
          });
  } else {
    rejectAdminOnMobile(user);
    if (!user.isActive) {
      fail("Invalid or expired token", "UnauthorizedError");
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ...(ethereumWallet && ethereumWallet !== user.ethereumWallet
          ? { ethereumWallet }
          : {}),
        ...(solanaWallet && solanaWallet !== user.solanaWallet
          ? { solanaWallet }
          : {}),
      },
    });
    await ensureMobileProfile(user.id, role, user.city);
  }

  const session = sessionUser(user, role);

  if (role === "DRIVER") {
    const fullProfile = await getDriverProfile(user.id);
    return {
      accessToken: createAccessToken(session),
      user: sanitizeDriverUser({
        ...session,
        ethereumWallet: user.ethereumWallet,
        solanaWallet: user.solanaWallet,
      }),
      driverProfile: fullProfile,
    };
  }

  return {
    accessToken: createAccessToken(session),
    user: sanitizeUser(session),
  };
}
