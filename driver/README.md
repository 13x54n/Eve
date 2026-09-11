# Eve Driver app

The Driver app is an Expo 57 / React Native 0.86 application for driver onboarding, availability, trip offers, lifecycle actions, earnings, and wallet activity.

## Features

- Privy sign-in and embedded EVM wallet
- Vehicle and document onboarding, then staff approval
- Foreground location/presence and nearby trip offers
- Pickup, start, complete, support, and chat flows
- Arc Testnet settlement signing and driver USDC/credit wallet views

## Local development

```bash
cd driver
cp .env.example .env
npm install
npx expo run:android # or npx expo run:ios
npx expo start
```

Use the same backend URL shape as the Rider app, but configure a separate Privy App Client for the Driver bundle. Use a LAN address rather than `localhost` on a physical device. Expo Go is not sufficient for the native Privy and Mapbox dependencies.

## Wallet lifecycle

The rider deposits a matched fare into `RideEscrow`. After the ride is completed, the driver signs the settlement transaction; the operator finalizes it after the dispute window unless there is a dispute. The driver wallet also shows platform credits and supports a Payment-owned withdrawal flow.

The app receives contract and chain configuration from Payment. Never add a contract address, operator address, or treasury key to a Driver Expo environment file. See [../backend/docs/driver-wallet.md](../backend/docs/driver-wallet.md).

## Checks

```bash
npm test
npm run lint
```

See [../GETTING_STARTED.md](../GETTING_STARTED.md) for backend setup and [../STORE.md](../STORE.md) for EAS releases.
