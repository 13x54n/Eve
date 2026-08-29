import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "@eve/http";
import * as riderService from "./rider.service.js";
import { createTripMessage, listTripMessages, markTripMessagesRead } from "./trip-chat.js";
import { chatMessageSchema, riderTripSchema, supportTicketSchema } from "./rider.validation.js";

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

export async function getActiveTrip(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ trip: await riderService.getActiveTrip(userId(req)) });
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

export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ messages: await listTripMessages(userId(req), String(req.params.id), "RIDER") });
  } catch (error) { next(error); }
}

export async function postMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { body } = chatMessageSchema.parse(req.body);
    const message = await createTripMessage(userId(req), String(req.params.id), "RIDER", body);
    res.status(201).json({ message });
  } catch (error) { next(error); }
}

export async function markMessagesRead(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await markTripMessagesRead(userId(req), String(req.params.id), "RIDER"));
  } catch (error) { next(error); }
}

export async function listSupport(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ tickets: await riderService.listSupportTickets(userId(req)) });
  } catch (error) { next(error); }
}

export async function createSupport(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await riderService.createSupportTicket(userId(req), supportTicketSchema.parse(req.body));
    res.status(201).json({ ticket });
  } catch (error) { next(error); }
}

export async function getSupport(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ ticket: await riderService.getSupportTicket(userId(req), String(req.params.id)) });
  } catch (error) { next(error); }
}

export async function postSupportMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { body } = chatMessageSchema.parse(req.body);
    res.json({ ticket: await riderService.addSupportMessage(userId(req), String(req.params.id), body) });
  } catch (error) { next(error); }
}

export async function getGreeting(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await riderService.getGreeting(userId(req)));
  } catch (error) { next(error); }
}

export async function getPublicCourier(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ courier: await riderService.getPublicCourier(String(req.params.token)) });
  } catch (error) { next(error); }
}
