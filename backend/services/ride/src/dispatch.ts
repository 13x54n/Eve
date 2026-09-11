import { prisma } from "@eve/db";
import { DISPATCH_SECONDS, money } from "@eve/shared";

export function dispatchExpiresAt(from = new Date()) {
  return new Date(from.getTime() + DISPATCH_SECONDS * 1000);
}

export async function createTripDispatches(tripId: string, driverIds: string[]) {
  const unique = [...new Set(driverIds)].filter(Boolean);
  if (unique.length === 0) return dispatchExpiresAt();
  const expiresAt = dispatchExpiresAt();
  await prisma.tripDispatch.createMany({
    data: unique.map((driverId) => ({ tripId, driverId, expiresAt })),
    skipDuplicates: true,
  });
  return expiresAt;
}

export async function refreshAcceptanceRate(driverId: string) {
  const counts = await prisma.tripDispatch.groupBy({
    by: ["status"],
    where: {
      driverId,
      voided: false,
      status: { in: ["ACCEPTED", "DECLINED", "EXPIRED"] },
    },
    _count: { _all: true },
  });
  const accepted = counts.find((row) => row.status === "ACCEPTED")?._count._all ?? 0;
  const declined = counts.find((row) => row.status === "DECLINED")?._count._all ?? 0;
  const expired = counts.find((row) => row.status === "EXPIRED")?._count._all ?? 0;
  const total = accepted + declined + expired;
  const acceptanceRate = total === 0 ? 0 : money((accepted / total) * 100);
  await prisma.driverProfile.update({
    where: { id: driverId },
    data: { acceptanceRate },
  });
  return acceptanceRate;
}

export async function expireTimedOutDispatches(driverId?: string) {
  const expired = await prisma.tripDispatch.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: new Date() },
      ...(driverId ? { driverId } : {}),
    },
    select: { id: true, driverId: true },
  });
  if (expired.length === 0) return;
  await prisma.tripDispatch.updateMany({
    where: { id: { in: expired.map((row) => row.id) } },
    data: { status: "EXPIRED" },
  });
  await Promise.all([...new Set(expired.map((row) => row.driverId))].map(refreshAcceptanceRate));
}

export async function voidPendingDispatches(tripId: string) {
  await prisma.tripDispatch.updateMany({
    where: { tripId, status: "PENDING" },
    data: { status: "EXPIRED", voided: true },
  });
}

export function serializeActiveDispatch(row: {
  expiresAt: Date;
  trip: {
    id: string;
    bookingCode: string;
    riderName?: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    distanceKm: number;
    durationMin: number;
    fareTotal: number;
    minFare?: number;
    vehicleType: string;
    rideType: string;
    recipientName: string | null;
  };
}) {
  return {
    tripId: row.trip.id,
    bookingCode: row.trip.bookingCode,
    riderName: row.trip.riderName ?? "Rider",
    pickupAddress: row.trip.pickupAddress,
    dropoffAddress: row.trip.dropoffAddress,
    pickupLat: row.trip.pickupLat,
    pickupLng: row.trip.pickupLng,
    dropoffLat: row.trip.dropoffLat,
    dropoffLng: row.trip.dropoffLng,
    distanceKm: money(row.trip.distanceKm),
    durationMin: row.trip.durationMin,
    fareTotal: money(row.trip.fareTotal),
    minFare: money(row.trip.minFare ?? 0),
    vehicleType: row.trip.vehicleType,
    rideType: row.trip.rideType,
    recipientName: row.trip.recipientName,
    expiresAt: row.expiresAt.toISOString(),
  };
}
