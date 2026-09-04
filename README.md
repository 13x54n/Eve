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
- **Privy integration** for SMS, passkeys, and embedded wallets
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
| Privy | @privy-io/expo | Authentication and embedded wallets |
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
  rider/     Expo 57 rider app — Privy SMS/passkey, request, offers, tracking, history
  driver/    Expo 57 driver app — Privy SMS/passkey, onboarding, presence, offers, trip lifecycle, earnings
  admin/     Next.js 16 console — dashboard, riders, drivers, trips, vehicles, pricing, safety, support
  www/       Next.js 16 marketing site — open-source landing page (port 3020)
  backend/   API: npm workspaces (packages, services, gateway) + Prisma/Postgres
```

## Architecture

Eve uses **separate Node microservices**. Clients call auth, ride, admin, and notify directly (no HTTP gateway).

### System Architecture

```mermaid
graph TB
    subgraph Clients["Client Applications"]
        Rider[Rider App<br/>iOS/Android]
        Driver[Driver App<br/>iOS/Android]
        Admin[Admin Console<br/>Next.js]
        WWW[Marketing Site<br/>Next.js]
    end

    subgraph Services["Microservices"]
        Auth[Auth Service :4001<br/>Authentication and JWT]
        Location[Location Service :4002<br/>GPS and geo matching]
        Ride[Ride Service :4003<br/>Trips and presence]
        Notify[Notify Service :4004<br/>Real-time events]
        AdminApi[Admin Service :4005<br/>Staff API]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL 16<br/>Primary Database)]
        RD[(Redis 7<br/>Cache and Geo Index)]
    end

    Rider --> Auth
    Rider --> Ride
    Rider --> Notify
    Driver --> Auth
    Driver --> Ride
    Driver --> Notify
    Admin --> Auth
    Admin --> AdminApi
    Admin --> Ride
    Admin --> Notify

    Auth --> PG
    Location --> PG
    Location --> RD
    Ride --> PG
    Ride --> RD
    Ride -.gRPC.-> Location
    Ride -.gRPC.-> Notify
    AdminApi --> PG
    Notify --> PG
```

**Learn more:**
- Service ports: [backend/docs/services-ports.md](backend/docs/services-ports.md)
- Authentication flow: [backend/docs/auth.md](backend/docs/auth.md)
- Geospatial matching: [backend/docs/h3-matchmaking.md](backend/docs/h3-matchmaking.md)
- gRPC implementation: [backend/docs/grpc.md](backend/docs/grpc.md)

Public prefixes:

| Prefix | Service | Purpose |
| --- | --- | --- |
| `/health` | each service | Health check |
| `/api/auth` | auth :4001 | Privy exchange, admin login, `/me` |
| `/api/driver/login` `register` `privy` | auth :4001 | Driver auth |
| `/api/driver` | ride :4003 | Presence, trips, earnings |
| `/api/rider` | ride :4003 | Rider trips and offer accept |
| `/api/admin` | admin :4005 | Staff console (RBAC) |
| `/socket.io` | notify :4004 | Realtime |

### Backend packages and services

| Package / service | Role |
| --- | --- |
| `@eve/db` | Prisma client |
| `@eve/http` | Express app, CORS, auth middleware |
| `@eve/shared` | JWT, passwords, permissions |
| `@eve/auth` | Privy identity-token exchange, admin login (`AUTH_PORT`, default 4001) |
| `@eve/location` | Matchmaking geo / gRPC (`LOCATION_PORT`, default 4002) |
| `@eve/ride` | Matching, offers, trip lifecycle, presence (`RIDE_PORT`, default 4003) |
| `@eve/notify` | Notifications + Socket.IO (`NOTIFY_PORT`, default 4004) |
| `@eve/admin` | Staff HTTP API (`ADMIN_PORT`, default 4005) |

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
- `4001` - Auth
- `4002` - Location
- `4003` - Ride
- `4004` - Notify
- `4005` - Admin API
- `5432` - PostgreSQL
- `6379` - Redis
- `3000` - Admin console
- `3020` - Marketing site (`www/`)
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
lsof -i :4001  # Auth; also keep 4002–4005 free
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
# Edit .env and set JWT_ACCESS_SECRET and PRIVY_* variables
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
- API: http://localhost:4003/health
- Admin: http://localhost:3000

For detailed setup instructions, see [GETTING_STARTED.md](GETTING_STARTED.md).

## Local setup

### 1. Database

From `backend/`, start Postgres only:

```bash
docker compose up postgres -d
```

Default compose credentials: user `eve`, password `eve`, database `eve` on `localhost:5432`.

Or start auth, location, ride, notify, and admin together:

```bash
docker compose up
```

### 2. Backend env

Create `backend/.env` (not in git). Required:

```
DATABASE_URL=postgresql://eve:eve@localhost:5432/eve
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
```

Optional:

| Variable | When |
| --- | --- |
| `AUTH_PORT`, `LOCATION_PORT`, `RIDE_PORT`, `NOTIFY_PORT`, `ADMIN_PORT` | Service listen ports |
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

Five services (`npm run dev`):

```bash
cd backend
npm run dev
```

Health: `GET http://localhost:4001/health` (auth), `:4002` (location), `:4003` (ride), `:4004` (notify), `:4005` (admin).

