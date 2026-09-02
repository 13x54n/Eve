# Store release (alpha)

Internal TestFlight / Play tracks via EAS. Admin and monitor are not store targets.

## Expo env (EAS `preview` / `production`)

Set these on each app (`rider/eas.json`, `driver/eas.json`) or as EAS secrets. Do not ship `localhost`.

| Variable | Points at |
| --- | --- |
| `EXPO_PUBLIC_AUTH_URL` | Auth HTTP, e.g. `https://auth.example.com/api` (local: `:4001/api`) |
| `EXPO_PUBLIC_API_URL` | Ride HTTP, e.g. `https://ride.example.com/api` (local: `:4003/api`) |
| `EXPO_PUBLIC_WS_URL` | Notify Socket.IO origin (local: `:4004`) |

Also required: `EXPO_PUBLIC_AUTH0_DOMAIN`, `EXPO_PUBLIC_AUTH0_CLIENT_ID`, `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.

## Auth0

Use one Native application. Domain is host only (no `https://`).

**Allowed Callback URLs** (login, `/callback`):

```
eve://YOUR_DOMAIN/ios/ca.sherpafoods.eve/callback
eve://YOUR_DOMAIN/android/ca.sherpafoods.eve/callback
evedriver://YOUR_DOMAIN/ios/ca.sherpafoods.evedriver/callback
evedriver://YOUR_DOMAIN/android/ca.sherpafoods.evedriver/callback
```

**Allowed Logout URLs** (must be `/logout`, not `/callback`):

```
eve://YOUR_DOMAIN/ios/ca.sherpafoods.eve/logout
eve://YOUR_DOMAIN/android/ca.sherpafoods.eve/logout
evedriver://YOUR_DOMAIN/ios/ca.sherpafoods.evedriver/logout
evedriver://YOUR_DOMAIN/android/ca.sherpafoods.evedriver/logout
```

## Mapbox

Public token in `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`. Restrict the token to bundle IDs `ca.sherpafoods.eve` and `ca.sherpafoods.evedriver`.

## Builds

From `rider/` or `driver/`:

```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```
