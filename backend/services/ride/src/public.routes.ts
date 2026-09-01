import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getPublicCourier } from "./rider.controller.js";

const router = Router();

const skipInVitest = () => Boolean(process.env.VITEST);

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInVitest,
});

router.use(publicLimiter);
router.get("/courier/:token", getPublicCourier);

export default router;
