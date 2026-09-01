import { Router } from "express";
import { requireInternalService } from "@eve/http";
import { emitAdminEventLocal, emitTripAndUserEventLocal, emitTripEventLocal, emitUserEventLocal } from "./emit.js";

export const internalNotifyRouter = Router();

// Require internal service authentication for all internal routes
internalNotifyRouter.use(requireInternalService);

internalNotifyRouter.post("/emit", (req, res) => {
  const { target, tripId, role, userId, event, payload } = req.body ?? {};
  if (typeof event !== "string" || !event) {
    res.status(400).json({ message: "event is required" });
    return;
  }
  if (target === "trip" && typeof tripId === "string") {
    emitTripEventLocal(tripId, event, payload);
    res.json({ ok: true });
    return;
  }
  if (target === "user" && (role === "RIDER" || role === "DRIVER") && typeof userId === "string") {
    emitUserEventLocal(role, userId, event, payload);
    res.json({ ok: true });
    return;
  }
  if (
    target === "trip+user" &&
    typeof tripId === "string" &&
    (role === "RIDER" || role === "DRIVER") &&
    typeof userId === "string"
  ) {
    emitTripAndUserEventLocal(tripId, role, userId, event, payload);
    res.json({ ok: true });
    return;
  }
  if (target === "admin") {
    emitAdminEventLocal(event, payload);
    res.json({ ok: true });
    return;
  }
  res.status(400).json({ message: "Invalid emit target" });
});
