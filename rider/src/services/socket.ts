import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;
let connectGeneration = 0;
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
  if (socket?.connected) return socket;
  if (connectPromise) return connectPromise;

  const generation = ++connectGeneration;
  connectPromise = (async () => {
    const token = await SecureStore.getItemAsync('access_token');
    if (!token || generation !== connectGeneration) return null;
    if (socket?.connected) return socket;

    socket?.removeAllListeners();
    socket?.disconnect();
    const next = io(socketUrl(), { auth: { token }, transports: ['websocket'] });
    if (generation !== connectGeneration) {
      next.disconnect();
      return null;
    }
    socket = next;
    socket.onAny((event, payload) => dispatch(event, payload));
    socket.on('connect', joinSubscribedTrip);
    if (socket.connected) return socket;
    await new Promise<void>((resolve, reject) => {
      const current = socket;
      if (!current) {
        resolve();
        return;
      }
      current.once('connect', () => resolve());
      current.once('connect_error', (error) => reject(error));
    });
    return generation === connectGeneration ? socket : null;
  })().finally(() => {
    if (generation === connectGeneration) connectPromise = null;
  });

  return connectPromise;
}

export function subscribeTrip(tripId: string) {
  subscribedTripId = tripId;
  if (socket?.connected) socket.emit('trip:subscribe', tripId);
}

export function disconnectSocket() {
  connectGeneration += 1;
  connectPromise = null;
  subscribedTripId = null;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
