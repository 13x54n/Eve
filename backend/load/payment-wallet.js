import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { jsonHeaders, loadTokens, paymentUrl } from "./lib.js";

const pairs = new SharedArray("pairs", () => loadTokens().pairs);

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "20s",
  thresholds: {
    checks: ["rate>0.9"],
  },
};

export default function paymentWallet() {
  const pair = pairs[(__VU - 1) % pairs.length];
  const root = paymentUrl();
  http.setResponseCallback(http.expectedStatuses(200, 429));

  const config = http.get(`${root}/api/payment/config`, jsonHeaders(pair.riderToken));
  check(config, { "payment config 200 or 429": (r) => r.status === 200 || r.status === 429 });

  const rider = http.get(`${root}/api/rider/wallet`, jsonHeaders(pair.riderToken));
  check(rider, { "rider wallet 200 or 429": (r) => r.status === 200 || r.status === 429 });

  const driver = http.get(`${root}/api/driver/wallet`, jsonHeaders(pair.driverToken));
  check(driver, { "driver wallet 200 or 429": (r) => r.status === 200 || r.status === 429 });
  sleep(0.2);
}
