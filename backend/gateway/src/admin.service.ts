import { Prisma, prisma, recordTripEvent, writeAudit, calculateFare } from "@eve/db";
import { emitUserEvent } from "@eve/notify";
import { money, startOfDay, distanceKm, durationMinutes } from "@eve/shared";

function parseFilters(query: Record<string, unknown>) {
  const city = typeof query.city === "string" && query.city ? query.city : undefined;
  const zone = typeof query.zone === "string" && query.zone ? query.zone : undefined;
  const status = typeof query.status === "string" && query.status ? query.status : undefined;
  const rideType =
    typeof query.rideType === "string" && query.rideType ? query.rideType : undefined;
  const from = typeof query.from === "string" && query.from ? new Date(query.from) : undefined;
  const to = typeof query.to === "string" && query.to ? new Date(query.to) : undefined;
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const skip = Number(query.skip ?? 0) || 0;
  const take = Math.min(Number(query.take ?? 50) || 50, 200);

  return { city, zone, status, rideType, from, to, q, skip, take };
}

function tripWhere(filters: ReturnType<typeof parseFilters>): Prisma.TripWhereInput {
  return {
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.zone ? { zone: filters.zone } : {}),
    ...(filters.status ? { status: filters.status as Prisma.EnumTripStatusFilter["equals"] } : {}),
    ...(filters.rideType
      ? { rideType: filters.rideType as Prisma.EnumRideTypeFilter["equals"] }
      : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };
}

export async function getDashboard(query: Record<string, unknown>) {
  const filters = parseFilters(query);
  const today = startOfDay();
  const tripFilter = tripWhere(filters);
  const now = new Date();

  const [
    riders,
    drivers,
    vehicles,
    activeUsers,
    driverGroups,
    tripGroups,
    todayTrips,
    todayMatched,
    pendingDrivers,
    openTickets,
    slaBreachedTickets,
    openSos,
    openIncidents,
    alerts,
    liveDrivers,
    liveTrips,
    searchingTrips,
    matchedOffers,
    liveSos,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "RIDER" } }),
    prisma.user.count({ where: { role: "DRIVER" } }),
    prisma.vehicle.count(),
    prisma.user.count({ where: { isActive: true, accountStatus: "ACTIVE" } }),
    prisma.driverProfile.groupBy({
      by: ["presence"],
      _count: { _all: true },
    }),
    prisma.trip.groupBy({
      by: ["status"],
      where: tripFilter,
      _count: { _all: true },
    }),
    prisma.trip.count({
      where: { ...tripFilter, createdAt: { gte: today } },
    }),
    prisma.trip.aggregate({
      where: { ...tripFilter, status: "COMPLETED", createdAt: { gte: today } },
      _sum: { fareTotal: true },
    }),
    prisma.driverProfile.count({
      where: { approvalStatus: { in: ["PENDING", "NEEDS_INFO"] } },
    }),
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
    }),
    prisma.supportTicket.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        slaDueAt: { lt: now },
      },
    }),
    prisma.safetyIncident.count({
      where: { type: "SOS", status: "OPEN" },
    }),
    prisma.safetyIncident.count({
      where: { status: "OPEN" },
    }),
    prisma.alert.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.driverProfile.findMany({
      where: {
        presence: { in: ["ONLINE", "IDLE", "ON_TRIP"] },
        ...(filters.city ? { city: filters.city } : {}),
      },
      include: { user: true },
      take: 200,
    }),
    prisma.trip.findMany({
      where: {
        ...tripFilter,
        status: { in: ["SEARCHING", "ASSIGNED", "ONGOING"] },
      },
      include: {
        rider: { include: { user: true } },
        driver: { include: { user: true } },
      },
      take: 200,
    }),
    prisma.trip.findMany({
      where: { ...tripFilter, status: "SEARCHING" },
      select: { createdAt: true },
      take: 200,
    }),
    prisma.tripOffer.findMany({
      where: {
        status: "ACCEPTED",
        respondedAt: { gte: today },
        trip: tripFilter,
      },
      select: {
        respondedAt: true,
        trip: { select: { createdAt: true } },
      },
      take: 200,
    }),
    prisma.safetyIncident.findMany({
      where: {
        type: "SOS",
        status: "OPEN",
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        severity: true,
        trip: { select: { id: true, bookingCode: true } },
      },
      take: 50,
    }),
  ]);

  const presence = Object.fromEntries(
    driverGroups.map((row) => [row.presence, row._count._all]),
  );
  const trips = Object.fromEntries(
    tripGroups.map((row) => [row.status, row._count._all]),
  );
  const matchedFares = money(todayMatched._sum.fareTotal);
  const searchingCount = trips.SEARCHING ?? 0;
  const assignedCount = trips.ASSIGNED ?? 0;
  const ongoingCount = trips.ONGOING ?? 0;

  const searchingWaitMinutes = averageMinutes(
    searchingTrips.map((trip) => now.getTime() - trip.createdAt.getTime()),
  );
  const matchMinutes = averageMinutes(
    matchedOffers
      .filter((offer) => offer.respondedAt)
      .map((offer) => offer.respondedAt!.getTime() - offer.trip.createdAt.getTime()),
  );

  return {
    totals: { riders, drivers, vehicles, activeUsers },
    drivers: {
      online: presence.ONLINE ?? 0,
      offline: presence.OFFLINE ?? 0,
      idle: presence.IDLE ?? 0,
      onTrip: presence.ON_TRIP ?? 0,
    },
    rides: {
      searching: searchingCount,
      assigned: assignedCount,
      ongoing: ongoingCount,
      live: searchingCount + assignedCount + ongoingCount,
      completed: trips.COMPLETED ?? 0,
      cancelled: trips.CANCELLED ?? 0,
      scheduled: trips.SCHEDULED ?? 0,
    },
    waits: {
      searchingMinutes: searchingWaitMinutes,
      matchMinutes,
    },
    finance: {
      dailyBookings: todayTrips,
      matchedFares,
    },
    queues: {
      driverApprovals: pendingDrivers,
      openTickets,
      slaBreachedTickets,
      openSos,
      openIncidents,
    },
    alerts,
    liveMap: {
      drivers: liveDrivers.map((driver) => ({
        id: driver.id,
        userId: driver.userId,
        name: driver.user.name,
        presence: driver.presence,
        city: driver.city,
        lat: driver.latitude,
        lng: driver.longitude,
      })),
      trips: liveTrips.map((trip) => ({
        id: trip.id,
        bookingCode: trip.bookingCode,
        status: trip.status,
        pickupLat: trip.pickupLat,
        pickupLng: trip.pickupLng,
        dropoffLat: trip.dropoffLat,
        dropoffLng: trip.dropoffLng,
        etaMinutes: trip.etaMinutes,
        rider: trip.rider.user.name,
        driver: trip.driver?.user.name ?? null,
        driverId: trip.driverId,
        driverLat: trip.driver?.latitude ?? null,
        driverLng: trip.driver?.longitude ?? null,
      })),
      sos: liveSos.map((incident) => ({
        id: incident.id,
        lat: incident.latitude,
        lng: incident.longitude,
        severity: incident.severity,
        tripId: incident.trip?.id ?? null,
        bookingCode: incident.trip?.bookingCode ?? null,
      })),
    },
  };
}

