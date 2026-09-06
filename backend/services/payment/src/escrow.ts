import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  parseEventLogs,
  parseGwei,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fail } from "@eve/shared";
import {
  getChainRpcUrl,
  getPayoutChainPublicConfig,
  isTreasuryConfigured,
} from "@eve/shared/treasury";
import { ESCROW_ABI } from "./escrow-abi.js";
import { payoutChain } from "./chain.js";

export type DepositQuote = {
  chainId: number;
  chainName: string;
  to: string;
  value: string;
  data: Hex;
  tripIdHash: Hex;
  amountUsd: number;
  tokenSymbol: string;
  decimals: number;
  explorerTxUrl: string;
};

type LockedDeposit = {
  payer: string;
  payee: string;
  amountWei: bigint;
  state: "locked" | "released" | "refunded";
  depositTx: string;
  releaseTx?: string;
  refundTx?: string;
};

export type EscrowOps = {
  quote: (input: {
    tripIdHash: Hex;
    payee: string;
    amountWei: bigint;
  }) => DepositQuote;
  confirm: (input: {
    txHash: string;
    expectedFrom: string;
    expectedPayee: string;
    tripIdHash: Hex;
    amountWei: bigint;
  }) => Promise<{ txHash: string }>;
  release: (tripIdHash: Hex) => Promise<{ txHash: string }>;
  refund: (tripIdHash: Hex) => Promise<{ txHash: string }>;
};

const memory = new Map<string, LockedDeposit>();
let escrowOverride: EscrowOps | null = null;

export function setEscrowForTests(ops: EscrowOps | null) {
  escrowOverride = ops;
  if (!ops) memory.clear();
}

export function getEscrowAddress() {
  return process.env.ESCROW_CONTRACT_ADDRESS?.trim() || null;
}

export function isEscrowConfigured() {
  return Boolean(getEscrowAddress());
}

function requireEscrowAddress() {
  const address = getEscrowAddress();
  if (!address) {
    fail("Ride escrow contract is not configured", "ConflictError");
  }
  return getAddress(address);
}

function useMemoryEscrow() {
  return (
    !isEscrowConfigured() &&
    (Boolean(process.env.VITEST) || process.env.LOAD_ESCROW === "1")
  );
}

function quotePayload(tripIdHash: Hex, payee: string, amountWei: bigint, to: string): DepositQuote {
  const chain = getPayoutChainPublicConfig();
  const data = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: "deposit",
    args: [tripIdHash, getAddress(payee)],
  });
  return {
    chainId: chain.chainId,
    chainName: chain.chainName,
    to,
    value: `0x${amountWei.toString(16)}`,
    data,
    tripIdHash,
    amountUsd: Number(formatUnits(amountWei, chain.nativeDecimals)),
    tokenSymbol: chain.tokenSymbol,
    decimals: chain.nativeDecimals,
    explorerTxUrl: chain.explorerTxUrl,
  };
}

export function memoryEscrowOps(): EscrowOps {
  return {
    quote({ tripIdHash, payee, amountWei }) {
      const to = getEscrowAddress() || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      return quotePayload(tripIdHash, payee, amountWei, to);
    },
    async confirm({ txHash, expectedFrom, expectedPayee, tripIdHash, amountWei }) {
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        fail("Invalid transaction hash", "ValidationError");
      }
      const existing = memory.get(tripIdHash);
      if (existing?.state === "locked" && existing.depositTx === txHash) {
        return { txHash };
      }
      if (existing) {
        fail("This trip already has an escrow deposit", "ConflictError");
      }
      memory.set(tripIdHash, {
        payer: expectedFrom.toLowerCase(),
        payee: expectedPayee.toLowerCase(),
        amountWei,
        state: "locked",
        depositTx: txHash,
      });
      return { txHash };
    },
    async release(tripIdHash) {
      const item = memory.get(tripIdHash);
      if (!item) {
        fail("No escrow deposit to release", "ConflictError");
      }
      if (item.state === "released") {
        return { txHash: item.releaseTx || item.depositTx };
      }
      if (item.state !== "locked") {
        fail("Escrow is not locked", "ConflictError");
      }
      const txHash = (`0xrel${tripIdHash.slice(2)}`).slice(0, 66).padEnd(66, "0");
      item.state = "released";
      item.releaseTx = txHash;
      return { txHash };
    },
    async refund(tripIdHash) {
      const item = memory.get(tripIdHash);
      if (!item) {
        return {
          txHash:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        };
      }
      if (item.state === "refunded") {
        return { txHash: item.refundTx || item.depositTx };
      }
      if (item.state !== "locked") {
        fail("Escrow is not locked", "ConflictError");
      }
      const txHash = (`0xref${tripIdHash.slice(2)}`).slice(0, 66).padEnd(66, "0");
      item.state = "refunded";
      item.refundTx = txHash;
      return { txHash };
    },
  };
}

