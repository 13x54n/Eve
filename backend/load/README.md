# Backend load tests (k6)

Stress the **compose** gateway (`npm run dev`, port 4000) against the same Postgres you use locally. These scripts are not part of `npm test`.

## Prerequisites

- Postgres migrated and seeded
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed (`brew install k6`)
- Gateway running: `npm run dev` in `backend/`
- `JWT_ACCESS_SECRET` in `.env` (seed writes JWTs with that secret)

## Commands

```bash
npm run load:seed          # creates load-*@eve-load.test users and load/.tokens.json
k6 run -e BASE_URL=http://localhost:4000 load/health.js
k6 run -e BASE_URL=http://localhost:4000 load/lifecycle.js
npm run load:smoke         # health then a short lifecycle run
npm run load:cleanup       # deletes @eve-load.test users, trips, offers, ledger
```

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
