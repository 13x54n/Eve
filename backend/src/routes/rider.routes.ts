import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { acceptOffer, cancelTrip, createTrip, getOffers, getTrip, listTrips } from "../controllers/rider.controller.js";

const router = Router();
router.use(requireAuth, requireRole("RIDER"));
router.post("/trips", createTrip);
router.get("/trips", listTrips);
router.get("/trips/:id", getTrip);
router.get("/trips/:id/offers", getOffers);
router.post("/trips/:id/offers/:offerId/accept", acceptOffer);
router.post("/trips/:id/cancel", cancelTrip);

export default router;