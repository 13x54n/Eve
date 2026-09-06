import http from "k6/http";
import { check } from "k6";
import { serviceUrls } from "./lib.js";

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "15s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

export default function servicesHealth() {
  for (const service of serviceUrls()) {
    const res = http.get(`${service.url}/health`);
    check(res, {
      [`${service.name} health 200`]: (r) => r.status === 200 && r.json("status") === "ok",
      [`${service.name} reports name`]: (r) => r.json("service") === service.name,
    });
  }
}
