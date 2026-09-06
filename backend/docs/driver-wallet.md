# Arc Testnet USDC payments

Trip fares lock **USDC on Circle Arc Testnet** (chain id `5042002`). The rider signs a Privy `deposit`. After the trip the **driver** signs `startSettlement` (5-minute on-chain window). Undisputed fares auto-finalize. A rider `dispute` holds funds until operator review. Platform credits (`walletBalance`) cash out with `TREASURY_PRIVATE_KEY`; that key also sends operator escrow calls.

Follow Circle [`use-arc`](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md):

- Wallets show a **single** USDC balance: ERC-20 `balanceOf` at `0x3600000000000000000000000000000000000000` (6 decimals).
- Escrow `value` is **18-decimal native** units of the same asset (not a second token).
- Do not add native `eth_getBalance` to the ERC-20 balance.
- Fund test wallets from [faucet.circle.com](https://faucet.circle.com). Mempool requires `maxFeePerGas` ≥ 20 Gwei.

## Service

`@eve/payment` listens on **`:4006`**. Ride owns trip status. Payment quotes calldata and confirms receipts. Apps sign with Privy `eth_sendTransaction`.

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

Deploy the contract: [backend/contracts/README.md](../contracts/README.md). Constructor takes the **operator** address.

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
| `GET` | `/api/driver/wallet` | Driver | ERC-20 USDC, platform credits, ledger |
| `POST` | `/api/driver/wallet/withdraw` | Driver | Cash out credits as ERC-20 USDC |
| `POST` | `/api/admin/tickets/:id/escrow-resolve` | Admin | Body `{ releaseToPayee }` operator resolve |

Admin credits: `POST /api/admin/drivers/:profileId/wallet/credit` on the **admin** service.

## Env

`PAYMENT_PORT=4006`, `ESCROW_CONTRACT_ADDRESS`, `ESCROW_OPERATOR_ADDRESS`, `TREASURY_PRIVATE_KEY`, `CHAIN_RPC_URL`. Default `PAYOUT_TOKEN_ADDRESS` is Arc ERC-20 USDC. Set `PAYOUT_TOKEN_ADDRESS=native` only to force native treasury sends.

Apps need `EXPO_PUBLIC_PAYMENT_URL` (e.g. `http://localhost:4006/api`). Admin: `PAYMENT_PROXY_TARGET=http://127.0.0.1:4006`.
