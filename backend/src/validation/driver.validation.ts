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
});

export const tripActionSchema = z.object({
  reason: z.string().max(250).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  feedback: z.string().max(250).optional(),
});
