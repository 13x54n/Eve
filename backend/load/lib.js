import http from "k6/http";

export const PICKUP = { lat: 40.7128, lng: -74.006 };
export const DROPOFF = { lat: 40.758, lng: -73.9855 };

export function rideUrl() {
  return __ENV.RIDE_URL || __ENV.BASE_URL || "http://localhost:4003";
}

export function baseUrl() {
  return rideUrl();
}

export function authUrl() {
  return __ENV.AUTH_URL || "http://localhost:4001";
}

export function locationUrl() {
  return __ENV.LOCATION_URL || "http://localhost:4002";
}

export function notifyUrl() {
  return __ENV.NOTIFY_URL || "http://localhost:4004";
}

export function adminUrl() {
  return __ENV.ADMIN_URL || "http://localhost:4005";
}

export function paymentUrl() {
  return __ENV.PAYMENT_URL || "http://localhost:4006";
}

export function serviceUrls() {
  return [
    { name: "auth", url: authUrl() },
    { name: "location", url: locationUrl() },
    { name: "ride", url: rideUrl() },
    { name: "notify", url: notifyUrl() },
    { name: "admin", url: adminUrl() },
    { name: "payment", url: paymentUrl() },
  ];
}

export function jsonHeaders(token, extra = {}) {
  const { name, city, tags, ...rest } = extra;
  const requestTags = { ...tags };
  if (name) requestTags.name = name;
  if (city) requestTags.city = city;
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(Object.keys(requestTags).length ? { tags: requestTags } : {}),
    ...rest,
  };
}

export function tripBody(market) {
  const pickup = market?.pickup || PICKUP;
  const dropoff = market?.dropoff || DROPOFF;
  return JSON.stringify({
    pickupAddress: "Pickup St",
    dropoffAddress: "Dropoff Ave",
    city: market?.city || "New York",
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    dropoffLat: dropoff.lat,
    dropoffLng: dropoff.lng,
    vehicleType: "CAR",
  });
}

export function loadTokens() {
  return JSON.parse(open("./.tokens.json"));
}

export function fakeTxHash(seed) {
  const src = `${seed}:${Date.now()}:${Math.random()}`;
  let hex = "";
  for (let i = 0; i < src.length; i += 1) {
    hex += src.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return `0x${hex.slice(0, 64).padEnd(64, "a")}`;
}

export function marketForPair(_pair) {
  return { city: "New York", pickup: PICKUP, dropoff: DROPOFF };
}

export function cancelActiveTrip(root, riderToken, extra = {}) {
  const active = http.get(`${root}/api/rider/trips/active`, jsonHeaders(riderToken, extra));
  const trip = active.status === 200 ? active.json("trip") : null;
  if (trip && trip.id) {
    http.post(
      `${root}/api/rider/trips/${trip.id}/cancel`,
      null,
      jsonHeaders(riderToken, extra),
    );
  }
}
