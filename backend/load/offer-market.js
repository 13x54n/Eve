import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { baseUrl, cancelActiveTrip, jsonHeaders, loadTokens, tripBody } from "./lib.js";

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

  cancelActiveTrip(root, pair.riderToken);
  const created = http.post(`${root}/api/rider/trips`, tripBody(), jsonHeaders(pair.riderToken));
  const trip = created.status === 201 ? created.json("trip") : null;
  check(created, { "trip created": (r) => r.status === 201 });

  const incoming = http.get(`${root}/api/driver/trips/incoming`, jsonHeaders(pair.driverToken));
  check(incoming, { "incoming 200": (r) => r.status === 200 });

  if (!trip) {
    sleep(0.2);
    return;
  }

  const offer = http.post(
    `${root}/api/driver/trips/${trip.id}/offers`,
    JSON.stringify({ proposedFare: trip.fareTotal, etaMinutes: 5 }),
    jsonHeaders(pair.driverToken),
  );
  check(offer, {
    "offer 201 or 409": (r) => r.status === 201 || r.status === 409,
  });
  cancelActiveTrip(root, pair.riderToken);
  sleep(0.3);
}
