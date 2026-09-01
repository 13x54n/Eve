import { GrpcServer, loadProto, GrpcStatus } from '@eve/grpc';
import type { ServiceError } from '@grpc/grpc-js';
import {
  nearbyDrivers,
  recordDriverLocation,
  syncDriverGeo,
  nearbySearchingTrips,
  distanceToPickup,
  indexSearchingTrip,
  removeSearchingTrip,
} from './matching.js';

// Load proto definition
const proto = loadProto('backend/proto/location.proto', 'eve.location');
const LocationService = proto.LocationService;

/**
 * gRPC service implementation for Location Service
 */
const locationServiceImpl = {
  /**
   * Record driver location (unary)
   */
  async RecordDriverLocation(call: any, callback: any) {
    try {
      const { user_id, latitude, longitude } = call.request;
      
      if (!user_id || typeof latitude !== 'number' || typeof longitude !== 'number') {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'user_id, latitude, and longitude are required',
        });
      }
      
      const tripIds = await recordDriverLocation(user_id, latitude, longitude);
      callback(null, { trip_ids: tripIds });
    } catch (error: any) {
      console.error('RecordDriverLocation error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Record driver location (bidirectional streaming)
   */
  RecordDriverLocationStream(call: any) {
    call.on('data', async (request: any) => {
      try {
        const { user_id, latitude, longitude } = request;
        
        if (!user_id || typeof latitude !== 'number' || typeof longitude !== 'number') {
          call.emit('error', {
            code: GrpcStatus.INVALID_ARGUMENT,
            message: 'user_id, latitude, and longitude are required',
          });
          return;
        }
        
        const tripIds = await recordDriverLocation(user_id, latitude, longitude);
        call.write({ trip_ids: tripIds });
      } catch (error: any) {
        console.error('RecordDriverLocationStream error:', error);
        call.emit('error', {
          code: GrpcStatus.INTERNAL,
          message: error.message || 'Internal server error',
        });
      }
    });
    
    call.on('end', () => {
      call.end();
    });
    
    call.on('error', (error: Error) => {
      console.error('Stream error:', error);
    });
  },

  /**
   * Sync driver geo
   */
  async SyncDriverGeo(call: any, callback: any) {
    try {
      const { user_id } = call.request;
      
      if (!user_id) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'user_id is required',
        });
      }
      
      await syncDriverGeo(user_id);
      callback(null, { success: true });
    } catch (error: any) {
      console.error('SyncDriverGeo error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Find nearby drivers
   */
  async NearbyDrivers(call: any, callback: any) {
    try {
      const { 
        pickup_lat, 
        pickup_lng, 
        vehicle_type, 
        exclude_user_id,
        match_all_vehicle_types 
      } = call.request;
      
      if (typeof pickup_lat !== 'number' || typeof pickup_lng !== 'number' || !vehicle_type) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'pickup_lat, pickup_lng, and vehicle_type are required',
        });
      }
      
      if (vehicle_type !== 'BIKE' && vehicle_type !== 'CAR') {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'vehicle_type must be BIKE or CAR',
        });
      }
      
      const drivers = await nearbyDrivers({
        pickupLat: pickup_lat,
        pickupLng: pickup_lng,
        vehicleType: vehicle_type as "BIKE" | "CAR",
        excludeUserId: exclude_user_id || undefined,
        matchAllVehicleTypes: match_all_vehicle_types || false,
      });
      
      // Transform drivers to proto format
      const protoDrivers = drivers.map(driver => ({
        id: driver.id,
        user_id: driver.userId,
        distance_to_pickup: driver.distance,
        rating: 0, // TODO: Add rating to NearbyDriver type
        vehicle_types: [], // TODO: Add vehicle types to NearbyDriver type
        latitude: driver.latitude,
        longitude: driver.longitude,
      }));
      
      callback(null, { drivers: protoDrivers });
    } catch (error: any) {
      console.error('NearbyDrivers error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Find nearby searching trips
   */
  async NearbySearchingTrips(call: any, callback: any) {
    try {
      const { user_id } = call.request;
      
      if (!user_id) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'user_id is required',
        });
      }
      
      const trips = await nearbySearchingTrips(user_id);
      
      // Transform trips to proto format
      const protoTrips = trips.map(trip => ({
        id: trip.id,
        distance_to_pickup: trip.distanceToPickup,
        pickup_lat: 0, // Not available in NearbySearchingTrip type
        pickup_lng: 0, // Not available in NearbySearchingTrip type
        vehicle_type: 'CAR', // Not available in NearbySearchingTrip type
      }));
      
      callback(null, { trips: protoTrips });
    } catch (error: any) {
      console.error('NearbySearchingTrips error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Calculate distance to pickup
   */
  async DistanceToPickup(call: any, callback: any) {
    try {
      const { user_id, pickup_lat, pickup_lng } = call.request;
      
      if (!user_id || typeof pickup_lat !== 'number' || typeof pickup_lng !== 'number') {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'user_id, pickup_lat, and pickup_lng are required',
        });
      }
      
      const distance = await distanceToPickup(user_id, pickup_lat, pickup_lng);
      callback(null, { distance_km: distance });
    } catch (error: any) {
      console.error('DistanceToPickup error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Index searching trip
   */
  async IndexSearchingTrip(call: any, callback: any) {
    try {
      const { id, pickup_lat, pickup_lng, vehicle_type, match_all_vehicle_types } = call.request;
      
      if (!id || typeof pickup_lat !== 'number' || typeof pickup_lng !== 'number' || !vehicle_type) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'id, pickup_lat, pickup_lng, and vehicle_type are required',
        });
      }
      
      if (vehicle_type !== 'BIKE' && vehicle_type !== 'CAR') {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'vehicle_type must be BIKE or CAR',
        });
      }
      
      await indexSearchingTrip({
        id,
        pickupLat: pickup_lat,
        pickupLng: pickup_lng,
        vehicleType: vehicle_type as "BIKE" | "CAR",
        matchAllVehicleTypes: match_all_vehicle_types || false,
      });
      
      callback(null, { success: true });
    } catch (error: any) {
      console.error('IndexSearchingTrip error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Remove searching trip
   */
  async RemoveSearchingTrip(call: any, callback: any) {
    try {
      const { id, vehicle_type } = call.request;
      
      if (!id) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'id is required',
        });
      }
      
      let vehicleTypeParam: "BIKE" | "CAR" | undefined;
      if (vehicle_type) {
        if (vehicle_type !== 'BIKE' && vehicle_type !== 'CAR') {
          return callback({
            code: GrpcStatus.INVALID_ARGUMENT,
            message: 'vehicle_type must be BIKE or CAR if provided',
          });
        }
        vehicleTypeParam = vehicle_type as "BIKE" | "CAR";
      }
      
      await removeSearchingTrip(id, vehicleTypeParam);
      callback(null, { success: true });
    } catch (error: any) {
      console.error('RemoveSearchingTrip error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },
};

/**
 * Start the Location gRPC server
 */
export async function startLocationGrpcServer(port: number = 50051): Promise<GrpcServer> {
  const server = new GrpcServer();
  server.addService(LocationService.service, locationServiceImpl);
  await server.start({ port });
  console.log(`Location gRPC server ready on port ${port}`);
  return server;
}
