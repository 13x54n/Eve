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

Requires PostgreSQL (`DATABASE_URL`) and, for matchmaking tests, Redis (`REDIS_URL`). Tests talk to an in-process Express app ([backend/tests/helpers/test-app.ts](backend/tests/helpers/test-app.ts)) that mounts the same prefixes as the split services — there is no gateway.

Password `POST /api/auth/login` and `/api/auth/driver/register` exist for tests and k6. Mobile apps use Privy.

## Admin (Playwright)

From `admin/`:

```bash
npm run test:e2e
```

Needs the five backend services (or at least auth `:4001` and admin `:4005`) plus seeded staff. The console proxies `/api` to those ports — not `:4000`.

## Load (k6)

From `backend/`:

```bash
npm run load:seed
npm run load:smoke
```

Scripts hit ride `:4003` and still log in with passwords. See [backend/load/README.md](backend/load/README.md).

## Mobile (Jest)

From `rider/` or `driver/`:

```bash
npm test
```

These are unit tests (Privy helpers, formatting). There is **no** committed Maestro `flows/` or Detox config. Host emulator + `expo run:android` / `run:ios` is the manual path; see [e2e/mobile-testing-guide.md](e2e/mobile-testing-guide.md) for future E2E ideas only.

## CI

This repository does not currently ship GitHub Actions under `.github/workflows`. Run the suites above locally before merging.
