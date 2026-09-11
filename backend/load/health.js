import http from "k6/http";
import { check } from "k6";
import { baseUrl } from "./lib.js";

export const options = {
  vus: 5,
  duration: "20s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function health() {
  const res = http.get(`${baseUrl()}/health`);
  check(res, { "health is ok": (r) => r.status === 200 && r.json("status") === "ok" });
}
