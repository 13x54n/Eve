# Eve backend

Auth, location, ride, notify, admin, and payment as separate Node processes on Postgres and Redis. npm workspaces: `packages/*`, `services/*`.

Clients call services directly:

| App | HTTP | WebSocket |
| --- | --- | --- |
| Rider / driver | Auth `:4001`, ride `:4003`, payment `:4006` | Notify `:4004` |
| Admin console | Auth `:4001`, admin `:4005`, ride `:4003`, payment `:4006` (Next rewrites) | Notify `:4004` |

Location HTTP is health-only (`:4002`); matchmaking uses gRPC on **50051**.

## Quick Start

### With Docker (recommended)

From `backend/`:

```bash
cp .env.example .env
# Set JWT_ACCESS_SECRET (required)

docker compose up --build
```

The `migrate` service generates Prisma Client, applies all pending migrations, and must exit with code 0 before the six application services start. See **[docs/docker.md](docs/docker.md)** for health URLs, logs, seed, recovery from an existing database volume, and host emulator networking. Rider/driver apps are not in Compose. Arc USDC escrow and wallets: **[docs/driver-wallet.md](docs/driver-wallet.md)**.

### Without Docker

Run Postgres and Redis, install dependencies, generate Prisma Client, apply migrations, and seed the database before starting the services:

```bash
cd backend
cp .env.example .env
npm install
docker compose up postgres redis -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run db:migrate` updates the database selected by `backend/.env`. This may be the shared Prisma Postgres database rather than the local Docker Postgres container. Check `npx prisma migrate status` if a service reports a missing column, then run `npx prisma migrate deploy` and restart `npm run dev`.

See **[docs/auth.md](docs/auth.md)** for Privy (rider/driver) and admin password login.

## Scripts (from `backend/`)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Auth, location, ride, notify, admin, payment (`tsx` watch) |
| `npm start` | Compiled six services |
| `npm test` | Vitest (in-process test app) |
| `npm run db:generate` / `db:migrate` / `db:seed` | Prisma |

## Matchmaking geo

Nearby drivers and searching trips are indexed in Uber H3 cells (Redis sets) and queried with `gridDisk` plus a Haversine radius filter. Postgres stays the source of truth.

See **[docs/h3-matchmaking.md](docs/h3-matchmaking.md)** for keys, write paths, fallback, and how to change the **15 km** match radius (`MATCH_RADIUS_KM`).
