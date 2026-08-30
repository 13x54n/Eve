# Eve

Community ride-matching marketplace. Riders request a trip, drivers send fare offers, the rider accepts a match, and payment happens off-platform (for example cash). Eve records a **suggested fare** and the **matched fare** for audit. It does not collect ride payments and does not take commission. Vehicle types: bike and car.

## Repository

```
Eve/
  rider/     Expo 57 rider app — auth, request, offers, tracking, history
  driver/    Expo 57 driver app — onboarding, presence, offers, trip lifecycle, earnings
  admin/     Next.js 16 console — dashboard, riders, drivers, trips, vehicles, pricing, safety, support
  monitor/   Next.js 16 liveness board — API/frontend ping, memory, host performance
  backend/   API: npm workspaces (packages, services, gateway) + Prisma/Postgres
```

## Architecture

Clients talk only to the **gateway** on port **4000**. Admin HTTP lives on the gateway. Auth, location, ride, and notify can run in-process or as separate services.

```
  rider / driver / admin
            │
            ▼
     gateway :4000
            │
     ┌──────┼──────────────┐
     ▼      ▼       ▼      ▼
  auth    location  ride  notify     Postgres
  :4001   :4002     :4003 :4004
```

**Compose mode** (`GATEWAY_MODE=compose`, default): one Node process mounts all routers. Use `npm run dev` in `backend/`.

**Proxy mode** (`GATEWAY_MODE=proxy`): gateway forwards `/api/auth`, `/api/driver`, `/api/rider`, and `/socket.io` to the services and keeps `/api/admin` local. Use `npm run dev:split` in `backend/`.

Details (routing, env, internal HTTP, production start): **[backend/docs/gateway.md](backend/docs/gateway.md)**.

Public prefixes (both modes):

| Prefix | Purpose |
| --- | --- |
| `/api/health` | Health check |
| `/api/auth` | Rider and admin auth |
| `/api/driver` | Driver auth, presence, trips, earnings |
| `/api/rider` | Rider trips and offer accept |
| `/api/admin` | Staff console (RBAC) |
| `/socket.io` | Realtime (notify) |

### Backend packages and services

| Package / service | Role |
| --- | --- |
| `@eve/db` | Prisma client |
| `@eve/http` | Express app, CORS, auth middleware |
| `@eve/shared` | JWT, passwords, permissions |
| `@eve/auth` | Register / login / password reset (`AUTH_PORT`, default 4001) |
| `@eve/location` | Driver presence (`LOCATION_PORT`, default 4002) |
| `@eve/ride` | Matching, offers, trip lifecycle (`RIDE_PORT`, default 4003) |
| `@eve/notify` | Notifications + Socket.IO (`NOTIFY_PORT`, default 4004) |
| `@eve/gateway` | Compose or proxy entrypoint (`PORT`, default 4000) |

## Prerequisites

- Node 22+
- npm
- Docker (Postgres, or the full backend stack)

## Local setup

### 1. Database

From `backend/`, start Postgres only:

```bash
docker compose up postgres -d
```

Default compose credentials: user `eve`, password `eve`, database `eve` on `localhost:5432`.

Or start auth, location, ride, notify, and gateway together (`GATEWAY_MODE=proxy` is set on the gateway service):

```bash
docker compose up
```

### 2. Backend env

Create `backend/.env` (not in git). Required:

```
DATABASE_URL=postgresql://eve:eve@localhost:5432/eve
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
```

Optional:

| Variable | When |
| --- | --- |
| `PORT` | Gateway listen port (default `4000`) |
| `GATEWAY_MODE` | `compose` or `proxy` |
| `AUTH_URL`, `LOCATION_URL`, `RIDE_URL`, `NOTIFY_URL` | Proxy mode service bases |
| `AUTH_PORT`, `LOCATION_PORT`, `RIDE_PORT`, `NOTIFY_PORT` | Split-process listen ports |
| `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_DRIVER_FOLDER` | Driver document upload auth |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API (default `http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:8081`, `http://127.0.0.1:8081`). Native apps omit `Origin` and are allowed through. Production example: `CORS_ORIGINS=https://admin.example.com` |

### 3. Install, migrate, seed

```bash
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Run the API

In-process (compose) — typical local default:

```bash
cd backend
npm run dev
```

Gateway: `http://localhost:4000`. Health: `GET /api/health`.

Split processes (proxy gateway + four services):

```bash
cd backend
npm run dev:split
```

Tests:

```bash
cd backend
npm test
```

### 5. Apps

Point clients at the gateway **`/api`** base. On a phone or simulator, use your machine’s LAN IP instead of `localhost`.

`rider/.env` and `driver/.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:4000/api
```

`admin/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

```bash
cd rider && npm install && npm start
cd driver && npm install && npm start
cd admin && npm install && npm run dev
```

Admin console: [http://localhost:3000](http://localhost:3000).

Monitor (separate from admin):

```bash
cd monitor && npm install && npm run dev
```

Liveness board: [http://localhost:3010](http://localhost:3010). Probes gateway `/api/health`, optional split-service ports, and frontend origins. See `monitor/.env.example`.

Restart Expo after changing `EXPO_PUBLIC_*` env vars.

Store release (App Store / Play, TestFlight, EAS identifiers): see [`STORE.md`](STORE.md).

## Seed users (local only)

After `npm run db:seed`, password for all seeded accounts is `Admin123!`.

| Role | Email |
| --- | --- |
| Admin owner | `owner@eve.local` |
| Operations | `ops@eve.local` |
| Finance | `finance@eve.local` |
| Support | `support@eve.local` |
| Safety | `safety@eve.local` |
| Rider | `amina@example.com`, `luis@example.com`, `priya@example.com`, `noah@example.com` |
| Driver | `jordan.driver@example.com`, `elena.driver@example.com`, `chris.driver@example.com` |

Do not use these credentials outside local development.

## Apps in more detail

**Rider** — request a trip with a suggested fare, review driver offers, accept a match, track, complete, ride history.

**Driver** — register, vehicle and documents, go online, incoming trips, send offers, pickup / start / complete, earnings.

**Admin** — staff login with roles (`OWNER`, `OPERATIONS`, `FINANCE`, `SUPPORT`, `SAFETY`). Suggested-fare configs and zones; trip and offer audit; driver approval; safety and support. No in-app commission or rider payment collection.
