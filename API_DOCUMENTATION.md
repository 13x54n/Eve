# API documentation

Eve has no HTTP gateway. Each client calls the service that owns a route. The most maintainable route annotations live in [backend/docs/api/routes.yml](backend/docs/api/routes.yml); generate the OpenAPI document from `backend/` with:

```bash
npm run openapi:generate
```

## Base URLs in development

| Service | Base URL |
| --- | --- |
| Auth | `http://localhost:4001/api` |
| Ride | `http://localhost:4003/api` |
| Notify | `http://localhost:4004` |
| Admin | `http://localhost:4005/api` |
| Payment | `http://localhost:4006/api` |

The admin console proxies the same prefixes through Next.js. Mobile apps configure these values independently with `EXPO_PUBLIC_*` variables.

## Authentication

Mobile clients first complete a Privy flow, then exchange the identity token with Auth:

| Method | Route | User |
| --- | --- | --- |
| `POST` | `/api/auth/privy` | Rider |
| `POST` | `/api/auth/driver/privy` | Driver |
| `POST` | `/api/auth/admin/login` | Staff |
| `GET` / `PATCH` | `/api/auth/me` | Authenticated user |

Protected endpoints receive `Authorization: Bearer <eve-jwt>`. The identity token and Privy app secret are not forwarded to Ride, Payment, or Admin.

## Route ownership

| Routes | Service | Notes |
| --- | --- | --- |
| `/api/rider/*`, `/api/driver/*`, `/api/public/*` | Ride | Trips, offers, presence, lifecycle, courier tracking |
| `/api/payment/*` | Payment | Escrow configuration, quotes, and transaction confirmations |
| `/api/rider/wallet`, `/api/driver/wallet` | Payment | Wallet balance, activity, and driver withdrawal |
| `/api/admin/*` | Admin | Staff operations; some payment-backed actions are rewritten onward |
| `/socket.io` | Notify | Socket.IO events and authenticated subscriptions |

## Trip flow

1. Rider creates a trip with `POST /api/rider/trips`.
2. Drivers discover and offer on trip routes under `/api/driver`.
3. Rider accepts an offer with the route returned by Ride.
4. Payment returns an escrow deposit quote; the app signs it using the Privy wallet and posts the transaction hash to the confirmation route.
5. Driver settlement, rider dispute/refund, and operator finalization use Payment quotes and confirmations.

Payment routes, authorization, and the Arc transaction lifecycle are documented in [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md). Do not hardcode an escrow address in clients.

## Errors and health

Each service exposes `GET /health`. API failures use the service's standard HTTP status and JSON error response. Client code should surface a useful message, preserve local/offline state where applicable, and refetch canonical trip or wallet state after an uncertain network outcome.

## Realtime

Connect to Notify's Socket.IO origin (`EXPO_PUBLIC_WS_URL` in mobile, `NEXT_PUBLIC_NOTIFY_URL` in Admin) using the Eve JWT. Socket events supplement REST state; clients must not rely on an event as their only source of truth.

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [backend/docs/services-ports.md](backend/docs/services-ports.md)
- [backend/docs/auth.md](backend/docs/auth.md)
- [backend/docs/websockets.md](backend/docs/websockets.md)
