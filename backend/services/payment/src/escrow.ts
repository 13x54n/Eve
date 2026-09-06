import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  parseEventLogs,
  type Hex,
} from "viem";
import { fail } from "@eve/shared";
import { getChainRpcUrl, getPayoutChainPublicConfig } from "@eve/shared/treasury";
import { ESCROW_ABI } from "./escrow-abi.js";
import { payoutChain } from "./chain.js";

export const DISPUTE_WINDOW_MS = 5 * 60 * 1000;

export type EscrowAction =
  | "deposit"
  | "startSettlement"
  | "dispute"
  | "finalize"
  | "refund";

export type EscrowMemoryState =
  | "none"
  | "locked"
  | "settling"
  | "disputed"
  | "released"
  | "refunded";

export type CallQuote = {
  action: EscrowAction;
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
  disputeWindowMs: number;
  settleFrom?: string | null;
};

type MemoryDeposit = {
  payer: string;
  payee: string;
  amountWei: bigint;
  state: EscrowMemoryState;
  settleFromMs: number;
  depositTx?: string;
  startTx?: string;
  disputeTx?: string;
  releaseTx?: string;
  refundTx?: string;
};

export type EscrowConfirmInput = {
  txHash: string;
  expectedFrom: string;
  expectedPayee: string;
  tripIdHash: Hex;
  amountWei: bigint;
  action?: EscrowAction;
};

export type EscrowConfirmResult = {
  txHash: string;
  action: EscrowAction;
  settleFromMs?: number;
};

export type EscrowOps = {
  quoteDeposit: (input: {
    tripIdHash: Hex;
    payee: string;
    amountWei: bigint;
  }) => CallQuote;
  quoteCall: (action: Exclude<EscrowAction, "deposit">, tripIdHash: Hex) => CallQuote;
  confirm: (input: EscrowConfirmInput) => Promise<EscrowConfirmResult>;
};

const memory = new Map<string, MemoryDeposit>();
let escrowOverride: EscrowOps | null = null;
let frozenNowMs: number | null = null;

export function setEscrowForTests(ops: EscrowOps | null) {
  escrowOverride = ops;
  if (!ops) memory.clear();
}

export function setEscrowNowMs(ms: number | null) {
  frozenNowMs = ms;
}

export function advanceEscrowNowMs(deltaMs: number) {
  frozenNowMs = escrowNowMs() + deltaMs;
}

export function escrowNowMs() {
  return frozenNowMs ?? Date.now();
}

export function disputeWindowMs() {
  if (process.env.VITEST) return DISPUTE_WINDOW_MS;
  if (process.env.LOAD_ESCROW === "1") return 0;
  return DISPUTE_WINDOW_MS;
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

function chainMeta() {
  return getPayoutChainPublicConfig();
}

function quoteFor(
  action: EscrowAction,
  tripIdHash: Hex,
  to: string,
  valueWei: bigint,
  data: Hex,
  settleFromMs?: number,
): CallQuote {
  const chain = chainMeta();
  return {
    action,
    chainId: chain.chainId,
    chainName: chain.chainName,
    to,
    value: `0x${valueWei.toString(16)}`,
    data,
    tripIdHash,
    amountUsd: Number(formatUnits(valueWei, chain.nativeDecimals)),
    tokenSymbol: chain.tokenSymbol,
    decimals: chain.nativeDecimals,
    explorerTxUrl: chain.explorerTxUrl,
    disputeWindowMs: disputeWindowMs(),
    settleFrom: settleFromMs ? new Date(settleFromMs).toISOString() : null,
  };
}

export function quoteDepositCall(tripIdHash: Hex, payee: string, amountWei: bigint, to: string): CallQuote {
  const data = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: "deposit",
    args: [tripIdHash, getAddress(payee)],
  });
  return quoteFor("deposit", tripIdHash, to, amountWei, data);
}

export function quoteActionCall(
  action: Exclude<EscrowAction, "deposit">,
  tripIdHash: Hex,
  to: string,
): CallQuote {
  const data = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: action,
    args: [tripIdHash],
  });
  return quoteFor(action, tripIdHash, to, 0n, data);
}

function requireTxHash(txHash: string) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    fail("Invalid transaction hash", "ValidationError");
  }
}

function fakeHash(prefix: string, tripIdHash: Hex) {
  return (`0x${prefix}${tripIdHash.slice(2)}`).slice(0, 66).padEnd(66, "0");
}

