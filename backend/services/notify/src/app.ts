import { applyErrorHandler, createBaseApp } from "@eve/http";
import { internalNotifyRouter } from "./routes.js";

export function createNotifyApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "notify" }));
  app.use("/internal", internalNotifyRouter);
  applyErrorHandler(app);
  return app;
}