function averageMinutes(durationsMs: number[]) {
  if (durationsMs.length === 0) {
    return 0;
  }
  const avgMs = durationsMs.reduce((sum, value) => sum + value, 0) / durationsMs.length;
  return Math.round((avgMs / 60_000) * 10) / 10;
}

export async function searchRiders(query: Record<string, unknown>) {
  const { q, skip, take, from, to, city } = parseFilters(query);

  const where: Prisma.UserWhereInput = {
    role: "RIDER",
    ...(city ? { city } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { id: q },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { riderProfile: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    total,
    items: items.map((user) => ({
      ...sanitizePublicUser(user),
      profile: user.riderProfile
        ? {
            id: user.riderProfile.id,
            verificationStatus: user.riderProfile.verificationStatus,
            rating: money(user.riderProfile.rating),
            walletBalance: money(user.riderProfile.walletBalance),
            loyaltyPoints: user.riderProfile.loyaltyPoints,
            deletionRequestedAt: user.riderProfile.deletionRequestedAt,
          }
        : null,
    })),
  };
}

function sanitizePublicUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  accountStatus: string;
  isActive: boolean;
  flagged: boolean;
  city: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    accountStatus: user.accountStatus,
    isActive: user.isActive,
    flagged: user.flagged,
    city: user.city,
    createdAt: user.createdAt,
  };
}

