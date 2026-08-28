import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { getDriverProfile } from "@eve/db";
import { applyErrorHandler, createBaseApp, requireAuth, type AuthenticatedRequest } from "@eve/http";
import {
  distanceToPickup,
  nearbyDrivers,
  nearbySearchingTrips,
  recordDriverLocation,
  updateDriverPresence,
} from "./matching.js";

const presenceSchema = z.object({
  presence: z.enum(["ONLINE", "OFFLINE", "IDLE", "ON_TRIP"]),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const presenceRouter = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

presenceRouter.patch("/presence", limiter, requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const data = presenceSchema.parse(req.body);
    await updateDriverPresence(user.id, data);
    res.status(200).json({ driver: await getDriverProfile(user.id) });
  } catch (error) {
    next(error);
  }
});

export const internalLocationRouter = Router();

internalLocationRouter.post("/drivers/location", async (req, res, next) => {
  try {
    const { userId, latitude, longitude } = req.body ?? {};
    if (typeof userId !== "string" || typeof latitude !== "number" || typeof longitude !== "number") {
      res.status(400).json({ message: "userId, latitude, and longitude are required" });
      return;
    }
    const tripIds = await recordDriverLocation(userId, latitude, longitude);
    res.json({ tripIds });
  } catch (error) {
    next(error);
  }
});

internalLocationRouter.get("/drivers/nearby", async (req, res, next) => {
  try {
    const pickupLat = Number(req.query.pickupLat);
    const pickupLng = Number(req.query.pickupLng);
    const vehicleType = String(req.query.vehicleType) as "BIKE" | "CAR";
    if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng) || (vehicleType !== "BIKE" && vehicleType !== "CAR")) {
      res.status(400).json({ message: "pickupLat, pickupLng, and vehicleType are required" });
      return;
    }
    res.json({ drivers: await nearbyDrivers({ pickupLat, pickupLng, vehicleType }) });
  } catch (error) {
    next(error);
  }
});

internalLocationRouter.get("/trips/nearby", async (req, res, next) => {
  try {
    const userId = String(req.query.userId ?? "");
    if (!userId) {
      res.status(400).json({ message: "userId is required" });
      return;
    }
    res.json({ trips: await nearbySearchingTrips(userId) });
  } catch (error) {
    next(error);
  }
});

internalLocationRouter.get("/distance", async (req, res, next) => {
  try {
    const userId = String(req.query.userId ?? "");
    const pickupLat = Number(req.query.pickupLat);
    const pickupLng = Number(req.query.pickupLng);
    if (!userId || !Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
      res.status(400).json({ message: "userId, pickupLat, and pickupLng are required" });
      return;
    }
    res.json({ distanceKm: await distanceToPickup(userId, pickupLat, pickupLng) });
  } catch (error) {
    next(error);
  }
});

export function createLocationApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "location" }));
  app.use("/api/driver", presenceRouter);
  app.use("/internal", internalLocationRouter);
  applyErrorHandler(app);
  return app;
}
