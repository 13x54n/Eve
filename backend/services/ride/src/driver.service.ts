import { createHmac, randomBytes } from "node:crypto";
import { getDriverProfile, getMinFare, prisma, recordTripEvent } from "@eve/db";
import { MATCH_RADIUS_KM, fail, money, startOfDay } from "@eve/shared";
import {
  distanceToPickupClient,
  nearbySearchingTripsClient,
  removeSearchingTripClient,
  syncDriverGeoClient,
} from "@eve/location";
import { emitAdminEvent, emitTripAndUserEvent } from "@eve/notify";
import {
  expireTimedOutDispatches,
  refreshAcceptanceRate,
  serializeActiveDispatch,
  voidPendingDispatches,
} from "./dispatch.js";

export { getDriverProfile };

export async function addOrUpdateVehicle(
  userId: string,
  input: {
    make: string;
    model: string;
    year: number;
    color: string;
    plateNumber: string;
    vehicleType: "BIKE" | "CAR";
    serviceCategory?: string;
    capacity?: number;
    city?: string;
  },
) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { vehicles: true },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  const plate = input.plateNumber.trim().toUpperCase();

  const existingVehicle = await prisma.vehicle.findFirst({
    where: {
      plateNumber: plate,
      driverId: { not: profile.id },
    },
  });

  if (existingVehicle) {
    const error = new Error("Vehicle plate number is already in use by another driver");
    error.name = "ConflictError";
    throw error;
  }

  if (profile.vehicles.length > 0) {
    const vehicleId = profile.vehicles[0]!.id;
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        make: input.make.trim(),
        model: input.model.trim(),
        year: input.year,
        color: input.color.trim(),
        plateNumber: plate,
        vehicleType: input.vehicleType,
        serviceCategory: input.serviceCategory || "standard",
        capacity: input.capacity || 4,
        city: input.city || profile.city,
      },
    });
  } else {
    await prisma.vehicle.create({
      data: {
        driverId: profile.id,
        make: input.make.trim(),
        model: input.model.trim(),
        year: input.year,
        color: input.color.trim(),
        plateNumber: plate,
        vehicleType: input.vehicleType,
        serviceCategory: input.serviceCategory || "standard",
        capacity: input.capacity || 4,
        city: input.city || profile.city,
      },
    });
  }

  return getDriverProfile(userId);
}

export async function submitDriverDocument(
  userId: string,
  input: {
    type:
      | "IDENTITY"
      | "LICENSE"
      | "INSURANCE"
      | "BACKGROUND_CHECK"
      | "VEHICLE_REGISTRATION"
      | "VEHICLE_INSPECTION";
    expiresAt?: string | null;
    notes?: string;
    imageKitFileId?: string;
    fileUrl?: string;
    fileName?: string;
    mimeType?: string | null;
    fileSize?: number | null;
  },
) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  const existingDoc = await prisma.driverDocument.findFirst({
    where: {
      driverId: profile.id,
      type: input.type,
    },
  });

  if (existingDoc) {
    await prisma.driverDocument.update({
      where: { id: existingDoc.id },
      data: {
        status: "PENDING",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : existingDoc.expiresAt,
        notes: input.notes ?? existingDoc.notes,
        imageKitFileId: input.imageKitFileId,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        reviewedAt: null,
        reviewedById: null,
      },
    });
  } else {
    await prisma.driverDocument.create({
      data: {
        driverId: profile.id,
        type: input.type,
        status: "PENDING",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        notes: input.notes,
        imageKitFileId: input.imageKitFileId,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      },
    });
  }

  return getDriverProfile(userId);
}

export function getDocumentUploadAuth() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const folder = process.env.IMAGEKIT_DRIVER_FOLDER || "/eve/drivers";

  if (!privateKey || !publicKey) {
    const error = new Error("ImageKit upload is not configured");
    error.name = "ConfigurationError";
    throw error;
  }

  const expire = Math.floor(Date.now() / 1000) + 600;
  const token = randomBytes(16).toString("hex");
  const signature = createHmac("sha1", privateKey)
    .update(token + expire)
    .digest("hex");

  return { token, expire, signature, publicKey, folder };
}