export async function getRider(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: "RIDER" },
    include: {
      riderProfile: {
        include: {
          paymentMethods: true,
          trips: { orderBy: { createdAt: "desc" }, take: 25 },
          tickets: { orderBy: { createdAt: "desc" }, take: 10 },
          lostItems: true,
          privacyRequests: true,
        },
      },
    },
  });

  if (!user) {
    const error = new Error("Rider not found");
    error.name = "NotFoundError";
    throw error;
  }

  const refunds = user.riderProfile
    ? await prisma.ledgerEntry.findMany({
        where: { userId: user.id, type: { in: ["REFUND", "CREDIT"] } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return {
    ...sanitizePublicUser(user),
    profile: user.riderProfile
      ? {
          ...user.riderProfile,
          rating: money(user.riderProfile.rating),
          walletBalance: money(user.riderProfile.walletBalance),
          paymentMethods: user.riderProfile.paymentMethods.map((method) => ({
            id: method.id,
            kind: method.kind,
            brand: method.brand,
            last4: method.last4,
            isDefault: method.isDefault,
          })),
          trips: user.riderProfile.trips,
          tickets: user.riderProfile.tickets,
          lostItems: user.riderProfile.lostItems,
          privacyRequests: user.riderProfile.privacyRequests,
        }
      : null,
    ledger: refunds.map((entry) => ({
      ...entry,
      amount: money(entry.amount),
    })),
  };
}

export async function updateRider(
  id: string,
  actorId: string,
  body: {
    name?: string;
    phone?: string;
    city?: string;
    notes?: string;
    consentMarketing?: boolean;
    accountStatus?: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "DEACTIVATED";
    flagged?: boolean;
    credit?: number;
    loyaltyPoints?: number;
  },
  ip?: string,
) {
  const user = await prisma.user.findFirst({
    where: { id, role: "RIDER" },
    include: { riderProfile: true },
  });

  if (!user || !user.riderProfile) {
    const error = new Error("Rider not found");
    error.name = "NotFoundError";
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        name: body.name ?? user.name,
        phone: body.phone ?? user.phone,
        city: body.city ?? user.city,
        accountStatus: body.accountStatus ?? user.accountStatus,
        flagged: body.flagged ?? user.flagged,
        isActive: body.accountStatus
          ? !["BLOCKED", "DEACTIVATED", "SUSPENDED"].includes(body.accountStatus)
          : user.isActive,
      },
    });

    await tx.riderProfile.update({
      where: { id: user.riderProfile!.id },
      data: {
        notes: body.notes ?? user.riderProfile!.notes,
        consentMarketing: body.consentMarketing ?? user.riderProfile!.consentMarketing,
        loyaltyPoints: body.loyaltyPoints ?? user.riderProfile!.loyaltyPoints,
        walletBalance:
          body.credit != null
            ? { increment: body.credit }
            : user.riderProfile!.walletBalance,
      },
    });

    if (body.credit != null && body.credit !== 0) {
      await tx.ledgerEntry.create({
        data: {
          userId: id,
          type: "CREDIT",
          status: "COMPLETED",
          method: "WALLET",
          amount: Math.abs(body.credit),
          note: body.credit > 0 ? "Admin credit" : "Admin debit",
        },
      });
    }
  });

  await writeAudit({
    actorId,
    action: "rider.update",
    entity: "User",
    entityId: id,
    metadata: body as Prisma.InputJsonValue,
    ip,
  });

  return getRider(id);
}

export async function searchDrivers(query: Record<string, unknown>) {
  const { q, skip, take, city, status } = parseFilters(query);
  const where: Prisma.DriverProfileWhereInput = {
    ...(city ? { city } : {}),
    ...(status
      ? {
          approvalStatus:
            status as Prisma.EnumDriverApprovalStatusFilter["equals"],
        }
      : {}),
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { phone: { contains: q, mode: "insensitive" } } },
            { userId: q },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.driverProfile.findMany({
      where,
      include: {
        user: true,
        fleetCompany: true,
        vehicles: true,
        documents: true,
      },
      orderBy: { user: { createdAt: "desc" } },
      skip,
      take,
    }),
    prisma.driverProfile.count({ where }),
  ]);

  return {
    total,
    items: items.map(serializeDriver),
  };
}

function serializeDriver(
  driver: Prisma.DriverProfileGetPayload<{
    include: {
      user: true;
      fleetCompany: true;
      vehicles: true;
      documents: true;
    };
  }>,
) {
  return {
    id: driver.id,
    user: sanitizePublicUser(driver.user),
    approvalStatus: driver.approvalStatus,
    presence: driver.presence,
    rating: money(driver.rating),
    acceptanceRate: money(driver.acceptanceRate),
    cancellationRate: money(driver.cancellationRate),
    onlineHours: money(driver.onlineHours),
    earningsTotal: money(driver.earningsTotal),
    city: driver.city,
    lat: driver.latitude,
    lng: driver.longitude,
    fleetCompany: driver.fleetCompany,
    vehicles: driver.vehicles,
    documents: driver.documents,
    notes: driver.notes,
  };
}

