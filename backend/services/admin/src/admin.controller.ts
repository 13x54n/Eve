import type {
  NextFunction,
  Request,
  Response,
} from "express";
import type { AuthenticatedRequest } from "@eve/http";
import * as admin from "./admin.service.js";

function actor(req: Request) {
  return req as AuthenticatedRequest;
}

function handle(
  fn: (req: Request, res: Response) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

export const dashboard = handle(async (req, res) => {
  res.json(await admin.getDashboard(req.query as Record<string, unknown>));
});

export const riders = handle(async (req, res) => {
  res.json(await admin.searchRiders(req.query as Record<string, unknown>));
});

export const rider = handle(async (req, res) => {
  res.json(await admin.getRider(String(req.params.id)));
});

export const updateRider = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.updateRider(
      String(req.params.id),
      auth.user.id,
      req.body,
      req.ip,
    ),
  );
});

export const drivers = handle(async (req, res) => {
  res.json(await admin.searchDrivers(req.query as Record<string, unknown>));
});

export const driver = handle(async (req, res) => {
  res.json(await admin.getDriver(String(req.params.id)));
});

export const reviewDriver = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.reviewDriver(
      String(req.params.id),
      auth.user.id,
      req.body,
      req.ip,
    ),
  );
});

export const vehicles = handle(async (req, res) => {
  res.json(await admin.listVehicles(req.query as Record<string, unknown>));
});

export const assignVehicle = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.assignVehicle(
      String(req.params.id),
      req.body.driverId ?? null,
      auth.user.id,
      req.ip,
    ),
  );
});

export const fleets = handle(async (_req, res) => {
  res.json(await admin.listFleets());
});

export const trips = handle(async (req, res) => {
  res.json(await admin.searchTrips(req.query as Record<string, unknown>));
});

export const trip = handle(async (req, res) => {
  res.json(await admin.getTrip(String(req.params.id)));
});

export const interveneTrip = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.interveneTrip(
      String(req.params.id),
      auth.user.id,
      req.body,
      req.ip,
    ),
  );
});

export const createTrip = handle(async (req, res) => {
  const auth = actor(req);
  res.status(201).json(
    await admin.createTrip(auth.user.id, req.body, req.ip),
  );
});

export const pricing = handle(async (_req, res) => {
  res.json(await admin.listPricing());
});

export const savePricing = handle(async (req, res) => {
  const auth = actor(req);
  res.status(201).json(
    await admin.savePricing(auth.user.id, req.body, req.ip),
  );
});

export const transitionPricing = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.transitionPricing(
      String(req.params.id),
      auth.user.id,
      req.body.action,
      req.ip,
    ),
  );
});

export const ledger = handle(async (req, res) => {
  res.json(await admin.listLedger(req.query as Record<string, unknown>));
});

export const refund = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.refundPayment(
      String(req.params.id),
      auth.user.id,
      Number(req.body.amount),
      req.ip,
    ),
  );
});

export const payout = handle(async (req, res) => {
  const auth = actor(req);
  res.status(201).json(
    await admin.payoutDriver(auth.user.id, req.body, req.ip),
  );
});

export const safety = handle(async (req, res) => {
  res.json(await admin.listSafety(req.query as Record<string, unknown>));
});

export const updateIncident = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.updateIncident(
      String(req.params.id),
      auth.user.id,
      req.body,
      req.ip,
    ),
  );
});

export const tickets = handle(async (req, res) => {
  res.json(await admin.listTickets(req.query as Record<string, unknown>));
});

export const ticket = handle(async (req, res) => {
  res.json(await admin.getTicket(String(req.params.id)));
});

export const updateTicket = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.updateTicket(
      String(req.params.id),
      auth.user.id,
      req.body,
      req.ip,
    ),
  );
});

export const promos = handle(async (_req, res) => {
  res.json(await admin.listPromos());
});

export const savePromo = handle(async (req, res) => {
  const auth = actor(req);
  res.status(201).json(await admin.savePromo(auth.user.id, req.body, req.ip));
});

export const notifications = handle(async (_req, res) => {
  res.json(await admin.listNotifications());
});

export const sendNotification = handle(async (req, res) => {
  const auth = actor(req);
  res.status(201).json(
    await admin.sendNotification(auth.user.id, req.body, req.ip),
  );
});

export const analytics = handle(async (req, res) => {
  res.json(await admin.getAnalytics(req.query as Record<string, unknown>));
});

export const audit = handle(async (req, res) => {
  res.json(await admin.listAudit(req.query as Record<string, unknown>));
});

export const staff = handle(async (req, res) => {
  const auth = actor(req);
  res.json(await admin.listStaff(auth.user));
});

export const createStaff = handle(async (req, res) => {
  const auth = actor(req);
  res.status(201).json(
    await admin.createStaff(auth.user.id, auth.user, req.body, req.ip),
  );
});

export const updateStaff = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.updateStaff(
      String(req.params.id),
      auth.user.id,
      auth.user,
      req.body,
      req.ip,
    ),
  );
});

export const resetStaffCredentials = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.resetStaffCredentials(
      String(req.params.id),
      auth.user.id,
      auth.user,
      req.body,
      req.ip,
    ),
  );
});

export const greetings = handle(async (_req, res) => {
  res.json(await admin.listGreetings());
});

export const createGreeting = handle(async (req, res) => {
  const auth = actor(req);
  res.status(201).json(await admin.createGreeting(auth.user.id, req.body, req.ip));
});

export const updateGreeting = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.updateGreeting(
      String(req.params.id),
      auth.user.id,
      req.body,
      req.ip,
    ),
  );
});

export const removeGreeting = handle(async (req, res) => {
  const auth = actor(req);
  res.json(
    await admin.deleteGreeting(String(req.params.id), auth.user.id, req.ip),
  );
});

export const saveGreetingSettings = handle(async (req, res) => {
  const auth = actor(req);
  res.json(await admin.updateGreetingSettings(auth.user.id, req.body, req.ip));
});
