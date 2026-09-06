import { applyErrorHandler, createBaseApp, healthPayload } from "@eve/http";
import { authRouter, driverAuthRouter } from "@eve/auth";
import { driverRoutes, presenceRouter, publicRideRoutes, riderRoutes } from "@eve/ride";
import { adminRoutes } from "@eve/admin";
import {
  driverWalletRouter,
  paymentInternalRouter,
  paymentRouter,
  riderWalletRouter,
} from "@eve/payment";

/**
 * In-process Express app for Vitest: same HTTP prefixes as the split services,
 * without a production gateway.
 */
export function createTestApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json(healthPayload("ride")));
  app.use("/api/auth", authRouter);
  app.use("/api/driver", driverAuthRouter);
  app.use("/api/driver", presenceRouter);
  app.use("/api/driver", driverWalletRouter);
  app.use("/api/driver", driverRoutes);
  app.use("/api/rider", riderWalletRouter);
  app.use("/api/rider", riderRoutes);
  app.use("/api/public", publicRideRoutes);
  app.use("/api/payment", paymentRouter);
  app.use("/internal", paymentInternalRouter);
  app.use("/api/admin", adminRoutes);
  applyErrorHandler(app);
  return app;
}

const app = createTestApp();
export default app;
