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
import {
  nearbyDriversGrpc,
  recordDriverLocationGrpc,
  syncDriverGeoGrpc,
  nearbySearchingTripsGrpc,
  distanceToPickupGrpc,
  indexSearchingTripGrpc,
  removeSearchingTripGrpc,
} from "./grpc-client.js";

function locationUrl() {
  return process.env.LOCATION_URL;
}

function internalHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  return secret ? { "x-internal-secret": secret } : {};
}

function isGrpcEnabled() {
  return process.env.GRPC_ENABLED === 'true';
}

/**
 * Hybrid client: tries gRPC first, falls back to HTTP, then local
 */
export async function nearbyDrivers(input: {
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
  excludeUserId?: string;
  matchAllVehicleTypes?: boolean;
}): Promise<NearbyDriver[]> {
  // Try gRPC first if enabled
  if (isGrpcEnabled()) {
    try {
      return await nearbyDriversGrpc(input);
    } catch (error) {
      console.warn('gRPC nearbyDrivers failed, falling back to HTTP:', error);
    }
  }
  
  // Fall back to HTTP
  const base = locationUrl();
  if (!base) return nearbyDriversLocal(input);
  
  try {
    const url = new URL("/internal/drivers/nearby", base);
    url.searchParams.set("pickupLat", String(input.pickupLat));
    url.searchParams.set("pickupLng", String(input.pickupLng));
    url.searchParams.set("vehicleType", input.vehicleType);
    if (input.excludeUserId) url.searchParams.set("excludeUserId", input.excludeUserId);
    if (input.matchAllVehicleTypes) url.searchParams.set("matchAllVehicleTypes", "true");
    const response = await fetch(url, { headers: internalHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { drivers: NearbyDriver[] };
    return body.drivers;
  } catch (error) {
    console.warn('HTTP nearbyDrivers failed, falling back to local:', error);
    return nearbyDriversLocal(input);
  }
}


export async function nearbySearchingTrips(userId: string) {
  // Try gRPC first if enabled
  if (isGrpcEnabled()) {
    try {
      return await nearbySearchingTripsGrpc(userId);
    } catch (error) {
      console.warn('gRPC nearbySearchingTrips failed, falling back to HTTP:', error);
    }
  }
  
  // Fall back to HTTP
  const base = locationUrl();
  if (!base) return nearbySearchingTripsLocal(userId);
  
  try {
    const url = new URL("/internal/trips/nearby", base);
    url.searchParams.set("userId", userId);
    const response = await fetch(url, { headers: internalHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { trips: { id: string; distanceToPickup: number }[] };
    return body.trips;
  } catch (error) {
    console.warn('HTTP nearbySearchingTrips failed, falling back to local:', error);
    return nearbySearchingTripsLocal(userId);
  }
}

export async function distanceToPickup(userId: string, pickupLat: number, pickupLng: number) {
  // Try gRPC first if enabled
  if (isGrpcEnabled()) {
    try {
      return await distanceToPickupGrpc(userId, pickupLat, pickupLng);
    } catch (error) {
      console.warn('gRPC distanceToPickup failed, falling back to HTTP:', error);
    }
  }
  
  // Fall back to HTTP
  const base = locationUrl();
  if (!base) return distanceToPickupLocal(userId, pickupLat, pickupLng);
  
  try {
    const url = new URL("/internal/distance", base);
    url.searchParams.set("userId", userId);
    url.searchParams.set("pickupLat", String(pickupLat));
    url.searchParams.set("pickupLng", String(pickupLng));
    const response = await fetch(url, { headers: internalHeaders() });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { distanceKm: number };
    return body.distanceKm;
  } catch (error) {
    console.warn('HTTP distanceToPickup failed, falling back to local:', error);
    return distanceToPickupLocal(userId, pickupLat, pickupLng);
  }
}

export async function recordDriverLocation(userId: string, latitude: number, longitude: number) {
  // Try gRPC first if enabled
  if (isGrpcEnabled()) {
    try {
      return await recordDriverLocationGrpc(userId, latitude, longitude);
    } catch (error) {
      console.warn('gRPC recordDriverLocation failed, falling back to HTTP:', error);
    }
  }
  
  // Fall back to HTTP
  const base = locationUrl();
  if (!base) return recordDriverLocationLocal(userId, latitude, longitude);
  
  try {
    const response = await fetch(new URL("/internal/drivers/location", base), {
      method: "POST",
      headers: { ...internalHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ userId, latitude, longitude }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as { tripIds: string[] };
    return body.tripIds;
  } catch (error) {
    console.warn('HTTP recordDriverLocation failed, falling back to local:', error);
    return recordDriverLocationLocal(userId, latitude, longitude);
  }
}

export async function syncDriverGeo(userId: string) {
  // Try gRPC first if enabled
  if (isGrpcEnabled()) {
    try {
      await syncDriverGeoGrpc(userId);
      return;
    } catch (error) {
      console.warn('gRPC syncDriverGeo failed, falling back to HTTP:', error);
    }
  }
  
  // Fall back to HTTP
  const base = locationUrl();
  if (!base) return syncDriverGeoLocal(userId);
  
  try {
    const response = await fetch(new URL("/internal/drivers/geo/sync", base), {
      method: "POST",
      headers: { ...internalHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn('HTTP syncDriverGeo failed, falling back to local:', error);
    return syncDriverGeoLocal(userId);
  }
}

export async function indexSearchingTrip(input: {
  id: string;
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
  matchAllVehicleTypes?: boolean;
}) {
  // Try gRPC first if enabled
  if (isGrpcEnabled()) {
    try {
      await indexSearchingTripGrpc(input);
      return;
    } catch (error) {
      console.warn('gRPC indexSearchingTrip failed, falling back to HTTP:', error);
    }
  }
  
  // Fall back to HTTP
  const base = locationUrl();
  if (!base) return indexSearchingTripLocal(input);
  
  try {
    const response = await fetch(new URL("/internal/trips/geo", base), {
      method: "POST",
      headers: { ...internalHeaders(), "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn('HTTP indexSearchingTrip failed, falling back to local:', error);
    return indexSearchingTripLocal(input);
  }
}

export async function removeSearchingTrip(id: string, vehicleType?: "BIKE" | "CAR") {
  // Try gRPC first if enabled
  if (isGrpcEnabled()) {
    try {
      await removeSearchingTripGrpc(id, vehicleType);
      return;
    } catch (error) {
      console.warn('gRPC removeSearchingTrip failed, falling back to HTTP:', error);
    }
  }
  
  // Fall back to HTTP
  const base = locationUrl();
  if (!base) return removeSearchingTripLocal(id, vehicleType);
  
  try {
    const response = await fetch(new URL("/internal/trips/geo/remove", base), {
      method: "POST",
      headers: { ...internalHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ id, vehicleType }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn('HTTP removeSearchingTrip failed, falling back to local:', error);
    return removeSearchingTripLocal(id, vehicleType);
  }
}
