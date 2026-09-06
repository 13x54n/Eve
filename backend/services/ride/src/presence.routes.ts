import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { getDriverProfile } from "@eve/db";
import { requireAuth, skipRateLimit, type AuthenticatedRequest } from "@eve/http";
import { updateDriverPresence } from "@eve/location";
import { emitAdminEvent } from "@eve/notify";

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
  skip: skipRateLimit,
});

presenceRouter.patch("/presence", limiter, requireAuth, async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const data = presenceSchema.parse(req.body);
    await updateDriverPresence(user.id, data);
    const driver = await getDriverProfile(user.id);
    void emitAdminEvent(
      "driver:presence.changed",
      { userId: user.id, presence: data.presence },
      user.id,
    );
    res.status(200).json({ driver });
  } catch (error) {
    next(error);
  }
});

export default presenceRouter;
