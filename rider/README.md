# Eve Rider app

The Rider app is an Expo 57 / React Native 0.86 application for requesting trips, reviewing offers, tracking a driver, support, and wallet actions.

## Features

- Privy SMS, email, and passkey sign-in with an embedded EVM wallet
- Ride request, fare offers, real-time tracking, chat, history, and courier tracking
- Arc Testnet USDC escrow deposit signing
- Wallet balance, receive QR, address sharing, and USDC transfer

## Local development

```bash
cd rider
cp .env.example .env
npm install
npx expo run:android # or npx expo run:ios
npx expo start
```

Build a development client before opening Metro. Expo Go cannot load the Privy/passkey native integration.

For a physical device, use the development computer's LAN address in `.env`:

```dotenv
EXPO_PUBLIC_AUTH_URL=http://YOUR_HOST:4001/api
EXPO_PUBLIC_API_URL=http://YOUR_HOST:4003/api
EXPO_PUBLIC_PAYMENT_URL=http://YOUR_HOST:4006/api
EXPO_PUBLIC_WS_URL=http://YOUR_HOST:4004
EXPO_PUBLIC_PRIVY_APP_ID=your-privy-app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your-rider-privy-client-id
EXPO_PUBLIC_PRIVY_RELYING_PARTY=https://your-domain.com
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token
```

## Wallet

Wallet flows live in `src/app/profile/wallet.tsx`. The screen displays the rider's linked EVM wallet address, on-chain balance, and activity ledger, and supports receiving funds (with QR code and copy/share) as well as direct cash-out / transfers.

For escrow configuration and funding test wallets, see [../backend/docs/driver-wallet.md](../backend/docs/driver-wallet.md).

## Checks

```bash
npm test
npm run lint
```

Use [../TESTING.md](../TESTING.md) for the repository test matrix and [../STORE.md](../STORE.md) for EAS release instructions.
