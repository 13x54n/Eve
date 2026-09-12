# Privy × Eve

Judge-facing note for **ETHOnline**: how Eve uses [Privy](https://www.privy.io/) for auth, wallets, funding, and escrow signatures.

## Problem → web3 rides

Riders and drivers need **login without seed phrases**, wallets that can hold **Arc USDC**, and one-tap signing for escrow — not a DIY key-management product. Privy is that layer.

## Three pillars

| Pillar | What Privy does |
| --- | --- |
| **Rider** | Email/SMS (and passkeys where enabled) → Eve JWT. Embedded Ethereum (+ Solana) wallet. Wallet screen: **Buy** (`useFundWallet`) next to **Receive**. Escrow `deposit` / `refund` / `dispute` via `eth_sendTransaction`. |
| **Driver** | Same auth + embedded wallets. Signs `startSettlement` after trip complete. Earnings / cash-out use the linked EVM address. |
| **Server host** | `@eve/auth` exchanges a Privy **identity token** for Eve API JWTs. `@eve/payment` quotes calldata; apps sign. Operator/treasury key finalizes undisputed escrow and platform cash-outs (not the user’s Privy key). |

## Auth

1. Rider/driver apps wrap the tree in `PrivyProvider` (`@privy-io/expo`) with `EXPO_PUBLIC_PRIVY_APP_ID` + `EXPO_PUBLIC_PRIVY_CLIENT_ID`.
2. User completes email OTP / SMS (Dashboard: identity tokens, SMS, funding).
3. App sends the Privy identity token to `@eve/auth`; backend verifies and issues Eve JWTs for ride/payment/notify.

Details: [backend/docs/auth.md](backend/docs/auth.md).

## Embedded wallets

On login, Eve creates wallets for users who do not have them:

```ts
embedded: {
  ethereum: { createOnLogin: "users-without-wallets" },
  solana: { createOnLogin: "users-without-wallets" },
}
```

Trip escrow runs on **EVM (Arc Testnet)**. The embedded Ethereum address is what riders fund and what drivers settle with.

## Custom EVM chain (Arc Testnet)

Arc Testnet (`eip155:5042002`) was **not** on Privy’s default chain allowlist, so apps pass a custom viem chain (`eveArcTestnet` from `lib/arc-chain.ts`) into `PrivyProvider` `supportedChains` and use that chain for balance reads and funding.

Canonical Arc story + addresses: **[ARC.md](ARC.md)** and [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md).

## Buy / Add funds (card onramp)

Rider wallet mounts `<PrivyElements />` (required) and uses `useFundWallet` from `@privy-io/expo/ui` — **not** the React web `useFiatOnramp` hook.

- Target: linked EVM wallet
- Asset: Arc USDC `0x3600000000000000000000000000000000000000`
- RN providers: **MoonPay / Coinbase** only
- UI: **Buy** control on the same screen as **Receive**

Enable funding + MoonPay/Coinbase in the Privy Dashboard for the app.

## Escrow signing

Payment returns quotes (`to`, `value`, `data`, `chainId`). The mobile client switches to Arc if needed and sends:

`eth_sendTransaction` via the Privy embedded Ethereum wallet

Then `POST /api/payment/trips/:id/confirm` with `{ txHash, action }`.

Apps **do not** hardcode `RideEscrow`; they read `GET /api/payment/config`.

## Dashboard checklist

- [ ] Identity tokens
- [ ] Email / SMS (and passkeys if used)
- [ ] Embedded wallets
- [ ] Custom chain / Arc Testnet allowed for the app
- [ ] Funding (MoonPay / Coinbase) for rider Buy
