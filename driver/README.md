# Eve Driver App

Mobile application for drivers to receive trip requests, manage rides, and track earnings.

**Platform**: iOS & Android  
**Framework**: Expo SDK 57 / React Native  
**Bundle ID**: `ca.sherpafoods.evedriver`  
**Language**: TypeScript

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Onboarding Flow](#onboarding-flow)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Building](#building)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

The Driver app enables drivers to:
- Complete vehicle and document onboarding
- Go online/offline to receive trip requests
- View incoming trips nearby
- Submit competitive fare offers
- Navigate to pickup and dropoff locations
- Track trip status and earnings
- Manage vehicle and document information

## Features

### Authentication & Onboarding
- Privy SMS / passkeys
- Multi-step onboarding wizard
- Vehicle registration (type, year, color, plate)
- Document upload (license, insurance, vehicle registration)
- ImageKit integration for photo uploads
- Approval workflow

### Trip Management
- Real-time trip requests nearby
- Submit custom fare offers
- View trip details and route
- Trip status management (arriving, in progress, complete)
- Trip history and earnings

### Navigation & Location
- GPS tracking every 5 seconds
- Live rider location updates
- Mapbox turn-by-turn navigation
- Offline mode support

### Presence System
- Online/Offline toggle
- Idle detection
- Auto-offline on low battery
- Geospatial indexing for matching

### Earnings
- Daily, weekly, monthly summaries
- Per-trip breakdown
- Total lifetime earnings
- Export reports

### Communication
- In-trip chat with rider
- Push notifications
- Trip status updates

## Architecture

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Expo | 57 | React Native framework |
| React Native | 0.76+ | Mobile UI |
| TypeScript | 5.9+ | Type safety |
| Privy | @privy-io/expo | Authentication and wallets |
| Mapbox | @rnmapbox/maps | Maps & navigation |
| Socket.IO | socket.io-client | Real-time events |
| Zustand | 4.x | State management |
| expo-document-picker | Latest | Document uploads |

### Navigation

File-based routing:

```
src/app/
  (auth)/
    login.tsx           # SMS / passkey login
    onboarding/
      vehicle.tsx       # Vehicle info
      documents.tsx     # Upload docs
      approval.tsx      # Pending approval
  (tabs)/
    home.tsx           # Online/Offline, incoming trips
    trips.tsx          # Trip history
    earnings.tsx       # Earnings dashboard
    profile.tsx        # Profile & vehicle
  trip/
    [id].tsx           # Active trip screen
    navigation.tsx     # Turn-by-turn
```

### State Management

- **Zustand** for global state (presence, active trip, earnings)
- **React Query** for API data
- **Context** for theme and settings

### Key Services

```typescript
// src/services/
auth.ts         // Privy exchange, token management
api.ts          // HTTP client
socket.ts       // WebSocket connection
location.ts     // GPS tracking, background location
driver.ts       // Driver-specific API calls
notifications.ts // Push notifications
```

## Prerequisites

### Required

- **macOS**: For iOS development (Xcode 15+)
- **Node.js**: 22.x or higher
- **Expo CLI**: Latest
- **Xcode** (iOS) or **Android Studio** (Android)

### Accounts

- **Privy**: Authentication and embedded wallets
- **Mapbox**: Maps (same token as rider app)
- **ImageKit**: Document uploads
- **Apple Developer**: iOS ($99/year)
- **Google Play**: Android ($25 one-time)

## Local Development

### 1. Install Dependencies

```bash
cd driver
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Backend URLs (use LAN IP for physical devices)
EXPO_PUBLIC_AUTH_URL=http://192.168.1.100:4001/api
EXPO_PUBLIC_API_URL=http://192.168.1.100:4003/api
EXPO_PUBLIC_WS_URL=http://192.168.1.100:4004

# Privy (separate client from rider)
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your-driver-privy-client-id
EXPO_PUBLIC_PRIVY_RELYING_PARTY=https://your-domain.com

# Mapbox
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token
```

### 3. Build Development Client

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

### 4. Start Metro

```bash
npx expo start
```

### 5. Test Onboarding

1. Sign in with SMS or passkey
2. Complete vehicle registration
3. Upload documents (use test images)
4. Submit for approval
5. Manually approve in admin console
6. Return to app (should show home screen)

## Onboarding Flow

New drivers must complete onboarding before going online:

### 1. Privy Sign-Up

- SMS OTP or passkey
- Creates user account with `DRIVER` role
- Creates `DriverProfile` with `PENDING` approval status

### 2. Vehicle Information

Required fields:
- Vehicle type (CAR or BIKE)
- Year
- Make & Model
- Color
- License plate

### 3. Document Upload

Required documents:
- **Driver's license** (front & back)
- **Vehicle registration**
- **Insurance certificate**
- (Optional) Profile photo

**Upload Process**:
1. Pick document with `expo-document-picker`
2. Request ImageKit auth token from backend
3. Upload to ImageKit CDN
4. Save URL to database

### 4. Submit for Approval

- Documents sent to admin for review
- Status: `PENDING` → `APPROVED` or `REJECTED`
- Driver receives email notification
- Can only go online after `APPROVED`

### 5. First Online

- Complete onboarding checklist
- Turn on location permissions
- Go online to start receiving trips

## Project Structure

```
driver/
├── src/
│   ├── app/                    # File-based routes
│   │   ├── (auth)/            # Auth & onboarding
│   │   ├── (tabs)/            # Tab navigation
│   │   └── trip/              # Trip screens
│   ├── components/
│   │   ├── map/               # Map components
│   │   ├── trip/              # Trip UI
│   │   ├── onboarding/        # Onboarding steps
│   │   └── ui/                # Generic components
│   ├── services/
│   │   ├── driver.ts          # Driver API
│   │   ├── location.ts        # GPS tracking
│   │   └── upload.ts          # Document upload
│   ├── lib/
│   │   └── onboarding-steps.ts # Onboarding logic
│   ├── hooks/
│   ├── store/
│   ├── types/
│   └── legal/
├── assets/
├── app.json
├── eas.json
└── .env
```

## Configuration

### Privy Setup

**Important**: Driver uses a **different Privy App Client** than rider.

1. Create a driver App Client with bundle ID `ca.sherpafoods.evedriver`
2. Enable SMS, passkeys, identity tokens, and Ethereum + Solana wallets
3. Copy that Client ID into the driver `.env` (`EXPO_PUBLIC_PRIVY_CLIENT_ID`)
4. Use the same App ID and relying-party origin as rider

### ImageKit Setup

1. Sign up at https://imagekit.io
2. Get API keys from dashboard
3. Configure in **backend** `.env`:
   ```bash
   IMAGEKIT_PRIVATE_KEY=private_...
   IMAGEKIT_PUBLIC_KEY=public_...
   IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id
   IMAGEKIT_DRIVER_FOLDER=/eve/drivers
   ```

Documents are uploaded to ImageKit, backend handles auth tokens.

### Background Location (Future)

For real-time tracking during trips. Currently using foreground location only.

## Building

### Development Builds

```bash
npx expo run:ios      # iOS
npx expo run:android  # Android

# Or cloud build
eas build --profile development --platform ios
```

### Preview/Production

```bash
# Preview (TestFlight/Internal)
eas build --profile preview --platform ios --submit

# Production
eas build --profile production --platform ios --submit
```

**See**: [../STORE.md](../STORE.md)

## Testing

### Unit Tests

```bash
npm test
npm test -- --watch
npm test -- --coverage
```

### Manual Testing

- [ ] Sign up and complete onboarding
- [ ] Admin approves driver
- [ ] Go online
- [ ] Receive trip request
- [ ] Submit offer
- [ ] Accept assigned trip
- [ ] Navigate to pickup
- [ ] Start trip
- [ ] Navigate to dropoff
- [ ] Complete trip
- [ ] View earnings

## Troubleshooting

### Cannot go online after approval

**Problem**: Onboarding incomplete or approval not synced

**Solution**:
1. Check onboarding status in profile
2. Pull to refresh on home screen
3. Logout and login again
4. Verify approval status in admin console

### Location not updating

**Problem**: GPS permissions or background location

**Solution**:
1. Check location permissions in settings
2. Enable "Always" for background location
3. Restart app
4. Check GPS signal (indoor/outdoor)

### Document upload fails

**Problem**: ImageKit configuration or file size

**Solution**:
```bash
# Check file size (<10MB recommended)
# Check backend ImageKit config
cd ../backend
grep IMAGEKIT .env

# Check backend logs
cd ../backend
npm run dev
```

### No trip requests appearing

**Problem**: Not approved, offline, or no trips nearby

**Solution**:
1. Verify `approvalStatus = APPROVED`
2. Toggle online/offline
3. Check presence API: `PATCH /api/driver/presence`
4. Create test trip from rider app
5. Check distance (must be within 15km)

### Privy client mismatch

**Problem**: Login works in rider but not driver, or identity-token exchange fails

**Solution**:
1. Verify the driver Privy App Client uses bundle ID `ca.sherpafoods.evedriver`
2. Confirm `EXPO_PUBLIC_PRIVY_CLIENT_ID` is the driver client, not the rider client
3. Rebuild the development client after env changes

## Related Documentation

- [Project Overview](../README.md)
- [Getting Started](../GETTING_STARTED.md)
- [Backend Auth](../backend/docs/auth.md)
- [Store Release](../STORE.md)
- [FAQ](../FAQ.md)

## Support

For issues, check [../FAQ.md](../FAQ.md) or contact the development team.

---

**Last Updated**: 2026-09-01
