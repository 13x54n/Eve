import { prisma } from "@eve/db";
import { MATCH_LIMIT, MATCH_RADIUS_KM, distanceKm } from "@eve/shared";
import { cellFor, diskCells } from "./h3.js";
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

function h3Namespace() {
  const worker = process.env.VITEST_WORKER_ID || process.env.VITEST_POOL_ID;
  return worker ? `h3:test:${worker}` : "h3";
}

function legacyGeoNamespace() {
  const worker = process.env.VITEST_WORKER_ID || process.env.VITEST_POOL_ID;
  return worker ? `geo:test:${worker}` : "geo";
}

function driverCellKey(vehicleType: VehicleType, cell: string) {
  return `${h3Namespace()}:drivers:${vehicleType}:${cell}`;
}

function tripCellKey(vehicleType: VehicleType, cell: string) {
  return `${h3Namespace()}:trips:${vehicleType}:${cell}`;
}

function driverUsersHash() {
  return `${h3Namespace()}:driver:users`;
}

function driverPosHash() {
  return `${h3Namespace()}:pos:drivers`;
}

function tripPosHash() {
  return `${h3Namespace()}:pos:trips`;
}

function driverCellsHash() {
  return `${h3Namespace()}:driver:cells`;
}

function tripCellsHash() {
  return `${h3Namespace()}:trip:cells`;
}

function uniqueVehicleTypes(types: VehicleType[]) {
  return [...new Set(types.filter((type) => type === "BIKE" || type === "CAR"))];
}

function encodePos(latitude: number, longitude: number) {
  return `${latitude},${longitude}`;
}

function parsePos(value: string | null | undefined): { latitude: number; longitude: number } | null {
  if (!value) return null;
  const [latRaw, lngRaw] = value.split(",");
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function toId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return null;
}

async function unlinkByPattern(redis: NonNullable<Awaited<ReturnType<typeof getRedis>>>, pattern: string) {
  const batch: string[] = [];
  for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 200 })) {
    const name = toId(key);
    if (!name) continue;
    batch.push(name);
    if (batch.length >= 200) {
      await redis.unlink(batch);
      batch.length = 0;
    }
  }
  if (batch.length > 0) await redis.unlink(batch);
}

async function unlinkIndexes() {
  const redis = await getRedis();
  if (!redis) return false;
  await unlinkByPattern(redis, `${h3Namespace()}:*`);
  await unlinkByPattern(redis, `${legacyGeoNamespace()}:*`);
  return true;
}

async function searchKey(
  keyForCell: (cell: string) => string,
  longitude: number,
  latitude: number,
  posHash: string,
): Promise<GeoHit[] | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const cells = diskCells(latitude, longitude);
    const keys = cells.map(keyForCell);
    if (keys.length === 0) return [];
    const members = await redis.sUnion(keys);
    const ids = members.map(toId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return [];
    const positions = await redis.hmGet(posHash, ids);
    const hits: GeoHit[] = [];
    for (let index = 0; index < ids.length; index += 1) {
      const pos = parsePos(positions[index]);
      if (!pos) continue;
      const distance = distanceKm(latitude, longitude, pos.latitude, pos.longitude);
      if (distance > MATCH_RADIUS_KM) continue;
      hits.push({ id: ids[index]!, distance, latitude: pos.latitude, longitude: pos.longitude });
    }
    hits.sort((left, right) => left.distance - right.distance);
    return hits.slice(0, GEO_SEARCH_COUNT);
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
  const cell = cellFor(input.latitude, input.longitude);
  try {
    const previousCell = await redis.hGet(driverCellsHash(), input.id);
    await redis.hSet(driverUsersHash(), input.userId, input.id);
    await redis.hSet(driverPosHash(), input.id, encodePos(input.latitude, input.longitude));
    await redis.hSet(driverCellsHash(), input.id, cell);
    for (const type of VEHICLE_TYPES) {
      if (previousCell && (previousCell !== cell || !wanted.has(type))) {
        await redis.sRem(driverCellKey(type, previousCell), input.id);
      }
      if (wanted.has(type)) {
        await redis.sAdd(driverCellKey(type, cell), input.id);
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
    const cell = await redis.hGet(driverCellsHash(), id);
    if (cell) {
      await Promise.all(VEHICLE_TYPES.map((type) => redis.sRem(driverCellKey(type, cell), id)));
    }
    await redis.hDel(driverCellsHash(), id);
    await redis.hDel(driverPosHash(), id);
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
    const previousCell = await redis.hGet(driverCellsHash(), profileId);
    if (!previousCell) return;
    const cell = cellFor(latitude, longitude);
    await redis.hSet(driverPosHash(), profileId, encodePos(latitude, longitude));
    if (cell === previousCell) return;
    for (const type of VEHICLE_TYPES) {
      const inIndex = await redis.sIsMember(driverCellKey(type, previousCell), profileId);
      if (!inIndex) continue;
      await redis.sRem(driverCellKey(type, previousCell), profileId);
      await redis.sAdd(driverCellKey(type, cell), profileId);
    }
    await redis.hSet(driverCellsHash(), profileId, cell);
  } catch (error) {
    logGeoFallback(error);
  }
}

export async function upsertSearchingTrip(input: {
  id: string;
  pickupLat: number;
  pickupLng: number;
  vehicleType: VehicleType;
  matchAllVehicleTypes?: boolean;
}) {
  const redis = await getRedis();
  if (!redis) return;
  const indexed = new Set(
    input.matchAllVehicleTypes ? VEHICLE_TYPES : uniqueVehicleTypes([input.vehicleType]),
  );
  const cell = cellFor(input.pickupLat, input.pickupLng);
  try {
    const previousCell = await redis.hGet(tripCellsHash(), input.id);
    await redis.hSet(tripPosHash(), input.id, encodePos(input.pickupLat, input.pickupLng));
    await redis.hSet(tripCellsHash(), input.id, cell);
    for (const type of VEHICLE_TYPES) {
      if (previousCell && (previousCell !== cell || !indexed.has(type))) {
        await redis.sRem(tripCellKey(type, previousCell), input.id);
      }
      if (indexed.has(type)) {
        await redis.sAdd(tripCellKey(type, cell), input.id);
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
    const cell = await redis.hGet(tripCellsHash(), id);
    const types = vehicleType ? [vehicleType] : VEHICLE_TYPES;
    if (cell) {
      await Promise.all(types.map((type) => redis.sRem(tripCellKey(type, cell), id)));
    }
    if (!vehicleType || types.length === VEHICLE_TYPES.length) {
      await redis.hDel(tripCellsHash(), id);
      await redis.hDel(tripPosHash(), id);
    }
  } catch (error) {
    logGeoFallback(error);
  }
}

export async function searchDrivers(
  vehicleType: VehicleType,
  longitude: number,
  latitude: number,
): Promise<GeoHit[] | null> {
  return searchKey((cell) => driverCellKey(vehicleType, cell), longitude, latitude, driverPosHash());
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
    const hits = await searchKey((cell) => tripCellKey(type, cell), longitude, latitude, tripPosHash());
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
    await unlinkIndexes();

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
        select: { id: true, pickupLat: true, pickupLng: true, vehicleType: true, rideType: true },
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
        matchAllVehicleTypes: trip.rideType === "COURIER",
      });
    }
    return true;
  } catch (error) {
    logGeoFallback(error);
    return false;
  }
}

export async function resetGeoIndexes() {
  try {
    return await unlinkIndexes();
  } catch (error) {
    logGeoFallback(error);
    return false;
  }
}
