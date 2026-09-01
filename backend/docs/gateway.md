# Gateway: compose vs split

Clients (rider, driver, admin) talk only to the **gateway** on port **4000**. Auth, location, ride, and notify can run in the same Node process (**compose**) or as four services behind an HTTP proxy (**split** / **proxy**).

Admin HTTP always lives on the gateway. Tests import the compose app from [`gateway/src/app.ts`](../gateway/src/app.ts).

## Workspace

npm workspaces under `backend/`:

| Package | Role |
| --- | --- |
| `@eve/db` | Prisma client |
| `@eve/http` | Express base app, CORS, auth middleware, health payload |
| `@eve/shared` | JWT, passwords, permissions |
| `@eve/auth` | Auth0 ID-token exchange, admin login, leftover password routes |
| `@eve/location` | Driver presence and matchmaking geo |
| `@eve/ride` | Matching, offers, trip lifecycle |
| `@eve/notify` | Notifications + Socket.IO |
| `@eve/gateway` | Compose or proxy entrypoint |

```
  rider / driver / admin
            │
            ▼
     gateway :4000
            │
     ┌──────┼──────────────┐
     ▼      ▼       ▼      ▼
  auth    location  ride  notify     Postgres / Redis
  :4001   :4002     :4003 :4004
```

In compose mode the four services are modules inside the gateway process, not separate listeners.

## Modes

`GATEWAY_MODE` is read in [`gateway/src/server.ts`](../gateway/src/server.ts). Default is `compose`. Any other value than `proxy` uses compose.

| Mode | Factory | When |
| --- | --- | --- |
| `compose` | [`createComposeApp`](../gateway/src/compose-app.ts) | Local default, tests |
| `proxy` | [`createProxyApp`](../gateway/src/proxy-app.ts) | `npm run dev:split`, multi-process deploy |

### Compose

One HTTP server:

- Mounts public routers: `/api/auth`, `/api/driver` (auth + presence + ride), `/api/rider`, `/api/public`, `/api/admin`.
- Attaches Socket.IO on the same server (`attachRealtime` from `@eve/notify`).
- Rebuilds matchmaking geo indexes on listen.
- Ride and notify call location **in-process** when `LOCATION_URL` is unset ([`services/location/src/client.ts`](../services/location/src/client.ts)).
- Emits use the in-process Socket.IO server when it is attached ([`services/notify/src/emit.ts`](../services/notify/src/emit.ts)).

### Proxy (split)

The gateway does **not** attach Socket.IO. It forwards HTTP (and `/socket.io` WebSockets) to the service URLs. `AUTH_URL`, `LOCATION_URL`, `RIDE_URL`, and `NOTIFY_URL` are **required**; the process throws at startup if any is missing.

Ride (and notify) should set `LOCATION_URL` and `NOTIFY_URL` so matchmaking and emits go over HTTP `/internal/*` instead of local functions.

## Public routing

Same prefixes in both modes. Clients always use the gateway, not the service ports.

| Prefix | Purpose |
| --- | --- |
| `/api/health` | Gateway health (`service: "gateway"`) |
| `/api/auth` | Rider/driver Auth0 exchange, admin login, `/me` |
| `/api/driver` | Driver auth, presence, trips, earnings |
| `/api/rider` | Rider trips and offer accept |
| `/api/public` | Public ride routes |
| `/api/admin` | Staff console (always on the gateway) |
| `/socket.io` | Realtime (notify) |

### Proxy path map

Order matters for `/api/driver`:

| Path | Target |
| --- | --- |
| `/api/auth` | auth |
| `/api/driver/register`, `/api/driver/login`, `/api/driver/auth0` | auth |
| `/api/driver/presence` | location |
| `/api/rider`, `/api/public`, remaining `/api/driver` | ride |
| `/socket.io` | notify (`ws: true`) |
| `/api/admin` | local gateway |

### Internal HTTP (split only)

Not exposed on the public gateway:

| Service | Path | Used by |
| --- | --- | --- |
| location | `/internal/*` (nearby, geo index, distance, …) | ride / notify via `LOCATION_URL` |
| notify | `/internal/emit` | ride via `NOTIFY_URL` when Socket.IO is not in-process |

Each split service also serves **`GET /health`** on its own port (not `/api/health`).

## How to run

From `backend/` after `npm install`, `npm run db:generate`, migrate, and seed.

| Mode | Command | Listen |
| --- | --- | --- |
| Compose | `npm run dev` | gateway `:4000` only |
| Split | `npm run dev:split` | gateway `:4000` plus auth `:4001`, location `:4002`, ride `:4003`, notify `:4004` |
| One service | `npm run dev -w @eve/auth` (or `@eve/location`, `@eve/ride`, `@eve/notify`) | that service’s port |

`dev:split` only sets `GATEWAY_MODE=proxy` and `PORT=4000` on the gateway process. **Service URLs must be in `backend/.env`.**

Production-style (after `npm run build`):

```bash
npm start                          # compose gateway (GATEWAY_MODE default)
GATEWAY_MODE=proxy npm start       # proxy gateway; start the four services too
npm start -w @eve/auth             # one compiled service
```

[`docker-compose.yml.temp`](../docker-compose.yml.temp) is the intended split stack (Postgres, Redis, four services, proxy gateway). It is not currently named `docker-compose.yml`.

## Environment

Required for any mode:

```
DATABASE_URL=postgresql://eve:eve@localhost:5432/eve
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
```

Required for rider/driver Auth0 exchange (`POST /api/auth/auth0`, `/api/auth/driver/auth0`):

```
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_native_app_client_id
```

Auth setup, callback URLs, and how the Eve JWT is issued: **[auth.md](auth.md)**.

Split / proxy (`backend/.env`):

```
GATEWAY_MODE=proxy
PORT=4000
AUTH_URL=http://localhost:4001
LOCATION_URL=http://localhost:4002
RIDE_URL=http://localhost:4003
NOTIFY_URL=http://localhost:4004
AUTH_PORT=4001
LOCATION_PORT=4002
RIDE_PORT=4003
NOTIFY_PORT=4004
REDIS_URL=redis://localhost:6379
```

`LOCATION_URL` and `NOTIFY_URL` on the **ride** (and notify) processes are what switch clients from in-process calls to HTTP. Leave them unset in compose so everything stays in one process.

| Variable | Role |
| --- | --- |
| `PORT` | Gateway listen port (default `4000`) |
| `GATEWAY_MODE` | `compose` or `proxy` |
| `AUTH_URL`, `LOCATION_URL`, `RIDE_URL`, `NOTIFY_URL` | Proxy targets; also location/notify HTTP clients |
| `AUTH_PORT`, `LOCATION_PORT`, `RIDE_PORT`, `NOTIFY_PORT` | Split-process listen ports |
| `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID` | Auth0 Native app (ID-token verification) |

## Health and monitor

- Gateway: `GET http://localhost:4000/api/health`
- Split services: `GET http://localhost:4001/health` … `:4004/health`

The monitor board (`monitor/`) probes the gateway always. Set `MONITOR_REQUIRE_SPLIT=1` when running `npm run dev:split` so auth/location/ride/notify health is required. See [`monitor/README.md`](../../monitor/README.md).