export async function getIncomingTrips(userId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { vehicles: true },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  if (profile.approvalStatus !== "APPROVED" || !["ONLINE", "IDLE"].includes(profile.presence)) {
    return { trips: [], pendingOffer: null, activeDispatch: null };
  }

  await expireTimedOutDispatches(profile.id);

  const activeTrip = await prisma.trip.findFirst({
    where: { driverId: profile.id, status: { in: ["ASSIGNED", "ONGOING"] } },
    select: { id: true },
  });
  if (activeTrip) {
    return { trips: [], pendingOffer: null, activeDispatch: null };
  }

  const pendingOffer = await prisma.tripOffer.findFirst({
    where: { driverId: profile.id, status: "PENDING" },
    include: { trip: { include: { rider: { include: { user: true } } } } },
  });

  if (pendingOffer) {
    return {
      trips: [],
      pendingOffer: {
        id: pendingOffer.id,
        tripId: pendingOffer.tripId,
        proposedFare: money(pendingOffer.proposedFare),
        etaMinutes: pendingOffer.etaMinutes,
        riderName: pendingOffer.trip.rider?.user?.name || "Rider",
        pickupAddress: pendingOffer.trip.pickupAddress,
        dropoffAddress: pendingOffer.trip.dropoffAddress,
        rideType: pendingOffer.trip.rideType,
        recipientName: pendingOffer.trip.recipientName,
        createdAt: pendingOffer.createdAt,
      },
      activeDispatch: null,
    };
  }

  const active = await prisma.tripDispatch.findFirst({
    where: { driverId: profile.id, status: "PENDING", expiresAt: { gt: new Date() } },
    include: { trip: { include: { rider: { include: { user: true } } } } },
    orderBy: { expiresAt: "asc" },
  });
  const activeDispatch = active && active.trip.status === "SEARCHING"
    ? serializeActiveDispatch({
        expiresAt: active.expiresAt,
        trip: {
          id: active.trip.id,
          bookingCode: active.trip.bookingCode,
          riderName: active.trip.rider?.user?.name || "Rider",
          pickupAddress: active.trip.pickupAddress,
          dropoffAddress: active.trip.dropoffAddress,
          pickupLat: active.trip.pickupLat,
          pickupLng: active.trip.pickupLng,
          dropoffLat: active.trip.dropoffLat,
          dropoffLng: active.trip.dropoffLng,
          distanceKm: Number(active.trip.distanceKm),
          durationMin: active.trip.durationMin,
          fareTotal: Number(active.trip.fareTotal),
          minFare: await getMinFare(active.trip.city, active.trip.vehicleType),
          vehicleType: active.trip.vehicleType,
          rideType: active.trip.rideType,
          recipientName: active.trip.recipientName,
        },
      })
    : null;

  const nearbyIds = await nearbySearchingTripsClient(userId);
  const hiddenDispatches = await prisma.tripDispatch.findMany({
    where: {
      driverId: profile.id,
      OR: [
        { status: "PENDING" },
        { status: { in: ["DECLINED", "EXPIRED"] }, voided: false },
      ],
    },
    select: { tripId: true },
  });
  const hiddenTripIds = new Set(hiddenDispatches.map((row) => row.tripId));
  const trips = nearbyIds.length
    ? await prisma.trip.findMany({
        where: { id: { in: nearbyIds.map((row) => row.id) }, status: "SEARCHING" },
        include: { rider: { include: { user: true } } },
      })
    : [];
  const distanceById = new Map(nearbyIds.map((row) => [row.id, row.distanceToPickup]));
  const minFareByKey = new Map<string, number>();
  for (const trip of trips) {
    const key = `${trip.city}:${trip.vehicleType}`;
    if (!minFareByKey.has(key)) {
      minFareByKey.set(key, await getMinFare(trip.city, trip.vehicleType));
    }
  }
  const nearby = nearbyIds
    .map((row) => trips.find((trip) => trip.id === row.id))
    .filter((trip): trip is NonNullable<typeof trip> => Boolean(trip))
    .filter((trip) => trip.rider.userId !== userId)
    .filter((trip) => !hiddenTripIds.has(trip.id))
    .map((trip) => ({
      id: trip.id,
      bookingCode: trip.bookingCode,
      riderName: trip.rider?.user?.name || "Rider",
      riderRating: money(trip.rider?.rating || 4.9),
      pickupAddress: trip.pickupAddress,
      dropoffAddress: trip.dropoffAddress,
      pickupLat: trip.pickupLat,
      pickupLng: trip.pickupLng,
      dropoffLat: trip.dropoffLat,
      dropoffLng: trip.dropoffLng,
      distanceKm: money(trip.distanceKm),
      durationMin: trip.durationMin,
      suggestedFare: money(trip.suggestedFare),
      fareTotal: money(trip.fareTotal),
      minFare: minFareByKey.get(`${trip.city}:${trip.vehicleType}`) ?? 0,
      estimatedEarnings: money(trip.fareTotal),
      rideType: trip.rideType,
      recipientName: trip.recipientName,
      recipientPhone: trip.recipientPhone,
      packageNote: trip.packageNote,
      vehicleType: trip.vehicleType,
      createdAt: trip.createdAt,
      distanceToPickup: distanceById.get(trip.id) ?? null,
    }));

  return { trips: nearby, pendingOffer: null, activeDispatch };
}

