import "dotenv/config";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

const JWT_SECRET: string = getRequiredEnv("JWT_ACCESS_SECRET");

export type UserRole = "RIDER" | "DRIVER" | "ADMIN";
export type AdminStaffRole =
  | "OWNER"
  | "OPERATIONS"
  | "FINANCE"
  | "SUPPORT"
  | "SAFETY";

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  staffRole?: AdminStaffRole | null;
};

const ADMIN_ACCESS_TTL_SECONDS = 15 * 60;
const MOBILE_ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60;

function accessTokenOptions(role: UserRole): SignOptions {
  return {
    expiresIn:
      role === "ADMIN" ? ADMIN_ACCESS_TTL_SECONDS : MOBILE_ACCESS_TTL_SECONDS,
  };
}

export function createAccessToken(user: {
  id: string;
  role: UserRole;
  adminStaffRole?: AdminStaffRole | null;
}): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      staffRole: user.adminStaffRole ?? null,
    },
    JWT_SECRET,
    accessTokenOptions(user.role),
  );
}

export function verifyAccessToken(
  token: string,
): AccessTokenPayload {
  return jwt.verify(
    token,
    JWT_SECRET,
  ) as AccessTokenPayload;
}
