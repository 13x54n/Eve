import { Router } from "express";
import rateLimit from "express-rate-limit";
import { skipRateLimit } from "@eve/http";
import { getPublicCourier } from "./rider.controller.js";

const router = Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
});

router.use(publicLimiter);
router.get("/courier/:token", getPublicCourier);

export default router;
