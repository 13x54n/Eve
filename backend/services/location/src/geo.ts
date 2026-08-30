import { prisma } from "@eve/db";
import { MATCH_LIMIT, MATCH_RADIUS_KM } from "@eve/shared";
import { GEO_REPLY_WITH } from "redis";
import { getRedis, logGeoFallback } from "./redis.js";

export type VehicleType = "BIKE" | "CAR";

export type GeoHit = {
  id: string;
  distance: number;
  latitude: number;
  longitude: number;
};

const VEHICLE_TYPES: VehicleType[] = ["BIKE", "CAR"];
const GEO_SEARCH_COUNT = MATCH_LIMIT * 3;

function geoNamespace() {
  const worker = process.env.VITEST_WORKER_ID || process.env.VITEST_POOL_ID;
  return worker ? `geo:test:${worker}` : "geo";
}

function driverKey(vehicleType: VehicleType) {
  return `${geoNamespace()}:drivers:${vehicleType}`;
}

function tripKey(vehicleType: VehicleType) {
  return `${geoNamespace()}:trips:${vehicleType}`;
}

function driverUsersHash() {
  return `${geoNamespace()}:driver:users`;
}

function geoKeys() {
  return [
    driverKey("BIKE"),
    driverKey("CAR"),
    tripKey("BIKE"),
    tripKey("CAR"),
    driverUsersHash(),
  ] as const;
}

function uniqueVehicleTypes(types: VehicleType[]) {
  return [...new Set(types.filter((type) => type === "BIKE" || type === "CAR"))];
}

function toId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" || typeof value === "bigint") return Number(value);
  return Number.NaN;
}

function parseSearchRow(row: unknown): GeoHit | null {
  if (!row || typeof row !== "object") return null;
  const record = row as {
    member?: unknown;
    distance?: unknown;
    coordinates?: { latitude?: unknown; longitude?: unknown };
  };
  const id = toId(record.member);
  const distance = toNumber(record.distance);
  const latitude = toNumber(record.coordinates?.latitude);
  const longitude = toNumber(record.coordinates?.longitude);
  if (!id || !Number.isFinite(distance) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { id, distance, latitude, longitude };
}

async function searchKey(key: string, longitude: number, latitude: number): Promise<GeoHit[] | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const rows = await redis.geoSearchWith(
      key,
      { longitude, latitude },
      { radius: MATCH_RADIUS_KM, unit: "km" },
      [GEO_REPLY_WITH.DISTANCE, GEO_REPLY_WITH.COORDINATES],
      {
        SORT: "ASC",
        COUNT: GEO_SEARCH_COUNT,
      },
    );
    return rows.map(parseSearchRow).filter((hit): hit is GeoHit => Boolean(hit));
  } catch (error) {
    logGeoFallback(error);
    return null;
  }
}

export async function upsertDriver(input: {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  vehicleTypes: VehicleType[];
}) {
  const redis = await getRedis();
  if (!redis) return;
  const wanted = new Set(uniqueVehicleTypes(input.vehicleTypes));
  try {
    await redis.hSet(driverUsersHash(), input.userId, input.id);
    for (const type of VEHICLE_TYPES) {
      if (wanted.has(type)) {
        await redis.geoAdd(driverKey(type), {
          longitude: input.longitude,
          latitude: input.latitude,
          member: input.id,
        });
      } else {
        await redis.zRem(driverKey(type), input.id);
      }
    }
  } catch (error) {
    logGeoFallback(error);
  }
}

export async function removeDriver(id: string, userId?: string) {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await Promise.all(VEHICLE_TYPES.map((type) => redis.zRem(driverKey(type), id)));
    if (userId) await redis.hDel(driverUsersHash(), userId);
  } catch (error) {
    logGeoFallback(error);
  }
}

