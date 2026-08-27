import { prisma } from "../config/prisma.js";
import { money } from "./serialize.js";

export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(toLat - fromLat);
  const longitudeDelta = radians(toLng - fromLng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(fromLat)) * Math.cos(radians(toLat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function durationMinutes(distance: number) {
  return Math.max(5, Math.ceil(distance / 0.45));
}

export async function calculateFare(city: string, vehicleType: "BIKE" | "CAR", distance: number, duration: number) {
  const config = await prisma.fareConfig.findFirst({
    where: { city, vehicleType, status: "ACTIVE", effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });
  const baseFare = config ? money(config.baseFare) : vehicleType === "BIKE" ? 4 : 8;
  const perKm = config ? money(config.perKm) : vehicleType === "BIKE" ? 0.8 : 1.5;
  const perMinute = config ? money(config.perMinute) : 0.25;
  const minFare = config ? money(config.minFare) : baseFare;
  const bookingFee = config ? money(config.bookingFee) : 1;
  const surge = config ? money(config.surgeMultiplier) : 1;
  return Math.max(minFare, (baseFare + distance * perKm + duration * perMinute + bookingFee) * surge);
}
