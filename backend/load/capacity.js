import http from "k6/http";
import { check } from "k6";
import { baseUrl } from "./lib.js";

const path = __ENV.PATH || "/health";
const startRate = Number(__ENV.START_RATE || 200);
const peakRate = Number(__ENV.PEAK_RATE || 4000);

export const options = {
  scenarios: {
    capacity: {
      executor: "ramping-arrival-rate",
      startRate,
      timeUnit: "1s",
      preAllocatedVUs: Number(__ENV.PRE_VUS || 100),
      maxVUs: Number(__ENV.MAX_VUS || 800),
      stages: [
        { duration: "15s", target: startRate },
        { duration: "20s", target: Math.round(peakRate * 0.25) },
        { duration: "20s", target: Math.round(peakRate * 0.5) },
        { duration: "20s", target: Math.round(peakRate * 0.75) },
        { duration: "30s", target: peakRate },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function capacity() {
  const res = http.get(`${baseUrl()}${path}`);
  check(res, { "status 200": (r) => r.status === 200 });
}
