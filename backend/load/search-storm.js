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

export default function searchStorm() {
  const pair = pairs[(__VU - 1) % pairs.length];
  const res = http.post(`${baseUrl()}/api/rider/trips`, tripBody(), jsonHeaders(pair.riderToken));
  check(res, { "trip created": (r) => r.status === 201 });
  sleep(0.3);
}
