import type { Server } from "socket.io";
import {
  EVE_TOPICS,
  isKafkaEnabled,
  publishEveEvent,
} from "@eve/shared/kafka";
import {
  emitTripEventGrpc,
  emitUserEventGrpc,
  emitAdminEventGrpc,
  emitTripAndUserEventGrpc,
} from "./grpc-client.js";

const ADMIN_OPS_ROOM = "admin:ops";

let io: Server | null = null;

export function setSocketServer(server: Server | null) {
  io = server;
}

type HttpEmitBody = {
  target: "trip" | "user" | "admin" | "trip_and_user";
  event: string;
  payload: unknown;
  tripId?: string;
  role?: "RIDER" | "DRIVER";
  userId?: string;
};

async function emitViaHttp(body: HttpEmitBody) {
  const notifyUrl = process.env.NOTIFY_URL;
  if (!notifyUrl) return;
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (secret) headers["x-internal-secret"] = secret;
  const res = await fetch(`${notifyUrl}/internal/emit`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[notify] HTTP emit fallback failed:", res.status);
  }
}

async function deliverRealtime(
  runLocal: () => void,
  runGrpc: () => Promise<void>,
  httpBody: HttpEmitBody,
) {
  if (isKafkaEnabled()) return;
  if (io) {
    runLocal();
    return;
  }
  try {
    await runGrpc();
  } catch (error) {
    console.warn("gRPC emit failed, falling back to HTTP /internal/emit:", error);
    try {
      await emitViaHttp(httpBody);
    } catch (httpError) {
      console.error(
        "[notify] HTTP emit fallback failed:",
        httpError instanceof Error ? httpError.message : httpError,
      );
    }
  }
}

export async function emitTripEvent(tripId: string, event: string, payload: unknown) {
  await publishEveEvent(EVE_TOPICS.trip, {
    type: event,
    key: tripId,
    payload,
  });
  await deliverRealtime(
    () => io?.to(`trip:${tripId}`).emit(event, payload),
    () => emitTripEventGrpc(tripId, event, payload),
    { target: "trip", tripId, event, payload },
  );
}

export async function emitUserEvent(
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown,
) {
  await publishEveEvent(EVE_TOPICS.user, {
    type: event,
    key: userId,
    payload: { role, body: payload },
  });
  await deliverRealtime(
    () => io?.to(`${role.toLowerCase()}:${userId}`).emit(event, payload),
    () => emitUserEventGrpc(role, userId, event, payload),
    { target: "user", role, userId, event, payload },
  );
}

export async function emitTripAndUserEvent(
  tripId: string,
  role: "RIDER" | "DRIVER",
  userId: string,
  event: string,
  payload: unknown,
) {
  await publishEveEvent(EVE_TOPICS.trip, {
    type: event,
    key: tripId,
    payload,
    notifyUser: { role, userId },
  });
  await deliverRealtime(
    () => emitTripAndUserEventLocal(tripId, role, userId, event, payload),
    () => emitTripAndUserEventGrpc(tripId, role, userId, event, payload),
    { target: "trip_and_user", tripId, role, userId, event, payload },
  );
}

export async function emitAdminEvent(event: string, payload: unknown, key?: string) {
  const payloadKey =
    key ??
    (payload && typeof payload === "object" && "ticketId" in payload && typeof (payload as { ticketId?: unknown }).ticketId === "string"
      ? (payload as { ticketId: string }).ticketId
      : event);
  await publishEveEvent(EVE_TOPICS.admin, {
    type: event,
    key: payloadKey,
    payload,
  });
  await deliverRealtime(
    () => io?.to(ADMIN_OPS_ROOM).emit(event, payload),
    () => emitAdminEventGrpc(event, payload),
    { target: "admin", event, payload },
  );
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
