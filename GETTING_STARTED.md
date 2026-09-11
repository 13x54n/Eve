# Getting started

This guide runs the active Eve stack locally: PostgreSQL, Redis, six backend services, the admin console, and either Expo app.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Docker Desktop (for PostgreSQL, Redis, and optionally Kafka)
- Android Studio or Xcode for a mobile development client
- Privy application credentials for mobile sign-in

## 1. Start backend dependencies

```bash
cd backend
cp .env.example .env
docker compose up postgres redis kafka -d
```

Use the default local database and Redis URLs initially. Before you use Privy, replace at least these values in `backend/.env`:

```dotenv
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
INTERNAL_SERVICE_SECRET=replace-with-a-separate-long-random-secret
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
```

`KAFKA_BROKERS` may remain empty for a host-side development run. Compose supplies broker configuration when it starts all backend containers.

## 2. Install, migrate, seed, and run services

```bash
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` starts Auth, Location, Ride, Notify, Admin, and Payment together. Check them with:

```bash
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
curl http://localhost:4004/health
curl http://localhost:4005/health
curl http://localhost:4006/health
```

Do not start the old monolith Compose file. The supported process and port list is in [backend/docs/services-ports.md](backend/docs/services-ports.md).

## 3. Start the admin console

```bash
cd admin
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The default proxy targets in `.env.example` route browser requests to the six local services.

## 4. Run the marketing site (optional)

```bash
cd www
npm install
npm run dev
```

The site runs on `http://localhost:3020` and does not need a backend connection.

## 5. Run a mobile app

Create `rider/.env` or `driver/.env` from its local example. For an iOS simulator, the default `localhost` values work. For Android, use `adb reverse` or `10.0.2.2`; for a physical device, use the development machine's LAN address.

```dotenv
EXPO_PUBLIC_AUTH_URL=http://YOUR_HOST:4001/api
EXPO_PUBLIC_API_URL=http://YOUR_HOST:4003/api
EXPO_PUBLIC_PAYMENT_URL=http://YOUR_HOST:4006/api
EXPO_PUBLIC_WS_URL=http://YOUR_HOST:4004
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your-app-client-id
EXPO_PUBLIC_PRIVY_RELYING_PARTY=https://your-domain.com
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token
```

Build a development client:

```bash
cd rider # or driver
npm install
npx expo run:android # or npx expo run:ios
npx expo start
```

Expo Go is not sufficient for the Privy/passkey native integration. Rebuild the development client after changing native app configuration.

## 6. Configure Arc Testnet escrow when needed

Wallet-funded trip tests require Payment's Arc configuration:

```dotenv
TREASURY_PRIVATE_KEY=
ESCROW_CONTRACT_ADDRESS=
ESCROW_OPERATOR_ADDRESS=
CHAIN_RPC_URL=https://rpc.testnet.arc.io
```

The mobile apps do not receive those values. They request chain and escrow configuration from Payment using `EXPO_PUBLIC_PAYMENT_URL`. Read [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md) before funding test wallets or using a treasury key.

## Common local issues

| Symptom | Check |
| --- | --- |
| Database connection error | `docker compose ps postgres`, then inspect `DATABASE_URL` |
| Redis or matching error | `docker compose ps redis`, then inspect `REDIS_URL` |
| Mobile app cannot reach the API | Do not use `localhost` on a physical device; use the LAN address |
| Privy token exchange fails | Confirm the app ID/client ID pair, identity-token setting, and relying-party domain |
| Wallet transaction is unavailable | Check Payment health and its Arc/escrow environment settings |

## Next reading

- [ARCHITECTURE.md](ARCHITECTURE.md) for service ownership and data flow
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for all supported variables
- [TESTING.md](TESTING.md) for the current test commands
