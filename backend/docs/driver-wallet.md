# Driver / rider Arc Testnet payments

Trip fares lock **USDC on Circle Arc Testnet** (`5042002`). The rider signs **one** Privy transaction that deposits native `msg.value` into `RideEscrow`. Completing a trip releases to the driver; cancel refunds the rider. Platform credits (`walletBalance`) cash out with an ERC-20 USDC transfer.

Per [`use-arc`](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md):

- Wallets show a **single** USDC balance: ERC-20 `balanceOf` at `0x3600000000000000000000000000000000000000` (6 decimals).
- Escrow `value` is **18-decimal native** units of the same asset (not a second token).
- Do not add native `eth_getBalance` to the ERC-20 balance.

## Flow

1. Rider creates a trip (`paymentMethod: WALLET`).
2. Rider accepts an offer. Payment service returns deposit calldata (`to`, `value`, `data`).
3. App switches to Arc Testnet (`5042002`) if needed, sends `eth_sendTransaction` via the Privy embedded wallet, then `POST /api/payment/trips/:id/confirm`.
4. `paymentStatus` becomes `ESCROWED`. Driver `start` / `complete` require this.
5. Complete: payment service operator calls `release`. Cancel: `refund`.

Deploy the contract with Foundry: [backend/contracts/README.md](contracts/README.md) and [Deploy on Arc](https://docs.arc.io/arc/tutorials/deploy-on-arc).

## Env

`PAYMENT_PORT=4006`, `ESCROW_CONTRACT_ADDRESS`, `TREASURY_PRIVATE_KEY`, `CHAIN_RPC_URL`. Apps need `EXPO_PUBLIC_PAYMENT_URL` (e.g. `http://localhost:4006/api`).

Admin credits: `POST /api/admin/drivers/:profileId/wallet/credit`. Driver cash-out: `POST /api/driver/wallet/withdraw` on the **payment** service.