export async function createTripOffer(userId: string, tripId: string, input: { proposedFare: number; etaMinutes: number }) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId }, include: { vehicles: true } });
  if (!profile) { const error = new Error("Driver profile not found"); error.name = "NotFoundError"; throw error; }
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { rider: { select: { userId: true } } },
  });
  if (!trip) { const error = new Error("Trip not found"); error.name = "NotFoundError"; throw error; }
  if (trip.rider.userId === userId) {
    const error = new Error("You cannot offer on your own trip");
    error.name = "ConflictError";
    throw error;
  }
  const missedDispatch = await prisma.tripDispatch.findFirst({
    where: {
      tripId,
      driverId: profile.id,
      voided: false,
      status: { in: ["DECLINED", "EXPIRED"] },
    },
    select: { id: true },
  });
  if (missedDispatch) fail("This request is no longer available", "ConflictError");
  const distanceToPickup = await distanceToPickupClient(userId, trip.pickupLat, trip.pickupLng);
  if (
    trip.status !== "SEARCHING"
    || profile.approvalStatus !== "APPROVED"
    || !["ONLINE", "IDLE"].includes(profile.presence)
    || distanceToPickup > MATCH_RADIUS_KM
    || (trip.rideType !== "COURIER" && !profile.vehicles.some((vehicle) => vehicle.vehicleType === trip.vehicleType))
    || (trip.rideType === "COURIER" && profile.vehicles.length === 0)
  ) {
    const error = new Error("This trip is not available to this driver"); error.name = "ConflictError"; throw error;
  }
  const minFare = await getMinFare(trip.city, trip.vehicleType);
  const maxFare = Number(trip.fareTotal) * 2;
  if (input.proposedFare < minFare || input.proposedFare > maxFare) {
    const error = new Error(
      `Offer must be at least the minimum fare ($${minFare.toFixed(2)}) and at most double the suggested fare`,
    );
    error.name = "ConflictError";
    throw error;
  }
  const [existingPending, activeTrip] = await Promise.all([
    prisma.tripOffer.findFirst({ where: { driverId: profile.id, status: "PENDING" } }),
    prisma.trip.findFirst({ where: { driverId: profile.id, status: { in: ["ASSIGNED", "ONGOING"] } } }),
  ]);
  if (existingPending || activeTrip) {
    const error = new Error("Wait for your current offer to be matched or declined before offering on another trip");
    error.name = "ConflictError";
    throw error;
  }
  try {
    const offer = await prisma.tripOffer.create({ data: { tripId, driverId: profile.id, proposedFare: input.proposedFare, etaMinutes: input.etaMinutes } });
    const payload = { ...offer, proposedFare: Number(offer.proposedFare), tripId };
    emitTripAndUserEvent(tripId, "RIDER", trip.rider.userId, "offer:created", payload);
    return offer;
  } catch (error: any) {
    if (error?.code === "P2002") { error.name = "ConflictError"; error.message = "You already offered on this trip"; }
    throw error;
  }
}

