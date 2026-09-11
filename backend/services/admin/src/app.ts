import { applyErrorHandler, createBaseApp, healthPayload } from "@eve/http";
import adminRoutes from "./admin.routes.js";

export function createAdminApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json(healthPayload("admin")));
  app.use("/api/admin", adminRoutes);
  applyErrorHandler(app);
  return app;
}
