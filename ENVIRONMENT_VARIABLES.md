# Environment variables

The committed `.env.example` files are the executable starting point for local configuration. This document explains the variables that are consumed by the active six-service architecture. Never commit a populated `.env` file.

## Backend: `backend/.env`

### Required outside test-only work

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL used by all services |
| `REDIS_URL` | Redis URL used for matching and cache paths |
| `JWT_ACCESS_SECRET` | Eve access-token signing secret |
| `INTERNAL_SERVICE_SECRET` | Service-to-service authentication secret |
| `PRIVY_APP_ID` | Privy application ID |
| `PRIVY_APP_SECRET` | Privy server secret; backend only |

Example local values:

```dotenv
DATABASE_URL=postgresql://eve:eve@localhost:5432/eve
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
INTERNAL_SERVICE_SECRET=replace-with-a-separate-long-random-secret
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
```

### Ports and internal endpoints

| Variable | Default |
| --- | --- |
| `AUTH_PORT` | `4001` |
| `LOCATION_PORT` | `4002` |
| `RIDE_PORT` | `4003` |
| `NOTIFY_PORT` | `4004` |
| `ADMIN_PORT` | `4005` |
| `PAYMENT_PORT` | `4006` |
| `LOCATION_GRPC_PORT` / `LOCATION_GRPC_URL` | `50051` / `127.0.0.1:50051` |
| `NOTIFY_GRPC_PORT` / `NOTIFY_GRPC_URL` | `50052` / `127.0.0.1:50052` |

When services run in Compose, the compose file overrides hostnames with Docker service names.

### Events, CORS, and optional integrations

| Variable | Use |
| --- | --- |
| `KAFKA_BROKERS` | Broker list. Leave unset for local host fallback; Compose uses `kafka:9092`. |
| `KAFKA_CLIENT_ID` | Optional client identity override. |
| `NOTIFY_URL` | HTTP notification fallback if gRPC is unavailable. |
| `CORS_ORIGINS` | Comma-separated browser origins; native apps do not send an `Origin`. |
| `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_URL_ENDPOINT`, `IMAGEKIT_DRIVER_FOLDER` | Driver document/image integration. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Optional mail integration. |
| `LOG_LEVEL` | Logging level. |

### Payment and Arc Testnet

| Variable | Purpose |
| --- | --- |
| `TREASURY_PRIVATE_KEY` | Operator and payout signer. Keep secret. |
| `CHAIN_RPC_URL` | Arc RPC URL; local default is `https://rpc.testnet.arc.io`. |
| `ESCROW_CONTRACT_ADDRESS` | Deployed `RideEscrow` address. |
| `ESCROW_OPERATOR_ADDRESS` | Contract operator; defaults to the treasury signer when unset. |
| `PAYOUT_TOKEN_ADDRESS` | ERC-20 USDC address; use `native` only to force native payouts. |
| `PAYOUT_CHAIN_ID`, `PAYOUT_CHAIN_NAME`, `PAYOUT_TOKEN_SYMBOL`, `PAYOUT_TOKEN_DECIMALS` | Chain/token display configuration. |

See [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md) for deployment addresses, transaction flow, and testnet safety notes.

### Test and load switches

| Variable | Use |
| --- | --- |
| `VITEST` | Enables test-specific behavior in backend tests. |
| `LOAD_TESTING=1` | Disables load-test rate-limit interference. Never use in production. |
| `LOAD_ESCROW=1` | Uses synthetic in-memory escrow receipts for load tests. Do not use for live escrow. |

## Rider and driver: `.env`

The apps share the same variable shape, but use separate Privy App Clients.

```dotenv
EXPO_PUBLIC_AUTH_URL=http://localhost:4001/api
EXPO_PUBLIC_API_URL=http://localhost:4003/api
EXPO_PUBLIC_PAYMENT_URL=http://localhost:4006/api
EXPO_PUBLIC_WS_URL=http://localhost:4004
EXPO_PUBLIC_CHAIN_RPC_URL=https://rpc.testnet.arc.io
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your-rider-or-driver-client-id
EXPO_PUBLIC_PRIVY_RELYING_PARTY=https://your-domain.com
```

`EXPO_PUBLIC_*` values are embedded in an app build and must not contain secrets. In particular, do not expose `PRIVY_APP_SECRET`, `TREASURY_PRIVATE_KEY`, or `ESCROW_CONTRACT_ADDRESS`. Apps retrieve escrow configuration from `GET /api/payment/config`.

Use an emulator-specific URL or the development machine's LAN address as needed. Restart Metro after changing an Expo environment value and rebuild a development client after a native configuration change.

## Admin: `admin/.env.local`

```dotenv
NEXT_PUBLIC_API_URL=/api
AUTH_PROXY_TARGET=http://127.0.0.1:4001
RIDE_PROXY_TARGET=http://127.0.0.1:4003
NOTIFY_PROXY_TARGET=http://127.0.0.1:4004
ADMIN_PROXY_TARGET=http://127.0.0.1:4005
PAYMENT_PROXY_TARGET=http://127.0.0.1:4006
NEXT_PUBLIC_NOTIFY_URL=http://127.0.0.1:4004
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token
```

The `*_PROXY_TARGET` values are server-side Next.js rewrites. `NEXT_PUBLIC_*` values are browser-visible.

## Marketing site: `www/.env.local`

`NEXT_PUBLIC_GITHUB_URL` controls the repository link. The marketing site has no backend service URL in its default setup.

## Secret handling

- Use independent, randomly generated values for JWT, internal-service, Privy, and treasury secrets.
- Store production values in the deployment platform's secret manager.
- Rotate a compromised secret and restart every service that reads it.
- Never copy a backend secret to an Expo or Next.js `NEXT_PUBLIC_*` variable.
