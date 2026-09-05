import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  analytics,
  assignVehicle,
  audit,
  createTrip,
  dashboard,
  driver,
  drivers,
  creditDriverWallet,
  fleets,
  greetings,
  createGreeting,
  updateGreeting,
  removeGreeting,
  saveGreetingSettings,
  interveneTrip,
  ledger,
  notifications,
  payout,
  pricing,
  promos,
  refund,
  reviewDriver,
  rider,
  riders,
  safety,
  savePricing,
  savePromo,
  sendNotification,
  staff,
  createStaff,
  resetStaffCredentials,
  tickets,
  ticket,
  transitionPricing,
  trip,
  trips,
  updateIncident,
  updateRider,
  updateStaff,
  updateTicket,
  vehicles,
} from "./admin.controller.js";
import {
  requireAdmin,
  requireAuth,
  requirePermission,
  requireStaffAccess,
} from "@eve/http";

const skipInVitest = () => Boolean(process.env.VITEST);

const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInVitest,
});

const router = Router();

router.use(adminApiLimiter, requireAuth, requireAdmin);

router.get("/dashboard", requirePermission("dashboard:read"), dashboard);

router.get("/riders", requirePermission("riders:read"), riders);
router.get("/riders/:id", requirePermission("riders:read"), rider);
router.patch("/riders/:id", requirePermission("riders:write"), updateRider);

router.get("/drivers", requirePermission("drivers:read"), drivers);
router.get("/drivers/:id", requirePermission("drivers:read"), driver);
router.patch(
  "/drivers/:id",
  requirePermission("drivers:approve"),
  reviewDriver,
);
router.post(
  "/drivers/:id/wallet/credit",
  requirePermission("payments:payout"),
  creditDriverWallet,
);

router.get("/vehicles", requirePermission("drivers:read"), vehicles);
router.patch(
  "/vehicles/:id",
  requirePermission("vehicles:write"),
  assignVehicle,
);
router.get("/fleets", requirePermission("drivers:read"), fleets);

router.get("/trips", requirePermission("trips:read"), trips);
router.post("/trips", requirePermission("trips:dispatch"), createTrip);
router.get("/trips/:id", requirePermission("trips:read"), trip);
router.patch(
  "/trips/:id",
  requirePermission("trips:dispatch"),
  interveneTrip,
);

router.get("/pricing", requirePermission("pricing:read"), pricing);
router.post("/pricing", requirePermission("pricing:approve"), savePricing);
router.patch(
  "/pricing/:id",
  requirePermission("pricing:approve"),
  transitionPricing,
);

router.get("/ledger", requirePermission("payments:read"), ledger);
router.post(
  "/ledger/:id/refund",
  requirePermission("payments:refund"),
  refund,
);
router.post("/payouts", requirePermission("payments:payout"), payout);

router.get("/safety", requirePermission("safety:read"), safety);
router.patch(
  "/safety/:id",
  requirePermission("safety:write"),
  updateIncident,
);

router.get("/tickets", requirePermission("support:read"), tickets);
router.get("/tickets/:id", requirePermission("support:read"), ticket);
router.patch(
  "/tickets/:id",
  requirePermission("support:write"),
  updateTicket,
);

router.get("/promos", requirePermission("promotions:write"), promos);
router.post("/promos", requirePermission("promotions:write"), savePromo);

router.get("/greetings", requirePermission("content:write"), greetings);
router.post("/greetings", requirePermission("content:write"), createGreeting);
router.patch(
  "/greetings/settings",
  requirePermission("content:write"),
  saveGreetingSettings,
);
router.patch(
  "/greetings/:id",
  requirePermission("content:write"),
  updateGreeting,
);
router.delete(
  "/greetings/:id",
  requirePermission("content:write"),
  removeGreeting,
);

router.get(
  "/notifications",
  requirePermission("notifications:send"),
  notifications,
);
router.post(
  "/notifications",
  requirePermission("notifications:send"),
  sendNotification,
);

router.get("/analytics", requirePermission("analytics:read"), analytics);
router.get("/audit", requirePermission("audit:read"), audit);
router.get("/staff", requireStaffAccess, staff);
router.post("/staff", requireStaffAccess, createStaff);
router.patch("/staff/:id", requireStaffAccess, updateStaff);
router.post("/staff/:id/credentials", requireStaffAccess, resetStaffCredentials);

export default router;
