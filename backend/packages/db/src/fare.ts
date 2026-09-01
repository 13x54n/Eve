import { prisma } from "./prisma.js";
import { money } from "@eve/shared";

async function activeFareConfig(city: string, vehicleType: "BIKE" | "CAR") {
  return prisma.fareConfig.findFirst({
    where: { city, vehicleType, status: "ACTIVE", effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });
}

export async function getMinFare(city: string, vehicleType: "BIKE" | "CAR") {
  const config = await activeFareConfig(city, vehicleType);
  if (config) return money(config.minFare);
  return vehicleType === "BIKE" ? 4 : 8;
}

export async function calculateFare(
  city: string,
  vehicleType: "BIKE" | "CAR",
  distance: number,
  duration: number,
) {
  const config = await activeFareConfig(city, vehicleType);
  const baseFare = config ? money(config.baseFare) : vehicleType === "BIKE" ? 4 : 8;
  const perKm = config ? money(config.perKm) : vehicleType === "BIKE" ? 0.8 : 1.5;
  const perMinute = config ? money(config.perMinute) : 0.25;
  const minFare = config ? money(config.minFare) : baseFare;
  const bookingFee = config ? money(config.bookingFee) : 1;
  const surge = config ? money(config.surgeMultiplier) : 1;
  return Math.max(minFare, (baseFare + distance * perKm + duration * perMinute + bookingFee) * surge);
}