export async function refreshDriverLocationIfIndexed(userId: string, latitude: number, longitude: number) {
  const redis = await getRedis();
  if (!redis) return;
  try {
    const profileId = await redis.hGet(driverUsersHash(), userId);
    if (!profileId) return;
    for (const type of VEHICLE_TYPES) {
      const score = await redis.zScore(driverKey(type), profileId);
      if (score == null) continue;
      await redis.geoAdd(driverKey(type), {
        longitude,
        latitude,
        member: profileId,
      });
    }
  } catch (error) {
    logGeoFallback(error);
  }
}

export async function upsertSearchingTrip(input: {
  id: string;
  pickupLat: number;
  pickupLng: number;
  vehicleType: VehicleType;
}) {
  const redis = await getRedis();
  if (!redis) return;
  try {
    for (const type of VEHICLE_TYPES) {
      if (type === input.vehicleType) {
        await redis.geoAdd(tripKey(type), {
          longitude: input.pickupLng,
          latitude: input.pickupLat,
          member: input.id,
        });
      } else {
        await redis.zRem(tripKey(type), input.id);
      }
    }
  } catch (error) {
    logGeoFallback(error);
  }
}

export async function removeSearchingTrip(id: string, vehicleType?: VehicleType) {
  const redis = await getRedis();
  if (!redis) return;
  try {
    const types = vehicleType ? [vehicleType] : VEHICLE_TYPES;
    await Promise.all(types.map((type) => redis.zRem(tripKey(type), id)));
  } catch (error) {
    logGeoFallback(error);
  }
}

export async function searchDrivers(
  vehicleType: VehicleType,
  longitude: number,
  latitude: number,
): Promise<GeoHit[] | null> {
  return searchKey(driverKey(vehicleType), longitude, latitude);
}

export async function searchTrips(
  vehicleTypes: VehicleType[],
  longitude: number,
  latitude: number,
): Promise<GeoHit[] | null> {
  const types = uniqueVehicleTypes(vehicleTypes);
  if (types.length === 0) return [];
  const merged = new Map<string, GeoHit>();
  for (const type of types) {
    const hits = await searchKey(tripKey(type), longitude, latitude);
    if (hits == null) return null;
    for (const hit of hits) {
      const previous = merged.get(hit.id);
      if (!previous || hit.distance < previous.distance) {
        merged.set(hit.id, hit);
      }
    }
  }
  return [...merged.values()].sort((left, right) => left.distance - right.distance);
}

export async function rebuildGeoIndexes() {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    for (const key of geoKeys()) {
      await redis.unlink(key);
    }

    const [drivers, trips] = await Promise.all([
      prisma.driverProfile.findMany({
        where: {
          approvalStatus: "APPROVED",
          presence: { in: ["ONLINE", "IDLE"] },
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          userId: true,
          latitude: true,
          longitude: true,
          vehicles: { select: { vehicleType: true } },
        },
      }),
      prisma.trip.findMany({
        where: { status: "SEARCHING" },
        select: { id: true, pickupLat: true, pickupLng: true, vehicleType: true },
      }),
    ]);

    for (const driver of drivers) {
      await upsertDriver({
        id: driver.id,
        userId: driver.userId,
        latitude: driver.latitude!,
        longitude: driver.longitude!,
        vehicleTypes: driver.vehicles.map((vehicle) => vehicle.vehicleType as VehicleType),
      });
    }
    for (const trip of trips) {
      if (trip.vehicleType !== "BIKE" && trip.vehicleType !== "CAR") continue;
      await upsertSearchingTrip({
        id: trip.id,
        pickupLat: trip.pickupLat,
        pickupLng: trip.pickupLng,
        vehicleType: trip.vehicleType,
      });
    }
    return true;
  } catch (error) {
    logGeoFallback(error);
    return false;
  }
}

export async function resetGeoIndexes() {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    for (const key of geoKeys()) {
      await redis.unlink(key);
    }
    return true;
  } catch (error) {
    logGeoFallback(error);
    return false;
  }
}
