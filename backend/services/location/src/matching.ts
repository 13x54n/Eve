import { prisma } from "@eve/db";
import { MATCH_LIMIT, MATCH_RADIUS_KM, distanceKm, fail } from "@eve/shared";

const GPS_WRITE_INTERVAL_MS = 15_000;
const lastGpsWrite = new Map<string, number>();

export type NearbyDriver = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  distance: number;
};

export async function nearbyDrivers(input: {
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
}): Promise<NearbyDriver[]> {
  const drivers = await prisma.driverProfile.findMany({
    where: {
      approvalStatus: "APPROVED",
      presence: { in: ["ONLINE", "IDLE"] },
      vehicles: { some: { vehicleType: input.vehicleType } },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { id: true, userId: true, latitude: true, longitude: true },
  });

  return drivers
    .map((driver) => ({
      ...driver,
      latitude: driver.latitude!,
      longitude: driver.longitude!,
      distance: distanceKm(driver.latitude!, driver.longitude!, input.pickupLat, input.pickupLng),
    }))
    .filter((driver) => driver.distance <= MATCH_RADIUS_KM)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, MATCH_LIMIT);
}

export async function nearbySearchingTrips(userId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { vehicles: true },
  });

  if (!profile) fail("Driver profile not found", "NotFoundError");
  if (profile.approvalStatus !== "APPROVED" || !["ONLINE", "IDLE"].includes(profile.presence)) {
    return [] as { id: string; distanceToPickup: number }[];
  }
  if (profile.latitude == null || profile.longitude == null) {
    return [];
  }

  const trips = await prisma.trip.findMany({
    where: {
      status: "SEARCHING",
      vehicleType: { in: profile.vehicles.map((vehicle) => vehicle.vehicleType) },
    },
    select: { id: true, pickupLat: true, pickupLng: true },
    orderBy: { createdAt: "desc" },
  });

  return trips
    .map((trip) => ({
      id: trip.id,
      distanceToPickup: distanceKm(profile.latitude!, profile.longitude!, trip.pickupLat, trip.pickupLng),
    }))
    .filter((trip) => trip.distanceToPickup <= MATCH_RADIUS_KM)
    .sort((left, right) => left.distanceToPickup - right.distanceToPickup)
    .slice(0, MATCH_LIMIT);
}

export async function distanceToPickup(userId: string, pickupLat: number, pickupLng: number) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile || profile.latitude == null || profile.longitude == null) {
    return Number.POSITIVE_INFINITY;
  }
  return distanceKm(profile.latitude, profile.longitude, pickupLat, pickupLng);
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
    fail("Driver profile not found", "NotFoundError");
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
}

export async function recordDriverLocation(userId: string, latitude: number, longitude: number) {
  const now = Date.now();
  const last = lastGpsWrite.get(userId) ?? 0;
  if (now - last >= GPS_WRITE_INTERVAL_MS) {
    lastGpsWrite.set(userId, now);
    await prisma.driverProfile.update({
      where: { userId },
      data: { latitude, longitude },
    });
  }

  const trips = await prisma.trip.findMany({
    where: { driver: { userId }, status: { in: ["ASSIGNED", "ONGOING"] } },
    select: { id: true },
  });
  return trips.map((trip) => trip.id);
}
