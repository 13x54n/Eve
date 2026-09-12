# Arc Testnet USDC payments

Trip fares lock **USDC on Circle Arc Testnet** (chain id `5042002`). The rider signs a Privy `deposit`. After the trip the **driver** signs `startSettlement` (5-minute on-chain window). Undisputed fares auto-finalize. A rider `dispute` holds funds until operator review. Platform credits (`walletBalance`) cash out with `TREASURY_PRIVATE_KEY`; that key also sends operator escrow calls and treasury-settled driver swaps.

Follow Circle [`use-arc`](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md):

- Wallets show a **single** USDC balance: ERC-20 `balanceOf` at `0x3600000000000000000000000000000000000000` (6 decimals).
- Escrow `value` is **18-decimal native** units of the same asset (not a second token).
- EURC (swap pair): `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 decimals).
- Do not add native `eth_getBalance` to the ERC-20 balance.
- Fund test wallets from [faucet.circle.com](https://faucet.circle.com). Mempool requires `maxFeePerGas` ≥ 20 Gwei.

## Service

`@eve/payment` listens on **`:4006`**. Ride owns trip status. Payment quotes calldata and confirms receipts. Apps sign with Privy `eth_sendTransaction`.

On the desktop host (`DESKTOP-CM59BMB`), Docker usually runs **only Postgres + Redis**. The six Node services (including payment) run on the host via `npm run dev` (`tsx` watch). Full `docker compose up` is optional.

## Flow

1. Rider creates a trip (`paymentMethod: WALLET`).
2. Rider accepts an offer. Payment returns deposit calldata (`to`, native `value`, `data`).
3. App switches to Arc Testnet if needed, sends `eth_sendTransaction`, then `POST /api/payment/trips/:id/confirm` with `action: "deposit"`.
4. `paymentStatus` becomes `ESCROWED`. Driver `start` requires this.
5. Driver `complete` marks the trip complete and `SETTLING`, and returns a `startSettlement` quote. Earnings are **not** credited yet.
6. Driver signs `startSettlement`. `escrowSettleFrom` is now + 5 minutes (`DISPUTE_WINDOW` on-chain). Payment schedules an automatic operator `finalize`.
7. Rider may quote/sign `dispute` before that time. A dispute **cancels** the auto-finalize timer; funds stay locked until admin AI (or staff) `resolve`s release or refund.
8. Without a dispute, payment finalizes when the window ends (chain/app events). Payment credits `earningsTotal` and sets `COMPLETED`.
9. Cancel while still locked: HTTP cancel returns a `refund` quote; the rider (payer) must confirm `refund`.

Redeploy only if you need a new operator or bytecode: [backend/contracts/README.md](../contracts/README.md). Constructor takes the **operator** address.

## Current Arc Testnet deployment

Live instance (chain id `5042002`). Restart `@eve/payment` after changing `backend/.env`. Leave `LOAD_ESCROW` unset so quotes hit this contract.

| | |
| --- | --- |
| RideEscrow | [`0xdE6f01794e74AfDbAd4C783123241285c1947f4C`](https://testnet.arcscan.app/address/0xde6f01794e74afdbad4c783123241285c1947f4c) |
| Operator / treasury | `0xf4Ea0728c0EEc26c590a651A27a388121e1fA8e3` |
| USDC (ERC-20, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| EURC (ERC-20, 6 decimals) | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| RPC | `https://rpc.testnet.arc.io` |

