import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

let socket: Socket | null = null;

function socketUrl() {
  return process.env.EXPO_PUBLIC_WS_URL || (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/api\/?$/, '');
}

export async function connectSocket(onTripEvent: (event: string, payload: unknown) => void) {
  const token = await SecureStore.getItemAsync('access_token');
  socket = io(socketUrl(), { auth: { token }, transports: ['websocket'] });
  socket.onAny((event, payload) => onTripEvent(event, payload));
  return socket;
}

export function subscribeTrip(tripId: string) {
  socket?.emit('trip:subscribe', tripId);
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
