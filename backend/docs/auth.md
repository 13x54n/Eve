# Authentication

Rider and driver apps sign in with **Privy** (SMS OTP and passkeys). The API still authorizes with **Eve JWTs** (`requireAuth` in `@eve/http`). Admin stays on email/password against the same Eve JWT.

## Flow (rider and driver)

1. The app wraps the tree in `PrivyProvider` (`@privy-io/expo`). This needs a **custom development build** — it does not work in Expo Go.
2. The user authenticates with SMS (`useLoginWithSMS`) or a passkey (`useLoginWithPasskey` / `useSignupWithPasskey`).
3. The app reads the Privy **identity token** (`useIdentityToken().getIdentityToken()`) and `POST`s it to auth (`:4001`).
4. `@eve/auth` verifies the identity token with `@privy-io/node`, finds or creates a Prisma `User`, stores embedded wallet addresses, and returns `{ accessToken, user }` (Eve JWT).
5. The app stores the Eve token in Secure Store and sends `Authorization: Bearer` on later API and socket calls.

Logout: the apps call Privy `logout` and clear the Eve JWT locally.

## Auth service endpoints

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/api/auth/privy` | Rider app. Body `{ "identityToken": "...", "ethereumWallet"?, "solanaWallet"? }` |
| `POST` | `/api/auth/driver/privy` | Driver app. Same body |
| `POST` | `/api/driver/privy` | Same as driver exchange (legacy `/api/driver` prefix) |
| `GET` / `PATCH` | `/api/auth/me` | Session user (Eve JWT) |
| `POST` | `/api/auth/admin/login` | Admin console |
| `POST` | `/api/auth/admin/refresh` / `logout` | Admin refresh cookie-style tokens |

Password `POST /api/auth/login`, `/register`, `/auth/driver/login`, `/auth/driver/register`, forgot/reset, and change-password remain for **tests, load scripts, and admin**. The mobile apps do not call them.

User resolution on Privy exchange:

- Match `User.privyDid`, else link by **phone**, else link by **email**, else create `RIDER` or `DRIVER`.
- SMS-only users may have a null email. Passkey-only users may have neither phone nor email.
- The same Privy identity can use both mobile apps. `User.role` stays the first signup role. Missing `RiderProfile` / `DriverProfile` is created on the matching exchange (driver onboarding stays `DriverProfile.approvalStatus = PENDING`; an existing rider's `accountStatus` is not flipped to `PENDING`).
- Eve JWT `role` is **session context** (which app exchanged), not `User.role`. Rider APIs require a rider-session token; driver APIs require a driver-session token.
- Reject (403) if the existing user is **admin**.
- Privy-only users have no `passwordHash`.

## Privy Dashboard

Create a Privy app, then:

1. Add **App Clients** for rider (`ca.sherpafoods.eve`) and driver (`ca.sherpafoods.evedriver`).
2. Enable **SMS** (or WhatsApp — not both), **passkeys**, and **identity tokens**.
3. Enable automatic **Ethereum** and **Solana** embedded wallets.
4. Add Android signing SHA-256 hashes.
5. Host Apple App Site Association and Digital Asset Links on the passkey relying-party origin (see `www/app/.well-known`).

## Environment

Backend (`backend/.env`), required for the exchange endpoints:

```
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
```

Apps (`rider/.env`, `driver/.env`):

```
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your-privy-app-client-id
EXPO_PUBLIC_PRIVY_RELYING_PARTY=https://your-domain.com
EXPO_PUBLIC_AUTH_URL=http://localhost:4001/api
EXPO_PUBLIC_API_URL=http://localhost:4003/api
EXPO_PUBLIC_WS_URL=http://localhost:4004
```

Use a **different** Privy client ID per app. Never put `PRIVY_APP_SECRET` in the mobile apps. Restart Metro after changing `EXPO_PUBLIC_*`. Rebuild the **dev client** after native plugin changes (`npx expo run:ios` / `run:android`), including Face ID usage text and the passkey passcode-fallback plugin.

Passkeys need a device passcode. Face ID/Touch ID is optional once the native client includes that plugin. On iOS Simulator, enroll Face ID with **Features → Face ID → Enrolled** if you still see `BiometricException`.

## Local seed vs the apps

`npm run db:seed` still creates riders/drivers/admins with password `Admin123!`. Those passwords work on the leftover password API routes and the **admin** console. They do **not** open the rider/driver apps. Sign in there with Privy SMS or a passkey; a matching phone or email that already exists in Postgres is linked on first exchange.
