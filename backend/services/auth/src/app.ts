import { applyErrorHandler, createBaseApp, healthPayload } from "@eve/http";
import { authRouter, driverAuthRouter } from "./routes.js";

export function createAuthApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json(healthPayload("auth")));
  app.use("/api/auth", authRouter);
  app.use("/api/driver", driverAuthRouter);
  applyErrorHandler(app);
  return app;
}
