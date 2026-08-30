# Eve Rider

Expo SDK 57 rider app (`ca.sherpafoods.eve`). File-based routes live in `src/app`. This app uses Mapbox and `expo-dev-client` — use a development build, not Expo Go.

## Local

```bash
cp .env.example .env
# Set EXPO_PUBLIC_API_URL (http://localhost:4000/api or your LAN IP) and a Mapbox public token
npm install
npm start
```

The API is the backend gateway `/api` (default `http://localhost:4000/api`). See the repo root `README.md`.

## Store release

Identifiers, EAS profiles, and the exact `eas build` / `eas submit` commands for **both** apps are in [`../STORE.md`](../STORE.md).

Do not ship with a localhost or LAN `EXPO_PUBLIC_API_URL`. Replace the placeholders in `eas.json` first.
