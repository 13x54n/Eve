# Authentication

Rider and driver apps sign in with **Auth0 Universal Login**. The API still authorizes with **Eve JWTs** (`requireAuth` in `@eve/http`). Admin stays on email/password against the same Eve JWT.

## Flow (rider and driver)

1. The app opens Auth0 (`react-native-auth0` `authorize`, PKCE). This needs a **custom development build** — it does not work in Expo Go.
2. After login, the app reads the Auth0 **ID token** (`getCredentials`) and `POST`s it to the gateway.
3. `@eve/auth` verifies the JWT against Auth0 JWKS (`iss` = tenant, `aud` = Native Client ID), finds or creates a Prisma `User`, and returns `{ accessToken, user }` (Eve JWT).
4. The app stores the Eve token in Secure Store and sends `Authorization: Bearer` on later API and socket calls, same as before.

Logout: Auth0 `clearSession` plus delete the Eve token.

## Gateway endpoints

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/api/auth/auth0` | Rider app. Body `{ "idToken": "..." }` |
| `POST` | `/api/auth/driver/auth0` | Driver app. Same body |
| `POST` | `/api/driver/auth0` | Same as driver exchange (legacy `/api/driver` prefix) |
| `GET` / `PATCH` | `/api/auth/me` | Session user (Eve JWT) |
| `POST` | `/api/auth/admin/login` | Admin console |
| `POST` | `/api/auth/admin/refresh` / `logout` | Admin refresh cookie-style tokens |

Password `POST /api/auth/login`, `/register`, `/auth/driver/login`, `/auth/driver/register`, forgot/reset, and change-password remain for **tests, load scripts, and admin**. The mobile apps do not call them.

User resolution on Auth0 exchange:

- Match `User.auth0Sub`, else link by **verified** email, else create `RIDER` or `DRIVER`.
- The same Auth0 identity can use both mobile apps. `User.role` stays the first signup role. Missing `RiderProfile` / `DriverProfile` is created on the matching exchange (driver onboarding stays `DriverProfile.approvalStatus = PENDING`; an existing rider's `accountStatus` is not flipped to `PENDING`).
- Eve JWT `role` is **session context** (which app exchanged), not `User.role`. Rider APIs require a rider-session token; driver APIs require a driver-session token.
- Reject (403) if the existing user is **admin**.
- Auth0-only users have no `passwordHash`.

## Auth0 Native app

Use one **Native** application (OIDC Conformant). `EXPO_PUBLIC_AUTH0_DOMAIN` / `AUTH0_DOMAIN` must be the host only (no `https://`, no trailing slash).

Register **Allowed Callback URLs** and **Allowed Logout URLs** with the same four values (comma or newline separated). If Auth0 shows `Callback URL mismatch`, copy the `redirect_uri` query parameter from that error URL and paste it exactly.

Rider (`customScheme` `eve`, bundle/package `ca.sherpafoods.eve`):

```
eve://YOUR_TENANT_DOMAIN/ios/ca.sherpafoods.eve/callback
eve://YOUR_TENANT_DOMAIN/android/ca.sherpafoods.eve/callback
```

Driver (`customScheme` `evedriver` — Auth0 schemes cannot include a hyphen; Expo `scheme` stays `eve-driver`):

```
evedriver://YOUR_TENANT_DOMAIN/ios/ca.sherpafoods.evedriver/callback
evedriver://YOUR_TENANT_DOMAIN/android/ca.sherpafoods.evedriver/callback
```

Do not use `eve-driver://`, do not prefix the domain with `https://`, and do not add a trailing slash after `callback`. Enable the Username-Password-Authentication connection on that client.

## Environment

Backend (`backend/.env`), required for the exchange endpoints:

```
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_native_app_client_id
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
```

Apps (`rider/.env`, `driver/.env`; also `preview` / `production` in each `eas.json`):

```
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.us.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your_native_app_client_id
EXPO_PUBLIC_API_URL=http://localhost:4000/api
```

Do not put a Client Secret in the mobile apps. Restart Metro after changing `EXPO_PUBLIC_*`. After adding the Auth0 config plugin, rebuild the **dev client** (`npx expo run:ios` / `run:android` or EAS `development` profile).

## Local seed vs the apps

`npm run db:seed` still creates riders/drivers/admins with password `Admin123!`. Those passwords work on the leftover password API routes and the **admin** console. They do **not** open the rider/driver apps. Sign in there with Auth0; a verified email that already exists in Postgres is linked on first exchange.
