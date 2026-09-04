# Store release (alpha)

Internal TestFlight / Play tracks via EAS. Admin and www (marketing site) are not store targets.

## Expo env (EAS `preview` / `production`)

Set these on each app (`rider/eas.json`, `driver/eas.json`) or as EAS secrets. Do not ship `localhost`.

| Variable | Points at |
| --- | --- |
| `EXPO_PUBLIC_AUTH_URL` | Auth HTTP, e.g. `https://auth.example.com/api` (local: `:4001/api`) |
| `EXPO_PUBLIC_API_URL` | Ride HTTP, e.g. `https://ride.example.com/api` (local: `:4003/api`) |
| `EXPO_PUBLIC_WS_URL` | Notify Socket.IO origin (local: `:4004`) |

Also required: `EXPO_PUBLIC_PRIVY_APP_ID`, `EXPO_PUBLIC_PRIVY_CLIENT_ID`, `EXPO_PUBLIC_PRIVY_RELYING_PARTY`, `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.

## Privy

Create a Privy app with **separate App Clients** for rider and driver. Enable SMS, passkeys, identity tokens, and Ethereum + Solana embedded wallets.

Host Apple App Site Association and Digital Asset Links on `EXPO_PUBLIC_PRIVY_RELYING_PARTY` (see `www/app/.well-known`). Rebuild a development client after changing associated domains.

## Mapbox

Use a public token with the URL restrictions you need for store builds.
