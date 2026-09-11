# Eve

Eve is a ride-matching platform. Riders request a trip, drivers make offers, and an accepted fare is held in USDC escrow until the trip settles or is refunded. The repository contains two Expo mobile apps, an operations console, a marketing site, and the backend services they use.

## Current architecture

The active backend is a **six-service Node.js system**. Clients call the owning service directly; there is no HTTP gateway and port `4000` is not part of the supported runtime.

| Service | Port | Responsibility |
| --- | ---: | --- |
| Auth | 4001 | Privy identity exchange, Eve JWTs, admin sign-in |
| Location | 4002 / 50051 | Geospatial matching and location gRPC |
| Ride | 4003 | Rider and driver trips, offers, presence, and public tracking |
| Notify | 4004 / 50052 | Socket.IO real-time events and notify gRPC |
| Admin | 4005 | Operations and staff API |
| Payment | 4006 | Arc Testnet USDC wallets, `RideEscrow`, and payouts |

PostgreSQL stores durable data; Redis supports geo and cache workloads. Docker Compose includes Kafka for domain events. A host process can run with its in-process/direct notification fallback when `KAFKA_BROKERS` is unset.

## Repository layout

```text
admin/       Next.js operations console
backend/     npm workspaces, Prisma schema, shared packages, and six services
driver/      Expo driver app
rider/       Expo rider app
www/         Next.js marketing site
```

## Quick start

Prerequisites: Node 22+, npm, Docker Desktop, and a PostgreSQL/Redis-compatible local environment supplied by Compose.

```bash
# Terminal 1 — backend infrastructure and services
cd backend
cp .env.example .env
# Set JWT_ACCESS_SECRET and Privy credentials in .env before signing in on mobile.
docker compose up postgres redis kafka -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

```bash
# Terminal 2 — operations console
cd admin
cp .env.example .env.local
npm install
npm run dev
```

The console runs at `http://localhost:3000`. Health endpoints are available on ports `4001` through `4006`.

Rider and driver apps require a development client because Privy and passkeys use native modules:

```bash
cd rider # or driver
cp .env.example .env
npm install
npx expo run:android # or npx expo run:ios
```

For a physical device, replace `localhost` in the Expo environment file with the development machine's LAN address. See [GETTING_STARTED.md](GETTING_STARTED.md) for the complete setup flow.

## Payments and wallets

Trip escrow currently runs on Circle Arc Testnet (chain `5042002`). The apps obtain chain, token, and contract configuration from `GET /api/payment/config`; do not put a contract address or treasury key in a mobile environment file. Rider Wallet also exposes a Privy card-onramp entry point for a linked EVM wallet. Provider and destination-chain availability must be enabled in Privy before it can be used.

Read [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md) before deploying or testing escrow.

## Documentation

| Need | Read |
| --- | --- |
| Local setup | [GETTING_STARTED.md](GETTING_STARTED.md) |
| Service boundaries and flows | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Environment reference | [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) |
| API routes | [API_DOCUMENTATION.md](API_DOCUMENTATION.md) and [backend/docs/api/routes.yml](backend/docs/api/routes.yml) |
| Backend process and ports | [backend/docs/services-ports.md](backend/docs/services-ports.md) |
| Authentication | [backend/docs/auth.md](backend/docs/auth.md) |
| Payment and escrow | [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md) |
| Tests | [TESTING.md](TESTING.md) |
| Deployment | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Store builds | [STORE.md](STORE.md) |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and run the checks appropriate to your change before opening a pull request. Do not commit `.env` files, Privy secrets, or treasury keys.
