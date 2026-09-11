import { z } from "zod";

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

export const driverPresenceSchema = z.object({
  presence: z.enum(["ONLINE", "OFFLINE", "IDLE", "ON_TRIP"]),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const driverVehicleSchema = z.object({
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  year: z.coerce.number().int().min(1995).max(2030),
  color: z.string().trim().min(2).max(40),
  plateNumber: z.string().trim().min(2).max(20),
  vehicleType: z.enum(["BIKE", "CAR"]),
  serviceCategory: z.string().trim().default("standard"),
  capacity: z.coerce.number().int().min(1).max(10).default(4),
  city: z.string().trim().optional(),
});

export const driverDocumentSchema = z.object({
  type: z.enum([
    "IDENTITY",
    "LICENSE",
    "INSURANCE",
    "BACKGROUND_CHECK",
    "VEHICLE_REGISTRATION",
    "VEHICLE_INSPECTION",
  ]),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(250).optional(),
  imageKitFileId: z.string().trim().min(1).max(200).optional(),
  fileUrl: z.string().url().max(2000).optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
  mimeType: z.string().trim().max(100).optional().nullable(),
  fileSize: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
});

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(40).default("TRIP"),
  body: z.string().trim().min(1).max(2000),
  tripId: z.string().trim().min(1).optional(),
});

export const tripActionSchema = z.object({
  reason: z.string().max(250).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  feedback: z.string().max(250).optional(),
});

export const driverOfferSchema = z.object({
  proposedFare: z.coerce.number().positive().max(10000),
  etaMinutes: z.coerce.number().int().min(1).max(180),
});

export const chatMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export const walletWithdrawSchema = z.object({
  amount: z.coerce.number().positive().max(10000),
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
});
