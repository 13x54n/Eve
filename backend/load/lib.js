export const PICKUP = { lat: 40.7128, lng: -74.006 };
export const DROPOFF = { lat: 40.758, lng: -73.9855 };

export function baseUrl() {
  return __ENV.BASE_URL || "http://localhost:4003";
}

export function jsonHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

export function tripBody() {
  return JSON.stringify({
    pickupAddress: "Pickup St",
    dropoffAddress: "Dropoff Ave",
    city: "New York",
    pickupLat: PICKUP.lat,
    pickupLng: PICKUP.lng,
    dropoffLat: DROPOFF.lat,
    dropoffLng: DROPOFF.lng,
    vehicleType: "CAR",
  });
}

export function loadTokens() {
  return JSON.parse(open("./.tokens.json"));
}
