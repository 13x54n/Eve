import { applyErrorHandler, createBaseApp, healthPayload } from "@eve/http";

export function createNotifyApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json(healthPayload("notify")));
  applyErrorHandler(app);
  return app;
}
