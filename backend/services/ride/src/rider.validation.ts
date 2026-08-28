import { z } from "zod";

export const riderTripSchema = z.object({
  pickupAddress: z.string().trim().min(2).max(200),
  dropoffAddress: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(80).default("New York"),
  pickupLat: z.coerce.number().min(-90).max(90),
  pickupLng: z.coerce.number().min(-180).max(180),
  dropoffLat: z.coerce.number().min(-90).max(90),
  dropoffLng: z.coerce.number().min(-180).max(180),
  vehicleType: z.enum(["BIKE", "CAR"]).default("CAR"),
  rideType: z.enum(["STANDARD", "AIRPORT", "MULTI_STOP", "SCHEDULED", "CORPORATE"]).default("STANDARD"),
});

export const chatMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(40).default("TRIP"),
  body: z.string().trim().min(1).max(2000),
  tripId: z.string().trim().min(1).optional(),
});