import { prisma } from "./prisma.js";
import { money, cache } from "@eve/shared";

async function activeFareConfig(city: string, vehicleType: "BIKE" | "CAR") {
  // Try cache first
  const cacheKey = `fare:config:${city}:${vehicleType}`;
  const cached = await cache.hGetAll(cacheKey);
  
  if (Object.keys(cached).length > 0) {
    return {
      baseFare: Number(cached.baseFare),
      perKm: Number(cached.perKm),
      perMinute: Number(cached.perMinute),
      minFare: Number(cached.minFare),
      bookingFee: Number(cached.bookingFee),
      surgeMultiplier: Number(cached.surgeMultiplier),
    };
  }
  
  // Cache miss: query database
  const config = await prisma.fareConfig.findFirst({
    where: { city, vehicleType, status: "ACTIVE", effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });
  
  // Cache the result for 24 hours
  if (config) {
    await cache.hSetAll(cacheKey, {
      baseFare: String(config.baseFare),
      perKm: String(config.perKm),
      perMinute: String(config.perMinute),
      minFare: String(config.minFare),
      bookingFee: String(config.bookingFee),
      surgeMultiplier: String(config.surgeMultiplier),
    });
    await cache.expire(cacheKey, 86400); // 24 hours
  }
  
  return config;
}

export async function getMinFare(city: string, vehicleType: "BIKE" | "CAR") {
  // Try specific min fare cache first
  const minFareKey = `fare:min:${city}:${vehicleType}`;
  const cachedMinFare = await cache.get(minFareKey);
  
  if (cachedMinFare) {
    return Number(cachedMinFare);
  }
  
  const config = await activeFareConfig(city, vehicleType);
  const minFare = config ? money(config.minFare) : vehicleType === "BIKE" ? 4 : 8;
  
  // Cache min fare separately for quick lookups
  await cache.set(minFareKey, String(minFare), 86400); // 24 hours
  
  return minFare;
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

/**
 * Invalidate fare cache for a specific city and vehicle type
 */
export async function invalidateFareCache(city: string, vehicleType: "BIKE" | "CAR") {
  await cache.del(
    `fare:config:${city}:${vehicleType}`,
    `fare:min:${city}:${vehicleType}`
  );
}