export function memoryEscrowOps(): EscrowOps {
  return {
    quoteDeposit({ tripIdHash, payee, amountWei }) {
      const to = getEscrowAddress() || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      return quoteDepositCall(tripIdHash, payee, amountWei, to);
    },
    quoteCall(action, tripIdHash) {
      const to = getEscrowAddress() || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      const quote = quoteActionCall(action, tripIdHash, to);
      const item = memory.get(tripIdHash);
      if (item?.settleFromMs) quote.settleFrom = new Date(item.settleFromMs).toISOString();
      return quote;
    },
    async confirm(input) {
      requireTxHash(input.txHash);
      const key = input.tripIdHash;
      const existing = memory.get(key);
      const action = input.action ?? inferMemoryAction(existing, input.expectedFrom);

      if (action === "deposit") {
        if (existing?.state === "locked" && existing.depositTx === input.txHash) {
          return { txHash: input.txHash, action };
        }
        if (existing) fail("This trip already has an escrow deposit", "ConflictError");
        memory.set(key, {
          payer: input.expectedFrom.toLowerCase(),
          payee: input.expectedPayee.toLowerCase(),
          amountWei: input.amountWei,
          state: "locked",
          settleFromMs: 0,
          depositTx: input.txHash,
        });
        return { txHash: input.txHash, action };
      }

      const item = existing ?? (process.env.LOAD_ESCROW === "1"
        ? {
            payer: input.expectedFrom.toLowerCase(),
            payee: input.expectedPayee.toLowerCase(),
            amountWei: input.amountWei,
            state: "locked" as const,
            settleFromMs: 0,
          }
        : null);
      if (!item) fail("No escrow deposit for this trip", "ConflictError");

      if (action === "startSettlement") {
        if (item.state === "settling" && item.startTx === input.txHash) {
          return { txHash: input.txHash, action, settleFromMs: item.settleFromMs };
        }
        if (item.state !== "locked") fail("Escrow is not locked", "ConflictError");
        if (item.payee !== input.expectedFrom.toLowerCase()) {
          fail("Only the driver can start settlement", "ForbiddenError");
        }
        item.state = "settling";
        item.settleFromMs = escrowNowMs() + disputeWindowMs();
        item.startTx = input.txHash;
        memory.set(key, item);
        return { txHash: input.txHash, action, settleFromMs: item.settleFromMs };
      }

      if (action === "dispute") {
        if (item.state === "disputed" && item.disputeTx === input.txHash) {
          return { txHash: input.txHash, action };
        }
        if (item.state !== "settling") fail("Settlement is not open for dispute", "ConflictError");
        if (escrowNowMs() >= item.settleFromMs) fail("The dispute window has closed", "ConflictError");
        if (item.payer !== input.expectedFrom.toLowerCase()) {
          fail("Only the rider can dispute", "ForbiddenError");
        }
        item.state = "disputed";
        item.disputeTx = input.txHash;
        memory.set(key, item);
        return { txHash: input.txHash, action };
      }

      if (action === "finalize") {
        if (item.state === "released" && (item.releaseTx === input.txHash || item.releaseTx)) {
          return { txHash: item.releaseTx || input.txHash, action };
        }
        if (item.state !== "settling") fail("Escrow is not settling", "ConflictError");
        if (escrowNowMs() < item.settleFromMs) fail("Wait for the 5-minute dispute window", "ConflictError");
        if (item.payee !== input.expectedFrom.toLowerCase()) {
          fail("Only the driver can finalize", "ForbiddenError");
        }
        item.state = "released";
        item.releaseTx = input.txHash || fakeHash("rel", key);
        memory.set(key, item);
        return { txHash: item.releaseTx, action };
      }

      if (action === "refund") {
        if (item.state === "refunded") {
          return { txHash: item.refundTx || input.txHash, action };
        }
        if (item.state !== "locked" && item.state !== "disputed") {
          fail("This trip cannot be refunded yet", "ConflictError");
        }
        if (item.payer !== input.expectedFrom.toLowerCase()) {
          fail("Only the rider can refund", "ForbiddenError");
        }
        item.state = "refunded";
        item.refundTx = input.txHash;
        memory.set(key, item);
        return { txHash: input.txHash, action };
      }

      fail("Unknown escrow action", "ValidationError");
    },
  };
}

