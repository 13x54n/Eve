import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Trend } from "k6/metrics";
import { baseUrl, jsonHeaders, loadTokens, marketForPair, tripBody } from "./lib.js";

const pairs = new SharedArray("pairs", () => loadTokens().pairs);

const createTrend = new Trend("match_create", true);
const incomingTrend = new Trend("match_incoming", true);

export const options = {
  vus: 20,
  duration: "1m",
  thresholds: {
    checks: ["rate>0.9"],
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2500"],
    match_create: ["p(95)<2500"],
    match_incoming: ["p(95)<2500"],
  },
};

function cancelActive(root, riderToken, city) {
  const active = http.get(
    `${root}/api/rider/trips/active`,
    jsonHeaders(riderToken, { city, name: "ActiveTrip" }),
  );
  const trip = active.status === 200 ? active.json("trip") : null;
  if (trip && trip.id) {
    http.post(
      `${root}/api/rider/trips/${trip.id}/cancel`,
      null,
      jsonHeaders(riderToken, { city, name: "CancelTrip" }),
    );
  }
}

export default function matchmakingGeo() {
  const pair = pairs[(__VU - 1) % pairs.length];
  const market = marketForPair(pair);
  const city = market.city;
  const root = baseUrl();
  http.setResponseCallback(http.expectedStatuses(200, 201, 409));

  cancelActive(root, pair.riderToken, city);

  const created = http.post(
    `${root}/api/rider/trips`,
    tripBody(market),
    jsonHeaders(pair.riderToken, { city, name: "CreateTrip" }),
  );
  createTrend.add(created.timings.duration, { city });
  const createdOk = check(created, {
    "trip created": (r) => r.status === 201,
  });
  if (!createdOk) {
    sleep(0.3);
    return;
  }

  const trip = created.json("trip");

  const incoming = http.get(
    `${root}/api/driver/trips/incoming`,
    jsonHeaders(pair.driverToken, { city, name: "IncomingTrips" }),
  );
  incomingTrend.add(incoming.timings.duration, { city });
  const trips = incoming.json("trips") || [];
  check(incoming, {
    "incoming 200": (r) => r.status === 200,
    "same-city trip in incoming": () => trips.some((row) => row.id === trip.id),
  });

  if (trips.some((row) => row.id === trip.id)) {
    const offer = http.post(
      `${root}/api/driver/trips/${trip.id}/offers`,
      JSON.stringify({ proposedFare: trip.fareTotal, etaMinutes: 5 }),
      jsonHeaders(pair.driverToken, { city, name: "CreateOffer" }),
    );
    check(offer, {
      "offer 201 or 409": (r) => r.status === 201 || r.status === 409,
    });
  }

  http.post(
    `${root}/api/rider/trips/${trip.id}/cancel`,
    null,
    jsonHeaders(pair.riderToken, { city, name: "CancelTrip" }),
  );
  sleep(0.3);
}
