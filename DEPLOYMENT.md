# Deployment Guide

Alpha and current-repo deploy is **six Node services** (auth, location, ride, notify, admin, payment) plus Postgres and Redis. There is **no HTTP gateway** and **no `docker-compose.prod.yml` in this repository**. Kubernetes, ECR multi-target Dockerfiles, and GitHub Actions described in older drafts are not shipped here.

Mobile binaries are built with **EAS** ([STORE.md](STORE.md)), not Docker. iOS cannot be built in a Linux container.

## Local / single-host Compose

From `backend/`:

```bash
cp .env.example .env
# Set JWT_ACCESS_SECRET, PRIVY_*, TREASURY_PRIVATE_KEY, ESCROW_CONTRACT_ADDRESS, ESCROW_OPERATOR_ADDRESS for Arc USDC

docker compose up --build
```

Published ports:

| Port | Process |
| --- | --- |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 4001 | Auth |
| 4002 / 50051 | Location HTTP / gRPC |
| 4003 | Ride |
| 4004 / 50052 | Notify HTTP+Socket.IO / gRPC |
| 4005 | Admin API |
| 4006 | Payment |

Health: `curl http://localhost:4001/health` (repeat for 4002–4006).

Host-side alternative: `docker compose up postgres redis -d` then `npm run db:migrate && npm run dev`.

Rider/driver emulators talk to those host ports — [backend/docs/docker.md](backend/docs/docker.md). Admin: `cd admin && npm run dev` (proxies to 4001/4003/4004/4005/4006). www: port 3020, no API required.

## Production-shaped host

Until a prod Compose file exists, run the same six processes with production `NODE_ENV`, managed Postgres 16, managed Redis 7, and a reverse proxy that routes:

- `/api/auth` → auth :4001
- `/api/rider`, `/api/driver` (except auth aliases on 4001 and wallet routes on 4006) → ride :4003
- `/api/payment`, `/api/driver/wallet`, `/api/rider/wallet` → payment :4006
- `/api/admin` → admin :4005
- `/socket.io` → notify :4004
- WebSocket upgrade on notify

Set `INTERNAL_SERVICE_SECRET`, strong `JWT_ACCESS_SECRET`, and gRPC URLs to the location/notify hosts. Arc Testnet escrow: `ESCROW_CONTRACT_ADDRESS`, `ESCROW_OPERATOR_ADDRESS`, and `TREASURY_PRIVATE_KEY`. Apps read the contract from `GET /api/payment/config` (no Expo contract env). Live addresses: [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md). Restart payment after changing `.env`. Leave `LOAD_ESCROW` unset.

Do not expose Postgres or Redis publicly.

## Mobile

```bash
cd rider   # or driver
eas build --profile production --platform ios
eas build --profile production --platform android
```

See [STORE.md](STORE.md). Point `EXPO_PUBLIC_*` at the public auth/ride/payment/notify URLs.

## Secrets

Never commit `.env`. Rotate `JWT_ACCESS_SECRET`, `PRIVY_APP_SECRET`, `INTERNAL_SERVICE_SECRET`, and `TREASURY_PRIVATE_KEY` independently.

## Related

- [backend/docs/services-ports.md](backend/docs/services-ports.md)
- [backend/docs/docker.md](backend/docs/docker.md)
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)
