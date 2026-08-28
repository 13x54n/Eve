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