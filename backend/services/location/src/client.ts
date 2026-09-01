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

/**
 * gRPC-first client with local fallback
 */
export async function nearbyDrivers(input: {
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
  excludeUserId?: string;
  matchAllVehicleTypes?: boolean;
}): Promise<NearbyDriver[]> {
  try {
    return await nearbyDriversGrpc(input);
  } catch (error) {
    console.warn('gRPC nearbyDrivers failed, using local fallback:', error);
    return nearbyDriversLocal(input);
  }
}

export async function nearbySearchingTrips(userId: string) {
  try {
    return await nearbySearchingTripsGrpc(userId);
  } catch (error) {
    console.warn('gRPC nearbySearchingTrips failed, using local fallback:', error);
    return nearbySearchingTripsLocal(userId);
  }
}

export async function distanceToPickup(userId: string, pickupLat: number, pickupLng: number) {
  try {
    return await distanceToPickupGrpc(userId, pickupLat, pickupLng);
  } catch (error) {
    console.warn('gRPC distanceToPickup failed, using local fallback:', error);
    return distanceToPickupLocal(userId, pickupLat, pickupLng);
  }
}

export async function recordDriverLocation(userId: string, latitude: number, longitude: number) {
  try {
    return await recordDriverLocationGrpc(userId, latitude, longitude);
  } catch (error) {
    console.warn('gRPC recordDriverLocation failed, using local fallback:', error);
    return recordDriverLocationLocal(userId, latitude, longitude);
  }
}

export async function syncDriverGeo(userId: string) {
  try {
    await syncDriverGeoGrpc(userId);
  } catch (error) {
    console.warn('gRPC syncDriverGeo failed, using local fallback:', error);
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
  try {
    await indexSearchingTripGrpc(input);
  } catch (error) {
    console.warn('gRPC indexSearchingTrip failed, using local fallback:', error);
    return indexSearchingTripLocal(input);
  }
}

export async function removeSearchingTrip(id: string, vehicleType?: "BIKE" | "CAR") {
  try {
    await removeSearchingTripGrpc(id, vehicleType);
  } catch (error) {
    console.warn('gRPC removeSearchingTrip failed, using local fallback:', error);
    return removeSearchingTripLocal(id, vehicleType);
  }
}
