import { prisma } from "../config/prisma.js";
import { createAccessToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { money, startOfDay } from "../utils/serialize.js";
import { recordTripEvent } from "./audit.service.js";
import { createHmac, randomBytes } from "node:crypto";
import { emitTripEvent, emitUserEvent } from "../realtime.js";

export function sanitizeDriverUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  city: string | null;
  accountStatus: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    city: user.city,
    accountStatus: user.accountStatus,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function registerDriver(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  city: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor: string;
  vehiclePlateNumber: string;
  vehicleType: "BIKE" | "CAR";
  vehicleCategory?: string;
  vehicleCapacity?: number;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    const error = new Error("An account with this email already exists");
    error.name = "ConflictError";
    throw error;
  }

  const existingPlate = await prisma.vehicle.findUnique({
    where: { plateNumber: input.vehiclePlateNumber.trim().toUpperCase() },
  });

  if (existingPlate) {
    const error = new Error("A vehicle with this license plate is already registered");
    error.name = "ConflictError";
    throw error;
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        phone: input.phone?.trim() || null,
        city: input.city.trim(),
        passwordHash,
        role: "DRIVER",
        accountStatus: "PENDING",
      },
    });

    const driverProfile = await tx.driverProfile.create({
      data: {
        userId: newUser.id,
        city: input.city.trim(),
        approvalStatus: "PENDING",
        presence: "OFFLINE",
        rating: 5.0,
        acceptanceRate: 100,
        cancellationRate: 0,
        onlineHours: 0,
        earningsTotal: 0,
      },
    });

    await tx.vehicle.create({
      data: {
        driverId: driverProfile.id,
        make: input.vehicleMake.trim(),
        model: input.vehicleModel.trim(),
        year: input.vehicleYear,
        color: input.vehicleColor.trim(),
        plateNumber: input.vehiclePlateNumber.trim().toUpperCase(),
        vehicleType: input.vehicleType,
        serviceCategory: input.vehicleCategory?.trim() || "standard",
        capacity: input.vehicleCapacity || 4,
        inspectionStatus: "PENDING",
        city: input.city.trim(),
      },
    });

    const docTypes = [
      "LICENSE",
      "INSURANCE",
      "IDENTITY",
      "VEHICLE_REGISTRATION",
    ] as const;

    await tx.driverDocument.createMany({
      data: docTypes.map((type) => ({
        driverId: driverProfile.id,
        type,
        status: "PENDING" as const,
        notes: `Submitted during driver registration`,
      })),
    });

    return newUser;
  });

  const fullProfile = await getDriverProfile(user.id);

  return {
    accessToken: createAccessToken(user),
    user: sanitizeDriverUser(user),
    driverProfile: fullProfile,
  };
}

export async function loginDriver(input: {
  email: string;
  password: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      driverProfile: true,
    },
  });

  if (!user || !user.isActive || user.role !== "DRIVER") {
    const error = new Error("Invalid email or password for driver account");
    error.name = "UnauthorizedError";
    throw error;
  }

  const passwordIsValid = await verifyPassword(
    user.passwordHash,
    input.password,
  );

  if (!passwordIsValid) {
    const error = new Error("Invalid email or password");
    error.name = "UnauthorizedError";
    throw error;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const fullProfile = await getDriverProfile(user.id);

  return {
    accessToken: createAccessToken(user),
    user: sanitizeDriverUser(user),
    driverProfile: fullProfile,
  };
}

export async function getDriverProfile(userId: string) {
  let profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      vehicles: true,
      documents: { orderBy: { type: "asc" } },
      fleetCompany: true,
      trips: {
        where: {
          status: { in: ["ASSIGNED", "ONGOING"] },
        },
        include: {
          rider: { include: { user: true } },
          vehicle: true,
        },
        take: 1,
      },
    },
  });

  if (!profile) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "DRIVER") {
      const error = new Error("Driver account not found");
      error.name = "NotFoundError";
      throw error;
    }

    await prisma.driverProfile.create({
      data: {
        userId: user.id,
        city: user.city,
        approvalStatus: "PENDING",
        presence: "OFFLINE",
        rating: 5.0,
        acceptanceRate: 100,
        cancellationRate: 0,
        onlineHours: 0,
        earningsTotal: 0,
      },
    });

    profile = await prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        vehicles: true,
        documents: { orderBy: { type: "asc" } },
        fleetCompany: true,
        trips: {
          where: {
            status: { in: ["ASSIGNED", "ONGOING"] },
          },
          include: {
            rider: { include: { user: true } },
            vehicle: true,
          },
          take: 1,
        },
      },
    });
  }

  if (!profile) {
    const error = new Error("Driver profile could not be loaded");
    error.name = "NotFoundError";
    throw error;
  }

  const today = startOfDay();
  const todayTrips = await prisma.trip.findMany({
    where: {
      driverId: profile.id,
      status: "COMPLETED",
      createdAt: { gte: today },
    },
  });

  const todayEarnings = todayTrips.reduce(
    (acc, trip) => acc + Number(trip.fareTotal) - Number(trip.commission),
    0,
  );

  return {
    id: profile.id,
    userId: profile.userId,
    user: sanitizeDriverUser(profile.user),
    approvalStatus: profile.approvalStatus,
    presence: profile.presence,
    rating: money(profile.rating),
    acceptanceRate: money(profile.acceptanceRate),
    cancellationRate: money(profile.cancellationRate),
    onlineHours: money(profile.onlineHours),
    earningsTotal: money(profile.earningsTotal),
    commissionTier: profile.commissionTier,
    city: profile.city || profile.user.city || "New York",
    lat: profile.latitude,
    lng: profile.longitude,
    vehicles: profile.vehicles,
    activeVehicle: profile.vehicles[0] || null,
    documents: profile.documents,
    activeTrip: profile.trips[0] || null,
    todayStats: {
      earnings: Number(todayEarnings.toFixed(2)),
      completedTrips: todayTrips.length,
      onlineHours: 0,
    },
  };
}

