import * as SecureStore from 'expo-secure-store';

let socket: WebSocket | null = null;
let pingTimer: any;

type SocketMessage =
  | { type: 'LOCATION_UPDATE'; driver_id?: string; lat: number; lng: number; ts: number }
  | { type: 'TRIP_UPDATE'; ride_id: string; status: string; eta?: number };

export function connectSocket(
  onMessage: (msg: SocketMessage) => void,
  onError?: (err: any) => void
) {
  const wsUrl = process.env.EXPO_PUBLIC_WS_URL + '/ws';
  const token = SecureStore.getItemAsync('access_token');

  // Use the global WebSocket (React Native / Expo)
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    // Send auth header after open if your server expects it in a message
    // Otherwise, rely on query param or cookie auth on your backend
    pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);
  };

  socket.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as SocketMessage;
      onMessage(msg);
    } catch {
      // ignore malformed
    }
  };

  socket.onerror = (err) => onError?.(err);
  socket.onclose = () => {
    if (pingTimer) clearInterval(pingTimer);
    socket = null;
  };

  return socket;
}

export function sendDriverLocation(lat: number, lng: number) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'LOCATION_UPDATE', lat, lng, ts: Date.now() }));
}

export function subscribeTrip(rideId: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: 'SUBSCRIBE_TRIP', ride_id: rideId }));
}

export function disconnectSocket() {
  if (pingTimer) clearInterval(pingTimer);
  socket?.close();
  socket = null;
}