# Docker (local split stack)

Postgres, Redis, a one-shot Prisma migrate job, and five Node processes (auth, location, ride, notify, admin) on one Compose network.

This stack is **backend-only**. `Dockerfile.dev` does not install the Android SDK, Xcode, or Expo. Rider and driver apps stay on the host (or [EAS](../../STORE.md)) so you can open them in the iOS Simulator or Android Emulator later.

Clients:

- Rider/driver (iOS Simulator, or Android with `adb reverse`): `EXPO_PUBLIC_AUTH_URL=http://localhost:4001/api`, `EXPO_PUBLIC_API_URL=http://localhost:4003/api`, `EXPO_PUBLIC_WS_URL=http://localhost:4004`
- Rider/driver (Android Emulator without reverse): use `http://10.0.2.2:4001/api` (and `4003` / `4004`) — `10.0.2.2` is the emulator’s alias for the host
- Physical device: your machine’s LAN IP instead of `localhost`
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

## Mobile apps and emulators (host)

Keep Metro and `expo run:*` on the machine that has Xcode / Android Studio. Compose only needs to publish 4001, 4003, and 4004 (and 4002/4005 if you hit them directly).

### iOS Simulator

The simulator shares the Mac’s localhost, so the `.env.example` URLs work as-is:

```bash
cd rider   # or driver
cp .env.example .env
npx expo run:ios
```

### Android Emulator

Either map emulator ports to the host:

```bash
adb reverse tcp:4001 tcp:4001
adb reverse tcp:4003 tcp:4003
adb reverse tcp:4004 tcp:4004
```

and keep `localhost` in `EXPO_PUBLIC_*`, **or** set:

```bash
EXPO_PUBLIC_AUTH_URL=http://10.0.2.2:4001/api
EXPO_PUBLIC_API_URL=http://10.0.2.2:4003/api
EXPO_PUBLIC_WS_URL=http://10.0.2.2:4004
```

Then:

```bash
cd rider   # or driver
npx expo run:android
```

### Physical device

Use the LAN IP of the host that is running Compose (same Wi-Fi). `localhost` and `10.0.2.2` will not reach the backend from a phone.
