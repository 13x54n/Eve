# Eve backend

Auth, location, ride, notify, and admin as separate Node processes on Postgres and Redis. npm workspaces: `packages/*`, `services/*`.

Clients call services directly:

| App | HTTP | WebSocket |
| --- | --- | --- |
| Rider / driver | Auth `:4001`, ride `:4003` | Notify `:4004` |
| Admin console | Auth `:4001`, admin `:4005`, ride `:4003` (Next rewrites) | Notify `:4004` |

Location HTTP is health-only (`:4002`); matchmaking uses gRPC on **50051**.

## Quick Start

### With Docker (recommended)

From `backend/`:

```bash
cp .env.example .env
# Set JWT_ACCESS_SECRET (required)

docker compose up --build
```

See **[docs/docker.md](docs/docker.md)** for health URLs, logs, seed, and host emulator networking. Rider/driver apps are not in Compose. Driver wallet cash-out: **[docs/driver-wallet.md](docs/driver-wallet.md)**.

### Without Docker

Run Postgres and Redis, then from `backend/`: `npm run dev` (starts all five services). See **[docs/auth.md](docs/auth.md)** for Privy (rider/driver) and admin password login.

## Scripts (from `backend/`)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Auth, location, ride, notify, admin (`tsx` watch) |
| `npm start` | Compiled five services |
| `npm test` | Vitest (in-process test app) |
| `npm run db:generate` / `db:migrate` / `db:seed` | Prisma |

## Matchmaking geo

Nearby drivers and searching trips are indexed in Uber H3 cells (Redis sets) and queried with `gridDisk` plus a Haversine radius filter. Postgres stays the source of truth.

See **[docs/h3-matchmaking.md](docs/h3-matchmaking.md)** for keys, write paths, fallback, and how to change the **15 km** match radius (`MATCH_RADIUS_KM`).
