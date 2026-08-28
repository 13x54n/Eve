import { applyErrorHandler, createBaseApp } from "@eve/http";
import { authRouter, driverAuthRouter } from "@eve/auth";
import { presenceRouter } from "@eve/location";
import { driverRoutes, riderRoutes } from "@eve/ride";
import adminRoutes from "./admin.routes.js";

export function createComposeApp() {
  const app = createBaseApp();
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRouter);
  app.use("/api/driver", driverAuthRouter);
  app.use("/api/driver", presenceRouter);
  app.use("/api/driver", driverRoutes);
  app.use("/api/rider", riderRoutes);
  app.use("/api/admin", adminRoutes);
  applyErrorHandler(app);
  return app;
}
