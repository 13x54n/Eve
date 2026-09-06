import { Router } from "express";
import { requireAuth, requireInternalService, requireRole } from "@eve/http";
import * as controller from "./payment.controller.js";

export const paymentRouter = Router();
paymentRouter.use(requireAuth);
paymentRouter.get("/config", controller.config);
paymentRouter.get("/trips/:id/deposit", requireRole("RIDER"), controller.quoteDeposit);
paymentRouter.post("/trips/:id/confirm", requireRole("RIDER"), controller.confirmDeposit);

export const riderWalletRouter = Router();
riderWalletRouter.use(requireAuth, requireRole("RIDER"));
riderWalletRouter.get("/wallet", controller.riderWallet);

export const driverWalletRouter = Router();
driverWalletRouter.use(requireAuth, requireRole("DRIVER"));
driverWalletRouter.get("/wallet", controller.driverWallet);
driverWalletRouter.post("/wallet/withdraw", controller.withdrawWallet);

export const paymentInternalRouter = Router();
paymentInternalRouter.use(requireInternalService);
paymentInternalRouter.post("/trips/:id/release", controller.releaseInternal);
paymentInternalRouter.post("/trips/:id/refund", controller.refundInternal);
