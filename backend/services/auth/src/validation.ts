import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(25).optional(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(256),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits"),
  password: z.string().min(8).max(128),
});

export const driverRegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(25).optional(),
  password: z.string().min(8).max(128),
  city: z.string().trim().min(2).max(80).default("New York"),
  vehicleMake: z.string().trim().min(1).max(50).default("Toyota"),
  vehicleModel: z.string().trim().min(1).max(50).default("Camry"),
  vehicleYear: z.coerce.number().int().min(1995).max(2030).default(2022),
  vehicleColor: z.string().trim().min(2).max(40).default("Black"),
  vehiclePlateNumber: z.string().trim().min(2).max(20),
  vehicleType: z.enum(["BIKE", "CAR"]),
  vehicleCategory: z.string().trim().default("standard"),
  vehicleCapacity: z.coerce.number().int().min(1).max(10).default(4),
});

export const driverLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length === 0 ? null : trimmed;
  }, z.union([z.string().email(), z.null()]).optional()),
  phone: z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }, z.union([z.string().min(7).max(25), z.null()]).optional()),
  pushNotificationsEnabled: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const privyExchangeSchema = z.object({
  identityToken: z.string().min(20).max(16384),
  ethereumWallet: z.string().trim().min(20).max(128).optional(),
  solanaWallet: z.string().trim().min(20).max(128).optional(),
});
