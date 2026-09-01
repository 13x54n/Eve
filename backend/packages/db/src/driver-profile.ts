import { prisma } from "./prisma.js";
import { money, startOfDay } from "@eve/shared";

export function sanitizeDriverUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  city: string | null;
  accountStatus: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    city: user.city,
    accountStatus: user.accountStatus,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

const driverProfileInclude = {
  user: true,
  vehicles: true,
  documents: { orderBy: { type: "asc" as const } },
  fleetCompany: true,
  trips: {
    where: {
      status: { in: ["ASSIGNED" as const, "ONGOING" as const] },
    },
    include: {
      rider: { include: { user: true } },
      vehicle: true,
      stops: { orderBy: { sequence: "asc" as const } },
    },
    take: 1,
  },
};

export async function getDriverProfile(userId: string) {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    include: driverProfileInclude,
  });

  if (!profile) {
    const error = new Error("Driver account not found");
    error.name = "NotFoundError";
    throw error;
  }

  const today = startOfDay();
  const todayTrips = await prisma.trip.findMany({
    where: {
      driverId: profile.id,
      status: "COMPLETED",
      createdAt: { gte: today },
    },
  });

  const todayEarnings = todayTrips.reduce(
    (acc, trip) => acc + Number(trip.fareTotal),
    0,
  );

  return {
    id: profile.id,
    userId: profile.userId,
    user: sanitizeDriverUser(profile.user),
    approvalStatus: profile.approvalStatus,
    presence: profile.presence,
    rating: money(profile.rating),
    acceptanceRate: money(profile.acceptanceRate),
    cancellationRate: money(profile.cancellationRate),
    onlineHours: money(profile.onlineHours),
    earningsTotal: money(profile.earningsTotal),
    city: profile.city || profile.user.city || "New York",
    lat: profile.latitude,
    lng: profile.longitude,
    vehicles: profile.vehicles,
    activeVehicle: profile.vehicles[0] || null,
    documents: profile.documents,
    activeTrip: profile.trips[0]
      ? {
          ...profile.trips[0],
          fareTotal: money(profile.trips[0].fareTotal),
          suggestedFare: money(profile.trips[0].suggestedFare),
          distanceKm: money(profile.trips[0].distanceKm),
          stops: profile.trips[0].stops ?? [],
          rider: profile.trips[0].rider
            ? { ...profile.trips[0].rider, rating: money(profile.trips[0].rider.rating) }
            : profile.trips[0].rider,
        }
      : null,
    todayStats: {
      earnings: Number(todayEarnings.toFixed(2)),
      completedTrips: todayTrips.length,
      onlineHours: 0,
    },
  };
}
