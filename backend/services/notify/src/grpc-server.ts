import { GrpcServer, loadProto, GrpcStatus } from '@eve/grpc';
import {
  emitTripEventLocal,
  emitUserEventLocal,
  emitAdminEventLocal,
  emitTripAndUserEventLocal,
} from './emit.js';

// Load proto definition
const proto = loadProto('backend/proto/notify.proto', 'eve.notify');
const NotifyService = proto.NotifyService;

/**
 * gRPC service implementation for Notify Service
 */
const notifyServiceImpl = {
  /**
   * Emit trip event
   */
  async EmitTripEvent(call: any, callback: any) {
    try {
      const { trip_id, event, payload } = call.request;
      
      if (!trip_id || !event) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'trip_id and event are required',
        });
      }
      
      // Parse JSON payload
      let parsedPayload: unknown;
      try {
        parsedPayload = payload ? JSON.parse(payload) : {};
      } catch (error) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'Invalid JSON payload',
        });
      }
      
      emitTripEventLocal(trip_id, event, parsedPayload);
      callback(null, { success: true });
    } catch (error: any) {
      console.error('EmitTripEvent error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Emit user event
   */
  async EmitUserEvent(call: any, callback: any) {
    try {
      const { role, user_id, event, payload } = call.request;
      
      if (!role || !user_id || !event) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'role, user_id, and event are required',
        });
      }
      
      if (role !== 'RIDER' && role !== 'DRIVER') {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'role must be RIDER or DRIVER',
        });
      }
      
      // Parse JSON payload
      let parsedPayload: unknown;
      try {
        parsedPayload = payload ? JSON.parse(payload) : {};
      } catch (error) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'Invalid JSON payload',
        });
      }
      
      emitUserEventLocal(role as "RIDER" | "DRIVER", user_id, event, parsedPayload);
      callback(null, { success: true });
    } catch (error: any) {
      console.error('EmitUserEvent error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Emit admin event
   */
  async EmitAdminEvent(call: any, callback: any) {
    try {
      const { event, payload } = call.request;
      
      if (!event) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'event is required',
        });
      }
      
      // Parse JSON payload
      let parsedPayload: unknown;
      try {
        parsedPayload = payload ? JSON.parse(payload) : {};
      } catch (error) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'Invalid JSON payload',
        });
      }
      
      emitAdminEventLocal(event, parsedPayload);
      callback(null, { success: true });
    } catch (error: any) {
      console.error('EmitAdminEvent error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Emit trip and user event
   */
  async EmitTripAndUserEvent(call: any, callback: any) {
    try {
      const { trip_id, role, user_id, event, payload } = call.request;
      
      if (!trip_id || !role || !user_id || !event) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'trip_id, role, user_id, and event are required',
        });
      }
      
      if (role !== 'RIDER' && role !== 'DRIVER') {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'role must be RIDER or DRIVER',
        });
      }
      
      // Parse JSON payload
      let parsedPayload: unknown;
      try {
        parsedPayload = payload ? JSON.parse(payload) : {};
      } catch (error) {
        return callback({
          code: GrpcStatus.INVALID_ARGUMENT,
          message: 'Invalid JSON payload',
        });
      }
      
      emitTripAndUserEventLocal(trip_id, role as "RIDER" | "DRIVER", user_id, event, parsedPayload);
      callback(null, { success: true });
    } catch (error: any) {
      console.error('EmitTripAndUserEvent error:', error);
      callback({
        code: GrpcStatus.INTERNAL,
        message: error.message || 'Internal server error',
      });
    }
  },

  /**
   * Stream admin events (server streaming)
   * Note: This is a placeholder for future implementation with proper event streaming
   */
  StreamAdminEvents(call: any) {
    // For now, just close the stream
    // In a full implementation, this would subscribe to admin events and stream them
    call.end();
  },

  /**
   * Stream trip events (server streaming)
   * Note: This is a placeholder for future implementation with proper event streaming
   */
  StreamTripEvents(call: any) {
    // For now, just close the stream
    // In a full implementation, this would subscribe to trip events and stream them
    call.end();
  },
};

/**
 * Start the Notify gRPC server
 */
export async function startNotifyGrpcServer(port: number = 50052): Promise<GrpcServer> {
  const server = new GrpcServer();
  server.addService(NotifyService.service, notifyServiceImpl);
  await server.start({ port });
  console.log(`Notify gRPC server ready on port ${port}`);
  return server;
}
