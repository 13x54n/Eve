import type { Server } from "socket.io";

const ADMIN_OPS_ROOM = "admin:ops";

let io: Server | null = null;

export function setSocketServer(server: Server | null) {
  io = server;
}

function internalHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  return secret ? { "x-internal-secret": secret } : {};
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

/** One emit to the trip room and a user room. Sockets in both rooms still receive it once. */
export async function emitTripAndUserEvent(
  tripId: string,
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown,
) {
  if (io) {
    emitTripAndUserEventLocal(tripId, role, userId, event, payload);
    return;
  }
  await postEmit({ target: "trip+user", tripId, role, userId, event, payload });
}

export async function emitAdminEvent(event: string, payload: unknown) {
  if (io) {
    io.to(ADMIN_OPS_ROOM).emit(event, payload);
    return;
  }
  await postEmit({ target: "admin", event, payload });
}

async function postEmit(body: Record<string, unknown>) {
  const url = process.env.NOTIFY_URL;
  if (!url) return;
  await fetch(new URL("/internal/emit", url), {
    method: "POST",
    headers: { ...internalHeaders(), "content-type": "application/json" },
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

export function emitTripAndUserEventLocal(
  tripId: string,
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown,
) {
  io?.to(`trip:${tripId}`).to(`${role.toLowerCase()}:${userId}`).emit(event, payload);
}

export function emitAdminEventLocal(event: string, payload: unknown) {
  io?.to(ADMIN_OPS_ROOM).emit(event, payload);
}
