"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "@/lib/api";

let socket: Socket | null = null;
let subscribedTripId: string | null = null;
const listeners = new Set<(event: string, payload: unknown) => void>();
const connectionListeners = new Set<(connected: boolean) => void>();

function socketUrl() {
  const value = process.env.NEXT_PUBLIC_API_URL ?? "";
  return value.replace(/\/api\/?$/, "");
}

function notifyConnection(connected: boolean) {
  for (const listener of connectionListeners) {
    listener(connected);
  }
}

export function addAdminSocketListener(listener: (event: string, payload: unknown) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addConnectionListener(listener: (connected: boolean) => void) {
  connectionListeners.add(listener);
  listener(Boolean(socket?.connected));
  return () => {
    connectionListeners.delete(listener);
  };
}

export function connectAdminSocket() {
  const token = getToken();
  if (!token) {
    return null;
  }

  if (socket?.connected) {
    return socket;
  }

  socket?.disconnect();
  socket = io(socketUrl(), { auth: { token }, transports: ["websocket"] });
  socket.onAny((event, payload) => {
    for (const listener of listeners) {
      listener(event, payload);
    }
  });
  socket.on("connect", () => {
    notifyConnection(true);
    if (subscribedTripId) {
      socket?.emit("trip:subscribe", subscribedTripId);
    }
  });
  socket.on("disconnect", () => notifyConnection(false));
  socket.on("connect_error", () => notifyConnection(false));
  return socket;
}

export function disconnectAdminSocket() {
  subscribedTripId = null;
  socket?.disconnect();
  socket = null;
  notifyConnection(false);
}

export function subscribeTrip(tripId: string) {
  subscribedTripId = tripId;
  const client = connectAdminSocket();
  if (client?.connected) {
    client.emit("trip:subscribe", tripId);
  }
}

export function unsubscribeTrip() {
  subscribedTripId = null;
}

export function useAdminSocket() {
  const [connected, setConnected] = useState(Boolean(socket?.connected));

  useEffect(() => {
    connectAdminSocket();
    return addConnectionListener(setConnected);
  }, []);

  return { connected };
}
