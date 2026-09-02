import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { getDriverProfile } from "@eve/db";
import { requireAuth, type AuthenticatedRequest } from "@eve/http";
import { updateDriverPresence } from "@eve/location";

const presenceSchema = z.object({
  presence: z.enum(["ONLINE", "OFFLINE", "IDLE", "ON_TRIP"]),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const presenceRouter = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
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

export default presenceRouter;
