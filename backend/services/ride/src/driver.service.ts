import { createHmac, randomBytes } from "node:crypto";
import { getDriverProfile, prisma, recordTripEvent } from "@eve/db";
import { MATCH_RADIUS_KM, money, startOfDay } from "@eve/shared";
import {
  distanceToPickupClient,
  nearbySearchingTripsClient,
} from "@eve/location";
import { emitTripEvent, emitUserEvent } from "@eve/notify";

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
    mimeType?: string;
    fileSize?: number;
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
    return { trips: [], pendingOffer: null };
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
        createdAt: pendingOffer.createdAt,
      },
    };
  }

  const nearbyIds = await nearbySearchingTripsClient(userId);
  const trips = nearbyIds.length
    ? await prisma.trip.findMany({
        where: { id: { in: nearbyIds.map((row) => row.id) }, status: "SEARCHING" },
        include: { rider: { include: { user: true } } },
      })
    : [];
  const distanceById = new Map(nearbyIds.map((row) => [row.id, row.distanceToPickup]));
  const nearby = nearbyIds
    .map((row) => trips.find((trip) => trip.id === row.id))
    .filter((trip): trip is NonNullable<typeof trip> => Boolean(trip))
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
      estimatedEarnings: money(trip.fareTotal),
      rideType: trip.rideType,
      vehicleType: trip.vehicleType,
      createdAt: trip.createdAt,
      distanceToPickup: distanceById.get(trip.id) ?? null,
    }));

  return { trips: nearby, pendingOffer: null };
}

export async function createTripOffer(userId: string, tripId: string, input: { proposedFare: number; etaMinutes: number }) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId }, include: { vehicles: true } });
  if (!profile) { const error = new Error("Driver profile not found"); error.name = "NotFoundError"; throw error; }
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) { const error = new Error("Trip not found"); error.name = "NotFoundError"; throw error; }
  const distanceToPickup = await distanceToPickupClient(userId, trip.pickupLat, trip.pickupLng);
  if (
    trip.status !== "SEARCHING"
    || profile.approvalStatus !== "APPROVED"
    || !["ONLINE", "IDLE"].includes(profile.presence)
    || distanceToPickup > MATCH_RADIUS_KM
    || !profile.vehicles.some((vehicle) => vehicle.vehicleType === trip.vehicleType)
  ) {
    const error = new Error("This trip is not available to this driver"); error.name = "ConflictError"; throw error;
  }
  if (input.proposedFare < Number(trip.fareTotal) || input.proposedFare > Number(trip.fareTotal) * 2) {
    const error = new Error("Offer must start at the base fare for this distance and can go up to double it"); error.name = "ConflictError"; throw error;
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
    emitTripEvent(tripId, "offer:created", offer);
    return offer;
  } catch (error: any) {
    if (error?.code === "P2002") { error.name = "ConflictError"; error.message = "You already offered on this trip"; }
    throw error;
  }
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
  });

  if (!trip) {
    const error = new Error("Trip not found");
    error.name = "NotFoundError";
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
    include: {
      rider: { include: { user: true } },
      vehicle: true,
    },
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

  emitTripEvent(tripId, "driver:arrived", trip);
  emitUserEvent("RIDER", trip.rider.userId, "driver:arrived", trip);

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

  emitTripEvent(tripId, "trip:started", updated);
  emitUserEvent("RIDER", updated.rider.userId, "trip:started", updated);

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

  emitTripEvent(tripId, "trip:completed", updatedTrip);
  emitUserEvent("RIDER", updatedTrip.rider.userId, "trip:completed", updatedTrip);

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

  await recordTripEvent({
    tripId,
    action: "trip.cancelled_by_driver",
    actorId: userId,
    details: {
      driverId: profile.id,
      reason,
    },
  });

  emitTripEvent(tripId, "trip:cancelled", cancelledTrip);
  emitUserEvent("RIDER", cancelledTrip.rider.userId, "trip:cancelled", cancelledTrip);

  return cancelledTrip;
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
    include: {
      rider: { include: { user: true } },
      vehicle: true,
    },
    orderBy: { createdAt: "desc" },
    take: options.take || 30,
    skip: options.skip || 0,
  });

  return trips.map((trip) => ({
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
  }));
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
