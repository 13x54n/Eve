import { prisma } from "@eve/db";
import { MATCH_LIMIT, MATCH_RADIUS_KM, distanceKm, fail } from "@eve/shared";
import {
  refreshDriverLocationIfIndexed,
  rebuildGeoIndexes as rebuildGeoIndexesFromPostgres,
  resetGeoIndexes as resetGeoIndexesInRedis,
  removeDriver,
  removeSearchingTrip as removeSearchingTripFromGeo,
  searchDrivers,
  searchTrips,
  upsertDriver,
  upsertSearchingTrip as upsertSearchingTripInGeo,
  type VehicleType,
} from "./geo.js";

const GPS_WRITE_INTERVAL_MS = 15_000;
const lastGpsWrite = new Map<string, number>();

export type NearbyDriver = {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  distance: number;
};

export type NearbySearchingTrip = {
  id: string;
  distanceToPickup: number;
};

function vehicleTypesOf(vehicles: { vehicleType: string }[]): VehicleType[] {
  return vehicles
    .map((vehicle) => vehicle.vehicleType)
    .filter((type): type is VehicleType => type === "BIKE" || type === "CAR");
}

function isMatchEligible(input: {
  approvalStatus: string;
  presence: string;
  latitude: number | null;
  longitude: number | null;
}) {
  return (
    input.approvalStatus === "APPROVED"
    && ["ONLINE", "IDLE"].includes(input.presence)
    && input.latitude != null
    && input.longitude != null
  );
}

async function nearbyDriversFromDb(input: {
  pickupLat: number;
  pickupLng: number;
  vehicleType: VehicleType;
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

async function nearbySearchingTripsFromDb(input: {
  latitude: number;
  longitude: number;
  vehicleTypes: VehicleType[];
}): Promise<NearbySearchingTrip[]> {
  if (input.vehicleTypes.length === 0) return [];
  const trips = await prisma.trip.findMany({
    where: {
      status: "SEARCHING",
      vehicleType: { in: input.vehicleTypes },
    },
    select: { id: true, pickupLat: true, pickupLng: true },
    orderBy: { createdAt: "desc" },
  });

  return trips
    .map((trip) => ({
      id: trip.id,
      distanceToPickup: distanceKm(input.latitude, input.longitude, trip.pickupLat, trip.pickupLng),
    }))
    .filter((trip) => trip.distanceToPickup <= MATCH_RADIUS_KM)
    .sort((left, right) => left.distanceToPickup - right.distanceToPickup)
    .slice(0, MATCH_LIMIT);
}

export async function nearbyDrivers(input: {
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
}): Promise<NearbyDriver[]> {
  const hits = await searchDrivers(input.vehicleType, input.pickupLng, input.pickupLat);
  if (hits == null) {
    return nearbyDriversFromDb(input);
  }
  if (hits.length === 0) return [];

  const rows = await prisma.driverProfile.findMany({
    where: {
      id: { in: hits.map((hit) => hit.id) },
      approvalStatus: "APPROVED",
      presence: { in: ["ONLINE", "IDLE"] },
      vehicles: { some: { vehicleType: input.vehicleType } },
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { id: true, userId: true },
  });
  const allowed = new Map(rows.map((row) => [row.id, row.userId]));

  return hits
    .filter((hit) => allowed.has(hit.id))
    .map((hit) => ({
      id: hit.id,
      userId: allowed.get(hit.id)!,
      latitude: hit.latitude,
      longitude: hit.longitude,
      distance: hit.distance,
    }))
    .slice(0, MATCH_LIMIT);
}

export async function nearbySearchingTrips(userId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { vehicles: true },
  });

  if (!profile) fail("Driver profile not found", "NotFoundError");
  if (profile.approvalStatus !== "APPROVED" || !["ONLINE", "IDLE"].includes(profile.presence)) {
    return [] as NearbySearchingTrip[];
  }
  if (profile.latitude == null || profile.longitude == null) {
    return [];
  }

  const types = vehicleTypesOf(profile.vehicles);
  const hits = await searchTrips(types, profile.longitude, profile.latitude);
  if (hits == null) {
    return nearbySearchingTripsFromDb({
      latitude: profile.latitude,
      longitude: profile.longitude,
      vehicleTypes: types,
    });
  }
  if (hits.length === 0) return [];

  const rows = await prisma.trip.findMany({
    where: {
      id: { in: hits.map((hit) => hit.id) },
      status: "SEARCHING",
      vehicleType: { in: types },
    },
    select: { id: true },
  });
  const allowed = new Set(rows.map((row) => row.id));

  return hits
    .filter((hit) => allowed.has(hit.id))
    .map((hit) => ({ id: hit.id, distanceToPickup: hit.distance }))
    .slice(0, MATCH_LIMIT);
}

export async function distanceToPickup(userId: string, pickupLat: number, pickupLng: number) {
  const profile = await prisma.driverProfile.findUnique({ where: { userId } });
  if (!profile || profile.latitude == null || profile.longitude == null) {
    return Number.POSITIVE_INFINITY;
  }
  return distanceKm(profile.latitude, profile.longitude, pickupLat, pickupLng);
}

export async function syncDriverGeo(userId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: { vehicles: { select: { vehicleType: true } } },
  });
  if (!profile) return;
  const latitude = profile.latitude;
  const longitude = profile.longitude;
  if (!isMatchEligible({ ...profile, latitude, longitude })) {
    await removeDriver(profile.id, profile.userId);
    return;
  }
  await upsertDriver({
    id: profile.id,
    userId: profile.userId,
    latitude: latitude!,
    longitude: longitude!,
    vehicleTypes: vehicleTypesOf(profile.vehicles),
  });
}

export async function indexSearchingTrip(input: {
  id: string;
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
}) {
  await upsertSearchingTripInGeo(input);
}

export async function removeSearchingTrip(id: string, vehicleType?: "BIKE" | "CAR") {
  await removeSearchingTripFromGeo(id, vehicleType);
}

export async function rebuildGeoIndexes() {
  return rebuildGeoIndexesFromPostgres();
}

export async function resetGeoIndexes() {
  return resetGeoIndexesInRedis();
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

  await syncDriverGeo(userId);
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

  await refreshDriverLocationIfIndexed(userId, latitude, longitude);

  const trips = await prisma.trip.findMany({
    where: { driver: { userId }, status: { in: ["ASSIGNED", "ONGOING"] } },
    select: { id: true },
  });
  return trips.map((trip) => trip.id);
}