export async function acceptDispatch(userId: string, tripId: string, proposedFare?: number) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile) fail("Driver profile not found", "NotFoundError");
  await expireTimedOutDispatches(profile.id);

  const dispatch = await prisma.tripDispatch.findUnique({
    where: { tripId_driverId: { tripId, driverId: profile.id } },
    include: { trip: true },
  });
  if (
    !dispatch
    || dispatch.status !== "PENDING"
    || dispatch.expiresAt <= new Date()
    || dispatch.trip.status !== "SEARCHING"
  ) {
    fail("This request is no longer available", "ConflictError");
  }

  await prisma.tripDispatch.update({
    where: { id: dispatch.id },
    data: { status: "ACCEPTED" },
  });
  await refreshAcceptanceRate(profile.id);

  const etaMinutes = Math.max(1, Math.ceil(dispatch.trip.durationMin / 3));
  return createTripOffer(userId, tripId, {
    proposedFare: money(proposedFare ?? dispatch.trip.fareTotal),
    etaMinutes,
  });
}

export async function declineDispatch(userId: string, tripId: string) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile) fail("Driver profile not found", "NotFoundError");
  await expireTimedOutDispatches(profile.id);

  const dispatch = await prisma.tripDispatch.findUnique({
    where: { tripId_driverId: { tripId, driverId: profile.id } },
  });
  if (!dispatch) fail("Dispatch not found", "NotFoundError");
  if (dispatch.status !== "PENDING") {
    return { status: dispatch.status };
  }

  await prisma.tripDispatch.update({
    where: { id: dispatch.id },
    data: { status: "DECLINED" },
  });
  const acceptanceRate = await refreshAcceptanceRate(profile.id);
  return { status: "DECLINED" as const, acceptanceRate };
}

export async function acceptTrip(userId: string, tripId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { vehicles: true },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { rider: { select: { userId: true } } },
  });

  if (!trip) {
    const error = new Error("Trip not found");
    error.name = "NotFoundError";
    throw error;
  }

  if (trip.rider.userId === userId) {
    const error = new Error("You cannot accept your own trip");
    error.name = "ConflictError";
    throw error;
  }

  if (trip.status !== "SEARCHING" && trip.status !== "SCHEDULED") {
    const error = new Error("This trip is no longer available");
    error.name = "ConflictError";
    throw error;
  }

  const vehicleId = profile.vehicles[0]?.id || null;

  const updatedTrip = await prisma.trip.update({
    where: { id: tripId },
    data: {
      driverId: profile.id,
      vehicleId,
      status: "ASSIGNED",
    },
    include: {
      rider: { include: { user: true } },
      vehicle: true,
    },
  });

  await prisma.driverProfile.update({
    where: { id: profile.id },
    data: { presence: "ON_TRIP" },
  });
  await removeSearchingTripClient(
    tripId,
    trip.vehicleType === "BIKE" || trip.vehicleType === "CAR" ? trip.vehicleType : undefined,
  );
  await syncDriverGeoClient(userId);
  await voidPendingDispatches(tripId);

  await recordTripEvent({
    tripId,
    action: "driver.accepted",
    actorId: userId,
    details: {
      driverId: profile.id,
      vehicleId,
    },
  });

  return updatedTrip;
}

