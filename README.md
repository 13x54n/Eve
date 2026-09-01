# Eve

[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![Expo](https://img.shields.io/badge/Expo-57-000020.svg)](https://expo.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)

Community ride-matching marketplace. Riders request a trip, drivers send fare offers, the rider accepts a match, and payment happens off-platform (for example cash). Eve records a **suggested fare** and the **matched fare** for audit. It does not collect ride payments and does not take commission. Vehicle types: bike and car.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Local Setup](#local-setup)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

Eve is a full-stack ride-matching platform featuring:
- **Real-time matching** using Uber H3 geospatial indexing
- **Microservices architecture** with optional gRPC support
- **Native mobile apps** for riders and drivers (iOS/Android)
- **Admin dashboard** for operations and support
- **Auth0 integration** for secure authentication
- **WebSocket** real-time updates for live tracking

## Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 22+ | Runtime environment |
| TypeScript | 5.9+ | Type-safe development |
| Express | 5.x | HTTP server framework |
| Prisma | 7.9+ | ORM and database migrations |
| PostgreSQL | 16 | Primary database |
| Redis | 7 | Caching and geospatial indexing |
| Socket.IO | 4.x | Real-time communication |
| gRPC | @grpc/grpc-js | Inter-service communication (optional) |

### Frontend - Mobile Apps
| Technology | Version | Purpose |
|------------|---------|---------|
| Expo | 57 | React Native framework |
| React Native | 0.76+ | Mobile UI framework |
| Auth0 | react-native-auth0 | Authentication |
| Mapbox | @rnmapbox/maps | Maps and navigation |
| TypeScript | 5.9+ | Type-safe development |

### Frontend - Web Apps
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | React framework |
| React | 19 | UI library |
| TypeScript | 5.9+ | Type-safe development |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | Latest | Component library |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Local development orchestration |
| Husky | Git hooks |
| Vitest | Backend testing |
| Playwright | E2E testing |
| k6 | Load testing |

## Repository

```
Eve/
  rider/     Expo 57 rider app — Auth0, request, offers, tracking, history
  driver/    Expo 57 driver app — Auth0, onboarding, presence, offers, trip lifecycle, earnings
  admin/     Next.js 16 console — dashboard, riders, drivers, trips, vehicles, pricing, safety, support
  monitor/   Next.js 16 liveness board — API/frontend ping, memory, host performance
  backend/   API: npm workspaces (packages, services, gateway) + Prisma/Postgres
```

## Architecture

Eve uses a **microservices architecture** where all clients communicate with a central gateway that routes requests to specialized services. The gateway can run in two modes:

### System Architecture

```mermaid
graph TB
    subgraph Clients["Client Applications"]
        Rider[Rider App<br/>iOS/Android]
        Driver[Driver App<br/>iOS/Android]
        Admin[Admin Console<br/>Next.js]
        Monitor[Monitor Dashboard<br/>Next.js]
    end

    subgraph Gateway["API Gateway :4000"]
        GW[Gateway Service<br/>Routing & Admin API]
    end

    subgraph Services["Microservices"]
        Auth[Auth Service :4001<br/>Authentication & JWT]
        Location[Location Service :4002<br/>GPS & Geo-matching]
        Ride[Ride Service :4003<br/>Trips & Offers]
        Notify[Notify Service :4004<br/>Real-time Events]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL 16<br/>Primary Database)]
        RD[(Redis 7<br/>Cache & Geo Index)]
    end

    Rider --> GW
    Driver --> GW
    Admin --> GW
    Monitor --> GW

    GW --> Auth
    GW --> Location
    GW --> Ride
    GW --> Notify

    Auth --> PG
    Location --> PG
    Location --> RD
    Ride --> PG
    Ride --> RD
    Ride -.Internal HTTP/gRPC.-> Location
    Ride -.Internal HTTP/gRPC.-> Notify
    Notify --> PG
    Notify -.Internal HTTP/gRPC.-> Location
```

### Gateway Modes

**Compose mode** (`GATEWAY_MODE=compose`, default):
- One Node process mounts all routers
- Faster for local development
- Use `npm run dev` in `backend/`
- Services communicate in-process

**Proxy mode** (`GATEWAY_MODE=proxy`):
- Gateway forwards requests to separate service processes
- Better for production and testing service isolation
- Use `npm run dev:split` in `backend/`
- Services communicate via HTTP/gRPC

**Learn more:**
- Gateway routing and modes: [backend/docs/gateway.md](backend/docs/gateway.md)
- Authentication flow: [backend/docs/auth.md](backend/docs/auth.md)
- Geospatial matching: [backend/docs/h3-matchmaking.md](backend/docs/h3-matchmaking.md)
- gRPC implementation: [backend/docs/grpc.md](backend/docs/grpc.md)

Public prefixes (both modes):

| Prefix | Purpose |
| --- | --- |
| `/api/health` | Health check |
| `/api/auth` | Rider/driver Auth0 exchange, admin login, `/me` |
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
| `@eve/auth` | Auth0 ID-token exchange, admin login, leftover password routes (`AUTH_PORT`, default 4001) |
| `@eve/location` | Driver presence (`LOCATION_PORT`, default 4002) |
| `@eve/ride` | Matching, offers, trip lifecycle (`RIDE_PORT`, default 4003) |
| `@eve/notify` | Notifications + Socket.IO (`NOTIFY_PORT`, default 4004) |
| `@eve/gateway` | Compose or proxy entrypoint (`PORT`, default 4000) |

## Prerequisites

### Required

- **Node.js**: 22.x or higher ([Download](https://nodejs.org/))
- **npm**: 10.x or higher (comes with Node.js)
- **Docker Desktop**: Latest version ([Download](https://www.docker.com/products/docker-desktop/))
  - Required for PostgreSQL and Redis
  - Optional: Run full backend stack in Docker

### Optional

- **Xcode**: 15+ (for iOS development on macOS)
- **Android Studio**: Latest (for Android development)
- **EAS CLI**: For mobile app builds (`npm install -g eas-cli`)

### Port Requirements

Ensure these ports are available:
- `4000` - Gateway (main API)
- `4001` - Auth service (proxy mode)
- `4002` - Location service (proxy mode)
- `4003` - Ride service (proxy mode)
- `4004` - Notify service (proxy mode)
- `5432` - PostgreSQL
- `6379` - Redis
- `3000` - Admin console
- `3010` - Monitor dashboard
- `8081` - Expo dev server

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be 22.x or higher

# Check npm version
npm --version   # Should be 10.x or higher

# Check Docker
docker --version
docker compose version

# Check available ports
lsof -i :4000  # Should return nothing if port is free
```

## Quick Start

Get Eve running in 5 minutes:

```bash
# 1. Clone the repository
git clone <repository-url>
cd Eve

# 2. Start infrastructure
cd backend
docker compose up postgres redis -d

# 3. Set up backend
cp .env.example .env
# Edit .env and set JWT_ACCESS_SECRET and AUTH0_* variables
npm install
npm run db:generate
npm run db:migrate
npm run db:seed

# 4. Start the API
npm run dev

# 5. In another terminal, start admin console
cd admin
cp .env.example .env.local
npm install
npm run dev
```

Visit:
- API: http://localhost:4000/api/health
- Admin: http://localhost:3000

For detailed setup instructions, see [GETTING_STARTED.md](GETTING_STARTED.md).

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
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_native_app_client_id
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
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.us.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your_native_app_client_id
```

Copy from `.env.example`. Rider and driver use Auth0 Universal Login, then exchange an ID token for an Eve API JWT. See **[backend/docs/auth.md](backend/docs/auth.md)** for callback URLs and the Native app settings. Rebuild a **development client** after changing the Auth0 config plugin (`npx expo run:ios` / `run:android`). `npx expo start` / Expo Go cannot run Auth0.

`admin/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

```bash
cd rider && npm install && npx expo run:android
cd driver && npm install && npx expo run:android
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

After `npm run db:seed`, password for all seeded accounts is `Admin123!`. Use those emails only in the **admin** console and against leftover password API routes (tests/load). Rider and driver apps sign in with Auth0, not these passwords.

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

**Rider** — Auth0 sign-in, request a trip with a suggested fare, review driver offers, accept a match, track, complete, ride history.

**Driver** — Auth0 sign-in, vehicle and documents onboarding, go online, incoming trips, send offers, pickup / start / complete, earnings.

**Admin** — staff email/password login with roles (`OWNER`, `OPERATIONS`, `FINANCE`, `SUPPORT`, `SAFETY`). Suggested-fare configs and zones; trip and offer audit; driver approval; safety and support. No in-app commission or rider payment collection.

## Documentation

### Core Documentation
- [Getting Started Guide](GETTING_STARTED.md) - Complete setup walkthrough
- [Architecture Overview](ARCHITECTURE.md) - System design and data flows
- [Environment Variables](ENVIRONMENT_VARIABLES.md) - Configuration reference
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Development Workflow](DEVELOPMENT.md) - Git workflow and standards
- [FAQ & Troubleshooting](FAQ.md) - Common issues and solutions

### Backend Documentation
- [Gateway Configuration](backend/docs/gateway.md) - Compose vs proxy modes
- [Authentication](backend/docs/auth.md) - Auth0 integration
- [Docker Setup](backend/docs/docker.md) - Container orchestration
- [H3 Geospatial Matching](backend/docs/h3-matchmaking.md) - Location indexing
- [gRPC Implementation](backend/docs/grpc.md) - Inter-service communication
- [Redis Caching](backend/docs/caching.md) - Cache strategies

### Application Guides
- [Rider App](rider/README.md) - Mobile app for passengers
- [Driver App](driver/README.md) - Mobile app for drivers
- [Admin Console](admin/README.md) - Web-based operations dashboard
- [Monitor Dashboard](monitor/README.md) - System health monitoring

### Additional Resources
- [Security Policy](SECURITY.md) - Security practices and reporting
- [Testing Standards](TESTING.md) - Test coverage and guidelines
- [Store Release](STORE.md) - App Store and Play Store deployment

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 4000
lsof -i :4000

# Kill the process
kill -9 <PID>
```

#### Database Connection Failed
```bash
# Ensure PostgreSQL is running
docker compose ps postgres

# Check connection
docker compose exec postgres psql -U eve -d eve -c "SELECT 1;"

# Restart PostgreSQL
docker compose restart postgres
```

#### Prisma Client Not Generated
```bash
cd backend
npm run db:generate
```

#### Auth0 Configuration Issues
- Verify `AUTH0_DOMAIN` does not include `https://` or trailing slash
- Check callback URLs match exactly (case-sensitive)
- Ensure Native app type is selected in Auth0 dashboard
- See [backend/docs/auth.md](backend/docs/auth.md) for details

#### Mobile App Won't Start
```bash
# Clear Metro bundler cache
npx expo start --clear

# Rebuild development client
npx expo run:ios  # or run:android

# Ensure .env file exists
cp .env.example .env
```

#### Docker Issues on Windows/Mac
- Increase Docker memory to 8GB+ in Docker Desktop settings
- Enable file sharing for the project directory
- Use WSL2 backend on Windows

For more solutions, see [FAQ.md](FAQ.md).

## Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow the [Development Workflow](DEVELOPMENT.md) guide
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Standards
- TypeScript for all new code
- ESLint and Prettier for formatting
- Write tests for new features
- Follow existing patterns and conventions
- Update documentation for API changes

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Admin E2E tests
cd admin
npm run test:e2e

# Load tests
cd backend
npm run load:smoke
```

## License

Private - All rights reserved

## Support

For issues and questions:
- Check [FAQ.md](FAQ.md) for common problems
- Review existing GitHub Issues
- Contact the development team

---

**Last Updated**: 2026-09-01
