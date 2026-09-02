# Docker (local split stack)

Postgres, Redis, a one-shot Prisma migrate job, and five Node processes (auth, location, ride, notify, admin) on one Compose network.

Clients:

- Rider/driver: `EXPO_PUBLIC_AUTH_URL=http://localhost:4001/api`, `EXPO_PUBLIC_API_URL=http://localhost:4003/api`, `EXPO_PUBLIC_WS_URL=http://localhost:4004`
- Admin: `NEXT_PUBLIC_API_URL=/api` with per-service proxy targets (see `admin/next.config.ts`)

Restart `next dev` after changing env.

## Files

- `Dockerfile.dev` — Node 22 workspace image (Prisma generate, `tsx` watch)
- `docker-compose.yml` — local stack
- `.dockerignore` — keeps `prisma/migrations` and `package-lock.json` in the build context

## Start

From `backend/`:

```bash
cp .env.example .env
# Set JWT_ACCESS_SECRET (and any ImageKit/SMTP values you need)

docker compose up --build
```

`docker-compose.yml` overrides `DATABASE_URL`, `REDIS_URL`, and gRPC hosts to Docker DNS names (`postgres`, `redis`, `location`, `notify`). Keep localhost values in `.env` for host-side `npm run dev`.

## Health

| URL | Service |
| --- | --- |
| `http://localhost:4001/health` | auth |
| `http://localhost:4002/health` | location |
| `http://localhost:4003/health` | ride |
| `http://localhost:4004/health` | notify |
| `http://localhost:4005/health` | admin |

## Common commands

```bash
docker compose down
docker compose down -v          # also drop Postgres/Redis volumes
docker compose logs -f ride
docker compose exec auth npx prisma studio
docker compose exec auth npm run db:seed
docker compose exec postgres psql -U eve -d eve
```

Migrations run automatically via the `migrate` service on `up`. After changing dependencies, rebuild: `docker compose up --build`.
