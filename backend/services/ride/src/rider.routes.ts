import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole } from "@eve/http";
import {
  acceptOffer,
  cancelTrip,
  createSupport,
  createTrip,
  getActiveTrip,
  getOffers,
  getSupport,
  getTrip,
  listMessages,
  listSupport,
  listTrips,
  postMessage,
  postSupportMessage,
} from "./rider.controller.js";

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
router.get("/trips/active", getActiveTrip);
router.get("/trips/:id", getTrip);
router.get("/trips/:id/offers", getOffers);
router.get("/trips/:id/messages", listMessages);
router.post("/trips/:id/messages", postMessage);
router.post("/trips/:id/offers/:offerId/accept", acceptOffer);
router.post("/trips/:id/cancel", cancelTrip);
router.get("/support", listSupport);
router.post("/support", createSupport);
router.get("/support/:id", getSupport);
router.post("/support/:id/messages", postSupportMessage);

export default router;
