# Arc × Eve

Judge-facing note for **ETHOnline**: why Eve settles on **Circle Arc**, how testnet works today, and what “mainnet-ready” means.

Deep ops reference: [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md) · Contracts: [backend/contracts/README.md](backend/contracts/README.md)

## Why Arc

| Need | Arc |
| --- | --- |
| Stable fare asset | **Native USDC** (one asset, ERC-20 view for balances) |
| Cheap escrow txs | Low gas on Arc Testnet → same pattern for mainnet |
| Familiar tooling | **viem** + Circle faucet / Arcscan |

Eve does **not** take commission. Matched fare locks in `RideEscrow` until release or refund.

## Testnet coordinates

| | |
| --- | --- |
| Chain id | `5042002` (`eip155:5042002`) |
| RPC | `https://rpc.testnet.arc.io` |
| USDC (ERC-20, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| RideEscrow | [`0xdE6f01794e74AfDbAd4C783123241285c1947f4C`](https://testnet.arcscan.app/address/0xde6f01794e74afdbad4c783123241285c1947f4c) |
| Operator / treasury | `0xf4Ea0728c0EEc26c590a651A27a388121e1fA8e3` |
| Faucet | [faucet.circle.com](https://faucet.circle.com) (Arc Testnet) |

Mempool: `maxFeePerGas` ≥ 20 Gwei.

**USDC is one asset, two views** (Circle `use-arc`): ERC-20 `balanceOf` for wallets/display; native 18-decimal `msg.value` for escrow. Never sum the two.

## Trip money flow

```text
deposit (rider Privy) → ESCROWED → startSettlement (driver) → 5m window
       → finalize (operator) OR dispute → admin resolve
cancel while locked → refund (rider)
```

1. Rider accepts offer → payment quotes `deposit`.
2. Rider signs with Privy → confirm → `ESCROWED`.
3. Driver completes trip → quotes `startSettlement` → driver signs.
4. No dispute → operator **auto-finalize** after ~5 minutes → driver earnings.
5. Dispute → funds held until admin `escrow-resolve`.
6. Cancel while locked → rider signs `refund`.

Apps call `GET /api/payment/config` and quote endpoints — they never hardcode the escrow address in Expo env.

## Server role (viem)

`@eve/payment` (`:4006`) uses **viem** against Arc RPC to:

- Quote deposit / settlement / dispute / refund calldata
- Confirm receipts after Privy txs
- Run operator `finalize` / resolve with `TREASURY_PRIVATE_KEY`
- Drive treasury cash-out for platform credits (`POST /api/driver/wallet/withdraw`, etc.)

Rider/driver wallets show on-chain ERC-20 USDC; cash-out notes live in [driver-wallet.md](backend/docs/driver-wallet.md).

## Mainnet-ready

Same product shape on Arc mainnet:

1. Redeploy `RideEscrow` with the production operator.
2. Point `CHAIN_RPC_URL`, `ESCROW_*`, `PAYOUT_TOKEN_ADDRESS`, faucet → mainnet USDC.
3. Flip Privy supported chain + funding to mainnet Arc.
4. Keep quote → Privy sign → confirm; no app rewrite of the escrow state machine.

Testnet proves the **Privy + Arc** prize path end-to-end before that flip.

## Related

- Auth / wallets: **[PRIVY.md](PRIVY.md)**
- HTTP + env tables: [backend/docs/driver-wallet.md](backend/docs/driver-wallet.md)
