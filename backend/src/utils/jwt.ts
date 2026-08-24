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

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
};

const jwtOptions: SignOptions = {
  expiresIn: 15 * 60,
};

export function createAccessToken(user: {
  id: string;
  role: UserRole;
}): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
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