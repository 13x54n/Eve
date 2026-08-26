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

const jwtOptions: SignOptions = {
  expiresIn: 15 * 60,
};

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
    jwtOptions,
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
