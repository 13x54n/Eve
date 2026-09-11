import { Router } from "express";
import { requireAuth, requireRole, skipRateLimit } from "@eve/http";
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
paymentRouter.get("/trips/:id/settlement", requireRole("DRIVER"), controller.quoteSettlement);
paymentRouter.get("/trips/:id/dispute", requireRole("RIDER"), controller.quoteDispute);
paymentRouter.get("/trips/:id/refund", requireRole("RIDER"), controller.quoteRefund);
paymentRouter.post("/trips/:id/confirm", controller.confirmEscrow);

export const riderWalletRouter = Router();
riderWalletRouter.use(paymentRateLimiter, requireAuth, requireRole("RIDER"));
riderWalletRouter.get("/wallet", controller.riderWallet);
riderWalletRouter.post("/wallet/withdraw", controller.withdrawRiderWallet);
riderWalletRouter.post("/wallet/transfers", controller.recordWalletTransfer);
riderWalletRouter.get("/wallet/swap/wallet", controller.getSwapWallet);
riderWalletRouter.post("/wallet/swap/quote", controller.getSwapQuote);
riderWalletRouter.post("/wallet/swap/execute", controller.executeSwap);
riderWalletRouter.get("/wallet/swap/actions/:actionId", controller.getSwapActionStatus);
riderWalletRouter.get("/wallet/swap/history", controller.listSwapHistory);

export const driverWalletRouter = Router();
driverWalletRouter.use(paymentRateLimiter, requireAuth, requireRole("DRIVER"));
driverWalletRouter.get("/wallet", controller.driverWallet);
driverWalletRouter.post("/wallet/withdraw", controller.withdrawWallet);
driverWalletRouter.post("/wallet/transfers", controller.recordWalletTransfer);
driverWalletRouter.get("/wallet/bank-accounts", controller.listBankAccounts);
driverWalletRouter.post("/wallet/bank-accounts", controller.registerBankAccount);
driverWalletRouter.delete("/wallet/bank-accounts/:id", controller.deleteBankAccount);
driverWalletRouter.post("/wallet/payout", controller.createFiatPayout);
driverWalletRouter.get("/wallet/payout/:actionId", controller.getFiatPayoutStatus);
driverWalletRouter.get("/wallet/swap/wallet", controller.getSwapWallet);
driverWalletRouter.post("/wallet/swap/quote", controller.getSwapQuote);
driverWalletRouter.post("/wallet/swap/execute", controller.executeSwap);
driverWalletRouter.get("/wallet/swap/actions/:actionId", controller.getSwapActionStatus);
driverWalletRouter.get("/wallet/swap/history", controller.listSwapHistory);


export const paymentInternalRouter = Router();
paymentInternalRouter.post("/webhooks/privy", controller.handlePrivyWebhook);

