# Arc Testnet USDC payments

Trip fares lock **USDC on Circle Arc Testnet** (chain id `5042002`). The rider signs **one** Privy transaction that deposits native `msg.value` into `RideEscrow`. Completing a trip releases to the driver; cancel refunds the rider. Platform credits (`walletBalance`) cash out with an ERC-20 USDC transfer.

Follow Circle [`use-arc`](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md):

- Wallets show a **single** USDC balance: ERC-20 `balanceOf` at `0x3600000000000000000000000000000000000000` (6 decimals).
- Escrow `value` is **18-decimal native** units of the same asset (not a second token).
- Do not add native `eth_getBalance` to the ERC-20 balance.
- Fund test wallets from [faucet.circle.com](https://faucet.circle.com). Mempool requires `maxFeePerGas` ≥ 20 Gwei.

## Service

`@eve/payment` listens on **`:4006`**. Ride still owns trip lifecycle; it calls payment helpers in-process (`quoteTripDeposit`, `confirmTripDeposit`, `releaseTripEscrow`, `refundTripEscrow`). Internal HTTP (`X-Internal-Secret`) exists for `release` / `refund`.

## Flow

1. Rider creates a trip (`paymentMethod: WALLET`).
2. Rider accepts an offer. Payment returns deposit calldata (`to`, native `value`, `data`).
3. App switches to Arc Testnet if needed, sends `eth_sendTransaction` via the Privy embedded wallet, then `POST /api/payment/trips/:id/confirm`.
4. `paymentStatus` becomes `ESCROWED`. Driver `start` / `complete` require this.
5. Complete: operator `release`. Cancel: `refund`.

Deploy the contract: [backend/contracts/README.md](contracts/README.md).

## HTTP

Mounted by the payment process (and by admin Next rewrites for `/api/payment`, `/api/driver/wallet`, `/api/rider/wallet`).

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/payment/config` | JWT | Chain id, escrow address, ERC-20 token |
| `GET` | `/api/payment/trips/:id/deposit` | Rider | Quote `to` / `value` / `data` |
| `POST` | `/api/payment/trips/:id/confirm` | Rider | Body `{ txHash }` → `ESCROWED` |
| `GET` | `/api/rider/wallet` | Rider | ERC-20 USDC balance, address, ledger |
| `GET` | `/api/driver/wallet` | Driver | ERC-20 USDC, platform credits, ledger |
| `POST` | `/api/driver/wallet/withdraw` | Driver | Cash out credits as ERC-20 USDC |
| `POST` | `/internal/trips/:id/release` | Internal | Operator release |
| `POST` | `/internal/trips/:id/refund` | Internal | Operator refund |

Admin credits: `POST /api/admin/drivers/:profileId/wallet/credit` on the **admin** service.

## Env

`PAYMENT_PORT=4006`, `ESCROW_CONTRACT_ADDRESS`, `TREASURY_PRIVATE_KEY`, `CHAIN_RPC_URL`. Default `PAYOUT_TOKEN_ADDRESS` is Arc ERC-20 USDC. Set `PAYOUT_TOKEN_ADDRESS=native` only to force native treasury sends.

Apps need `EXPO_PUBLIC_PAYMENT_URL` (e.g. `http://localhost:4006/api`). Admin: `PAYMENT_PROXY_TARGET=http://127.0.0.1:4006`.
