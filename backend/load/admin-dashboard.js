import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { adminUrl, authUrl, jsonHeaders, loadTokens } from "./lib.js";

const tokens = new SharedArray("admin-tokens", () => [loadTokens()]);

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "20s",
  thresholds: {
    checks: ["rate>0.85"],
  },
};

export default function adminDashboard() {
  const data = tokens[0];
  const root = adminUrl();
  http.setResponseCallback(http.expectedStatuses(200, 401, 429));

  const login = http.post(
    `${authUrl()}/api/auth/admin/login`,
    JSON.stringify({
      email: data.adminEmail || "load-admin@eve-load.test",
      password: data.adminPassword || data.password,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(login, {
    "admin login 200 or 429": (r) => r.status === 200 || r.status === 429,
  });

  const token = data.adminToken || login.json("accessToken");
  if (!token) {
    sleep(0.2);
    return;
  }

  const dash = http.get(`${root}/api/admin/dashboard`, jsonHeaders(token));
  check(dash, { "dashboard 200 or 429": (r) => r.status === 200 || r.status === 429 });
  sleep(0.3);
}
