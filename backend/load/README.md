# Backend load tests (k6)

Stress ride (`npm run dev`, port 4003) against the same Postgres you use locally. These scripts are not part of `npm test`.

## Prerequisites

- Postgres migrated and seeded
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed (`brew install k6`)
Scripts hit auth `:4001`, ride `:4003`, payment `:4006`, admin `:4005`, location `:4002`, and notify `:4004`. Set `LOAD_ESCROW=1` on the payment process (no live contract) so lifecycle can confirm a synthetic deposit hash. Set `LOAD_TESTING=1` on every service so k6 is not blocked by 15-minute IP rate limiters (never set that in production). Password `POST /api/auth/login` is still used by `auth.js` / seed tokens. Rider and driver **apps** use Privy instead.

## Commands

```bash
npm run load:seed          # creates load-*@eve-load.test users and load/.tokens.json
k6 run -e AUTH_URL=http://localhost:4001 load/auth.js
k6 run load/services-health.js
k6 run load/payment-wallet.js
k6 run load/admin-dashboard.js
npm run load:smoke         # health then a short lifecycle run (needs LOAD_ESCROW=1)
npm run load:all           # health, auth, payment, admin, presence, search, offers, lifecycle, matchmaking, capacity
npm run load:capacity      # ramp GET /health until latency or errors break
npm run load:cleanup       # deletes @eve-load.test users, trips, offers, ledger
```

## Capacity (max requests / second)

`lifecycle.js` is a ride flow, not a throughput test: one rider cannot hold two active trips, so it collapses into 409s. Use `capacity.js` to see how many HTTP requests ride can take at once.

With services on `npm run dev`:

```bash
npm run load:capacity
```

That ramps from 200 toward 4000 requests/second against `GET /health` (no auth, no trip rules). Watch:

| Metric | Meaning |
| --- | --- |
| `http_reqs` rate | What the server actually served |
| `http_req_duration` p95 | When this climbs past ~500ms, you are saturating |
| `http_req_failed` | Errors / non-2xx |
| `dropped_iterations` | k6 could not open enough VUs to hit the target rate |

The ceiling is the last stage where fail rate stays near 0 and p95 stays healthy — not the `PEAK_RATE` you asked for if thresholds fail.

Raise the target if the laptop still looks idle:

```bash
k6 run -e BASE_URL=http://localhost:4003 -e PEAK_RATE=8000 load/capacity.js
```

This is the Node/health ceiling. It is not trip-create throughput. Do not use `POST /api/rider/trips` for “max RPS”; use `lifecycle.js` or `search-storm.js` for that path.

Optional: `LOAD_COUNT=50 npm run load:seed`

Start at **20 VUs / 1m**, then **50 VUs / 2m**.

## Scripts

| File | Service | Purpose |
|---|---|---|
| `services-health.js` | all six | Smoke `GET /health` |
| `geo-notify-health.js` | location, notify | Health on `:4002` / `:4004` |
| `health.js` | ride | Smoke `GET /health` |
| `auth.js` | auth `:4001` | Login/me bursts (429 only if `LOAD_TESTING` is unset) |
| `payment-wallet.js` | payment `:4006` | Config + rider/driver wallets |
| `admin-dashboard.js` | admin `:4005` | Staff login + dashboard |
| `search-storm.js` | ride | Many `POST /api/rider/trips` |
| `offer-market.js` | ride | Incoming + offers; **409 is expected** (one pending offer) |
| `lifecycle.js` | ride + payment | Create → offer → accept → escrow confirm → start → complete |
| `presence.js` | ride | GPS/presence patches (location throttle is 15s; not every ping persists) |
| `matchmaking-geo.js` | ride + location | Cross-city create/incoming/cancel |

Treat 409s on the offer market as expected (one pending offer per driver). With `LOAD_TESTING=1`, auth/payment 429s should not appear. `load:all` uses a lighter capacity ramp (`PEAK_RATE=400` unless overridden). Tune `http_req_duration` after a baseline.

Never point these scripts at a database you cannot wipe of `@eve-load.test` rows.
