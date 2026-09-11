import { applyErrorHandler, createBaseApp, healthPayload } from "@eve/http";

export function createLocationApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json(healthPayload("location")));
  applyErrorHandler(app);
  return app;
}