export async function arrivedAtPickup(userId: string, tripId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, driverId: profile.id },
    include: driverTripInclude,
  });

  if (!trip) {
    const error = new Error("Trip not found or not assigned to you");
    error.name = "NotFoundError";
    throw error;
  }

  await recordTripEvent({
    tripId,
    action: "driver.arrived",
    actorId: userId,
    details: {
      driverId: profile.id,
      arrivedAt: new Date().toISOString(),
    },
  });

  emitTripAndUserEvent(tripId, "RIDER", trip.rider.userId, "driver:arrived", trip);

  return trip;
}

export async function startTrip(userId: string, tripId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, driverId: profile.id },
  });

  if (!trip) {
    const error = new Error("Trip not found or not assigned to you");
    error.name = "NotFoundError";
    throw error;
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: {
      status: "ONGOING",
      startedAt: new Date(),
    },
    include: {
      rider: { include: { user: true } },
      vehicle: true,
    },
  });

  await recordTripEvent({
    tripId,
    action: "trip.started",
    actorId: userId,
    details: {
      driverId: profile.id,
      startedAt: new Date().toISOString(),
    },
  });

  emitTripAndUserEvent(tripId, "RIDER", updated.rider.userId, "trip:started", updated);

  return updated;
}

export async function completeTrip(
  userId: string,
  tripId: string,
  input: { rating?: number; feedback?: string } = {},
) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, driverId: profile.id },
    include: { rider: true },
  });

  if (!trip) {
    const error = new Error("Trip not found or not assigned to you");
    error.name = "NotFoundError";
    throw error;
  }

  const driverNetEarnings = Number(trip.fareTotal);

  const updatedTrip = await prisma.$transaction(async (tx) => {
    const completed = await tx.trip.update({
      where: { id: tripId },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
        paymentStatus: "COMPLETED",
      },
      include: {
        rider: { include: { user: true } },
        vehicle: true,
      },
    });

    await tx.driverProfile.update({
      where: { id: profile.id },
      data: {
        presence: "ONLINE",
        earningsTotal: { increment: driverNetEarnings },
        onlineHours: { increment: (trip.durationMin || 15) / 60 },
      },
    });

    await tx.ledgerEntry.create({
      data: {
        tripId: trip.id,
        userId: profile.userId,
        type: "CHARGE",
        status: "COMPLETED",
        method: trip.paymentMethod,
        amount: trip.fareTotal,
        note: `Matched fare recorded off-platform for trip ${trip.bookingCode}`,
      },
    });

    return completed;
  });
  await syncDriverGeoClient(userId);

  await recordTripEvent({
    tripId,
    action: "trip.completed",
    actorId: userId,
    details: {
      driverId: profile.id,
      endedAt: new Date().toISOString(),
      driverEarnings: driverNetEarnings,
      riderRatingGiven: input.rating,
    },
  });

  emitTripAndUserEvent(tripId, "RIDER", updatedTrip.rider.userId, "trip:completed", updatedTrip);

  return {
    trip: updatedTrip,
    earnings: {
      fareTotal: money(trip.fareTotal),
      netEarnings: money(driverNetEarnings),
      durationMin: trip.durationMin,
      distanceKm: money(trip.distanceKm),
    },
  };
}

export async function cancelTrip(
  userId: string,
  tripId: string,
  reason?: string,
) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, driverId: profile.id },
  });

  if (!trip) {
    const error = new Error("Trip not found or not assigned to you");
    error.name = "NotFoundError";
    throw error;
  }

  const cancelledTrip = await prisma.trip.update({
    where: { id: tripId },
    data: {
      status: "CANCELLED",
      cancellationReason: reason || "Cancelled by driver",
      paymentStatus: "CANCELLED",
    },
    include: {
      rider: { include: { user: true } },
      vehicle: true,
    },
  });

  await prisma.driverProfile.update({
    where: { id: profile.id },
    data: {
      presence: "ONLINE",
      cancellationRate: { increment: 1 },
    },
  });
  await removeSearchingTripClient(
    tripId,
    trip.vehicleType === "BIKE" || trip.vehicleType === "CAR" ? trip.vehicleType : undefined,
  );
  await syncDriverGeoClient(userId);
  await voidPendingDispatches(tripId);

  await recordTripEvent({
    tripId,
    action: "trip.cancelled_by_driver",
    actorId: userId,
    details: {
      driverId: profile.id,
      reason,
    },
  });

  emitTripAndUserEvent(tripId, "RIDER", cancelledTrip.rider.userId, "trip:cancelled", cancelledTrip);

  return cancelledTrip;
}

