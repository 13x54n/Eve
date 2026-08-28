import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "@eve/http";
import * as riderService from "./rider.service.js";
import { riderTripSchema } from "./rider.validation.js";

function userId(req: Request) { return (req as AuthenticatedRequest).user.id; }

export async function createTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const trip = await riderService.createTrip(userId(req), riderTripSchema.parse(req.body));
    res.status(201).json({ trip });
  } catch (error) { next(error); }
}

export async function getTrip(req: Request, res: Response, next: NextFunction) {
  try {
    const trip = await riderService.getTrip(userId(req), String(req.params.id));
    res.json({ trip });
  } catch (error) { next(error); }
}

export async function listTrips(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ trips: await riderService.listTrips(userId(req)) });
  } catch (error) { next(error); }
}

export async function getOffers(req: Request, res: Response, next: NextFunction) {
  try { res.json({ offers: await riderService.getOffers(userId(req), String(req.params.id)) }); } catch (error) { next(error); }
}

export async function acceptOffer(req: Request, res: Response, next: NextFunction) {
  try { res.json({ trip: await riderService.acceptOffer(userId(req), String(req.params.id), String(req.params.offerId)) }); } catch (error) { next(error); }
}

export async function cancelTrip(req: Request, res: Response, next: NextFunction) {
  try { res.json({ trip: await riderService.cancelTrip(userId(req), String(req.params.id)) }); } catch (error) { next(error); }
}