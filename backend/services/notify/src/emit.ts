import type { Server } from "socket.io";
import {
  emitTripEventGrpc,
  emitUserEventGrpc,
  emitAdminEventGrpc,
  emitTripAndUserEventGrpc,
} from './grpc-client.js';

const ADMIN_OPS_ROOM = "admin:ops";

let io: Server | null = null;

export function setSocketServer(server: Server | null) {
  io = server;
}

/**
 * gRPC-first emit with Socket.IO direct access
 */
export async function emitTripEvent(tripId: string, event: string, payload: unknown) {
  if (io) {
    io.to(`trip:${tripId}`).emit(event, payload);
    return;
  }
  
  try {
    await emitTripEventGrpc(tripId, event, payload);
  } catch (error) {
    console.warn('gRPC emitTripEvent failed, no websocket server available:', error);
  }
}

export async function emitUserEvent(
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown,
) {
  if (io) {
    io.to(`${role.toLowerCase()}:${userId}`).emit(event, payload);
    return;
  }
  
  try {
    await emitUserEventGrpc(role, userId, event, payload);
  } catch (error) {
    console.warn('gRPC emitUserEvent failed, no websocket server available:', error);
  }
}

export async function emitTripAndUserEvent(
  tripId: string,
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown,
) {
  if (io) {
    emitTripAndUserEventLocal(tripId, role, userId, event, payload);
    return;
  }
  
  try {
    await emitTripAndUserEventGrpc(tripId, role, userId, event, payload);
  } catch (error) {
    console.warn('gRPC emitTripAndUserEvent failed, no websocket server available:', error);
  }
}

export async function emitAdminEvent(event: string, payload: unknown) {
  if (io) {
    io.to(ADMIN_OPS_ROOM).emit(event, payload);
    return;
  }
  
  try {
    await emitAdminEventGrpc(event, payload);
  } catch (error) {
    console.warn('gRPC emitAdminEvent failed, no websocket server available:', error);
  }
}

export function emitTripEventLocal(tripId: string, event: string, payload: unknown) {
  io?.to(`trip:${tripId}`).emit(event, payload);
}

export function emitUserEventLocal(
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown,
) {
  io?.to(`${role.toLowerCase()}:${userId}`).emit(event, payload);
}

export function emitTripAndUserEventLocal(
  tripId: string,
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown,
) {
  io?.to(`trip:${tripId}`).to(`${role.toLowerCase()}:${userId}`).emit(event, payload);
}

export function emitAdminEventLocal(event: string, payload: unknown) {
  io?.to(ADMIN_OPS_ROOM).emit(event, payload);
}
