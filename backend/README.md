# Eve backend

API gateway and services (auth, location, ride, notify) on Postgres. npm workspaces: `packages/*`, `services/*`, `gateway`.

Clients talk only to the **gateway** on port **4000**. You can run everything in one process (**compose**) or as four services behind a proxy (**split**).

## Quick Start

### With Docker (recommended)

From `backend/`:

```bash
cp .env.example .env
# Set JWT_ACCESS_SECRET (required)

docker compose up --build
```

Gateway: `http://localhost:4000`. See **[docs/docker.md](docs/docker.md)** for health URLs, logs, and seed.

### Without Docker

See **[docs/gateway.md](docs/gateway.md)** for modes, routing, env vars, and how to start compose vs split. See **[docs/auth.md](docs/auth.md)** for Auth0 (rider/driver) and admin password login.

## Scripts (from `backend/`)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Compose gateway (`GATEWAY_MODE=compose`) |
| `npm run dev:split` | Proxy gateway + auth, location, ride, notify |
| `npm start` | Compiled gateway (`gateway/dist/server.js`) |
| `npm test` | Vitest (compose app) |
| `npm run db:generate` / `db:migrate` / `db:seed` | Prisma |

## Matchmaking geo

Nearby drivers and searching trips are indexed in Uber H3 cells (Redis sets) and queried with `gridDisk` plus a Haversine radius filter. Postgres stays the source of truth.

See **[docs/h3-matchmaking.md](docs/h3-matchmaking.md)** for keys, write paths, fallback, and how to change the **15 km** match radius (`MATCH_RADIUS_KM`).
