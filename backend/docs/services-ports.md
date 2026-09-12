# Backend services

Auth, location, ride, notify, and admin each run as their own Node process. There is no HTTP gateway.

| Package | Port | Role |
| --- | --- | --- |
| `@eve/auth` | 4001 | Privy, admin login, `/api/auth`, driver `/register` `/login` `/privy` |
| `@eve/location` | 4002 HTTP, 50051 gRPC | Matchmaking geo |
| `@eve/ride` | 4003 | Rider/driver/public HTTP, including `PATCH /api/driver/presence` |
| `@eve/notify` | 4004 HTTP + Socket.IO, 50052 gRPC | Realtime |
| `@eve/admin` | 4005 | Staff `/api/admin` |
| `@eve/payment` | 4006 | Wallet, Arc escrow, treasury payouts |

Typical desktop host: Docker runs **postgres + redis** only; app services use `npm run dev` from `backend/` (`tsx` watch on 4001–4006). Optional: `docker compose up` for the full stack including Kafka and in-container services.

Tests mount the same HTTP prefixes in [`tests/helpers/test-app.ts`](../tests/helpers/test-app.ts).
