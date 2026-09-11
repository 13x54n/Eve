import { applyErrorHandler, createBaseApp, healthPayload } from "@eve/http";
import driverRoutes from "./driver.routes.js";
import presenceRouter from "./presence.routes.js";
import riderRoutes from "./rider.routes.js";
import publicRideRoutes from "./public.routes.js";

export function createRideApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json(healthPayload("ride")));
  app.use("/api/rider", riderRoutes);
  app.use("/api/driver", presenceRouter);
  app.use("/api/driver", driverRoutes);
  app.use("/api/public", publicRideRoutes);
  applyErrorHandler(app);
  return app;
}
