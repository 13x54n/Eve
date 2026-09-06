import { applyErrorHandler, createBaseApp, healthPayload } from "@eve/http";
import {
  driverWalletRouter,
  paymentInternalRouter,
  paymentRouter,
  riderWalletRouter,
} from "./payment.routes.js";

export function createPaymentApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json(healthPayload("payment")));
  app.use("/api/payment", paymentRouter);
  app.use("/api/rider", riderWalletRouter);
  app.use("/api/driver", driverWalletRouter);
  app.use("/internal", paymentInternalRouter);
  applyErrorHandler(app);
  return app;
}
