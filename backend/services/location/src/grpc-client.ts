import { createGrpcClient, loadProto, promisifyUnaryCall, createLoggingInterceptor } from '@eve/grpc';
import type { NearbyDriver } from './matching.js';

// Load proto definition
const proto = loadProto('backend/proto/location.proto', 'eve.location');
const LocationService = proto.LocationService;

let client: any = null;

/**
 * Get or create gRPC client for Location Service
 */
function getClient() {
  if (client) return client;
  
  const url = process.env.LOCATION_GRPC_URL || '127.0.0.1:50051';
  const useLogging = process.env.GRPC_LOGGING === 'true';
  
  client = createGrpcClient(
    LocationService,
    { url },
  );
  
  if (useLogging) {
    // Add logging interceptor if enabled
    console.log('Location gRPC client logging enabled');
  }
  
  console.log(`Location gRPC client connected to ${url}`);
  return client;
}

/**
 * Call NearbyDrivers via gRPC
 */
export async function nearbyDriversGrpc(input: {
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
  excludeUserId?: string;
  matchAllVehicleTypes?: boolean;
}): Promise<NearbyDriver[]> {
  const client = getClient();
  
  const response: any = await promisifyUnaryCall(
    client,
    'NearbyDrivers',
    {
      pickup_lat: input.pickupLat,
      pickup_lng: input.pickupLng,
      vehicle_type: input.vehicleType,
      exclude_user_id: input.excludeUserId,
      match_all_vehicle_types: input.matchAllVehicleTypes || false,
    }
  );
  
  // Transform proto response to application format
  return response.drivers.map((driver: any) => ({
    id: driver.id,
    userId: driver.user_id,
    latitude: driver.latitude,
    longitude: driver.longitude,
    distance: driver.distance_to_pickup,
  }));
}

/**
 * Record driver location via gRPC (unary)
 */
export async function recordDriverLocationGrpc(
  userId: string, 
  latitude: number, 
  longitude: number
): Promise<string[]> {
  const client = getClient();
  
  const response: any = await promisifyUnaryCall(
    client,
    'RecordDriverLocation',
    {
      user_id: userId,
      latitude,
      longitude,
    }
  );
  
  return response.trip_ids;
}

/**
 * Create a streaming client for continuous GPS updates
 */
export function createDriverLocationStream() {
  const client = getClient();
  const stream = client.RecordDriverLocationStream();
  
  return {
    /**
     * Send a location update
     */
    send: (userId: string, lat: number, lng: number) => {
      stream.write({ 
        user_id: userId, 
        latitude: lat, 
        longitude: lng 
      });
    },
    
    /**
     * Listen for responses
     */
    onData: (callback: (tripIds: string[]) => void) => {
      stream.on('data', (response: any) => {
        callback(response.trip_ids);
      });
    },
    
    /**
     * Listen for errors
     */
    onError: (callback: (error: Error) => void) => {
      stream.on('error', callback);
    },
    
    /**
     * Listen for stream end
     */
    onEnd: (callback: () => void) => {
      stream.on('end', callback);
    },
    
    /**
     * Close the stream
     */
    close: () => {
      stream.end();
    },
  };
}

/**
 * Sync driver geo via gRPC
 */
export async function syncDriverGeoGrpc(userId: string): Promise<void> {
  const client = getClient();
  
  await promisifyUnaryCall(
    client,
    'SyncDriverGeo',
    { user_id: userId }
  );
}

/**
 * Find nearby searching trips via gRPC
 */
export async function nearbySearchingTripsGrpc(userId: string): Promise<Array<{ id: string; distanceToPickup: number }>> {
  const client = getClient();
  
  const response: any = await promisifyUnaryCall(
    client,
    'NearbySearchingTrips',
    { user_id: userId }
  );
  
  return response.trips.map((trip: any) => ({
    id: trip.id,
    distanceToPickup: trip.distance_to_pickup,
  }));
}

/**
 * Calculate distance to pickup via gRPC
 */
export async function distanceToPickupGrpc(
  userId: string, 
  pickupLat: number, 
  pickupLng: number
): Promise<number> {
  const client = getClient();
  
  const response: any = await promisifyUnaryCall(
    client,
    'DistanceToPickup',
    {
      user_id: userId,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
    }
  );
  
  return response.distance_km;
}

/**
 * Index searching trip via gRPC
 */
export async function indexSearchingTripGrpc(input: {
  id: string;
  pickupLat: number;
  pickupLng: number;
  vehicleType: "BIKE" | "CAR";
  matchAllVehicleTypes?: boolean;
}): Promise<void> {
  const client = getClient();
  
  await promisifyUnaryCall(
    client,
    'IndexSearchingTrip',
    {
      id: input.id,
      pickup_lat: input.pickupLat,
      pickup_lng: input.pickupLng,
      vehicle_type: input.vehicleType,
      match_all_vehicle_types: input.matchAllVehicleTypes || false,
    }
  );
}

/**
 * Remove searching trip via gRPC
 */
export async function removeSearchingTripGrpc(
  id: string, 
  vehicleType?: "BIKE" | "CAR"
): Promise<void> {
  const client = getClient();
  
  await promisifyUnaryCall(
    client,
    'RemoveSearchingTrip',
    {
      id,
      vehicle_type: vehicleType,
    }
  );
}

/**
 * Close gRPC client connection
 */
export function closeGrpcClient(): void {
  if (client) {
    client.close();
    client = null;
    console.log('Location gRPC client closed');
  }
}
