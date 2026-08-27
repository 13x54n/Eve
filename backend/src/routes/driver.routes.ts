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
  login,
  me,
  register,
  saveDocument,
  saveVehicle,
  startTrip,
  trips,
  updatePresence,
} from "../controllers/driver.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

const driverAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Driver Auth
router.post("/register", driverAuthLimiter, register);
router.post("/login", driverAuthLimiter, login);

// Profile & Presence
router.get("/me", requireAuth, me);
router.patch("/presence", requireAuth, updatePresence);
router.post("/vehicles", requireAuth, saveVehicle);
router.post("/documents", requireAuth, saveDocument);
router.get("/documents/upload-auth", requireAuth, documentUploadAuth);
router.post("/trips/:id/offers", requireAuth, createOffer);

// Trips & Dispatching
router.get("/trips", requireAuth, trips);
router.get("/trips/incoming", requireAuth, incomingTrips);
router.post("/trips/:id/accept", requireAuth, acceptTrip);
router.post("/trips/:id/arrived", requireAuth, arrivedAtPickup);
router.post("/trips/:id/start", requireAuth, startTrip);
router.post("/trips/:id/complete", requireAuth, completeTrip);
router.post("/trips/:id/cancel", requireAuth, cancelTrip);

// Earnings & Performance
router.get("/earnings", requireAuth, earnings);

export default router;
