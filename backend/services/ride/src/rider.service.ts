import { calculateFare, prisma } from "@eve/db";
import { distanceKm, durationMinutes, fail, money } from "@eve/shared";
import { nearbyDriversClient } from "@eve/location";
import { emitTripEvent, emitUserEvent } from "@eve/notify";

async function getRider(userId: string) {
  const rider = await prisma.riderProfile.findUnique({ where: { userId } });
  if (!rider) fail("Rider profile not found", "NotFoundError");
  return rider;
}

function serializeTrip(trip: any) {
  return {
    ...trip,
    distanceKm: money(trip.distanceKm),
    suggestedFare: money(trip.suggestedFare),
    fareTotal: money(trip.fareTotal),
    offers: trip.offers?.map((offer: any) => ({
      ...offer,
      proposedFare: money(offer.proposedFare),
      driver: offer.driver ? { id: offer.driver.id, rating: money(offer.driver.rating), user: offer.driver.user } : undefined,
    })),
  };
}

export async function createTrip(userId: string, input: {
  pickupAddress: string; dropoffAddress: string; city: string;
  pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number;
  vehicleType: "BIKE" | "CAR"; rideType: "STANDARD" | "AIRPORT" | "MULTI_STOP" | "SCHEDULED" | "CORPORATE";
}) {
  const rider = await getRider(userId);
  const distance = distanceKm(input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng);
  if (distance < 0.05) fail("Pickup and drop-off must be different locations", "ConflictError");
  const duration = durationMinutes(distance);
  const fare = await calculateFare(input.city, input.vehicleType, distance, duration);
  const trip = await prisma.trip.create({
    data: {
      bookingCode: `EVE-${Date.now().toString(36).toUpperCase()}`,
      riderId: rider.id,
      status: "SEARCHING",
      rideType: input.rideType,
      vehicleType: input.vehicleType,
      city: input.city,
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      distanceKm: distance,
      durationMin: duration,
      suggestedFare: fare,
      fareTotal: fare,
      paymentMethod: "CASH",
    },
  });
  const result = serializeTrip(trip);
  const drivers = await nearbyDriversClient({
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    vehicleType: input.vehicleType,
  });
  await Promise.all(
    drivers.map((driver) => emitUserEvent("DRIVER", driver.userId, "trip:requested", result)),
  );
  await emitTripEvent(trip.id, "trip:requested", result);
  return result;
}

export async function getTrip(userId: string, tripId: string) {
  const rider = await getRider(userId);
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, riderId: rider.id },
    include: { offers: { include: { driver: { include: { user: true } } } }, driver: { include: { user: true } }, vehicle: true },
  });
  if (!trip) fail("Trip not found", "NotFoundError");
  return serializeTrip(trip);
}

export async function listTrips(userId: string) {
  const rider = await getRider(userId);
  const trips = await prisma.trip.findMany({
    where: { riderId: rider.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return trips.map(serializeTrip);
}

export async function acceptOffer(userId: string, tripId: string, offerId: string) {
  const rider = await getRider(userId);
  const { acceptedDriverUserId, rejectedDriverUserIds } = await prisma.$transaction(async (tx) => {
    const offer = await tx.tripOffer.findFirst({
      where: { id: offerId, tripId, status: "PENDING", trip: { riderId: rider.id, status: "SEARCHING" } },
      include: { trip: true, driver: { include: { vehicles: true } } },
    });
    if (!offer) fail("Offer is no longer available", "ConflictError");
    const vehicle = offer.driver.vehicles.find((item) => item.vehicleType === offer.trip.vehicleType);
    if (!vehicle) fail("Driver has no compatible vehicle", "ConflictError");
    const rejected = await tx.tripOffer.findMany({
      where: { tripId, id: { not: offerId }, status: "PENDING" },
      include: { driver: { select: { userId: true } } },
    });
    await tx.trip.update({
      where: { id: tripId },
      data: { driverId: offer.driverId, vehicleId: vehicle.id, status: "ASSIGNED", fareTotal: offer.proposedFare },
    });
    await tx.tripOffer.update({ where: { id: offerId }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    await tx.tripOffer.updateMany({ where: { tripId, id: { not: offerId }, status: "PENDING" }, data: { status: "REJECTED", respondedAt: new Date() } });
    await tx.driverProfile.update({ where: { id: offer.driverId }, data: { presence: "ON_TRIP" } });
    return { acceptedDriverUserId: offer.driver.userId, rejectedDriverUserIds: rejected.map((row) => row.driver.userId) };
  });
  // Re-read outside the transaction so this reflects the committed state.
  const result = await getTrip(userId, tripId);
  emitTripEvent(tripId, "trip:assigned", result);
  emitUserEvent("DRIVER", acceptedDriverUserId, "trip:assigned", result);
  for (const driverUserId of rejectedDriverUserIds) {
    emitUserEvent("DRIVER", driverUserId, "offer:rejected", { tripId });
  }
  return result;
}

export async function getOffers(userId: string, tripId: string) {
  const trip = await getTrip(userId, tripId);
  return trip.offers ?? [];
}

export async function cancelTrip(userId: string, tripId: string) {
  const rider = await getRider(userId);
  const trip = await prisma.trip.findFirst({ where: { id: tripId, riderId: rider.id } });
  if (!trip) fail("Trip not found", "NotFoundError");
  if (["COMPLETED", "CANCELLED"].includes(trip.status)) {
    fail("This trip cannot be cancelled", "ConflictError");
  }
  const pendingDrivers = await prisma.tripOffer.findMany({
    where: { tripId, status: "PENDING" },
    include: { driver: { select: { userId: true } } },
  });
  await prisma.$transaction(async (tx) => {
    await tx.trip.update({ where: { id: tripId }, data: { status: "CANCELLED", cancellationReason: "Cancelled by rider" } });
    await tx.tripOffer.updateMany({ where: { tripId, status: "PENDING" }, data: { status: "REJECTED", respondedAt: new Date() } });
    if (trip.driverId) {
      await tx.driverProfile.update({ where: { id: trip.driverId }, data: { presence: "ONLINE" } });
    }
  });
  const result = await getTrip(userId, tripId);
  emitTripEvent(tripId, "trip:cancelled", result);
  if (trip.driverId) {
    const assigned = await prisma.driverProfile.findUnique({ where: { id: trip.driverId }, select: { userId: true } });
    if (assigned) emitUserEvent("DRIVER", assigned.userId, "trip:cancelled", result);
  }
  for (const row of pendingDrivers) {
    emitUserEvent("DRIVER", row.driver.userId, "offer:rejected", { tripId });
  }
  return result;
}