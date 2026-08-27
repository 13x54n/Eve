import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

let socket: Socket | null = null;
let subscribedTripId: string | null = null;

function socketUrl() {
  return process.env.EXPO_PUBLIC_WS_URL || (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/api\/?$/, '');
}

function joinSubscribedTrip() {
  if (subscribedTripId) socket?.emit('trip:subscribe', subscribedTripId);
}

export async function connectSocket(onTripEvent: (event: string, payload: unknown) => void) {
  const token = await SecureStore.getItemAsync('access_token');
  socket?.disconnect();
  socket = io(socketUrl(), { auth: { token }, transports: ['websocket'] });
  socket.onAny((event, payload) => onTripEvent(event, payload));
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