**Apps do not set the contract address.** Rider and driver call `GET /api/payment/config` and the deposit/settlement/dispute/refund quotes. They only need `EXPO_PUBLIC_PAYMENT_URL` (optional `EXPO_PUBLIC_CHAIN_RPC_URL`). Fund each rider’s **Privy embedded** Ethereum address from [faucet.circle.com](https://faucet.circle.com) (Arc Testnet), not only the operator.

## Rider wallet (app + API)

Profile → Wallet (`rider/src/app/profile/wallet.tsx`):

- **Receive** — QR of the Privy embedded Ethereum address.
- **Buy** — Privy `useFundWallet` (client-only; MoonPay sandbox / Coinbase). Not a backend route.
- **Cash out** — on-chain USDC send from the embedded wallet, then `POST /api/rider/wallet/withdraw` (or `POST /api/rider/wallet/transfers` when recording a client-signed transfer).

## Driver wallet, cash-out, bank, swap

Earnings screen (`driver/src/app/(tabs)/earnings/`):

- **Receive** — QR of the Privy embedded Ethereum address.
- **Cash out → Wallet** — send on-chain USDC from the embedded wallet (or treasury payout of Eve credits to the linked address). `POST /api/driver/wallet/withdraw` with `destination: "wallet"` (default).
- **Cash out → Bank** — Eve earnings (`walletBalance`) to a saved US bank (UI shows last-4 only). Body: `{ amount, destination: "bank", bankAccountId }`. Ledger `method` is `BANK`. Live ACH needs Privy Bridge production + KYC; with `PRIVY_FIAT_ENVIRONMENT=sandbox` the API records the debit locally / sandbox.
- **Bank accounts** — `GET` / `POST` / `DELETE /api/driver/wallet/bank-accounts` (US routing + account number; responses expose last-4, not full numbers).
- **Swap** — estimate then execute USDC ↔ EURC (and related supported tokens) against the treasury.

### Swap settlement (not a fake hash)

`POST /api/driver/wallet/swap/estimate` returns the quote plus `treasuryOutBalance` and `canSettle`.

`POST /api/driver/wallet/swap` execute path:

1. Check treasury `tokenOut` balance first (409 / `ConflictError` if it cannot pay).
2. Driver sends `tokenIn` to the treasury on-chain and passes `depositTxHash`.
3. Payment waits for the deposit transfer, then treasury sends `tokenOut`.
4. If the payout fails after deposit confirmation, treasury refunds `tokenIn`.

Balance helpers treat Vitest mode as true **only** when `VITEST=true` or `VITEST=1`. A `.env` line `VITEST=false` must not stub balances.

## HTTP

Mounted by the payment process (and by admin Next rewrites for `/api/payment`, `/api/driver/wallet`, `/api/rider/wallet`).

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/payment/config` | JWT | Chain id, escrow address, ERC-20 token, dispute window |
| `GET` | `/api/payment/trips/:id/deposit` | Rider | Quote `deposit` |
| `GET` | `/api/payment/trips/:id/settlement` | Driver | Quote `startSettlement` or `finalize` |
| `GET` | `/api/payment/trips/:id/dispute` | Rider | Quote `dispute` |
| `GET` | `/api/payment/trips/:id/refund` | Rider | Quote `refund` |
| `POST` | `/api/payment/trips/:id/confirm` | Rider or driver | Body `{ txHash, action? }` |
| `GET` | `/api/rider/wallet` | Rider | ERC-20 USDC balance, address, ledger |
| `POST` | `/api/rider/wallet/withdraw` | Rider | Cash-out / record withdraw |
| `POST` | `/api/rider/wallet/transfers` | Rider | Record client-signed on-chain transfer |
| `GET` | `/api/driver/wallet` | Driver | ERC-20 USDC, platform credits, bank accounts, ledger |
| `POST` | `/api/driver/wallet/withdraw` | Driver | Cash out credits: `destination=wallet\|bank` + optional `bankAccountId` |
| `POST` | `/api/driver/wallet/transfers` | Driver | Record client-signed on-chain transfer |
| `POST` | `/api/driver/wallet/swap/estimate` | Driver | Quote + `treasuryOutBalance` / `canSettle` |
| `POST` | `/api/driver/wallet/swap` | Driver | Execute treasury-settled swap (`depositTxHash` required for treasury path) |
| `GET` | `/api/driver/wallet/bank-accounts` | Driver | List / sync saved US banks |
| `POST` | `/api/driver/wallet/bank-accounts` | Driver | Register US bank (last-4 stored) |
| `DELETE` | `/api/driver/wallet/bank-accounts/:id` | Driver | Remove bank |
| `POST` | `/api/admin/tickets/:id/escrow-resolve` | Admin | Body `{ releaseToPayee }` operator resolve |

Related ride endpoint (not on payment): `GET /api/rider/nearby-drivers?lat=&lng=` on **ride** `:4003` lists ONLINE/IDLE drivers for map pins.

Admin credits: `POST /api/admin/drivers/:profileId/wallet/credit` on the **admin** service.

## Env

`PAYMENT_PORT=4006`, `ESCROW_CONTRACT_ADDRESS`, `ESCROW_OPERATOR_ADDRESS`, `TREASURY_PRIVATE_KEY`, `CHAIN_RPC_URL`. Default `PAYOUT_TOKEN_ADDRESS` is Arc ERC-20 USDC. Set `PAYOUT_TOKEN_ADDRESS=native` only to force native treasury sends. `ESCROW_OPERATOR_ADDRESS` defaults to the treasury key address if unset; it must match the contract constructor.

Fiat / bank: `PRIVY_FIAT_ENVIRONMENT=sandbox` (default for local). Production ACH needs Privy Bridge + KYC.

Do **not** put private keys, Privy secrets, or full `.env` values in docs or client apps. Public contract addresses and ports are fine.

Apps need `EXPO_PUBLIC_PAYMENT_URL` (e.g. `http://localhost:4006/api`). Admin: `PAYMENT_PROXY_TARGET=http://127.0.0.1:4006`.

**Last verified**: Sep 2026 (desktop host split stack).