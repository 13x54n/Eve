import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { baseUrl, jsonHeaders, loadTokens, PICKUP } from "./lib.js";

const pairs = new SharedArray("pairs", () => loadTokens().pairs);

export const options = {
  vus: 20,
  duration: "1m",
  thresholds: {
    http_req_failed: ["rate<0.05"],
  },
};

export default function presence() {
  const pair = pairs[(__VU - 1) % pairs.length];
  const jitter = (__VU * 0.0001);
  const res = http.patch(
    `${baseUrl()}/api/driver/presence`,
    JSON.stringify({
      presence: "ONLINE",
      latitude: PICKUP.lat + jitter,
      longitude: PICKUP.lng,
    }),
    jsonHeaders(pair.driverToken),
  );
  check(res, { "presence 200": (r) => r.status === 200 });
  sleep(0.25);
}
