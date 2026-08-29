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
  rideType: z.enum(["STANDARD", "AIRPORT", "MULTI_STOP", "SCHEDULED", "CORPORATE", "COURIER"]).default("STANDARD"),
  recipientName: z.string().trim().min(2).max(80).optional(),
  recipientPhone: z.string().trim().min(7).max(25).optional(),
  packageNote: z.string().trim().max(280).optional(),
}).superRefine((value, ctx) => {
  const needsRecipient = value.rideType === "COURIER" || Boolean(value.recipientName || value.recipientPhone);
  if (!needsRecipient) return;
  if (!value.recipientName) {
    ctx.addIssue({
      code: "custom",
      message: value.rideType === "COURIER" ? "Recipient name is required" : "Passenger name is required",
      path: ["recipientName"],
    });
  }
  if (!value.recipientPhone) {
    ctx.addIssue({
      code: "custom",
      message: value.rideType === "COURIER" ? "Recipient phone is required" : "Passenger phone is required",
      path: ["recipientPhone"],
    });
  }
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
