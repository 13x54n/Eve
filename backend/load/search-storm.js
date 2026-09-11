import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { baseUrl, cancelActiveTrip, jsonHeaders, loadTokens, tripBody } from "./lib.js";

const pairs = new SharedArray("pairs", () => loadTokens().pairs);

export const options = {
  vus: 20,
  duration: "1m",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2500"],
  },
};

export default function searchStorm() {
  const pair = pairs[(__VU - 1) % pairs.length];
  const root = baseUrl();
  http.setResponseCallback(http.expectedStatuses(200, 201, 409));
  cancelActiveTrip(root, pair.riderToken);
  const res = http.post(`${root}/api/rider/trips`, tripBody(), jsonHeaders(pair.riderToken));
  const trip = res.status === 201 ? res.json("trip") : null;
  check(res, { "trip created": (r) => r.status === 201 });
  if (trip && trip.id) {
    http.post(`${root}/api/rider/trips/${trip.id}/cancel`, null, jsonHeaders(pair.riderToken));
  }
  sleep(0.3);
}