async function operatorCall(fn: "release" | "refund", tripIdHash: Hex) {
  if (!isTreasuryConfigured()) {
    fail("Treasury is not configured for escrow operator calls", "ConflictError");
  }
  const key = process.env.TREASURY_PRIVATE_KEY!.trim();
  const privateKey = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
  const account = privateKeyToAccount(privateKey);
  const chain = payoutChain();
  const wallet = createWalletClient({
    account,
    chain,
    transport: http(getChainRpcUrl()),
  });
  const hash = await wallet.writeContract({
    address: requireEscrowAddress(),
    abi: ESCROW_ABI,
    functionName: fn,
    args: [tripIdHash],
    account,
    chain,
    maxFeePerGas: parseGwei("20"),
    maxPriorityFeePerGas: parseGwei("1"),
  });
  const publicClient = createPublicClient({
    chain,
    transport: http(getChainRpcUrl()),
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { txHash: hash };
}

export function liveEscrowOps(): EscrowOps {
  return {
    quote({ tripIdHash, payee, amountWei }) {
      return quotePayload(tripIdHash, payee, amountWei, requireEscrowAddress());
    },
    async confirm({ txHash, expectedFrom, expectedPayee, tripIdHash, amountWei }) {
      const client = createPublicClient({
        chain: payoutChain(),
        transport: http(getChainRpcUrl()),
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: txHash as Hex,
      });
      if (receipt.status !== "success") {
        fail("Escrow deposit transaction failed", "ConflictError");
      }
      const tx = await client.getTransaction({ hash: txHash as Hex });
      const escrow = requireEscrowAddress().toLowerCase();
      if (tx.to?.toLowerCase() !== escrow) {
        fail("Transaction was not sent to the ride escrow", "ValidationError");
      }
      if (tx.from.toLowerCase() !== expectedFrom.toLowerCase()) {
        fail("Deposit must come from the rider Privy wallet", "ValidationError");
      }
      if (tx.value !== amountWei) {
        fail("Deposit amount does not match the trip fare", "ValidationError");
      }
      const logs = parseEventLogs({
        abi: ESCROW_ABI,
        logs: receipt.logs,
        eventName: "Deposited",
      });
      const match = logs.find(
        (log) =>
          String(log.args.tripId).toLowerCase() === tripIdHash.toLowerCase() &&
          String(log.args.payee).toLowerCase() === expectedPayee.toLowerCase(),
      );
      if (!match) {
        fail("Escrow deposit event was not found for this trip", "ValidationError");
      }
      return { txHash };
    },
    async release(tripIdHash) {
      return operatorCall("release", tripIdHash);
    },
    async refund(tripIdHash) {
      return operatorCall("refund", tripIdHash);
    },
  };
}

export function escrowOps(): EscrowOps {
  if (escrowOverride) return escrowOverride;
  if (useMemoryEscrow()) return memoryEscrowOps();
  return liveEscrowOps();
}
