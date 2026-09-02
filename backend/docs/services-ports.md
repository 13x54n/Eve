# Backend services

Auth, location, ride, notify, and admin each run as their own Node process. There is no HTTP gateway.

| Package | Port | Role |
| --- | --- | --- |
| `@eve/auth` | 4001 | Auth0, admin login, `/api/auth`, driver `/register` `/login` `/auth0` |
| `@eve/location` | 4002 HTTP, 50051 gRPC | Matchmaking geo |
| `@eve/ride` | 4003 | Rider/driver/public HTTP, including `PATCH /api/driver/presence` |
| `@eve/notify` | 4004 HTTP + Socket.IO, 50052 gRPC | Realtime |
| `@eve/admin` | 4005 | Staff `/api/admin` |

Local: `npm run dev` from `backend/`. Docker: `docker compose up`.

Tests mount the same HTTP prefixes in [`tests/helpers/test-app.ts`](../tests/helpers/test-app.ts).
