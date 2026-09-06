# Eve Wiki

This page is the architecture-oriented entry point for the Eve repository. Eve is a
community ride-matching marketplace: riders request trips, drivers submit fare
offers, and riders accept a match. Eve records the suggested and matched fares but
does not collect ride payments or take commission.

## Contents

- [System at a glance](#system-at-a-glance)
- [Repository map](#repository-map)
- [Runtime architecture](#runtime-architecture)
- [Core request flows](#core-request-flows)
- [Backend services](#backend-services)
- [Data and infrastructure](#data-and-infrastructure)
- [Client applications](#client-applications)
- [Authentication and authorization](#authentication-and-authorization)
- [Reliability and real-time behavior](#reliability-and-real-time-behavior)
- [Local development](#local-development)
- [Documentation map](#documentation-map)

## System at a glance

Eve is a monorepo with four client-facing applications and a split Node.js
backend:

```text
Rider app ───────┐
Driver app ──────┼──> Auth, Ride, Notify services
Admin console ───┘    └──> Admin service (and Ride/Notify)
Marketing site ───────────> static/public web experience

Auth, Ride, Admin, Location, Notify ──> PostgreSQL
Ride and Location ────────────────────> Redis
Ride/Admin ── gRPC/HTTP ──> Location/Notify
```

Clients call the backend services directly. There is no central HTTP gateway.
The admin console uses Next.js rewrites to proxy browser requests to the backend
services during development and deployment.

## Repository map

| Directory | Responsibility |
| --- | --- |
| `backend/` | npm-workspaces backend, Prisma schema, migrations, packages, services, and tests |
| `rider/` | Expo mobile application for passengers |
| `driver/` | Expo mobile application for drivers |
| `admin/` | Next.js operations and support console |
| `www/` | Next.js public marketing site |
| `e2e/` | Mobile E2E guidance; current mobile tests are Jest-based |
| Root `*.md` | Shared setup, architecture, security, deployment, and contributor documentation |

## Runtime architecture

### Service endpoints

| Service | Default port | Main responsibility |
| --- | ---: | --- |
| Auth | `4001` | Privy exchange, JWTs, admin login, profiles, sessions |
| Location | `4002` | GPS state, H3 indexing, nearby-driver/trip queries |
| Ride | `4003` | Trips, offers, fares, lifecycle, driver presence HTTP |
| Notify | `4004` | Socket.IO connections and event broadcasting |
| Admin | `4005` | Staff operations API, RBAC, audit, support, safety, and configuration |

Location also exposes its gRPC server on `50051` by default. All services expose
`/health`.

### Internal packages

| Package | Purpose |
| --- | --- |
| `@eve/db` | Prisma client, database access, fare and profile helpers |
| `@eve/http` | Express application setup, CORS, auth, validation, and shared middleware |
| `@eve/shared` | JWT, password, permission, cache, distance, serialization, and treasury utilities |
| `@eve/grpc` | Protocol Buffer and gRPC client/server helpers |

### Communication model

- Clients use HTTP for authentication, trip management, admin operations, and
  health checks.
- Rider and driver clients use Socket.IO on Notify for live trip, offer,
  location, and chat events.
- Ride calls Location and Notify through gRPC when available, with HTTP and
  local fallbacks where implemented.
- Internal HTTP calls are protected with `X-Internal-Secret`.

## Core request flows

### Rider requests a trip

1. The rider authenticates with Privy and exchanges the identity token for an
   Eve JWT.
2. Ride creates a `SEARCHING` trip and calculates the suggested fare.
3. Location indexes the pickup in Redis using an H3 cell.
4. Location finds nearby online drivers using H3 plus an exact Haversine filter.
5. Notify broadcasts `trip-request:new` to eligible drivers.

### Driver offers and rider accepts

1. A driver views nearby searching trips and submits an offer.
2. Ride validates the driver's eligibility and proximity, then stores the offer.
3. Notify sends `offer:new` to the rider.
4. The rider accepts one offer.
5. Ride assigns the driver, removes the trip from the geo index, marks the
   driver as on-trip, creates the chat room, and emits `trip:assigned`.

### Trip lifecycle

```text
SEARCHING → ASSIGNED → DRIVER_ARRIVING → IN_PROGRESS → COMPLETED
     └─────────────── or any active state ───────────────→ CANCELLED
```

PostgreSQL is the source of truth for trip state and audit history. Redis is an
operational index and cache; it can be rebuilt or bypassed with slower database
matching.

## Backend services

### Auth

Mobile apps authenticate through Privy (SMS, passkeys, or supported identity
providers). Auth verifies the Privy identity token, resolves or creates the Eve
user/profile, and issues an Eve JWT. Admin staff use email/password login with
role-based permissions and sessions.

### Location

Driver positions and searching trips are indexed in Redis H3 sets. The query
algorithm expands nearby cells, unions candidate IDs, applies a precise
distance filter, validates records in PostgreSQL, and sorts by distance.
Driver clients send location updates frequently; Redis is updated for
responsiveness while PostgreSQL writes are throttled.

### Ride

Ride owns the marketplace domain: trip creation, suggested fares, offers,
acceptance, assignment, status transitions, cancellation, history, driver
presence routes, trip chat, and driver wallet operations.

### Notify

Notify authenticates Socket.IO connections with JWTs and manages user, trip, and
admin rooms. Other services call its internal emit API or gRPC helpers to
broadcast events without sharing socket state.

### Admin

Admin exposes the staff API used by the operations console. It covers users,
drivers, vehicles, trips, offers, pricing, zones, greetings, notifications,
support, safety, audit logs, staff, and wallet-related operations.

## Data and infrastructure

- **PostgreSQL 16** stores users, profiles, trips, offers, events, messages,
  configuration, audit records, and wallet ledger data.
- **Prisma** defines the schema and migrations in `backend/prisma/`.
- **Redis 7** provides H3 geo sets, position hashes, presence state, and
  short-lived caches.
- **Docker Compose** runs PostgreSQL, Redis, migrations, and the five backend
  services. Mobile apps run on the host because they require Expo/native tooling.
- Fare configuration is stored in PostgreSQL and cached in Redis with a
  configurable TTL.

## Client applications

### Rider app

The Expo app handles Privy authentication, location selection, trip requests,
driver offers, acceptance, live tracking, trip chat, history, support, and
courier tracking.

### Driver app

The Expo app handles authentication, vehicle and document onboarding, online
presence, incoming trip requests, fare offers, navigation/trip status, earnings,
support, and Eve Wallet cash-out.

### Admin console

The Next.js console provides authenticated staff views for the dashboard,
riders, drivers, vehicles, trips, pricing, support, safety, greetings, and
staff administration. Permissions are enforced by backend roles as well as
client navigation.

### Marketing site

`www/` is an independent Next.js public site. It does not require the backend
and is deployed separately from the transactional applications.

## Authentication and authorization

- Mobile identity starts with Privy; backend APIs use Eve-issued JWTs.
- JWT claims include the user ID, role, session type, and expiry.
- Admin sessions use staff roles such as `OWNER`, `OPERATIONS`, `FINANCE`,
  `SUPPORT`, and `SAFETY`.
- API routes use shared auth and role middleware from `@eve/http` and
  `@eve/shared`.
- Never commit `.env` files, private keys, JWT secrets, or seeded credentials.

## Reliability and real-time behavior

- Redis failures can fall back to PostgreSQL-backed matching.
- gRPC calls can fall back to internal HTTP and, where supported, local
  matching.
- Socket.IO clients reconnect automatically; mobile apps also persist selected
  trip/session state and queue supported mutations while offline.
- PostgreSQL remains authoritative when caches, indexes, or realtime delivery
  are unavailable.

## Local development

1. Start PostgreSQL and Redis with `cd backend && docker compose up postgres redis -d`.
2. Copy `backend/.env.example` to `backend/.env` and set the required secrets.
3. From `backend/`, run `npm install`, `npm run db:generate`,
   `npm run db:migrate`, and `npm run db:seed`.
4. Start all services with `npm run dev`.
5. Start `admin/`, `rider/`, or `driver/` separately with their app-specific
   environment files and commands.

Useful checks:

```bash
cd backend
npm test
npm run build
npm run db:validate
```

## Documentation map

- [Architecture overview](ARCHITECTURE.md) — detailed diagrams and service/package reference
- [Getting started](GETTING_STARTED.md) — complete local setup
- [API documentation](API_DOCUMENTATION.md) — API and route reference
- [Environment variables](ENVIRONMENT_VARIABLES.md) — configuration reference
- [Deployment](DEPLOYMENT.md) — production deployment
- [Testing](TESTING.md) — backend, admin, mobile, and load tests
- [Security](SECURITY.md) — security practices and reporting
- [Offline resilience](OFFLINE_RESILIENCE.md) — mobile offline behavior
- [Backend services](backend/docs/services.md) — service internals and data flows
- [Authentication](backend/docs/auth.md) — Privy and admin authentication
- [H3 matchmaking](backend/docs/h3-matchmaking.md) — geo-index details
- [gRPC](backend/docs/grpc.md) — service-to-service communication
- [Docker](backend/docs/docker.md) — backend container workflow
- [Rider README](rider/README.md), [Driver README](driver/README.md), [Admin README](admin/README.md)

Keep this page focused on stable architecture. Put endpoint-level or
implementation-specific details in the linked documents so the wiki remains a
useful map of the system.
