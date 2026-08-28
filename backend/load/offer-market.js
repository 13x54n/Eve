import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { baseUrl, jsonHeaders, loadTokens, tripBody } from "./lib.js";

const pairs = new SharedArray("pairs", () => loadTokens().pairs);

export const options = {
  vus: 20,
  duration: "1m",
  thresholds: {
    checks: ["rate>0.9"],
  },
};

export default function offerMarket() {
  const pair = pairs[(__VU - 1) % pairs.length];
  const root = baseUrl();
  http.setResponseCallback(http.expectedStatuses(200, 201, 409));

  http.post(`${root}/api/rider/trips`, tripBody(), jsonHeaders(pair.riderToken));

  const incoming = http.get(`${root}/api/driver/trips/incoming`, jsonHeaders(pair.driverToken));
  check(incoming, { "incoming 200": (r) => r.status === 200 });

  const trips = incoming.json("trips") || [];
  if (trips.length === 0) {
    sleep(0.2);
    return;
  }

  const trip = trips[0];
  const offer = http.post(
    `${root}/api/driver/trips/${trip.id}/offers`,
    JSON.stringify({ proposedFare: trip.fareTotal, etaMinutes: 5 }),
    jsonHeaders(pair.driverToken),
  );
  check(offer, {
    "offer 201 or 409": (r) => r.status === 201 || r.status === 409,
  });
  sleep(0.3);
}
