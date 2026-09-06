import { keccak256, toBytes } from "viem";
import { prisma } from "@eve/db";
import { escrowNowMs } from "./escrow.js";

type Timer = {
  tripId: string;
  settleFromMs: number;
  timeout?: ReturnType<typeof setTimeout>;
};

const timers = new Map<string, Timer>();
const flushing = new Set<string>();

function hashTripId(tripId: string) {
  return keccak256(toBytes(tripId)).toLowerCase();
}

export function clearEscrowTimers() {
  for (const timer of timers.values()) {
    if (timer.timeout) clearTimeout(timer.timeout);
  }
  timers.clear();
}

export function cancelEscrowFinalize(tripId: string) {
  const existing = timers.get(tripId);
  if (existing?.timeout) clearTimeout(existing.timeout);
  timers.delete(tripId);
}

export async function scheduleEscrowFinalize(tripId: string, settleFromMs: number) {
  cancelEscrowFinalize(tripId);
  const delay = settleFromMs - escrowNowMs();
  const entry: Timer = { tripId, settleFromMs };
  timers.set(tripId, entry);
  if (delay <= 0) {
    await flushTrip(tripId);
    return;
  }
  if (process.env.VITEST) return;
  entry.timeout = setTimeout(() => {
    void flushTrip(tripId);
  }, delay);
}

export async function flushDueEscrowSettlements() {
  const now = escrowNowMs();
  const due = [...timers.values()].filter((timer) => now >= timer.settleFromMs);
  await Promise.all(due.map((timer) => flushTrip(timer.tripId)));
}

async function flushTrip(tripId: string) {
  const timer = timers.get(tripId);
  if (!timer) return;
  if (escrowNowMs() < timer.settleFromMs) return;
  if (flushing.has(tripId)) return;
  flushing.add(tripId);
  cancelEscrowFinalize(tripId);
  try {
    const { operatorFinalizeTrip } = await import("./payment.service.js");
    await operatorFinalizeTrip(tripId);
  } finally {
    flushing.delete(tripId);
  }
}

export async function rehydrateEscrowFinalizeTimers() {
  const settling = await prisma.trip.findMany({
    where: { paymentStatus: "SETTLING", escrowStartTx: { not: null } },
    select: { id: true, escrowSettleFrom: true },
  });
  for (const trip of settling) {
    const settleFromMs = trip.escrowSettleFrom?.getTime() ?? escrowNowMs();
    await scheduleEscrowFinalize(trip.id, settleFromMs);
  }
}

export async function findTripIdByHash(tripIdHashHex: string) {
  const needle = tripIdHashHex.toLowerCase();
  const trips = await prisma.trip.findMany({
    where: {
      paymentStatus: { in: ["PENDING", "ESCROWED", "SETTLING", "DISPUTED"] },
    },
    select: { id: true },
  });
  for (const trip of trips) {
    if (hashTripId(trip.id) === needle) return trip.id;
  }
  return null;
}
