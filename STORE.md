# Store release — Eve Rider and Eve Driver

Both apps are Expo SDK 57, use `expo-dev-client` plus Mapbox (`@rnmapbox/maps`), and must ship as **development clients / store binaries**, not Expo Go.

EAS Build and Submit consume plan minutes. Paid Apple Developer and Google Play accounts are required. Do not run cloud builds until identifiers, secrets, and store listings below are filled in.

| App | Folder | Display name | iOS bundle ID | Android package | EAS project |
| --- | --- | --- | --- | --- | --- |
| Rider | `rider/` | Eve Rider | `ca.sherpafoods.eve` | `ca.sherpafoods.eve` | `61c1fda6-f52f-49b8-8b49-a587575be3f2` |
| Driver | `driver/` | Eve Driver | `ca.sherpafoods.evedriver` | `ca.sherpafoods.evedriver` | `fcff2689-332f-4f65-9da1-98dced1d59bf` |

Schemes: `eve` and `eve-driver`.

## 1. Replace placeholders before the first production build

In each app’s `eas.json` (`preview.env` and `production.env`):

- `EXPO_PUBLIC_API_URL` — public gateway `/api` base, HTTPS. Not `localhost` or a LAN IP.
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` — Mapbox **public** token (`pk.…`). Restrict it to the app bundle IDs / package names in the Mapbox console.

In each app’s `eas.json` `submit.production` and `store.config.json`:

- Apple ID, App Store Connect Apple ID (`ascAppId`), Team ID
- Play Console service account JSON path (file is gitignored)
- Hosted privacy policy and support URLs (App Review requires a public page; in-app Legal is not enough)
- Review contact and a staging demo account (not the local seed users)

Optional EAS secrets (same names as the env keys) if you do not want tokens in `eas.json`:

```bash
cd rider
npx eas-cli@latest secret:create --name EXPO_PUBLIC_API_URL --value "https://YOUR_HOST/api" --type string
npx eas-cli@latest secret:create --name EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN --value "pk.YOUR_TOKEN" --type string
```

Repeat in `driver/`.

## 2. Console work (you must do this)

**Expo / EAS**

```bash
npm install -g eas-cli
eas login
eas whoami
```

Each app is already linked (`extra.eas.projectId` in `app.json`). Confirm you can see both projects after login.

**Apple**

1. Enroll at [developer.apple.com](https://developer.apple.com).
2. Create two App Store Connect apps with the bundle IDs above.
3. Run `eas credentials -p ios` in `rider/` and again in `driver/`.
4. Preferred for submit: App Store Connect API key (Users and Access → Keys). Keep the `.p8` out of git (`AuthKey_*.p8` is ignored).
5. Fill App Privacy, privacy policy URL, pricing, and review notes. Provide a demo rider/driver account.
6. Ship TestFlight first (`npx testflight` or `eas build -p ios --profile production --submit`).

**Google Play**

1. Create two apps in Play Console with the package names above.
2. Create a Cloud service account, download JSON, grant Play Console release permission.
3. Save the JSON as `rider/google-service-account.json` and `driver/google-service-account.json` (gitignored).
4. Complete Data safety, privacy policy URL, content rating, store listing, and photos.
5. First `eas submit` uses the **internal** track (`eas.json`). Promote to production in the Console.

## 3. Commands

From the app folder (`rider` or `driver`).

```bash
npm install
npx eas-cli@latest whoami
```

**Production builds (paid)**

```bash
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest build -p android --profile production
```

**Submit latest binaries**

```bash
npx eas-cli@latest submit -p ios --latest
npx eas-cli@latest submit -p android --latest
```

**Build and submit together**

```bash
npx eas-cli@latest build -p ios --profile production --submit
npx eas-cli@latest build -p android --profile production --submit
```

**TestFlight shortcut (iOS)**

```bash
npx testflight
```

**Internal preview APK (not Play production)**

```bash
npx eas-cli@latest build -p android --profile preview
```

**Versions** (`appVersionSource` is `remote`; production has `autoIncrement`)

```bash
npx eas-cli@latest build:version:get
```

**Apple listing copy (after a binary exists)**

```bash
npx eas-cli@latest metadata:push
```

`store.config.json` is preview / App Store only. Play listing is still filled in Play Console.

## 4. Permissions and keys (what review will see)

- **Location (when in use only).** Rider: pickup/drop-off and in-trip sharing. Driver: nearby requests and in-trip sharing. Background location is **off** — do not enable it in the consoles unless the apps start using it.
- **Notifications.** Local ride-status alerts via `expo-notifications`. Remote APNs/FCM is not configured; `promptToConfigurePushNotifications` is false.
- **Driver documents.** `expo-document-picker` for images/PDFs; iOS photo-library usage string is set. Uploads go to ImageKit using backend-issued auth (`IMAGEKIT_*` on the API, not in the app).
- **Maps.** Mapbox, not Google Maps. Token: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.
- **Encryption export.** `ITSAppUsesNonExemptEncryption` / `usesNonExemptEncryption` is false.

## 5. Local development (not store)

See the root `README.md`. Rider and driver: `npm install` then `npm start` (needs a **dev client** because of Mapbox). Point `EXPO_PUBLIC_API_URL` at the gateway `/api` (LAN IP on a phone).

`npm run dev` is a **backend** script (`backend/package.json`). There is no root workspace `package.json`. On Windows, Unix-style `NODE_OPTIONS=...` in those scripts used to fail; they were switched to `cross-env` in `backend/`.
