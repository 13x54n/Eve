import type { NearbyDriver } from "./matching.js";
import {
  distanceToPickup as distanceToPickupLocal,
  indexSearchingTrip as indexSearchingTripLocal,
  nearbyDrivers as nearbyDriversLocal,
  nearbySearchingTrips as nearbySearchingTripsLocal,
  recordDriverLocation as recordDriverLocationLocal,
  removeSearchingTrip as removeSearchingTripLocal,
  syncDriverGeo as syncDriverGeoLocal,
} from "./matching.js";

function locationUrl() {
  return process.env.LOCATION_URL;
}

export async function nearbyDrivers(input: {
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
}): Promise<NearbyDriver[]> {
  const base = locationUrl();
  if (!base) return nearbyDriversLocal(input);
  const url = new URL("/internal/drivers/nearby", base);
  url.searchParams.set("pickupLat", String(input.pickupLat));
  url.searchParams.set("pickupLng", String(input.pickupLng));
  url.searchParams.set("vehicleType", input.vehicleType);
  const response = await fetch(url);
  if (!response.ok) return nearbyDriversLocal(input);
  const body = await response.json() as { drivers: NearbyDriver[] };
  return body.drivers;
}

export async function nearbySearchingTrips(userId: string) {
  const base = locationUrl();
  if (!base) return nearbySearchingTripsLocal(userId);
  const url = new URL("/internal/trips/nearby", base);
  url.searchParams.set("userId", userId);
  const response = await fetch(url);
  if (!response.ok) return nearbySearchingTripsLocal(userId);
  const body = await response.json() as { trips: { id: string; distanceToPickup: number }[] };
  return body.trips;
}

export async function distanceToPickup(userId: string, pickupLat: number, pickupLng: number) {
  const base = locationUrl();
  if (!base) return distanceToPickupLocal(userId, pickupLat, pickupLng);
  const url = new URL("/internal/distance", base);
  url.searchParams.set("userId", userId);
  url.searchParams.set("pickupLat", String(pickupLat));
  url.searchParams.set("pickupLng", String(pickupLng));
  const response = await fetch(url);
  if (!response.ok) return distanceToPickupLocal(userId, pickupLat, pickupLng);
  const body = await response.json() as { distanceKm: number };
  return body.distanceKm;
}

export async function recordDriverLocation(userId: string, latitude: number, longitude: number) {
  const base = locationUrl();
  if (!base) return recordDriverLocationLocal(userId, latitude, longitude);
  const response = await fetch(new URL("/internal/drivers/location", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, latitude, longitude }),
  });
  if (!response.ok) return recordDriverLocationLocal(userId, latitude, longitude);
  const body = await response.json() as { tripIds: string[] };
  return body.tripIds;
}

export async function syncDriverGeo(userId: string) {
  const base = locationUrl();
  if (!base) return syncDriverGeoLocal(userId);
  const response = await fetch(new URL("/internal/drivers/geo/sync", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) return syncDriverGeoLocal(userId);
}

export async function indexSearchingTrip(input: {
  id: string;
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
}) {
  const base = locationUrl();
  if (!base) return indexSearchingTripLocal(input);
  const response = await fetch(new URL("/internal/trips/geo", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return indexSearchingTripLocal(input);
}

export async function removeSearchingTrip(id: string, vehicleType?: "BIKE" | "CAR") {
  const base = locationUrl();
  if (!base) return removeSearchingTripLocal(id, vehicleType);
  const response = await fetch(new URL("/internal/trips/geo/remove", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, vehicleType }),
  });
  if (!response.ok) return removeSearchingTripLocal(id, vehicleType);
}
