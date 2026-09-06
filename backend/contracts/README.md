# Ride escrow (Arc Testnet)

Native USDC escrow for Eve trip fares. The **rider** signs `deposit` (`msg.value`). After the trip, the **driver** signs `startSettlement` (5-minute dispute window). If nobody disputes, the **operator** auto-finalizes. A rider `dispute` freezes funds until the operator `resolve`s (release or refund). Pre-settlement cancel is still a rider-signed `refund`.

Follow Circle's [`use-arc`](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md) rules:

- **One asset, two views.** Native gas **is** USDC. Do not treat native + ERC-20 as two balances.
- **Native view (18 decimals):** gas and `msg.value` only. This contract holds native USDC.
- **ERC-20 view (6 decimals):** `0x3600000000000000000000000000000000000000` for balances, transfers, approvals, and display.
- Factor: `1e18` native = `1e6` ERC-20 (`10^12`). Never sum the two views.

Chain id `5042002`. Fund wallets from [faucet.circle.com](https://faucet.circle.com) (Arc Testnet). Mempool requires at least 20 Gwei `maxFeePerGas`.

`DISPUTE_WINDOW` is **5 minutes**, enforced on-chain. Constructor takes the **operator** address (`ESCROW_OPERATOR_ADDRESS`, or the treasury key address).

## Foundry

See [Deploy on Arc](https://docs.arc.io/arc/tutorials/deploy-on-arc).

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
cd backend/contracts
forge install foundry-rs/forge-std --no-commit
forge test
```

Set RPC in the environment (do not commit keys):

```bash
export ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io
export ESCROW_OPERATOR_ADDRESS=0xYourOperator
```

Preferred deploy (encrypted keystore — required outside local testing):

```bash
cast wallet import deployer --interactive
forge create src/RideEscrow.sol:RideEscrow \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --account deployer \
  --constructor-args $ESCROW_OPERATOR_ADDRESS \
  --broadcast
```

Local testing only — never pass `--private-key` as a CLI flag in testnet, staging, or production:

```bash
forge create src/RideEscrow.sol:RideEscrow \
  --rpc-url $ARC_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --constructor-args $ESCROW_OPERATOR_ADDRESS \
  --broadcast
```

Verify on Arcscan (Blockscout):

```bash
forge verify-contract $ESCROW_CONTRACT_ADDRESS src/RideEscrow.sol:RideEscrow \
  --chain-id 5042002 \
  --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api/ \
  --constructor-args $(cast abi-encode "constructor(address)" $ESCROW_OPERATOR_ADDRESS)
```

Set `ESCROW_CONTRACT_ADDRESS` in `backend/.env`. Platform credit cash-out and escrow operator txs use `TREASURY_PRIVATE_KEY` unless `ESCROW_OPERATOR_ADDRESS` is set to another wallet you control.