const driverTripInclude = {
  rider: { include: { user: true } },
  vehicle: true,
  stops: { orderBy: { sequence: "asc" as const } },
} as const;

function serializeDriverTrip(trip: {
  id: string;
  bookingCode: string;
  status: string;
  rideType: string;
  city: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number | { toString(): string };
  durationMin: number;
  fareTotal: number | { toString(): string };
  paymentStatus: string;
  paymentMethod: string;
  cancellationReason: string | null;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  rider?: { rating?: unknown; user?: { name?: string | null } | null } | null;
  stops?: { id: string; sequence: number; address: string; lat: number; lng: number; kind: string }[];
}) {
  return {
    id: trip.id,
    bookingCode: trip.bookingCode,
    status: trip.status,
    rideType: trip.rideType,
    city: trip.city,
    pickupAddress: trip.pickupAddress,
    dropoffAddress: trip.dropoffAddress,
    pickupLat: trip.pickupLat,
    pickupLng: trip.pickupLng,
    dropoffLat: trip.dropoffLat,
    dropoffLng: trip.dropoffLng,
    distanceKm: money(trip.distanceKm),
    durationMin: trip.durationMin,
    fareTotal: money(trip.fareTotal),
    netEarnings: money(trip.fareTotal),
    paymentStatus: trip.paymentStatus,
    paymentMethod: trip.paymentMethod,
    riderName: trip.rider?.user?.name || "Rider",
    riderRating: money(trip.rider?.rating || 5.0),
    cancellationReason: trip.cancellationReason,
    createdAt: trip.createdAt,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    stops: trip.stops ?? [],
  };
}

export async function getDriverTrips(
  userId: string,
  options: { status?: string; take?: number; skip?: number } = {},
) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  const trips = await prisma.trip.findMany({
    where: {
      driverId: profile.id,
      ...(options.status ? { status: options.status as never } : {}),
    },
    include: driverTripInclude,
    orderBy: { createdAt: "desc" },
    take: options.take || 30,
    skip: options.skip || 0,
  });

  return trips.map(serializeDriverTrip);
}

export async function getDriverTrip(userId: string, tripId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    fail("Driver profile not found", "NotFoundError");
  }

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, driverId: profile.id },
    include: driverTripInclude,
  });

  if (!trip) {
    fail("Trip not found", "NotFoundError");
  }

  return serializeDriverTrip(trip);
}

export async function getDriverEarningsOverview(userId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: {
      trips: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!profile) {
    const error = new Error("Driver profile not found");
    error.name = "NotFoundError";
    throw error;
  }

  const today = startOfDay();
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  startOfWeek.setHours(0, 0, 0, 0);

  const completedTrips = profile.trips;
  const todayTrips = completedTrips.filter(
    (t) => new Date(t.createdAt) >= today,
  );
  const weekTrips = completedTrips.filter(
    (t) => new Date(t.createdAt) >= startOfWeek,
  );

  const todayNet = todayTrips.reduce(
    (sum, t) => sum + Number(t.fareTotal),
    0,
  );

  const weekNet = weekTrips.reduce(
    (sum, t) => sum + Number(t.fareTotal),
    0,
  );

  return {
    summary: {
      todayEarnings: money(todayNet),
      todayTrips: todayTrips.length,
      todayOnlineHours: money(Number(profile.onlineHours)),
      weekEarnings: money(weekNet),
      weekTrips: weekTrips.length,
      lifetimeEarnings: money(profile.earningsTotal),
      walletBalance: money(profile.walletBalance),
      rating: money(profile.rating),
      acceptanceRate: money(profile.acceptanceRate),
      cancellationRate: money(profile.cancellationRate),
    },
    recentTrips: completedTrips.slice(0, 10).map((t) => ({
      id: t.id,
      bookingCode: t.bookingCode,
      pickupAddress: t.pickupAddress,
      dropoffAddress: t.dropoffAddress,
      fareTotal: money(t.fareTotal),
      netEarnings: money(t.fareTotal),
      distanceKm: money(t.distanceKm),
      durationMin: t.durationMin,
      createdAt: t.createdAt,
    })),
  };
}

