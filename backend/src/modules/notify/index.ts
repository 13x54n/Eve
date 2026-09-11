/**
 * Notify Module - Socket.IO Event Emission
 * 
 * Handles real-time event broadcasting via Socket.IO
 */

import { getSocketIO } from '../../shared/state.js';

/**
 * Emit event to trip room
 */
export function emitTripEvent(tripId: string, event: string, payload: unknown): void {
  const io = getSocketIO();
  if (!io) {
    console.warn('[notify] Socket.IO not initialized');
    return;
  }
  
  io.to(`trip:${tripId}`).emit(event, payload);
}

/**
 * Emit event to user room
 */
export function emitUserEvent(
  role: 'RIDER' | 'DRIVER',
  userId: string,
  event: string,
  payload: unknown
): void {
  const io = getSocketIO();
  if (!io) {
    console.warn('[notify] Socket.IO not initialized');
    return;
  }
  
  const room = `${role.toLowerCase()}:${userId}`;
  io.to(room).emit(event, payload);
}

/**
 * Emit event to trip and user rooms (union emit)
 */
export function emitTripAndUserEvent(
  tripId: string,
  role: 'RIDER' | 'DRIVER',
  userId: string,
  event: string,
  payload: unknown
): void {
  const io = getSocketIO();
  if (!io) {
    console.warn('[notify] Socket.IO not initialized');
    return;
  }
  
  const userRoom = `${role.toLowerCase()}:${userId}`;
  io.to(`trip:${tripId}`).to(userRoom).emit(event, payload);
}

/**
 * Emit event to admin room
 */
export function emitAdminEvent(event: string, payload: unknown): void {
  const io = getSocketIO();
  if (!io) {
    console.warn('[notify] Socket.IO not initialized');
    return;
  }
  
  io.to('admin:ops').emit(event, payload);
}

/**
 * Emit payment event (to trip + user rooms)
 */
export function emitPaymentEvent(tripId: string, event: string, payload: unknown): void {
  emitTripEvent(tripId, event, payload);
  
  const body = payload && typeof payload === 'object' ? payload as {
    riderUserId?: string | null;
    driverUserId?: string | null;
  } : {};

  if (body.riderUserId) {
    emitUserEvent('RIDER', body.riderUserId, event, payload);
  }
  
  if (body.driverUserId) {
    emitUserEvent('DRIVER', body.driverUserId, event, payload);
  }
}
