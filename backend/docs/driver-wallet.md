# Driver Eve Wallet

Trip **matched fares stay cash / off-platform**. They increment `DriverProfile.earningsTotal` only.

Eve Wallet is a separate USD ledger (`DriverProfile.walletBalance`) for **platform credits** (admin bonuses). Drivers cash out to the **Privy embedded Ethereum wallet** created at login (`User.ethereumWallet`).

## Flow

1. Admin credits the driver: `POST /api/admin/drivers/:profileId/wallet/credit` (`payments:payout`).
2. Driver app shows balance on the earnings tab and calls `GET /api/driver/wallet`.
3. Cash-out: `POST /api/driver/wallet/withdraw` `{ amount, idempotencyKey? }`.
4. Ride service debits `walletBalance` and writes `LedgerEntry` type `WALLET_WITHDRAW`.
5. If `TREASURY_PRIVATE_KEY` and `CHAIN_RPC_URL` are set, `@eve/shared` sends testnet crypto (default **Base Sepolia**) via viem to `ethereumWallet`. Otherwise the row stays `PENDING`.
6. Admin `POST /api/admin/payouts` `{ userId, amount, note? }` also debits the ledger and uses the same treasury path when configured.

Solana addresses are stored and shown; payouts in this version are Ethereum only.

## Env (backend)

See `backend/.env.example`: `TREASURY_PRIVATE_KEY`, `CHAIN_RPC_URL`, `PAYOUT_CHAIN_ID` (default `84532`), optional `PAYOUT_TOKEN_ADDRESS` for ERC-20.

## Related

- [auth.md](auth.md) — Privy session and wallet address persistence
- Driver UI: `driver/src/app/(tabs)/earnings/index.tsx`
