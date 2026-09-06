# Testing

How Eve is tested today. Sample Maestro/Detox configs in `e2e/` are **not** wired up as CI.

## Backend (Vitest)

From `backend/`:

```bash
npm test                 # tests/**/*.test.ts
npm run test:watch
npm run test:coverage
npm run test:contracts   # OpenAPI contract suite (partial)
```

Requires PostgreSQL (`DATABASE_URL`) and, for matchmaking tests, Redis (`REDIS_URL`). Tests talk to an in-process Express app ([backend/tests/helpers/test-app.ts](backend/tests/helpers/test-app.ts)) that mounts the same prefixes as the split services — there is no gateway. Escrow coverage lives in `tests/payment-escrow.test.ts` (in-memory escrow when `VITEST` is set and no contract address is configured).

Password `POST /api/auth/login` and `/api/auth/driver/register` exist for tests and k6. Mobile apps use Privy.

## Admin (Playwright)

From `admin/`:

```bash
npm run test:e2e
```

Needs the six backend services (or at least auth `:4001` and admin `:4005`) plus seeded staff. The console proxies `/api` to those ports — not `:4000`. Wallet and escrow routes go to payment `:4006`.

## Load (k6)

From `backend/`:

```bash
npm run load:seed
npm run load:smoke
```

Scripts hit all six HTTP services. Set `LOAD_ESCROW=1` on payment (synthetic deposits) and `LOAD_TESTING=1` on every process (skip IP rate limiters). See [backend/load/README.md](backend/load/README.md). Live rider/driver trips use the deployed RideEscrow and **unset** `LOAD_ESCROW` ([backend/docs/driver-wallet.md](backend/docs/driver-wallet.md)). `npm run load:all` runs health, auth, wallets, admin, presence, search, offers, lifecycle, matchmaking, and a capacity ramp.

## Mobile (Jest)

From `rider/` or `driver/`:

```bash
npm test
```

These are unit tests (Privy helpers, formatting). There is **no** committed Maestro `flows/` or Detox config. Host emulator + `expo run:android` / `run:ios` is the manual path; see [e2e/mobile-testing-guide.md](e2e/mobile-testing-guide.md) for future E2E ideas only.

## CI

This repository does not currently ship GitHub Actions under `.github/workflows`. Run the suites above locally before merging.
