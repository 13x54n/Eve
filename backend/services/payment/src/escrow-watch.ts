import { createPublicClient, http, parseAbiItem, type Hex } from "viem";
import { getChainRpcUrl } from "@eve/shared/treasury";
import { getEscrowAddress, isEscrowConfigured } from "./escrow.js";
import { payoutChain } from "./chain.js";
import { publishPaymentEvent } from "./payment-events.js";
import {
  cancelEscrowFinalize,
  findTripIdByHash,
} from "./escrow-scheduler.js";

let watching = false;

export function startEscrowEventWatch() {
  if (watching || !isEscrowConfigured() || process.env.VITEST) return;
  const address = getEscrowAddress();
  if (!address) return;
  watching = true;
  const client = createPublicClient({
    chain: payoutChain(),
    transport: http(getChainRpcUrl()),
  });
  const escrow = address as Hex;

  client.watchEvent({
    address: escrow,
    event: parseAbiItem(
      "event Deposited(bytes32 indexed tripId, address indexed payer, address indexed payee, uint256 amount)",
    ),
    onLogs: (logs) => {
      void Promise.all(
        logs.map(async (log) => {
          const tripId = await findTripIdByHash(String(log.args.tripId));
          if (!tripId) return;
          const { applyChainDeposit } = await import("./payment.service.js");
          await publishPaymentEvent("escrow.deposit.confirmed", tripId, {
            txHash: log.transactionHash,
          });
          await applyChainDeposit(tripId, log.transactionHash);
        }),
      );
    },
  });

  client.watchEvent({
    address: escrow,
    event: parseAbiItem(
      "event SettlementStarted(bytes32 indexed tripId, address indexed payee, uint64 settleFrom)",
    ),
    onLogs: (logs) => {
      void Promise.all(
        logs.map(async (log) => {
          const tripId = await findTripIdByHash(String(log.args.tripId));
          if (!tripId || log.args.settleFrom == null) return;
          const settleFromMs = Number(log.args.settleFrom) * 1000;
          const { applyChainSettlement } = await import("./payment.service.js");
          await publishPaymentEvent("escrow.settlement.started", tripId, {
            txHash: log.transactionHash,
            settleFromMs,
          });
          await applyChainSettlement(tripId, log.transactionHash, settleFromMs);
        }),
      );
    },
  });

  client.watchEvent({
    address: escrow,
    event: parseAbiItem("event Disputed(bytes32 indexed tripId, address indexed payer)"),
    onLogs: (logs) => {
      void Promise.all(
        logs.map(async (log) => {
          const tripId = await findTripIdByHash(String(log.args.tripId));
          if (!tripId) return;
          cancelEscrowFinalize(tripId);
          await publishPaymentEvent("escrow.disputed", tripId, {});
          const { onEscrowDisputed } = await import("./payment.service.js");
          await onEscrowDisputed(tripId, null);
        }),
      );
    },
  });

  client.watchEvent({
    address: escrow,
    event: parseAbiItem(
      "event Released(bytes32 indexed tripId, address indexed payee, uint256 amount)",
    ),
    onLogs: (logs) => {
      void Promise.all(
        logs.map(async (log) => {
          const tripId = await findTripIdByHash(String(log.args.tripId));
          if (!tripId) return;
          cancelEscrowFinalize(tripId);
          const { applyChainRelease } = await import("./payment.service.js");
          await applyChainRelease(tripId, log.transactionHash);
        }),
      );
    },
  });

  client.watchEvent({
    address: escrow,
    event: parseAbiItem(
      "event Refunded(bytes32 indexed tripId, address indexed payer, uint256 amount)",
    ),
    onLogs: (logs) => {
      void Promise.all(
        logs.map(async (log) => {
          const tripId = await findTripIdByHash(String(log.args.tripId));
          if (!tripId) return;
          cancelEscrowFinalize(tripId);
          const { applyChainRefund } = await import("./payment.service.js");
          await applyChainRefund(tripId, log.transactionHash);
        }),
      );
    },
  });
}
