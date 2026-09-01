# Backend load tests (k6)

Stress the **compose** gateway (`npm run dev`, port 4000) against the same Postgres you use locally. These scripts are not part of `npm test`.

## Prerequisites

- Postgres migrated and seeded
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed (`brew install k6`)
- Gateway running: `npm run dev` in `backend/`
- `JWT_ACCESS_SECRET` in `.env` (seed writes JWTs with that secret)
- Password `POST /api/auth/login` is still used by `auth.js` / seed tokens. Rider and driver **apps** use Auth0 instead; see [docs/auth.md](../docs/auth.md).

## Commands

```bash
npm run load:seed          # creates load-*@eve-load.test users and load/.tokens.json
k6 run -e BASE_URL=http://localhost:4000 load/health.js
k6 run -e BASE_URL=http://localhost:4000 load/lifecycle.js
npm run load:smoke         # health then a short lifecycle run
npm run load:capacity      # ramp GET /api/health until latency or errors break
npm run load:cleanup       # deletes @eve-load.test users, trips, offers, ledger
```

## Capacity (max requests / second)

`lifecycle.js` is a ride flow, not a throughput test: one rider cannot hold two active trips, so it collapses into 409s. Use `capacity.js` to see how many HTTP requests the gateway can take at once.

With the gateway on `npm run dev`:

```bash
npm run load:capacity
```

That ramps from 200 toward 4000 requests/second against `GET /api/health` (no auth, no trip rules). Watch:

| Metric | Meaning |
| --- | --- |
| `http_reqs` rate | What the server actually served |
| `http_req_duration` p95 | When this climbs past ~500ms, you are saturating |
| `http_req_failed` | Errors / non-2xx |
| `dropped_iterations` | k6 could not open enough VUs to hit the target rate |

The ceiling is the last stage where fail rate stays near 0 and p95 stays healthy — not the `PEAK_RATE` you asked for if thresholds fail.

Raise the target if the laptop still looks idle:

```bash
k6 run -e BASE_URL=http://localhost:4000 -e PEAK_RATE=8000 load/capacity.js
```

This is the Node/health ceiling. It is not trip-create throughput. Do not use `POST /api/rider/trips` for “max RPS”; use `lifecycle.js` or `search-storm.js` for that path.

Optional: `LOAD_COUNT=50 npm run load:seed`

Start at **20 VUs / 1m**, then **50 VUs / 2m**. Compose is a single Node process.

## Scripts

| File | Purpose |
|---|---|
| `health.js` | Smoke `GET /api/health` |
| `auth.js` | Login/me bursts; **429 is expected** (auth limiter is 20/15m) |
| `search-storm.js` | Many `POST /api/rider/trips` |
| `offer-market.js` | Incoming + offers; **409 is expected** (one pending offer) |
| `lifecycle.js` | Create → offer → accept → start → complete |
| `presence.js` | GPS/presence patches (location throttle is 15s; not every ping persists) |

Treat 409s on the offer market and 429s on auth as expected, not as SLO failures. Tune `http_req_duration` thresholds after a baseline run.

Never point these scripts at a database you cannot wipe of `@eve-load.test` rows.
