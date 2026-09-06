# Contributing

Thanks for working on Eve. This file is the contributor entry point; deep workflow notes live in [DEVELOPMENT.md](DEVELOPMENT.md).

## Before you start

1. Read [GETTING_STARTED.md](GETTING_STARTED.md) and run the five backend services locally (`cd backend && npm run dev`, or `docker compose up --build` for the same stack).
2. Rider and driver apps are **not** in Docker. Use a host Expo dev client + simulator/emulator ([backend/docs/docker.md](backend/docs/docker.md)).
3. Do not add an HTTP gateway. Clients call auth `:4001`, ride `:4003`, notify `:4004`, and admin `:4005` directly.

## Branches and commits

- Branch from `main` with a descriptive prefix (`feature/`, `fix/`, `docs/`, `chore/`).
- Keep commits focused. Do not commit secrets, `.env`, or generated `ios/` / `android/` trees.
- Husky runs lint-staged on commit. Pre-push may run additional checks — see [.husky/README.md](.husky/README.md).

## What to test

See [TESTING.md](TESTING.md). At minimum, run `cd backend && npm test` for API changes. Add or update tests next to the behavior you change.

## Docs

If you change ports, env vars, routes, or product behavior, update the matching doc in the same PR. Canonical ports: [backend/docs/services-ports.md](backend/docs/services-ports.md).

## Security

Report vulnerabilities as described in [SECURITY.md](SECURITY.md). Do not file public issues for exploitable bugs.
