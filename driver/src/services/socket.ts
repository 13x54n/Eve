import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { requireWsUrl } from '@/lib/public-env';

let socket: Socket | null = null;
let subscribedTripId: string | null = null;
let reconnectAttempts = 0;
const listeners = new Set<(event: string, payload: unknown) => void>();
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;

function socketUrl() {
  return requireWsUrl('driver');
}

function joinSubscribedTrip() {
  if (subscribedTripId) socket?.emit('trip:subscribe', subscribedTripId);
}

function dispatch(event: string, payload: unknown) {
  for (const listener of listeners) listener(event, payload);
}

export function addDriverSocketListener(listener: (event: string, payload: unknown) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export async function connectDriverSocket(onTripEvent?: (event: string, payload: unknown) => void) {
  if (onTripEvent) listeners.add(onTripEvent);
  const token = await SecureStore.getItemAsync('access_token');
  if (socket?.connected) {
    reconnectAttempts = 0;
    return socket;
  }
  socket?.disconnect();
  
  socket = io(socketUrl(), { 
    auth: { token }, 
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_BASE_DELAY,
    reconnectionDelayMax: RECONNECT_BASE_DELAY * Math.pow(2, 4),
  });
  
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
    socket?.once('connect', () => resolve());
    socket?.once('connect_error', (error) => reject(error));
  });
  return socket;
}

export function subscribeTrip(tripId: string) {
  subscribedTripId = tripId;
  if (socket?.connected) socket.emit('trip:subscribe', tripId);
}

export function sendDriverLocation(latitude: number, longitude: number) {
  if (socket?.connected) {
    socket.emit('driver:location', { latitude, longitude });
  } else {
    console.warn('[Socket] Cannot send location: socket not connected');
  }
}

export function disconnectDriverSocket() {
  subscribedTripId = null;
  reconnectAttempts = 0;
  socket?.disconnect();
  socket = null;
}
