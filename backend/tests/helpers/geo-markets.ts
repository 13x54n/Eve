export type LatLng = { lat: number; lng: number };

export type GeoMarket = {
  id: string;
  city: string;
  pickup: LatLng;
  dropoff: LatLng;
};

/** Six markets pairwise far beyond MATCH_RADIUS_KM (25). */
export const GEO_MARKETS: GeoMarket[] = [
  {
    id: "new-york",
    city: "New York",
    pickup: { lat: 40.7128, lng: -74.006 },
    dropoff: { lat: 40.758, lng: -73.9855 },
  },
  {
    id: "london",
    city: "London",
    pickup: { lat: 51.5074, lng: -0.1278 },
    dropoff: { lat: 51.5155, lng: -0.0922 },
  },
  {
    id: "tokyo",
    city: "Tokyo",
    pickup: { lat: 35.6762, lng: 139.6503 },
    dropoff: { lat: 35.6812, lng: 139.7671 },
  },
  {
    id: "sao-paulo",
    city: "Sao Paulo",
    pickup: { lat: -23.5505, lng: -46.6333 },
    dropoff: { lat: -23.5617, lng: -46.656 },
  },
  {
    id: "nairobi",
    city: "Nairobi",
    pickup: { lat: -1.2921, lng: 36.8219 },
    dropoff: { lat: -1.303, lng: 36.834 },
  },
  {
    id: "sydney",
    city: "Sydney",
    pickup: { lat: -33.8688, lng: 151.2093 },
    dropoff: { lat: -33.8523, lng: 151.2108 },
  },
];

/** Unused by seed / NYC tests — safe for MATCH_LIMIT. */
export const PERTH: GeoMarket = {
  id: "perth",
  city: "Perth",
  pickup: { lat: -31.9523, lng: 115.8613 },
  dropoff: { lat: -31.978, lng: 115.859 },
};

/** Unused isolated market for radius in/out. */
export const REYKJAVIK: GeoMarket = {
  id: "reykjavik",
  city: "Reykjavik",
  pickup: { lat: 64.1466, lng: -21.9426 },
  dropoff: { lat: 64.128, lng: -21.895 },
};

export const ANTIMERIDIAN: GeoMarket = {
  id: "antimeridian",
  city: "Dateline",
  pickup: { lat: 0, lng: 179.9 },
  dropoff: { lat: 0, lng: 179.7 },
};

export const ANTIMERIDIAN_NEAR_DRIVER: LatLng = { lat: 0, lng: -179.9 };
export const ANTIMERIDIAN_FAR_DRIVER: LatLng = { lat: 0, lng: 170 };

export function offsetKm(lat: number, lng: number, northKm: number, eastKm: number): LatLng {
  const dLat = northKm / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng = eastKm / (111.32 * (Math.abs(cosLat) < 0.01 ? 0.01 : cosLat));
  return { lat: lat + dLat, lng: lng + dLng };
}

export function marketTripPayload(market: GeoMarket, overrides: Record<string, unknown> = {}) {
  return {
    pickupAddress: `${market.city} Pickup`,
    dropoffAddress: `${market.city} Dropoff`,
    city: market.city,
    pickupLat: market.pickup.lat,
    pickupLng: market.pickup.lng,
    dropoffLat: market.dropoff.lat,
    dropoffLng: market.dropoff.lng,
    vehicleType: "CAR" as const,
    ...overrides,
  };
}
