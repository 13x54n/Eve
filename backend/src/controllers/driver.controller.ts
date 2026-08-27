import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import * as driverService from "../services/driver.service.js";
import {
  driverDocumentSchema,
  driverLoginSchema,
  driverPresenceSchema,
  driverRegisterSchema,
  driverVehicleSchema,
  driverOfferSchema,
  tripActionSchema,
} from "../validation/driver.validation.js";

function getAuthUser(req: Request) {
  return (req as AuthenticatedRequest).user;
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = driverRegisterSchema.parse(req.body);
    const result = await driverService.registerDriver(data);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = driverLoginSchema.parse(req.body);
    const result = await driverService.loginDriver(data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
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

export async function updatePresence(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const data = driverPresenceSchema.parse(req.body);
    const profile = await driverService.updateDriverPresence(user.id, data);
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

export async function incomingTrips(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = getAuthUser(req);
    const trips = await driverService.getIncomingTrips(user.id);
    res.status(200).json({ trips });
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
