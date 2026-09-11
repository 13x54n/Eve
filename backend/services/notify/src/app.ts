import {
  applyErrorHandler,
  createBaseApp,
  healthPayload,
  requireInternalService,
} from "@eve/http";
import {
  emitAdminEventLocal,
  emitTripAndUserEventLocal,
  emitTripEventLocal,
  emitUserEventLocal,
} from "./emit.js";

export function createNotifyApp() {
  const app = createBaseApp();
  app.get("/health", (_req, res) => res.json(healthPayload("notify")));
  app.post("/internal/emit", requireInternalService, (req, res) => {
    const body = req.body as {
      target?: string;
      event?: string;
      payload?: unknown;
      tripId?: string;
      role?: "RIDER" | "DRIVER";
      userId?: string;
    };
    const event = body.event;
    if (!event) {
      res.status(400).json({ message: "event is required" });
      return;
    }
    const payload = body.payload;
    if (body.target === "trip" && body.tripId) {
      emitTripEventLocal(body.tripId, event, payload);
    } else if (body.target === "user" && body.userId && body.role) {
      emitUserEventLocal(body.role, body.userId, event, payload);
    } else if (body.target === "admin") {
      emitAdminEventLocal(event, payload);
    } else if (
      body.target === "trip_and_user" &&
      body.tripId &&
      body.userId &&
      body.role
    ) {
      emitTripAndUserEventLocal(body.tripId, body.role, body.userId, event, payload);
    } else {
      res.status(400).json({ message: "invalid emit target" });
      return;
    }
    res.json({ ok: true });
  });
  applyErrorHandler(app);
  return app;
}
