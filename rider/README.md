# Eve Rider

Expo SDK 57 rider app (`ca.sherpafoods.eve`). File-based routes live in `src/app`. This app uses Mapbox, Auth0 (`react-native-auth0`), and `expo-dev-client` — use a **development build**, not Expo Go.

## Local

```bash
cp .env.example .env
# Set EXPO_PUBLIC_API_URL, Mapbox token, and Auth0 domain + Client ID
npm install
npx expo run:ios
# or: npx expo run:android
```

`npx expo start` is only useful after a native binary that already includes the Auth0 plugin exists.

The API is the backend gateway `/api` (default `http://localhost:4000/api`). Sign-in is Auth0 Universal Login; the app then exchanges the ID token for an Eve JWT. Callback URLs, env vars, and the backend contract: **[../backend/docs/auth.md](../backend/docs/auth.md)**. Repo overview: root `README.md`.

Auth0 custom scheme (plugin + `authorize` / `clearSession`): `eve`. Expo `scheme` is also `eve`.

## Store release

Identifiers, EAS profiles, and the exact `eas build` / `eas submit` commands for **both** apps are in [`../STORE.md`](../STORE.md).

Do not ship with a localhost or LAN `EXPO_PUBLIC_API_URL`. Replace the placeholders in `eas.json` first, including `EXPO_PUBLIC_AUTH0_*`.