function inferMemoryAction(item: MemoryDeposit | undefined, from: string): EscrowAction {
  const sender = from.toLowerCase();
  if (!item || item.state === "none") return "deposit";
  if (item.state === "locked" && sender === item.payee) return "startSettlement";
  if (item.state === "locked" && sender === item.payer) return "refund";
  if (item.state === "settling" && sender === item.payer && escrowNowMs() < item.settleFromMs) {
    return "dispute";
  }
  if (item.state === "settling" && sender === item.payee && escrowNowMs() >= item.settleFromMs) {
    return "finalize";
  }
  if (item.state === "disputed" && sender === item.payer) return "refund";
  fail("Could not infer escrow action from trip state", "ValidationError");
}

type DecodedEscrowLog = {
  eventName: string;
  args: { tripId?: unknown; payee?: unknown; settleFrom?: bigint; amount?: bigint };
};

function decodedEscrowLogs(logs: unknown): DecodedEscrowLog[] {
  return logs as DecodedEscrowLog[];
}

function actionFromLogs(logs: DecodedEscrowLog[], tripIdHash: Hex): EscrowAction | null {
  const trip = tripIdHash.toLowerCase();
  const match = (name: string) =>
    logs.find((log) => log.eventName === name && String(log.args.tripId).toLowerCase() === trip);
  if (match("Deposited")) return "deposit";
  if (match("SettlementStarted")) return "startSettlement";
  if (match("Disputed")) return "dispute";
  if (match("Released")) return "finalize";
  if (match("Refunded")) return "refund";
  return null;
}

function settleFromFromLogs(logs: DecodedEscrowLog[], tripIdHash: Hex) {
  const trip = tripIdHash.toLowerCase();
  const started = logs.find(
    (log) => log.eventName === "SettlementStarted" && String(log.args.tripId).toLowerCase() === trip,
  );
  const settleFrom = started?.args.settleFrom;
  return settleFrom != null ? Number(settleFrom) * 1000 : undefined;
}

export function liveEscrowOps(): EscrowOps {
  const to = () => requireEscrowAddress();
  return {
    quoteDeposit({ tripIdHash, payee, amountWei }) {
      return quoteDepositCall(tripIdHash, payee, amountWei, to());
    },
    quoteCall(action, tripIdHash) {
      return quoteActionCall(action, tripIdHash, to());
    },
    async confirm(input) {
      requireTxHash(input.txHash);
      const client = createPublicClient({
        chain: payoutChain(),
        transport: http(getChainRpcUrl()),
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: input.txHash as Hex,
      });
      if (receipt.status !== "success") {
        fail("Escrow transaction failed", "ConflictError");
      }
      const tx = await client.getTransaction({ hash: input.txHash as Hex });
      const escrow = to().toLowerCase();
      if (tx.to?.toLowerCase() !== escrow) {
        fail("Transaction was not sent to the ride escrow", "ValidationError");
      }
      if (tx.from.toLowerCase() !== input.expectedFrom.toLowerCase()) {
        fail("Transaction must be signed by the expected wallet", "ValidationError");
      }
      const logs = decodedEscrowLogs(
        parseEventLogs({
          abi: ESCROW_ABI,
          logs: receipt.logs,
        }),
      );
      const action = actionFromLogs(logs, input.tripIdHash) ?? input.action;
      if (!action) {
        fail("Escrow event was not found for this trip", "ValidationError");
      }
      if (action === "deposit") {
        if (tx.value !== input.amountWei) {
          fail("Deposit amount does not match the trip fare", "ValidationError");
        }
        const deposited = logs.find((log) => log.eventName === "Deposited");
        const payee = String(deposited?.args.payee || "");
        if (payee.toLowerCase() !== input.expectedPayee.toLowerCase()) {
          fail("Escrow deposit event was not found for this trip", "ValidationError");
        }
      }
      if (input.action && input.action !== action) {
        fail("Transaction does not match the expected escrow action", "ValidationError");
      }
      return {
        txHash: input.txHash,
        action,
        settleFromMs: settleFromFromLogs(logs, input.tripIdHash),
      };
    },
  };
}

export function escrowOps(): EscrowOps {
  if (escrowOverride) return escrowOverride;
  if (useMemoryEscrow()) return memoryEscrowOps();
  return liveEscrowOps();
}
