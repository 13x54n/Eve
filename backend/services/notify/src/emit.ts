import type { Server } from "socket.io";
import { verifyAccessToken } from "@eve/shared";

let io: Server | null = null;

export function setSocketServer(server: Server | null) {
  io = server;
}

export async function emitTripEvent(tripId: string, event: string, payload: unknown) {
  if (io) {
    io.to(`trip:${tripId}`).emit(event, payload);
    return;
  }
  await postEmit({ target: "trip", tripId, event, payload });
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
  await postEmit({ target: "user", role, userId, event, payload });
}

async function postEmit(body: Record<string, unknown>) {
  const url = process.env.NOTIFY_URL;
  if (!url) return;
  await fetch(new URL("/internal/emit", url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    /* live clients lag; HTTP APIs still work */
  });
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
