import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { requireWsUrl } from '@/lib/public-env';

let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;
let connectGeneration = 0;
let subscribedTripId: string | null = null;
let reconnectAttempts = 0;
const listeners = new Set<(event: string, payload: unknown) => void>();
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;

function socketUrl() {
  return requireWsUrl('rider');
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

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export async function connectSocket() {
  if (socket?.connected) {
    reconnectAttempts = 0;
    return socket;
  }
  if (connectPromise) return connectPromise;

  const generation = ++connectGeneration;
  connectPromise = (async () => {
    const token = await SecureStore.getItemAsync('access_token');
    if (!token || generation !== connectGeneration) return null;
    if (socket?.connected) return socket;

    socket?.removeAllListeners();
    socket?.disconnect();
    
    const next = io(socketUrl(), { 
      auth: { token }, 
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_BASE_DELAY,
      reconnectionDelayMax: RECONNECT_BASE_DELAY * Math.pow(2, 4),
    });
    
    if (generation !== connectGeneration) {
      next.disconnect();
      return null;
    }
    socket = next;
    socket.onAny((event, payload) => dispatch(event, payload));
    socket.on('connect', () => {
      reconnectAttempts = 0;
      joinSubscribedTrip();
      console.log('[Socket] Connected');
    });
    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });
    socket.on('connect_error', (error) => {
      reconnectAttempts++;
      console.error(`[Socket] Connection error (attempt ${reconnectAttempts}):`, error.message);
    });
    
    if (socket.connected) {
      reconnectAttempts = 0;
      return socket;
    }
    
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
  reconnectAttempts = 0;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}