export async function getDriver(id: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { id },
    include: {
      user: true,
      fleetCompany: true,
      vehicles: true,
      documents: true,
      trips: { orderBy: { createdAt: "desc" }, take: 25 },
      incidents: { orderBy: { createdAt: "desc" }, take: 10 },
      incentives: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!driver) {
    const error = new Error("Driver not found");
    error.name = "NotFoundError";
    throw error;
  }

  const tickets = await prisma.supportTicket.findMany({
    where: { requesterId: driver.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, subject: true, status: true, tripId: true },
  });

  return {
    ...serializeDriver({
      ...driver,
    }),
    trips: driver.trips,
    tickets,
    incidents: driver.incidents,
    incentives: driver.incentives.map((row) => ({
      ...row,
      amount: money(row.amount),
    })),
  };
}

export async function reviewDriver(
  id: string,
  actorId: string,
  body: {
    approvalStatus?: Prisma.DriverProfileUpdateInput["approvalStatus"];
    notes?: string;
    documentId?: string;
    documentStatus?: "APPROVED" | "REJECTED" | "EXPIRED";
    documentNotes?: string;
  },
  ip?: string,
) {
  const driver = await prisma.driverProfile.findUnique({
    where: { id },
    include: { documents: true },
  });

  if (!driver) {
    const error = new Error("Driver not found");
    error.name = "NotFoundError";
    throw error;
  }

  if (body.documentId && body.documentStatus) {
    await prisma.driverDocument.update({
      where: { id: body.documentId },
      data: {
        status: body.documentStatus,
        notes: body.documentNotes,
        reviewedAt: new Date(),
        reviewedById: actorId,
      },
    });
  }

  const expired = await prisma.driverDocument.count({
    where: {
      driverId: id,
      OR: [
        { status: "EXPIRED" },
        { expiresAt: { lte: new Date() } },
      ],
    },
  });

  await prisma.driverProfile.update({
    where: { id },
    data: {
      approvalStatus: body.approvalStatus as never,
      notes: body.notes ?? driver.notes,
      ...(expired > 0 && body.approvalStatus !== "DEACTIVATED"
        ? { approvalStatus: "SUSPENDED" }
        : {}),
    },
  });

  await writeAudit({
    actorId,
    action: "driver.review",
    entity: "DriverProfile",
    entityId: id,
    metadata: body as Prisma.InputJsonValue,
    ip,
  });

  return getDriver(id);
}