Tests:

```bash
cd backend
npm test
```

### 5. Apps

Point rider/driver at auth, ride, and notify. On a phone or simulator, use your machine’s LAN IP instead of `localhost`.

`rider/.env` and `driver/.env`:

```
EXPO_PUBLIC_AUTH_URL=http://localhost:4001/api
EXPO_PUBLIC_API_URL=http://localhost:4003/api
EXPO_PUBLIC_WS_URL=http://localhost:4004
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your-privy-client-id
EXPO_PUBLIC_PRIVY_RELYING_PARTY=https://your-domain.com
```

Copy from `.env.example`. Rider and driver use Privy SMS or passkeys, then exchange an identity token for an Eve API JWT. See **[backend/docs/auth.md](backend/docs/auth.md)**. Rebuild a **development client** after changing native Privy/passkey config (`npx expo run:ios` / `run:android`). `npx expo start` / Expo Go cannot run this auth stack.

`admin/.env.local`:

```
NEXT_PUBLIC_API_URL=/api
AUTH_PROXY_TARGET=http://127.0.0.1:4001
RIDE_PROXY_TARGET=http://127.0.0.1:4003
NOTIFY_PROXY_TARGET=http://127.0.0.1:4004
ADMIN_PROXY_TARGET=http://127.0.0.1:4005
NEXT_PUBLIC_NOTIFY_URL=http://127.0.0.1:4004
```

```bash
cd rider && npm install && npx expo run:android
cd driver && npm install && npx expo run:android
cd admin && npm install && npm run dev
```

Admin console: [http://localhost:3000](http://localhost:3000).

Marketing site (open-source landing page, no backend required):

```bash
cd www && npm install && npm run dev
```

Landing page: [http://localhost:3020](http://localhost:3020). Set `NEXT_PUBLIC_GITHUB_URL` in `www/.env.local` for GitHub links.

Restart Expo after changing `EXPO_PUBLIC_*` env vars.

Store release (App Store / Play, TestFlight, EAS identifiers): see [`STORE.md`](STORE.md).

## Seed users (local only)

After `npm run db:seed`, password for all seeded accounts is `Admin123!`. Use those emails only in the **admin** console and against leftover password API routes (tests/load). Rider and driver apps sign in with Privy, not these passwords.

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

**Rider** — Privy SMS/passkey sign-in, request a trip with a suggested fare, review driver offers, accept a match, track, complete, ride history.

**Driver** — Privy SMS/passkey sign-in, vehicle and documents onboarding, go online, incoming trips, send offers, pickup / start / complete, earnings.

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
- [Backend services](backend/docs/services-ports.md) - Ports and process layout
- [Authentication](backend/docs/auth.md) - Privy integration
- [Docker Setup](backend/docs/docker.md) - Container orchestration
- [H3 Geospatial Matching](backend/docs/h3-matchmaking.md) - Location indexing
- [gRPC Implementation](backend/docs/grpc.md) - Inter-service communication
- [Redis Caching](backend/docs/caching.md) - Cache strategies

### Application Guides
- [Rider App](rider/README.md) - Mobile app for passengers
- [Driver App](driver/README.md) - Mobile app for drivers
- [Admin Console](admin/README.md) - Web-based operations dashboard
- [Marketing Site](www/README.md) - Public landing page

### Additional Resources
- [Security Policy](SECURITY.md) - Security practices and reporting
- [Testing Standards](TESTING.md) - Test coverage and guidelines
- [Store Release](STORE.md) - App Store and Play Store deployment

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find a process using a service port (example: ride)
lsof -i :4003

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

#### Privy Configuration Issues
- Enable identity tokens, SMS, and passkeys in the Privy Dashboard
- Use a different App Client ID for rider vs driver
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

[MIT](LICENSE)

## Support

For issues and questions:
- Check [FAQ.md](FAQ.md) for common problems
- Review existing GitHub Issues
- Contact the development team

---

**Last Updated**: 2026-09-02
