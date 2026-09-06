import { Router } from "express";
import { requireAuth, requireInternalService, requireRole, skipRateLimit } from "@eve/http";
import rateLimit from "express-rate-limit";
import * as controller from "./payment.controller.js";

const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
});

export const paymentRouter = Router();
paymentRouter.use(paymentRateLimiter, requireAuth);
paymentRouter.get("/config", controller.config);
paymentRouter.get("/trips/:id/deposit", requireRole("RIDER"), controller.quoteDeposit);
paymentRouter.post("/trips/:id/confirm", requireRole("RIDER"), controller.confirmDeposit);

export const riderWalletRouter = Router();
riderWalletRouter.use(paymentRateLimiter, requireAuth, requireRole("RIDER"));
riderWalletRouter.get("/wallet", controller.riderWallet);

export const driverWalletRouter = Router();
driverWalletRouter.use(paymentRateLimiter, requireAuth, requireRole("DRIVER"));
driverWalletRouter.get("/wallet", controller.driverWallet);
driverWalletRouter.post("/wallet/withdraw", controller.withdrawWallet);

export const paymentInternalRouter = Router();
paymentInternalRouter.use(paymentRateLimiter, requireInternalService);
paymentInternalRouter.post("/trips/:id/release", controller.releaseInternal);
paymentInternalRouter.post("/trips/:id/refund", controller.refundInternal);
