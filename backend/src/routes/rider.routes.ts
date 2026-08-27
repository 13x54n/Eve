import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { acceptOffer, cancelTrip, createTrip, getOffers, getTrip, listTrips } from "../controllers/rider.controller.js";

const router = Router();

const riderApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(riderApiLimiter, requireAuth, requireRole("RIDER"));
router.post("/trips", createTrip);
router.get("/trips", listTrips);
router.get("/trips/:id", getTrip);
router.get("/trips/:id/offers", getOffers);
router.post("/trips/:id/offers/:offerId/accept", acceptOffer);
router.post("/trips/:id/cancel", cancelTrip);

export default router;