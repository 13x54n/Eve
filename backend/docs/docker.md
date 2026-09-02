# Docker (local split stack)

Postgres, Redis, a one-shot Prisma migrate job, and five Node processes (auth, location, ride, notify, gateway) on one Compose network. The gateway runs in **proxy** mode. Clients should use `http://localhost:4000`. The admin app needs `NEXT_PUBLIC_API_URL=http://localhost:4000/api` (not a relative `/api`). Restart `next dev` after changing it.

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

`docker-compose.yml` overrides `DATABASE_URL`, `REDIS_URL`, and service URLs to Docker DNS names (`postgres`, `redis`, `auth`, …). Keep localhost values in `.env` for host-side `npm run dev` / `dev:split`.

## Health

| URL | Service |
| --- | --- |
| `http://localhost:4000/api/health` | gateway |
| `http://localhost:4001/health` | auth |
| `http://localhost:4002/health` | location |
| `http://localhost:4003/health` | ride |
| `http://localhost:4004/health` | notify |

## Common commands

```bash
docker compose down
docker compose down -v          # also drop Postgres/Redis volumes
docker compose logs -f gateway
docker compose exec gateway npx prisma studio
docker compose exec gateway npm run db:seed
docker compose exec postgres psql -U eve -d eve
```

Migrations run automatically via the `migrate` service on `up`. After changing dependencies, rebuild: `docker compose up --build`.
