import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

let socket: Socket | null = null;
let subscribedTripId: string | null = null;
const listeners = new Set<(event: string, payload: unknown) => void>();

function socketUrl() {
  return process.env.EXPO_PUBLIC_WS_URL || (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/api\/?$/, '');
}

function joinSubscribedTrip() {
  if (subscribedTripId) socket?.emit('trip:subscribe', subscribedTripId);
}

function dispatch(event: string, payload: unknown) {
  for (const listener of listeners) listener(event, payload);
}

export function addSocketListener(listener: (event: string, payload: unknown) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function connectSocket() {
  const token = await SecureStore.getItemAsync('access_token');
  if (!token) return null;
  if (socket?.connected) return socket;
  socket?.disconnect();
  socket = io(socketUrl(), { auth: { token }, transports: ['websocket'] });
  socket.onAny((event, payload) => dispatch(event, payload));
  socket.on('connect', joinSubscribedTrip);
  if (socket.connected) return socket;
  await new Promise<void>((resolve, reject) => {
    socket?.once('connect', () => resolve());
    socket?.once('connect_error', (error) => reject(error));
  });
  return socket;
}

export function subscribeTrip(tripId: string) {
  subscribedTripId = tripId;
  if (socket?.connected) socket.emit('trip:subscribe', tripId);
}

export function disconnectSocket() {
  subscribedTripId = null;
  socket?.disconnect();
  socket = null;
}
