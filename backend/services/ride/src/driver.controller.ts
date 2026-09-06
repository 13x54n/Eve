import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "@eve/http";
import * as driverService from "./driver.service.js";
import { createTripMessage, listTripMessages, markTripMessagesRead } from "./trip-chat.js";
import {
  chatMessageSchema,
  driverDocumentSchema,
  driverVehicleSchema,
  driverOfferSchema,
  supportTicketSchema,
  tripActionSchema,
} from "./driver.validation.js";

function getAuthUser(req: Request) {
  return (req as AuthenticatedRequest).user;
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const profile = await driverService.getDriverProfile(user.id);
    res.status(200).json({ driver: profile });
  } catch (error) {
    next(error);
  }
}

export async function saveVehicle(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const data = driverVehicleSchema.parse(req.body);
    const profile = await driverService.addOrUpdateVehicle(user.id, data);
    res.status(200).json({ driver: profile });
  } catch (error) {
    next(error);
  }
}

export async function saveDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const data = driverDocumentSchema.parse(req.body);
    const profile = await driverService.submitDriverDocument(user.id, data);
    res.status(200).json({ driver: profile });
  } catch (error) {
    next(error);
  }
}

export async function documentUploadAuth(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.status(200).json(driverService.getDocumentUploadAuth());
  } catch (error) {
    next(error);
  }
}

export async function createOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(req);
    const data = driverOfferSchema.parse(req.body);
    const offer = await driverService.createTripOffer(user.id, String(req.params.id), data);
    res.status(201).json({ offer });
  } catch (error) { next(error); }
}

export async function acceptDispatch(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(req);
    const data = driverOfferSchema.pick({ proposedFare: true }).partial().parse(req.body ?? {});
    const offer = await driverService.acceptDispatch(user.id, String(req.params.id), data.proposedFare);
    res.status(201).json({ offer });
  } catch (error) { next(error); }
}

export async function declineDispatch(req: Request, res: Response, next: NextFunction) {
  try {
    const user = getAuthUser(req);
    const result = await driverService.declineDispatch(user.id, String(req.params.id));
    res.status(200).json(result);
  } catch (error) { next(error); }
}

export async function incomingTrips(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const trips = await driverService.getIncomingTrips(user.id);
    res.status(200).json(trips);
  } catch (error) {
    next(error);
  }
}

export async function trips(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const tripList = await driverService.getDriverTrips(user.id, req.query);
    res.status(200).json({ trips: tripList });
  } catch (error) {
    next(error);
  }
}

export async function getTrip(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const trip = await driverService.getDriverTrip(user.id, String(req.params.id));
    res.status(200).json({ trip });
  } catch (error) {
    next(error);
  }
}

export async function acceptTrip(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const trip = await driverService.acceptTrip(user.id, String(req.params.id));
    res.status(200).json({ trip });
  } catch (error) {
    next(error);
  }
}

export async function arrivedAtPickup(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const trip = await driverService.arrivedAtPickup(user.id, String(req.params.id));
    res.status(200).json({ trip });
  } catch (error) {
    next(error);
  }
}

export async function startTrip(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const trip = await driverService.startTrip(user.id, String(req.params.id));
    res.status(200).json({ trip });
  } catch (error) {
    next(error);
  }
}

export async function completeTrip(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const data = tripActionSchema.parse(req.body);
    const result = await driverService.completeTrip(
      user.id,
      String(req.params.id),
      data,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function cancelTrip(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const trip = await driverService.cancelTrip(
      user.id,
      String(req.params.id),
      req.body?.reason,
    );
    res.status(200).json({ trip });
  } catch (error) {
    next(error);
  }
}

export async function earnings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const result = await driverService.getDriverEarningsOverview(user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ messages: await listTripMessages(getAuthUser(req).id, String(req.params.id), "DRIVER") });
  } catch (error) { next(error); }
}

export async function postMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { body } = chatMessageSchema.parse(req.body);
    const message = await createTripMessage(getAuthUser(req).id, String(req.params.id), "DRIVER", body);
    res.status(201).json({ message });
  } catch (error) { next(error); }
}

export async function markMessagesRead(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await markTripMessagesRead(getAuthUser(req).id, String(req.params.id), "DRIVER"));
  } catch (error) { next(error); }
}

export async function listSupport(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ tickets: await driverService.listSupportTickets(getAuthUser(req).id) });
  } catch (error) { next(error); }
}

export async function createSupport(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await driverService.createSupportTicket(
      getAuthUser(req).id,
      supportTicketSchema.parse(req.body),
    );
    res.status(201).json({ ticket });
  } catch (error) { next(error); }
}

export async function getSupport(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ ticket: await driverService.getSupportTicket(getAuthUser(req).id, String(req.params.id)) });
  } catch (error) { next(error); }
}

export async function postSupportMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { body } = chatMessageSchema.parse(req.body);
    res.json({ ticket: await driverService.addSupportMessage(getAuthUser(req).id, String(req.params.id), body) });
  } catch (error) { next(error); }
}