export async function listVehicles(query: Record<string, unknown>) {
  const { q, skip, take, city, status } = parseFilters(query);
  const where: Prisma.VehicleWhereInput = {
    ...(city ? { city } : {}),
    ...(status
      ? { inspectionStatus: status as Prisma.EnumReviewStatusFilter["equals"] }
      : {}),
    ...(q
      ? {
          OR: [
            { plateNumber: { contains: q, mode: "insensitive" } },
            { make: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: { driver: { include: { user: true } }, fleetCompany: true },
      skip,
      take,
      orderBy: { plateNumber: "asc" },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return { total, items };
}

export async function assignVehicle(
  vehicleId: string,
  driverId: string | null,
  actorId: string,
  ip?: string,
) {
  const vehicle = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { driverId },
    include: { driver: { include: { user: true } } },
  });

  await writeAudit({
    actorId,
    action: "vehicle.assign",
    entity: "Vehicle",
    entityId: vehicleId,
    metadata: { driverId },
    ip,
  });

  return vehicle;
}

export async function searchTrips(query: Record<string, unknown>) {
  const filters = parseFilters(query);
  const where: Prisma.TripWhereInput = {
    ...tripWhere(filters),
    ...(filters.q
      ? {
          OR: [
            { bookingCode: { contains: filters.q, mode: "insensitive" } },
            { pickupAddress: { contains: filters.q, mode: "insensitive" } },
            { dropoffAddress: { contains: filters.q, mode: "insensitive" } },
            { rider: { user: { name: { contains: filters.q, mode: "insensitive" } } } },
            { rider: { user: { phone: { contains: filters.q, mode: "insensitive" } } } },
            { driver: { user: { name: { contains: filters.q, mode: "insensitive" } } } },
            { driver: { user: { phone: { contains: filters.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      include: {
        rider: { include: { user: true } },
        driver: { include: { user: true } },
        vehicle: true,
      },
      orderBy: { createdAt: "desc" },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.trip.count({ where }),
  ]);

  return {
    total,
    items: items.map((trip) => serializeTrip(trip)),
  };
}

function serializeTrip(
  trip: Prisma.TripGetPayload<{
    include: {
      rider: { include: { user: true } };
      driver: { include: { user: true } };
      vehicle: true;
    };
  }>,
) {
  return {
    ...trip,
    distanceKm: money(trip.distanceKm),
    suggestedFare: money(trip.suggestedFare),
    fareTotal: money(trip.fareTotal),
    rider: { ...sanitizePublicUser(trip.rider.user), profileId: trip.rider.id },
    driver: trip.driver
      ? { ...sanitizePublicUser(trip.driver.user), profileId: trip.driver.id }
      : null,
  };
}

export async function getTrip(id: string) {
  const trip = await prisma.trip.findFirst({
    where: { OR: [{ id }, { bookingCode: id }] },
    include: {
      rider: { include: { user: true } },
      driver: { include: { user: true } },
      vehicle: true,
      events: { orderBy: { createdAt: "asc" } },
      ledger: true,
      offers: { include: { driver: { include: { user: true } } }, orderBy: { createdAt: "asc" } },
      tickets: { orderBy: { createdAt: "desc" }, take: 10 },
      chatMessages: {
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });

  if (!trip) {
    const error = new Error("Trip not found");
    error.name = "NotFoundError";
    throw error;
  }

  return {
    ...serializeTrip(trip),
    events: trip.events,
    tickets: trip.tickets,
    chatMessages: trip.chatMessages.map((row) => ({
      id: row.id,
      authorId: row.authorId,
      body: row.body,
      createdAt: row.createdAt,
      authorName: row.author.name,
      authorRole: row.author.role,
    })),
    offers: trip.offers.map((offer) => ({
      id: offer.id,
      proposedFare: money(offer.proposedFare),
      etaMinutes: offer.etaMinutes,
      status: offer.status,
      createdAt: offer.createdAt,
      driverId: offer.driver.id,
      driverName: offer.driver.user.name,
    })),
    ledger: trip.ledger.map((entry) => ({
      ...entry,
      amount: money(entry.amount),
    })),
  };
}

export async function interveneTrip(
  id: string,
  actorId: string,
  body: {
    action: "assign" | "cancel" | "complete" | "create";
    driverId?: string;
    status?: Prisma.EnumTripStatusFieldUpdateOperationsInput["set"];
    reason?: string;
  },
  ip?: string,
) {
  const trip = await prisma.trip.findUnique({ where: { id } });

  if (!trip) {
    const error = new Error("Trip not found");
    error.name = "NotFoundError";
    throw error;
  }

  const data: Prisma.TripUpdateInput = {};

  if (body.action === "assign" && body.driverId) {
    data.driver = { connect: { id: body.driverId } };
    data.status = "ASSIGNED";
  }

  if (body.action === "cancel") {
    data.status = "CANCELLED";
    data.cancellationReason = body.reason ?? "admin_cancel";
    data.endedAt = new Date();
  }

  if (body.action === "complete") {
    data.status = "COMPLETED";
    data.endedAt = new Date();
    data.paymentStatus = "COMPLETED";
  }

  await prisma.trip.update({ where: { id }, data });
  await recordTripEvent({
    tripId: id,
    actorId,
    action: `admin.${body.action}`,
    details: body as Prisma.InputJsonValue,
  });
  await writeAudit({
    actorId,
    action: `trip.${body.action}`,
    entity: "Trip",
    entityId: id,
    metadata: body as Prisma.InputJsonValue,
    ip,
  });

  return getTrip(id);
}

export async function createTrip(
  actorId: string,
  body: {
    riderId: string;
    pickupAddress: string;
    dropoffAddress: string;
    city: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    vehicleType: "BIKE" | "CAR";
    rideType?: Prisma.TripCreateInput["rideType"];
    scheduledAt?: string;
    driverId?: string;
  },
  ip?: string,
) {
  const rider = await prisma.riderProfile.findFirst({
    where: { OR: [{ id: body.riderId }, { userId: body.riderId }] },
  });

  if (!rider) {
    const error = new Error("Rider not found");
    error.name = "NotFoundError";
    throw error;
  }

  const distance = distanceKm(body.pickupLat, body.pickupLng, body.dropoffLat, body.dropoffLng);
  if (!Number.isFinite(distance) || distance < 0.05) {
    const error = new Error("Pickup and drop-off must be different, real locations");
    error.name = "ConflictError";
    throw error;
  }
  const duration = durationMinutes(distance);
  const fare = await calculateFare(body.city, body.vehicleType, distance, duration);

  const trip = await prisma.trip.create({
    data: {
      bookingCode: `EVE-${Date.now().toString(36).toUpperCase()}`,
      riderId: rider.id,
      driverId: body.driverId,
      status: body.scheduledAt
        ? "SCHEDULED"
        : body.driverId
          ? "ASSIGNED"
          : "SEARCHING",
      rideType: body.rideType ?? "STANDARD",
      vehicleType: body.vehicleType,
      city: body.city,
      pickupAddress: body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
      pickupLat: body.pickupLat,
      pickupLng: body.pickupLng,
      dropoffLat: body.dropoffLat,
      dropoffLng: body.dropoffLng,
      distanceKm: distance,
      durationMin: duration,
      suggestedFare: fare,
      fareTotal: fare,
      paymentMethod: "CASH",
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    },
  });

  await recordTripEvent({
    tripId: trip.id,
    actorId,
    action: "admin.create",
    details: body as Prisma.InputJsonValue,
  });
  await writeAudit({
    actorId,
    action: "trip.create",
    entity: "Trip",
    entityId: trip.id,
    ip,
  });

  return getTrip(trip.id);
}

export async function listPricing() {
  const [configs, zones] = await Promise.all([
    prisma.fareConfig.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.zone.findMany({ orderBy: { city: "asc" } }),
  ]);

  return {
    configs: configs.map((row) => ({
      ...row,
      baseFare: money(row.baseFare),
      perKm: money(row.perKm),
      perMinute: money(row.perMinute),
      minFare: money(row.minFare),
      bookingFee: money(row.bookingFee),
      airportFee: money(row.airportFee),
      cancellationFee: money(row.cancellationFee),
      waitingFee: money(row.waitingFee),
      surgeMultiplier: money(row.surgeMultiplier),
    })),
    zones,
  };
}

export async function savePricing(
  actorId: string,
  body: Prisma.FareConfigUncheckedCreateInput,
  ip?: string,
) {
  const created = await prisma.fareConfig.create({
    data: {
      ...body,
      createdById: actorId,
      status: body.status ?? "PENDING_APPROVAL",
    },
  });

  await writeAudit({
    actorId,
    action: "pricing.create",
    entity: "FareConfig",
    entityId: created.id,
    ip,
  });

  return created;
}

export async function transitionPricing(
  id: string,
  actorId: string,
  action: "approve" | "rollback",
  ip?: string,
) {
  const current = await prisma.fareConfig.findUnique({ where: { id } });

  if (!current) {
    const error = new Error("Fare config not found");
    error.name = "NotFoundError";
    throw error;
  }

  const updated = await prisma.fareConfig.update({
    where: { id },
    data:
      action === "approve"
        ? { status: "ACTIVE", approvedById: actorId }
        : { status: "ROLLED_BACK" },
  });

  await writeAudit({
    actorId,
    action: `pricing.${action}`,
    entity: "FareConfig",
    entityId: id,
    ip,
  });

  return updated;
}

export async function listLedger(query: Record<string, unknown>) {
  const { q, skip, take, status } = parseFilters(query);
  const type = typeof query.type === "string" ? query.type : undefined;
  const where: Prisma.LedgerEntryWhereInput = {
    ...(status
      ? { status: status as Prisma.EnumLedgerStatusFilter["equals"] }
      : {}),
    ...(type ? { type: type as Prisma.EnumLedgerTypeFilter["equals"] } : {}),
    ...(q
      ? {
          OR: [
            { userId: q },
            { providerRef: { contains: q, mode: "insensitive" } },
            { last4: q },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      include: { trip: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.ledgerEntry.count({ where }),
  ]);

  return {
    total,
    items: items.map((entry) => ({
      ...entry,
      amount: money(entry.amount),
    })),
  };
}

export async function refundPayment(
  id: string,
  actorId: string,
  amount: number,
  ip?: string,
) {
  const original = await prisma.ledgerEntry.findUnique({ where: { id } });

  if (!original || original.type !== "CHARGE") {
    const error = new Error("Charge not found");
    error.name = "NotFoundError";
    throw error;
  }

  const refund = await prisma.ledgerEntry.create({
    data: {
      tripId: original.tripId,
      userId: original.userId,
      type: "REFUND",
      status: "COMPLETED",
      method: original.method,
      amount,
      brand: original.brand,
      last4: original.last4,
      note: "Admin refund",
    },
  });

  await writeAudit({
    actorId,
    action: "payment.refund",
    entity: "LedgerEntry",
    entityId: refund.id,
    metadata: { originalId: id, amount },
    ip,
  });

  return { ...refund, amount: money(refund.amount) };
}

export async function payoutDriver(
  actorId: string,
  body: { userId: string; amount: number; note?: string },
  ip?: string,
) {
  const payout = await prisma.ledgerEntry.create({
    data: {
      userId: body.userId,
      type: "PAYOUT",
      status: "COMPLETED",
      method: "WALLET",
      amount: body.amount,
      note: body.note ?? "Admin payout",
    },
  });

  await writeAudit({
    actorId,
    action: "payment.payout",
    entity: "LedgerEntry",
    entityId: payout.id,
    metadata: body as Prisma.InputJsonValue,
    ip,
  });

  return { ...payout, amount: money(payout.amount) };
}

export async function listSafety(query: Record<string, unknown>) {
  const { skip, take, status } = parseFilters(query);
  const where = status ? { status } : {};
  const [incidents, total, sos] = await Promise.all([
    prisma.safetyIncident.findMany({
      where,
      include: {
        rider: { include: { user: true } },
        driver: { include: { user: true } },
        trip: true,
        assignee: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.safetyIncident.count({ where }),
    prisma.safetyIncident.findMany({
      where: { type: "SOS", status: "OPEN" },
      include: {
        rider: { include: { user: true } },
        driver: { include: { user: true } },
        trip: true,
      },
    }),
  ]);

  return { total, incidents, sos };
}

export async function updateIncident(
  id: string,
  actorId: string,
  body: { status?: string; notes?: string; assigneeId?: string },
  ip?: string,
) {
  const incident = await prisma.safetyIncident.update({
    where: { id },
    data: {
      status: body.status,
      notes: body.notes,
      assigneeId: body.assigneeId,
      resolvedAt: body.status === "RESOLVED" ? new Date() : undefined,
    },
  });

  await writeAudit({
    actorId,
    action: "safety.update",
    entity: "SafetyIncident",
    entityId: id,
    metadata: body as Prisma.InputJsonValue,
    ip,
  });

  return incident;
}

type TicketAuthor = { id: string; name: string; role: string };

async function attachTicketAuthors<
  T extends { requesterId: string; messages: { authorId: string }[] },
>(tickets: T[]) {
  const ids = [
    ...new Set([
      ...tickets.map((ticket) => ticket.requesterId),
      ...tickets.flatMap((ticket) => ticket.messages.map((row) => row.authorId)),
    ]),
  ];
  const users =
    ids.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, role: true },
        });
  const byId = new Map<string, TicketAuthor>(users.map((user) => [user.id, user]));
  return tickets.map((ticket) => ({
    ...ticket,
    requester: byId.get(ticket.requesterId) ?? null,
    messages: ticket.messages.map((row) => ({
      ...row,
      author: byId.get(row.authorId) ?? { id: row.authorId, name: "Unknown", role: "ADMIN" },
    })),
  }));
}

const ticketDetailInclude = {
  rider: { include: { user: true } },
  trip: {
    include: {
      rider: { include: { user: true } },
      driver: { include: { user: true } },
      vehicle: true,
    },
  },
  assignee: true,
  messages: { orderBy: { createdAt: "asc" as const } },
};

export async function listTickets(query: Record<string, unknown>) {
  const { q, skip, take, status } = parseFilters(query);
  const where: Prisma.SupportTicketWhereInput = {
    ...(status
      ? { status: status as Prisma.EnumTicketStatusFilter["equals"] }
      : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: ticketDetailInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { total, items: await attachTicketAuthors(items) };
}

export async function getTicket(id: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: ticketDetailInclude,
  });
  if (!ticket) {
    const error = new Error("Ticket not found");
    error.name = "NotFoundError";
    throw error;
  }
  const [hydrated] = await attachTicketAuthors([ticket]);
  return hydrated;
}

export async function updateTicket(
  id: string,
  actorId: string,
  body: {
    status?: Prisma.SupportTicketUpdateInput["status"];
    priority?: Prisma.SupportTicketUpdateInput["priority"];
    assigneeId?: string | null;
    message?: string;
    internal?: boolean;
    csatScore?: number;
  },
  ip?: string,
) {
  await prisma.supportTicket.update({
    where: { id },
    data: {
      status: body.status as never,
      priority: body.priority as never,
      assigneeId: body.assigneeId,
      csatScore: body.csatScore,
    },
  });

  if (body.message) {
    await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        authorId: actorId,
        body: body.message,
        internal: body.internal ?? false,
      },
    });
  }

  await writeAudit({
    actorId,
    action: "ticket.update",
    entity: "SupportTicket",
    entityId: id,
    ip,
  });

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: ticketDetailInclude,
  });

  if (body.message && !body.internal && ticket?.requesterId) {
    const requester = await prisma.user.findUnique({
      where: { id: ticket.requesterId },
      select: { role: true },
    });
    const role = requester?.role === "DRIVER" ? "DRIVER" : "RIDER";
    emitUserEvent(role, ticket.requesterId, "support:message", {
      ticketId: id,
      body: body.message,
    });
  }

  if (!ticket) return ticket;
  const [hydrated] = await attachTicketAuthors([ticket]);
  return hydrated;
}

export async function listPromos() {
  const items = await prisma.promo.findMany({ orderBy: { startsAt: "desc" } });
  return items.map((promo) => ({
    ...promo,
    percentOff: money(promo.percentOff),
    amountOff: money(promo.amountOff),
  }));
}

export async function savePromo(
  actorId: string,
  body: Prisma.PromoUncheckedCreateInput,
  ip?: string,
) {
  const promo = await prisma.promo.create({ data: body });
  await writeAudit({
    actorId,
    action: "promo.create",
    entity: "Promo",
    entityId: promo.id,
    ip,
  });
  return promo;
}

export async function sendNotification(
  actorId: string,
  body: {
    userId?: string;
    channel: string;
    template: string;
    title: string;
    body: string;
    segment?: string;
  },
  ip?: string,
) {
  const notification = await prisma.notification.create({
    data: body,
  });

  await writeAudit({
    actorId,
    action: "notification.send",
    entity: "Notification",
    entityId: notification.id,
    metadata: body as Prisma.InputJsonValue,
    ip,
  });

  return notification;
}

export async function listNotifications() {
  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getAnalytics(query: Record<string, unknown>) {
  const filters = parseFilters(query);
  const where = tripWhere(filters);

  const [byStatus, byCity, byType, totals, ratings, failures, incidents] =
    await Promise.all([
      prisma.trip.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _avg: { fareTotal: true, distanceKm: true, durationMin: true },
      }),
      prisma.trip.groupBy({
        by: ["city"],
        where,
        _count: { _all: true },
        _sum: { fareTotal: true },
      }),
      prisma.trip.groupBy({
        by: ["rideType"],
        where,
        _count: { _all: true },
      }),
      prisma.ledgerEntry.groupBy({
        by: ["type", "status"],
        _sum: { amount: true },
      }),
      prisma.riderProfile.aggregate({ _avg: { rating: true } }),
      prisma.ledgerEntry.count({ where: { status: "FAILED" } }),
      prisma.safetyIncident.groupBy({
        by: ["type"],
        _count: { _all: true },
      }),
    ]);

  return {
    trips: byStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
      avgFare: money(row._avg.fareTotal),
      avgDistance: money(row._avg.distanceKm),
      avgDuration: row._avg.durationMin ?? 0,
    })),
    cities: byCity.map((row) => ({
      city: row.city,
      count: row._count._all,
      bookings: money(row._sum.fareTotal),
    })),
    rideTypes: byType,
    ledger: totals.map((row) => ({
      type: row.type,
      status: row.status,
      amount: money(row._sum.amount),
    })),
    avgRiderRating: money(ratings._avg.rating),
    paymentFailures: failures,
    incidents,
  };
}

export async function listAudit(query: Record<string, unknown>) {
  const { skip, take, q } = parseFilters(query);
  const where: Prisma.AuditLogWhereInput = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { entity: { contains: q, mode: "insensitive" } },
          { entityId: q },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    total,
    items: items.map((item) => ({
      ...item,
      actor: item.actor ? sanitizePublicUser(item.actor) : null,
    })),
  };
}

export async function listStaff() {
  const users = await prisma.user.findMany({
    where: { role: "ADMIN" },
    include: {
      loginEvents: { orderBy: { createdAt: "desc" }, take: 5 },
      sessions: { where: { revokedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  return users.map((user) => ({
    ...sanitizePublicUser(user),
    adminStaffRole: user.adminStaffRole,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: user.lastLoginAt,
    loginEvents: user.loginEvents,
    sessions: user.sessions,
  }));
}

export async function updateStaff(
  id: string,
  actorId: string,
  body: {
    adminStaffRole?: Prisma.UserUpdateInput["adminStaffRole"];
    mfaEnabled?: boolean;
    accountStatus?: Prisma.UserUpdateInput["accountStatus"];
  },
  ip?: string,
) {
  const user = await prisma.user.update({
    where: { id },
    data: body as Prisma.UserUpdateInput,
  });

  await writeAudit({
    actorId,
    action: "staff.update",
    entity: "User",
    entityId: id,
    metadata: body as Prisma.InputJsonValue,
    ip,
  });

  return user;
}

export async function listFleets() {
  return prisma.fleetCompany.findMany({
    include: { _count: { select: { drivers: true, vehicles: true } } },
  });
}
