import http from "k6/http";
import { check } from "k6";
import { locationUrl, notifyUrl } from "./lib.js";

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "15s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
  },
};

export default function geoNotifyHealth() {
  const loc = http.get(`${locationUrl()}/health`);
  check(loc, { "location health": (r) => r.status === 200 });

  const ntfy = http.get(`${notifyUrl()}/health`);
  check(ntfy, { "notify health": (r) => r.status === 200 });
}
