import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  acceptTrip,
  arrivedAtPickup,
  cancelTrip,
  completeTrip,
  createOffer,
  documentUploadAuth,
  earnings,
  incomingTrips,
  listMessages,
  listSupport,
  markMessagesRead,
  me,
  postMessage,
  postSupportMessage,
  createSupport,
  getSupport,
  saveDocument,
  saveVehicle,
  startTrip,
  trips,
} from "./driver.controller.js";
import { requireAuth } from "@eve/http";

const router = Router();

const driverApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(driverApiLimiter);

router.get("/me", requireAuth, me);
router.post("/vehicles", requireAuth, saveVehicle);
router.post("/documents", requireAuth, saveDocument);
router.get("/documents/upload-auth", requireAuth, documentUploadAuth);
router.post("/trips/:id/offers", requireAuth, createOffer);
router.get("/trips", requireAuth, trips);
router.get("/trips/incoming", requireAuth, incomingTrips);
router.get("/trips/:id/messages", requireAuth, listMessages);
router.post("/trips/:id/messages", requireAuth, postMessage);
router.post("/trips/:id/messages/read", requireAuth, markMessagesRead);
router.post("/trips/:id/accept", requireAuth, acceptTrip);
router.post("/trips/:id/arrived", requireAuth, arrivedAtPickup);
router.post("/trips/:id/start", requireAuth, startTrip);
router.post("/trips/:id/complete", requireAuth, completeTrip);
router.post("/trips/:id/cancel", requireAuth, cancelTrip);
router.get("/earnings", requireAuth, earnings);
router.get("/support", requireAuth, listSupport);
router.post("/support", requireAuth, createSupport);
router.get("/support/:id", requireAuth, getSupport);
router.post("/support/:id/messages", requireAuth, postSupportMessage);

export default router;
