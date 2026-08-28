import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { baseUrl, jsonHeaders, loadTokens, tripBody } from "./lib.js";

const pairs = new SharedArray("pairs", () => loadTokens().pairs);

export const options = {
  vus: 20,
  duration: "1m",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2500"],
  },
};

export default function lifecycle() {
  const pair = pairs[(__VU - 1) % pairs.length];
  const root = baseUrl();

  const created = http.post(`${root}/api/rider/trips`, tripBody(), jsonHeaders(pair.riderToken));
  const createdOk = check(created, { "trip created": (r) => r.status === 201 });
  if (!createdOk) {
    return;
  }
  const trip = created.json("trip");

  const incoming = http.get(`${root}/api/driver/trips/incoming`, jsonHeaders(pair.driverToken));
  check(incoming, { "incoming 200": (r) => r.status === 200 });

  const offer = http.post(
    `${root}/api/driver/trips/${trip.id}/offers`,
    JSON.stringify({ proposedFare: trip.fareTotal, etaMinutes: 5 }),
    jsonHeaders(pair.driverToken),
  );
  const offerOk = check(offer, { "offer created": (r) => r.status === 201 });
  if (!offerOk) {
    return;
  }

  const accepted = http.post(
    `${root}/api/rider/trips/${trip.id}/offers/${offer.json("offer.id")}/accept`,
    null,
    jsonHeaders(pair.riderToken),
  );
  check(accepted, { "offer accepted": (r) => r.status === 200 });

  http.post(`${root}/api/driver/trips/${trip.id}/arrived`, null, jsonHeaders(pair.driverToken));
  const started = http.post(`${root}/api/driver/trips/${trip.id}/start`, null, jsonHeaders(pair.driverToken));
  check(started, { "trip started": (r) => r.status === 200 });

  const completed = http.post(
    `${root}/api/driver/trips/${trip.id}/complete`,
    JSON.stringify({}),
    jsonHeaders(pair.driverToken),
  );
  check(completed, { "trip completed": (r) => r.status === 200 });
  sleep(0.5);
}
