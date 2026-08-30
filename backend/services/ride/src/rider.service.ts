import { randomBytes } from "node:crypto";
import { calculateFare, prisma, selectGreetingTemplate } from "@eve/db";
import { distanceKm, durationMinutes, fail, money } from "@eve/shared";
import {
  indexSearchingTripClient,
  nearbyDriversClient,
  removeSearchingTripClient,
  syncDriverGeoClient,
} from "@eve/location";
import { emitAdminEvent, emitTripAndUserEvent, emitTripEvent, emitUserEvent } from "@eve/notify";

async function getRider(userId: string) {
  const rider = await prisma.riderProfile.findUnique({ where: { userId } });
  if (!rider) fail("Rider profile not found", "NotFoundError");
  return rider;
}

const ACTIVE_STATUSES = ["SEARCHING", "ASSIGNED", "ONGOING"] as const;

function publicUser(user: { name: string; phone?: string | null } | null | undefined) {
  if (!user) return undefined;
  return { name: user.name, phone: user.phone ?? null };
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

type Viewer = { userId: string; riderId: string };

function serializeTrip(trip: any, viewer?: Viewer) {
  const isRecipient = Boolean(
    viewer && trip.recipientUserId === viewer.userId && trip.riderId !== viewer.riderId,
  );
  return {
    ...trip,
    distanceKm: money(trip.distanceKm),
    suggestedFare: money(trip.suggestedFare),
    fareTotal: money(trip.fareTotal),
    viewerRole: isRecipient ? "recipient" : "sender",
    canManage: !isRecipient,
    direction: isRecipient ? "receiving" : "sent",
    driver: trip.driver
      ? {
          ...trip.driver,
          rating: trip.driver.rating != null ? money(trip.driver.rating) : trip.driver.rating,
          user: publicUser(trip.driver.user),
        }
      : trip.driver,
    offers: isRecipient
      ? undefined
      : trip.offers?.map((offer: any) => ({
          ...offer,
          proposedFare: money(offer.proposedFare),
          driver: offer.driver
            ? { id: offer.driver.id, rating: money(offer.driver.rating), user: publicUser(offer.driver.user) }
            : undefined,
        })),
  };
}

async function matchRecipientUser(phone: string, excludeUserId: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  const or: { phone: string }[] = [{ phone: trimmed }];
  if (digits && digits !== trimmed) or.push({ phone: digits });
  const user = await prisma.user.findFirst({
    where: {
      role: "RIDER",
      isActive: true,
      id: { not: excludeUserId },
      phone: { not: null },
      OR: or,
    },
    select: { id: true },
  });
  return user?.id ?? null;
}

const tripDetailInclude = {
  offers: { include: { driver: { include: { user: true } } } },
  driver: { include: { user: true } },
  vehicle: true,
} as const;

export async function createTrip(userId: string, input: {
  pickupAddress: string; dropoffAddress: string; city: string;
  pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number;
  vehicleType: "BIKE" | "CAR";
  rideType: "STANDARD" | "AIRPORT" | "MULTI_STOP" | "SCHEDULED" | "CORPORATE" | "COURIER";
  recipientName?: string;
  recipientPhone?: string;
  packageNote?: string;
}) {
  const rider = await getRider(userId);
  const existing = await prisma.trip.findFirst({
    where: { riderId: rider.id, status: { in: [...ACTIVE_STATUSES] } },
    select: { id: true },
  });
  if (existing) fail("You already have an active trip", "ConflictError");
  const distance = distanceKm(input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng);
  if (distance < 0.05) fail("Pickup and drop-off must be different locations", "ConflictError");
  const duration = durationMinutes(distance);
  const fare = await calculateFare(input.city, input.vehicleType, distance, duration);
  const isCourier = input.rideType === "COURIER";
  const forSomeoneElse = Boolean(input.recipientName && input.recipientPhone);
  const recipientUserId = forSomeoneElse && input.recipientPhone
    ? await matchRecipientUser(input.recipientPhone, userId)
    : null;
  const trip = await prisma.trip.create({
    data: {
      bookingCode: `EVE-${randomBytes(6).toString("hex").toUpperCase()}`,
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
      recipientName: forSomeoneElse ? input.recipientName ?? null : null,
      recipientPhone: forSomeoneElse ? input.recipientPhone ?? null : null,
      packageNote: isCourier ? input.packageNote ?? null : null,
      trackingToken: forSomeoneElse ? randomBytes(16).toString("hex") : null,
      recipientUserId,
    },
  });
  const result = serializeTrip(trip, { userId, riderId: rider.id });
  await indexSearchingTripClient({
    id: trip.id,
    pickupLat: trip.pickupLat,
    pickupLng: trip.pickupLng,
    vehicleType: trip.vehicleType,
  });
  const drivers = await nearbyDriversClient({
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    vehicleType: input.vehicleType,
  });
  await Promise.all(
    drivers.map((driver) => emitUserEvent("DRIVER", driver.userId, "trip:requested", result)),
  );
  await emitTripEvent(trip.id, "trip:requested", result);
  if (recipientUserId) {
    emitUserEvent("RIDER", recipientUserId, isCourier ? "courier:incoming" : "trip:incoming", result);
  }
  return result;
}

export async function getTrip(userId: string, tripId: string) {
  const rider = await getRider(userId);
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, OR: [{ riderId: rider.id }, { recipientUserId: userId }] },
    include: tripDetailInclude,
  });
  if (!trip) fail("Trip not found", "NotFoundError");
  return serializeTrip(trip, { userId, riderId: rider.id });
}

