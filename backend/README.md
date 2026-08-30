# Eve backend

API gateway and services (auth, location, ride, notify) on Postgres. npm workspaces: `packages/*`, `services/*`, `gateway`.

Clients talk only to the **gateway** on port **4000**. You can run everything in one process (**compose**) or as four services behind a proxy (**split**).

See **[docs/gateway.md](docs/gateway.md)** for modes, routing, env vars, and how to start compose vs split.

## Scripts (from `backend/`)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Compose gateway (`GATEWAY_MODE=compose`) |
| `npm run dev:split` | Proxy gateway + auth, location, ride, notify |
| `npm start` | Compiled gateway (`gateway/dist/server.js`) |
| `npm test` | Vitest (compose app) |
| `npm run db:generate` / `db:migrate` / `db:seed` | Prisma |

## Matchmaking geo

Nearby drivers and searching trips are indexed in Redis GEO (geohash sorted sets) and queried with `GEOSEARCH` by radius. Postgres stays the source of truth.

See **[docs/redis-geosearch-matchmaking.md](docs/redis-geosearch-matchmaking.md)** for keys, write paths, fallback, and how to change the **25 km** match radius (`MATCH_RADIUS_KM`).