export async function updateDriverPresence(
  userId: string,
  input: {
    presence: "ONLINE" | "OFFLINE" | "IDLE" | "ON_TRIP";
    latitude?: number;
    longitude?: number;
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

  if (input.presence === "ONLINE" && profile.approvalStatus !== "APPROVED") {
    const error = new Error(
      profile.approvalStatus === "PENDING"
        ? "Your account is currently under review by Eve Admin. You will be able to go online once approved."
        : `Your account status is ${profile.approvalStatus}. Please contact support.`,
    );
    error.name = "UnauthorizedError";
    throw error;
  }

  await prisma.driverProfile.update({
    where: { id: profile.id },
    data: {
      presence: input.presence,
      ...(typeof input.latitude === "number" ? { latitude: input.latitude } : {}),
      ...(typeof input.longitude === "number" ? { longitude: input.longitude } : {}),
    },
  });

  return getDriverProfile(userId);
}

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
    return [];
  }

  const trips = await prisma.trip.findMany({
    where: {
      status: "SEARCHING",
      ...(profile.city ? { city: profile.city } : {}),
      vehicleType: { in: profile.vehicles.map((vehicle) => vehicle.vehicleType) },
    },
    include: {
      rider: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return trips
    .map((trip) => ({
      ...trip,
      distanceToPickup: profile.latitude == null || profile.longitude == null
        ? Number.POSITIVE_INFINITY
        : distanceBetween(profile.latitude, profile.longitude, trip.pickupLat, trip.pickupLng),
    }))
    .filter((trip) => trip.distanceToPickup <= 25)
    .sort((left, right) => left.distanceToPickup - right.distanceToPickup)
    .slice(0, 5)
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
    fareTotal: money(trip.fareTotal),
    estimatedEarnings: money(Number(trip.fareTotal) - Number(trip.commission)),
    rideType: trip.rideType,
    createdAt: trip.createdAt,
    distanceToPickup: Number.isFinite(trip.distanceToPickup) ? trip.distanceToPickup : null,
  }));
}

function distanceBetween(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(toLat - fromLat);
  const longitudeDelta = radians(toLng - fromLng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function createTripOffer(userId: string, tripId: string, input: { proposedFare: number; etaMinutes: number }) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId }, include: { vehicles: true } });
  if (!profile) { const error = new Error("Driver profile not found"); error.name = "NotFoundError"; throw error; }
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) { const error = new Error("Trip not found"); error.name = "NotFoundError"; throw error; }
  if (trip.status !== "SEARCHING" || trip.city !== profile.city || !profile.vehicles.some((vehicle) => vehicle.vehicleType === trip.vehicleType)) {
    const error = new Error("This trip is not available to this driver"); error.name = "ConflictError"; throw error;
  }
  if (input.proposedFare < Number(trip.fareTotal) || input.proposedFare > Number(trip.fareTotal) * 2) {
    const error = new Error("Offer must start at the base fare for this distance and can go up to double it"); error.name = "ConflictError"; throw error;
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

  const driverNetEarnings = Number(trip.fareTotal) - Number(trip.commission);

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
        note: `Fare payout for trip ${trip.bookingCode}`,
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

  return {
    trip: updatedTrip,
    earnings: {
      fareTotal: money(trip.fareTotal),
      commission: money(trip.commission),
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
    commission: money(trip.commission),
    netEarnings: money(Number(trip.fareTotal) - Number(trip.commission)),
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
    (sum, t) => sum + Number(t.fareTotal) - Number(t.commission),
    0,
  );

  const weekNet = weekTrips.reduce(
    (sum, t) => sum + Number(t.fareTotal) - Number(t.commission),
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
      netEarnings: money(Number(t.fareTotal) - Number(t.commission)),
      distanceKm: money(t.distanceKm),
      durationMin: t.durationMin,
      createdAt: t.createdAt,
    })),
  };
}