export async function listTrips(userId: string) {
  const rider = await getRider(userId);
  const trips = await prisma.trip.findMany({
    where: { OR: [{ riderId: rider.id }, { recipientUserId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return trips.map((trip) => serializeTrip(trip, { userId, riderId: rider.id }));
}

export async function getActiveTrip(userId: string) {
  const rider = await getRider(userId);
  const trip = await prisma.trip.findFirst({
    where: { riderId: rider.id, status: { in: [...ACTIVE_STATUSES] } },
    include: tripDetailInclude,
    orderBy: { createdAt: "desc" },
  });
  return trip ? serializeTrip(trip, { userId, riderId: rider.id }) : null;
}

export async function getPublicCourier(token: string) {
  const trip = await prisma.trip.findFirst({
    where: { trackingToken: token },
    include: { driver: true, vehicle: true },
  });
  if (!trip) fail("Tracking link not found", "NotFoundError");
  return {
    bookingCode: trip.bookingCode,
    status: trip.status,
    rideType: trip.rideType,
    pickupAddress: trip.pickupAddress,
    dropoffAddress: trip.dropoffAddress,
    pickupLat: trip.pickupLat,
    pickupLng: trip.pickupLng,
    dropoffLat: trip.dropoffLat,
    dropoffLng: trip.dropoffLng,
    etaMinutes: trip.etaMinutes,
    recipientName: trip.recipientName,
    packageNote: trip.packageNote,
    vehicle: trip.vehicle
      ? {
          make: trip.vehicle.make,
          model: trip.vehicle.model,
          color: trip.vehicle.color,
          plateNumber: trip.vehicle.plateNumber,
        }
      : null,
    driverLocation:
      trip.driver && trip.driver.latitude != null && trip.driver.longitude != null
        ? { latitude: trip.driver.latitude, longitude: trip.driver.longitude }
        : null,
  };
}

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

export async function listSupportTickets(userId: string) {
  const rider = await getRider(userId);
  const tickets = await prisma.supportTicket.findMany({
    where: { riderId: rider.id },
    include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return tickets.map(serializeSupportTicket);
}

export async function createSupportTicket(
  userId: string,
  input: { subject: string; category: string; body: string; tripId?: string },
) {
  const rider = await getRider(userId);
  if (input.tripId) {
    const trip = await prisma.trip.findFirst({ where: { id: input.tripId, riderId: rider.id }, select: { id: true } });
    if (!trip) fail("Trip not found", "NotFoundError");
  }
  const ticket = await prisma.supportTicket.create({
    data: {
      subject: input.subject,
      category: input.category,
      channel: "IN_APP",
      requesterId: userId,
      riderId: rider.id,
      tripId: input.tripId,
      messages: { create: { authorId: userId, body: input.body, internal: false } },
    },
    include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" } } },
  });
  notifyOpsTicket(ticket.id, ticket.subject, userId, "created");
  return serializeSupportTicket(ticket);
}

export async function getSupportTicket(userId: string, ticketId: string) {
  const rider = await getRider(userId);
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, riderId: rider.id },
    include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" } } },
  });
  if (!ticket) fail("Ticket not found", "NotFoundError");
  return serializeSupportTicket(ticket);
}

export async function addSupportMessage(userId: string, ticketId: string, body: string) {
  const text = body.trim();
  if (text.length < 1) fail("Message cannot be empty", "ConflictError");
  const rider = await getRider(userId);
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, riderId: rider.id },
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
  await Promise.all([
    removeSearchingTripClient(
      tripId,
      result.vehicleType === "BIKE" || result.vehicleType === "CAR" ? result.vehicleType : undefined,
    ),
    syncDriverGeoClient(acceptedDriverUserId),
  ]);
  emitTripAndUserEvent(tripId, "DRIVER", acceptedDriverUserId, "trip:assigned", result);
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
  await removeSearchingTripClient(
    tripId,
    trip.vehicleType === "BIKE" || trip.vehicleType === "CAR" ? trip.vehicleType : undefined,
  );
  const result = await getTrip(userId, tripId);
  const assigned = trip.driverId
    ? await prisma.driverProfile.findUnique({ where: { id: trip.driverId }, select: { userId: true } })
    : null;
  if (assigned) {
    await syncDriverGeoClient(assigned.userId);
    emitTripAndUserEvent(tripId, "DRIVER", assigned.userId, "trip:cancelled", result);
  } else emitTripEvent(tripId, "trip:cancelled", result);
  for (const row of pendingDrivers) {
    emitUserEvent("DRIVER", row.driver.userId, "offer:rejected", { tripId });
  }
  return result;
}

export async function getGreeting(userId: string) {
  return { template: await selectGreetingTemplate(userId) };
}