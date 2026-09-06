import { cache } from "./cache.js";

const ACTIVE_TTL_SEC = 6 * 60 * 60;
const DETAIL_TTL_ACTIVE_SEC = 60;
const DETAIL_TTL_TERMINAL_SEC = 24 * 60 * 60;

export function tripActiveKey(userId: string) {
  return `trip:active:${userId}`;
}

export function tripDetailKey(tripId: string) {
  return `trip:detail:${tripId}`;
}

export function isTerminalTripStatus(status: string) {
  return status === "COMPLETED" || status === "CANCELLED";
}

export async function getCachedTripDetail<T>(tripId: string): Promise<T | null> {
  const raw = await cache.get(tripDetailKey(tripId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getCachedActiveTripId(userId: string): Promise<string | null> {
  return cache.get(tripActiveKey(userId));
}

export async function writeTripConfirmationCache(input: {
  tripId: string;
  status: string;
  paymentStatus?: string;
  riderUserId?: string | null;
  driverUserId?: string | null;
  snapshot: unknown;
}): Promise<void> {
  const terminal = isTerminalTripStatus(input.status);
  const ttl = terminal ? DETAIL_TTL_TERMINAL_SEC : DETAIL_TTL_ACTIVE_SEC;
  await cache.set(tripDetailKey(input.tripId), JSON.stringify(input.snapshot), ttl);

  const holdActive = !terminal && ["SEARCHING", "ASSIGNED", "ONGOING"].includes(input.status);
  if (input.riderUserId) {
    if (holdActive) await cache.set(tripActiveKey(input.riderUserId), input.tripId, ACTIVE_TTL_SEC);
    else await cache.del(tripActiveKey(input.riderUserId));
  }
  if (input.driverUserId) {
    const driverHold = holdActive && (input.status === "ASSIGNED" || input.status === "ONGOING");
    if (driverHold) await cache.set(tripActiveKey(input.driverUserId), input.tripId, ACTIVE_TTL_SEC);
    else await cache.del(tripActiveKey(input.driverUserId));
  }
}

export async function invalidateTripConfirmationCache(input: {
  tripId: string;
  riderUserId?: string | null;
  driverUserId?: string | null;
}): Promise<void> {
  const keys = [tripDetailKey(input.tripId)];
  if (input.riderUserId) keys.push(tripActiveKey(input.riderUserId));
  if (input.driverUserId) keys.push(tripActiveKey(input.driverUserId));
  await cache.del(...keys);
}
