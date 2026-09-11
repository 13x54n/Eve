# Eve Admin console

The Admin console is a Next.js 16 operations application. It is a browser client of the active six-service backend, not a backend gateway.

## Local development

Start the backend services first, then:

```bash
cd admin
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The browser calls same-origin `/api`; Next.js rewrites those requests to Auth, Ride, Notify, Admin, and Payment.

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

## Scope

The console provides staff operations for riders, drivers, trips, vehicles, pricing, greetings, courier tracking, support, safety, and staff management. Payment-linked views and dispute resolution route through Payment. The operator key remains on the Payment service; it is never placed in `.env.local`.

## Checks

```bash
npm run lint
npm run build
npm run test:e2e
```

Playwright requires the relevant local backend services and seeded staff users. See [../TESTING.md](../TESTING.md) and [../backend/docs/driver-wallet.md](../backend/docs/driver-wallet.md).
