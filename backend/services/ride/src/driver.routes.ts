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
  getTrip,
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
  acceptDispatch,
  declineDispatch,
} from "./driver.controller.js";
import { requireAuth, requireRole } from "@eve/http";

const router = Router();

const skipInVitest = () => Boolean(process.env.VITEST);

const driverApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.DRIVER_API_RATE_LIMIT || 2000),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    skipInVitest() ||
    (req.method === "GET" && req.path.endsWith("/trips/incoming")),
});

router.use(driverApiLimiter, requireAuth, requireRole("DRIVER"));

router.get("/me", me);
router.post("/vehicles", saveVehicle);
router.post("/documents", saveDocument);
router.get("/documents/upload-auth", documentUploadAuth);
router.post("/trips/:id/offers", createOffer);
router.post("/trips/:id/dispatch/accept", acceptDispatch);
router.post("/trips/:id/dispatch/decline", declineDispatch);
router.get("/trips", trips);
router.get("/trips/incoming", incomingTrips);
router.get("/trips/:id", getTrip);
router.get("/trips/:id/messages", listMessages);
router.post("/trips/:id/messages", postMessage);
router.post("/trips/:id/messages/read", markMessagesRead);
router.post("/trips/:id/accept", acceptTrip);
router.post("/trips/:id/arrived", arrivedAtPickup);
router.post("/trips/:id/start", startTrip);
router.post("/trips/:id/complete", completeTrip);
router.post("/trips/:id/cancel", cancelTrip);
router.get("/earnings", earnings);
router.get("/support", listSupport);
router.post("/support", createSupport);
router.get("/support/:id", getSupport);
router.post("/support/:id/messages", postSupportMessage);

export default router;
