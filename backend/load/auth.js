import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { baseUrl, jsonHeaders, loadTokens } from "./lib.js";

const tokens = new SharedArray("tokens", () => {
  const data = loadTokens();
  return data.pairs.map((pair) => ({
    email: pair.riderEmail,
    password: data.password,
    token: pair.riderToken,
  }));
});

export const options = {
  vus: 20,
  duration: "30s",
  thresholds: {
    checks: ["rate>0.9"],
  },
};

export default function auth() {
  const account = tokens[(__VU - 1) % tokens.length];
  const root = baseUrl();
  http.setResponseCallback(http.expectedStatuses(200, 401, 429));

  const login = http.post(
    `${root}/api/auth/login`,
    JSON.stringify({ email: account.email, password: account.password }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(login, {
    "login 200 or 429": (r) => r.status === 200 || r.status === 429,
  });

  const me = http.get(`${root}/api/auth/me`, jsonHeaders(account.token));
  check(me, { "me 200": (r) => r.status === 200 });
  sleep(0.2);
}