const supportTicketInclude = {
  messages: { where: { internal: false }, orderBy: { createdAt: "asc" as const } },
};

function serializeSupportTicket(ticket: {
  id: string;
  subject: string;
  category: string;
  status: string;
  tripId: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: { id: string; authorId: string; body: string; internal: boolean; createdAt: Date }[];
}) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    tripId: ticket.tripId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    messages: (ticket.messages ?? [])
      .filter((message) => !message.internal)
      .map((message) => ({
        id: message.id,
        authorId: message.authorId,
        body: message.body,
        createdAt: message.createdAt,
      })),
  };
}

async function getDriver(userId: string) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile) fail("Driver profile not found", "NotFoundError");
  return profile;
}

async function notifyOpsTicket(
  ticketId: string,
  subject: string,
  userId: string,
  kind: "created" | "reply",
) {
  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  emitAdminEvent("admin:ticket", {
    ticketId,
    subject,
    kind,
    requesterName: requester?.name ?? "Unknown",
  });
}

export async function listSupportTickets(userId: string) {
  await getDriver(userId);
  const tickets = await prisma.supportTicket.findMany({
    where: { requesterId: userId },
    include: supportTicketInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return tickets.map(serializeSupportTicket);
}

export async function createSupportTicket(
  userId: string,
  input: { subject: string; category: string; body: string; tripId?: string },
) {
  await getDriver(userId);
  if (input.tripId) {
    const trip = await prisma.trip.findFirst({
      where: { id: input.tripId, driver: { userId } },
      select: { id: true },
    });
    if (!trip) fail("Trip not found", "NotFoundError");

    const existing = await prisma.supportTicket.findFirst({
      where: {
        requesterId: userId,
        tripId: input.tripId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      await prisma.ticketMessage.create({
        data: { ticketId: existing.id, authorId: userId, body: input.body.trim(), internal: false },
      });
      notifyOpsTicket(existing.id, existing.subject, userId, "reply");
      return getSupportTicket(userId, existing.id);
    }
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      subject: input.subject,
      category: input.category,
      channel: "IN_APP",
      requesterId: userId,
      tripId: input.tripId,
      messages: { create: { authorId: userId, body: input.body, internal: false } },
    },
    include: supportTicketInclude,
  });
  notifyOpsTicket(ticket.id, ticket.subject, userId, "created");
  return serializeSupportTicket(ticket);
}

export async function getSupportTicket(userId: string, ticketId: string) {
  await getDriver(userId);
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, requesterId: userId },
    include: supportTicketInclude,
  });
  if (!ticket) fail("Ticket not found", "NotFoundError");
  return serializeSupportTicket(ticket);
}

export async function addSupportMessage(userId: string, ticketId: string, body: string) {
  const text = body.trim();
  if (text.length < 1) fail("Message cannot be empty", "ConflictError");
  await getDriver(userId);
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, requesterId: userId },
    select: { id: true, status: true, subject: true },
  });
  if (!ticket) fail("Ticket not found", "NotFoundError");
  if (ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
    fail("This ticket is closed", "ConflictError");
  }
  await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, authorId: userId, body: text, internal: false },
  });
  notifyOpsTicket(ticket.id, ticket.subject, userId, "reply");
  return getSupportTicket(userId, ticketId);
}
