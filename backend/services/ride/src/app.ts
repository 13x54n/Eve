import { applyErrorHandler, createBaseApp } from "@eve/http";
import driverRoutes from "./driver.routes.js";
import riderRoutes from "./rider.routes.js";

export function createRideApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "ride" }));
  app.use("/api/rider", riderRoutes);
  app.use("/api/driver", driverRoutes);
  applyErrorHandler(app);
  return app;
}
