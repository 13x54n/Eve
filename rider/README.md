# Eve Rider App

Mobile application for passengers to request rides and manage trips.

**Platform**: iOS & Android  
**Framework**: Expo SDK 57 / React Native  
**Bundle ID**: `ca.sherpafoods.eve`  
**Language**: TypeScript

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Building](#building)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

The Rider app enables passengers to:
- Request rides with suggested fares
- Receive and review driver offers
- Accept offers and track driver location in real-time
- Chat with drivers during trips
- View trip history and receipts
- Manage payment methods (off-platform)

## Features

### Authentication
- Auth0 Universal Login (email/password, social)
- Biometric authentication (Face ID, Touch ID)
- JWT token management
- Secure token storage (SecureStore)

### Trip Management
- Search pickup/dropoff locations
- Get fare estimates
- Select vehicle type (CAR, BIKE)
- View incoming driver offers
- Accept best offer
- Track trip status in real-time

### Real-Time Tracking
- Live driver location on map
- ETA updates
- Route visualization
- Mapbox navigation

### Communication
- In-trip chat with driver
- Push notifications for trip updates
- Offer notifications

### Profile & History
- View past trips
- Trip receipts
- Saved locations
- Profile management

## Architecture

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Expo | 57 | React Native framework |
| React Native | 0.76+ | Mobile UI |
| TypeScript | 5.9+ | Type safety |
| Auth0 | react-native-auth0 | Authentication |
| Mapbox | @rnmapbox/maps | Maps & navigation |
| Socket.IO | socket.io-client | Real-time events |
| Zustand | 4.x | State management |

### Navigation

File-based routing with Expo Router:

```
src/app/
  (auth)/
    login.tsx           # Auth0 login
    onboarding.tsx      # First-time user flow
  (tabs)/
    index.tsx           # Home / Request ride
    trips.tsx           # Trip history
    profile.tsx         # User profile
  trip/
    [id].tsx            # Active trip details
    offers.tsx          # Review offers
```

### State Management

- **Zustand** for global state (user, active trip, offers)
- **React Query** for API data fetching and caching
- **Context** for theme and localization

### Key Services

```typescript
// src/services/
auth.ts         // Auth0 integration, token management
api.ts          // HTTP client, API calls
socket.ts       // WebSocket connection
location.ts     // GPS tracking
notifications.ts // Push notifications
```

## Prerequisites

### Required

- **macOS**: For iOS development (Xcode 15+)
- **Node.js**: 22.x or higher
- **npm**: 10.x or higher
- **Expo CLI**: Latest
- **Xcode** (iOS) or **Android Studio** (Android)

### Accounts

- **Auth0**: Free account for authentication
- **Mapbox**: Free tier for maps
- **Apple Developer**: For iOS builds ($99/year)
- **Google Play**: For Android builds ($25 one-time)

### Check Prerequisites

```bash
node --version   # 22.x+
npm --version    # 10.x+
expo --version   # Latest

# iOS
xcodebuild -version  # 15.x+

# Android
adb version  # Latest
```

## Local Development

### 1. Install Dependencies

```bash
cd rider
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Backend URLs (use your LAN IP for physical devices)
EXPO_PUBLIC_AUTH_URL=http://192.168.1.100:4001/api
EXPO_PUBLIC_API_URL=http://192.168.1.100:4003/api
EXPO_PUBLIC_WS_URL=http://192.168.1.100:4004

# Auth0 Configuration
EXPO_PUBLIC_AUTH0_DOMAIN=your-tenant.us.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=your_native_app_client_id

# Mapbox Access Token
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token
```

**Find your LAN IP**:
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr IPv4
```

### 3. Build Development Client

**Important**: This app requires a custom development build (not Expo Go) due to Auth0 and Mapbox native modules.

```bash
# iOS (requires macOS + Xcode)
npx expo run:ios

# Android (requires Android Studio + Android SDK)
npx expo run:android
```

**This takes 5-10 minutes** and builds the dev client with all native modules. You only need to rebuild when:
- First time setup
- After installing/updating native dependencies (expo-*, react-native-*)
- After changing app.json plugins
- When you see native errors like `NoClassDefFoundError`

**See [ANDROID_TROUBLESHOOTING.md](../../ANDROID_TROUBLESHOOTING.md) for common native build issues.**

### 4. Android Emulator Setup (IMPORTANT)

**If using Android emulator**, you MUST set up adb reverse before starting the app, or you'll get:
```
Failed to connect to /10.0.2.2:8081 (ECONNREFUSED)
```

**Use the automated script**:
```bash
# macOS/Linux
npm run android:dev

# Windows
npm run android:dev:win
```

**Or manually**:
```bash
# Ensure emulator is running first
adb devices  # Should show your emulator

# Set up port forwarding
adb reverse tcp:8081 tcp:8081

# Start Metro
npx expo start --android
```

**Why this is needed**: The Android emulator tries to connect to Metro at `10.0.2.2:8081` (the host IP from the emulator's perspective), but without `adb reverse`, the connection fails. The reverse proxy forwards port 8081 from the emulator to your host machine's Metro bundler.

**iOS simulator and physical devices** don't need this setup.

### 5. Start Metro Bundler

```bash
npx expo start
```

Press:
- `i` for iOS simulator
- `a` for Android emulator (after running android:dev script)
- Scan QR code with dev client on physical device

### 6. Verify Setup

1. App should open to login screen
2. Tap "Sign In" → Auth0 login should open
3. After login, home screen should appear
4. Check that map loads (Mapbox working)

**If stuck on "Reloading..."**: This usually means Metro isn't connected. For Android emulator, make sure you ran the `android:dev` script or manually set up `adb reverse tcp:8081 tcp:8081`.

**If you see native errors** (NoClassDefFoundError, etc.): You need a full rebuild. See the "When to Rebuild" section below or run `npm run android:rebuild`.

## When to Rebuild the Native App

You **DO NOT** need to rebuild for normal JS/TS development. Metro handles hot reloading.

You **DO** need to rebuild when:
- ✅ You ran `npm install` and added/updated native dependencies
- ✅ You changed `app.json` plugins array
- ✅ You see native errors: `NoClassDefFoundError`, `Native module cannot be null`, etc.
- ✅ First time setup

**To rebuild:**
```bash
# macOS/Linux
npm run android:rebuild

# Windows
npm run android:rebuild:win
```

**For detailed troubleshooting, see [ANDROID_TROUBLESHOOTING.md](../../ANDROID_TROUBLESHOOTING.md)**

## Project Structure

```
rider/
├── src/
│   ├── app/                    # File-based routes
│   │   ├── (auth)/            # Auth screens
│   │   ├── (tabs)/            # Tab navigation
│   │   └── trip/              # Trip screens
│   ├── components/            # Reusable components
│   │   ├── map/               # Map components
│   │   ├── trip/              # Trip-related UI
│   │   └── ui/                # Generic UI
│   ├── services/              # API & external services
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── socket.ts
│   │   └── location.ts
│   ├── hooks/                 # Custom React hooks
│   ├── store/                 # Zustand stores
│   ├── types/                 # TypeScript types
│   ├── constants/             # App constants
│   ├── utils/                 # Utility functions
│   └── legal/                 # Terms & Privacy
├── assets/                    # Images, fonts, etc.
├── app.json                   # Expo configuration
├── eas.json                   # EAS Build profiles
├── package.json
├── tsconfig.json
└── .env                       # Environment variables
```

## Configuration

### Auth0 Setup

1. Create **Native** application in Auth0 dashboard
2. Configure **Allowed Callback URLs**:
   ```
   eve://YOUR_TENANT_DOMAIN/ios/ca.sherpafoods.eve/callback
   eve://YOUR_TENANT_DOMAIN/android/ca.sherpafoods.eve/callback
   ```
3. Configure **Allowed Logout URLs** (`/logout`, not `/callback`):
   ```
   eve://YOUR_TENANT_DOMAIN/ios/ca.sherpafoods.eve/logout
   eve://YOUR_TENANT_DOMAIN/android/ca.sherpafoods.eve/logout
   ```
4. Copy Domain and Client ID to `.env`

**See**: [../backend/docs/auth.md](../backend/docs/auth.md) for details.

### Mapbox Setup

1. Sign up at https://account.mapbox.com/
2. Create access token
3. Add token to `.env`
4. Restrict token to your bundle ID in Mapbox dashboard

### Push Notifications (Future)

Currently using local notifications only. FCM/APNs setup planned.

## Building

### Development Builds

```bash
# iOS development build
npx expo run:ios

# Android development build  
npx expo run:android

# Or with EAS Build (cloud)
eas build --profile development --platform ios
eas build --profile development --platform android
```

### Preview Builds (Internal Testing)

```bash
# iOS (TestFlight)
eas build --profile preview --platform ios
eas submit --platform ios --latest

# Android (Internal testing)
eas build --profile preview --platform android
eas submit --platform android --latest
```

### Production Builds

```bash
# iOS (App Store)
eas build --profile production --platform ios --submit

# Android (Play Store)
eas build --profile production --platform android --submit
```

**See**: [../STORE.md](../STORE.md) for complete release process.

## Testing

### Unit Tests

```bash
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### E2E Tests (Future)

Detox E2E tests planned.

### Manual Testing Checklist

- [ ] Login with Auth0
- [ ] Request a trip
- [ ] Receive driver offers
- [ ] Accept an offer
- [ ] Track driver location
- [ ] Complete trip
- [ ] View trip history

## Troubleshooting

### "No development client found"

**Solution**: Build development client first:
```bash
npx expo run:ios  # or run:android
```

### Cannot connect to API

**Problem**: Using `localhost` instead of LAN IP

**Solution**: Update `.env` with your machine's IP:
```bash
EXPO_PUBLIC_AUTH_URL=http://192.168.1.100:4001/api
EXPO_PUBLIC_API_URL=http://192.168.1.100:4003/api
EXPO_PUBLIC_WS_URL=http://192.168.1.100:4004
```

### Auth0 callback not working

**Solution**: 
1. Verify **Allowed Callback URLs** use `/callback` and **Allowed Logout URLs** use `/logout`
2. Rebuild development client: `npx expo run:ios`
3. Check custom scheme in `app.json` (`eve`)

### Maps not showing

**Problem**: Invalid or missing Mapbox token

**Solution**:
```bash
# Verify token in .env
grep EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN .env

# Get token from https://account.mapbox.com/
```

### "Module not found" errors

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules .expo
npm install
npx expo start --clear
```

### Environment variables not updating

**Solution**:
```bash
# Restart Metro bundler with cache clear
npx expo start --clear
```

## Related Documentation

- [Project Overview](../README.md)
- [Getting Started Guide](../GETTING_STARTED.md)
- [Backend Authentication](../backend/docs/auth.md)
- [Store Release Process](../STORE.md)
- [Environment Variables](../ENVIRONMENT_VARIABLES.md)

## Support

For issues:
1. Check [../FAQ.md](../FAQ.md)
2. Review error logs
3. Search existing issues
4. Contact development team

---

**Last Updated**: 2026-09-01
