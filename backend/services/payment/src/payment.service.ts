import { keccak256, toBytes, type Hex } from "viem";
import { prisma } from "@eve/db";
import { fail, money, writeTripConfirmationCache } from "@eve/shared";
import { emitTripAndUserEvent } from "@eve/notify";
import {
  executePayout,
  getEscrowOperatorAddress,
  getPayoutChainPublicConfig,
  isTreasuryConfigured,
  usdToNativeUsdcWei,
} from "@eve/shared/treasury";
import { getUsdcBalance } from "./chain.js";
import { decideEscrowDispute } from "./dispute-resolver.js";
import {
  cancelEscrowFinalize,
  scheduleEscrowFinalize,
} from "./escrow-scheduler.js";
import { publishPaymentEvent } from "./payment-events.js";
import {
  disputeWindowMs,
  escrowNowMs,
  escrowOps,
  getEscrowAddress,
  type CallQuote,
  type EscrowAction,
} from "./escrow.js";

export function tripIdHash(tripId: string): Hex {
  return keccak256(toBytes(tripId));
}

function fareWei(amountUsd: number) {
  return usdToNativeUsdcWei(amountUsd);
}

type TripWithParties = NonNullable<Awaited<ReturnType<typeof loadTrip>>>;

async function loadTrip(tripId: string) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      rider: { include: { user: true } },
      driver: { include: { user: true } },
    },
  });
}

function riderWalletOf(trip: TripWithParties) {
  return trip.rider.user.ethereumWallet?.trim() || "";
}

function driverWalletOf(trip: TripWithParties) {
  return trip.driver?.user.ethereumWallet?.trim() || "";
}

function requireRiderWallet(trip: TripWithParties) {
  const wallet = riderWalletOf(trip);
  if (!wallet) fail("Link a Privy Ethereum wallet before paying", "ValidationError");
  return wallet;
}

function requireDriverWallet(trip: TripWithParties) {
  const wallet = driverWalletOf(trip);
  if (!wallet) fail("Driver has no Privy Ethereum wallet", "ConflictError");
  return wallet;
}

export function publicPaymentConfig() {
  return {
    ...getPayoutChainPublicConfig(),
    escrowAddress: getEscrowAddress(),
    escrowOperatorAddress: getEscrowOperatorAddress(),
    escrowConfigured: Boolean(getEscrowAddress()) || Boolean(process.env.VITEST),
    disputeWindowMs: disputeWindowMs(),
  };
}

function quoteDepositFor(trip: TripWithParties): CallQuote {
  return escrowOps().quoteDeposit({
    tripIdHash: tripIdHash(trip.id),
    payee: requireDriverWallet(trip),
    amountWei: fareWei(Number(trip.fareTotal)),
  });
}

export async function quoteTripDeposit(userId: string, tripId: string): Promise<CallQuote> {
  const trip = await loadTrip(tripId);
  if (!trip || trip.rider.userId !== userId) fail("Trip not found", "NotFoundError");
  if (trip.status !== "ASSIGNED" || trip.paymentStatus !== "PENDING") {
    fail("This trip cannot be funded", "ConflictError");
  }
  requireDriverWallet(trip);
  requireRiderWallet(trip);
  return quoteDepositFor(trip);
}

export async function quoteTripSettlement(userId: string, tripId: string): Promise<CallQuote> {
  const trip = await loadTrip(tripId);
  if (!trip || trip.driver?.userId !== userId) fail("Trip not found", "NotFoundError");
  requireDriverWallet(trip);
  const started = Boolean(trip.escrowStartTx);
  const settleFrom = trip.escrowSettleFrom?.getTime() ?? 0;
  if (trip.paymentStatus === "SETTLING" && started && escrowNowMs() >= settleFrom) {
    return escrowOps().quoteCall("finalize", tripIdHash(trip.id));
  }
  if (trip.paymentStatus === "ESCROWED" || (trip.paymentStatus === "SETTLING" && !started)) {
    return escrowOps().quoteCall("startSettlement", tripIdHash(trip.id));
  }
  fail("Settlement is not available for this trip", "ConflictError");
}

export async function quoteTripDispute(userId: string, tripId: string): Promise<CallQuote> {
  const trip = await loadTrip(tripId);
  if (!trip || trip.rider.userId !== userId) fail("Trip not found", "NotFoundError");
  if (trip.paymentStatus !== "SETTLING" || !trip.escrowStartTx) {
    fail("There is no open dispute window", "ConflictError");
  }
  if (escrowNowMs() >= (trip.escrowSettleFrom?.getTime() ?? 0)) {
    fail("The dispute window has closed", "ConflictError");
  }
  requireRiderWallet(trip);
  return escrowOps().quoteCall("dispute", tripIdHash(trip.id));
}

export async function quoteTripRefund(userId: string, tripId: string): Promise<CallQuote> {
  const trip = await loadTrip(tripId);
  if (!trip || trip.rider.userId !== userId) fail("Trip not found", "NotFoundError");
  if (trip.paymentStatus !== "ESCROWED") {
    fail("This trip cannot be refunded", "ConflictError");
  }
  requireRiderWallet(trip);
  return escrowOps().quoteCall("refund", tripIdHash(trip.id));
}

function expectedFrom(trip: TripWithParties, action: EscrowAction) {
  if (action === "deposit" || action === "dispute" || action === "refund") {
    return requireRiderWallet(trip);
  }
  return requireDriverWallet(trip);
}

function partyFields(trip: TripWithParties) {
  return {
    id: trip.id,
    tripId: trip.id,
    status: trip.status,
    paymentStatus: trip.paymentStatus,
    riderUserId: trip.rider.userId,
    driverUserId: trip.driver?.userId ?? null,
  };
}

async function cacheTripPayment(trip: TripWithParties, snapshot: unknown = trip) {
  await writeTripConfirmationCache({
    tripId: trip.id,
    status: trip.status,
    paymentStatus: trip.paymentStatus,
    riderUserId: trip.rider.userId,
    driverUserId: trip.driver?.userId ?? null,
    snapshot,
  });
}

function logEscrowApply(
  action: string,
  tripId: string,
  txHash: string,
  from: string,
  to: string,
) {
  console.info("[payment] escrow apply", { action, tripId, txHash, from, to });
}

async function persistDeposit(trip: TripWithParties, txHash: string) {
  if (trip.paymentStatus === "ESCROWED" && trip.escrowDepositTx === txHash) {
    return trip;
  }
  if (trip.paymentStatus !== "PENDING") {
    return trip;
  }
  const previous = trip.paymentStatus;
  const updated = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      paymentStatus: "ESCROWED",
      paymentMethod: "WALLET",
      escrowDepositTx: txHash,
    },
  });
  const existingCharge = await prisma.ledgerEntry.findFirst({
    where: { tripId: trip.id, type: "CHARGE" },
  });
  if (!existingCharge) {
    await prisma.ledgerEntry.create({
      data: {
        tripId: trip.id,
        userId: trip.rider.userId,
        type: "CHARGE",
        status: "PENDING",
        method: "WALLET",
        amount: trip.fareTotal,
        providerRef: txHash,
        note: `USDC escrowed on Arc Testnet for trip ${trip.bookingCode}`,
      },
    });
  }
  logEscrowApply("deposit", trip.id, txHash, previous, "ESCROWED");
  const merged = { ...trip, ...updated };
  await cacheTripPayment(merged);
  const payload = { ...partyFields(merged), txHash };
  await publishPaymentEvent("escrow.deposit.confirmed", trip.id, payload);
  if (trip.driver?.userId) {
    await emitTripAndUserEvent(trip.id, "DRIVER", trip.driver.userId, "trip:assigned", payload);
  }
  return merged;
}

async function persistSettlement(trip: TripWithParties, txHash: string, settleFromMs?: number) {
  if (trip.escrowStartTx === txHash && trip.paymentStatus === "SETTLING") {
    return trip;
  }
  const canStart =
    trip.paymentStatus === "ESCROWED" ||
    (trip.paymentStatus === "SETTLING" && !trip.escrowStartTx);
  if (!canStart) {
    return trip;
  }
  const previous = trip.paymentStatus;
  const settleFrom = settleFromMs
    ? new Date(settleFromMs)
    : new Date(escrowNowMs() + disputeWindowMs());
  const updated = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      paymentStatus: "SETTLING",
      escrowStartTx: txHash,
      escrowSettleFrom: settleFrom,
    },
  });
  await scheduleEscrowFinalize(trip.id, settleFrom.getTime());
  logEscrowApply("startSettlement", trip.id, txHash, previous, "SETTLING");
  const merged = {
    ...trip,
    ...updated,
    escrowSettleFrom: settleFrom,
    escrowStartTx: txHash,
  };
  await cacheTripPayment(merged);
  await publishPaymentEvent("escrow.settlement.started", trip.id, {
    ...partyFields(merged),
    txHash,
    settleFromMs: settleFrom.getTime(),
  });
  return merged;
}

function inferAction(trip: TripWithParties, userId: string): EscrowAction {
  const isRider = trip.rider.userId === userId;
  const isDriver = trip.driver?.userId === userId;
  if (trip.paymentStatus === "PENDING" && isRider) return "deposit";
  if ((trip.paymentStatus === "ESCROWED" || (trip.paymentStatus === "SETTLING" && !trip.escrowStartTx)) && isDriver) {
    return "startSettlement";
  }
  if (trip.paymentStatus === "SETTLING" && isRider && escrowNowMs() < (trip.escrowSettleFrom?.getTime() ?? 0)) {
    return "dispute";
  }
  if (trip.paymentStatus === "SETTLING" && isDriver && escrowNowMs() >= (trip.escrowSettleFrom?.getTime() ?? 0)) {
    return "finalize";
  }
  if (trip.paymentStatus === "ESCROWED" && isRider) {
    return "refund";
  }
  fail("No escrow action is available for this user", "ConflictError");
}

export async function confirmTripEscrow(
  userId: string,
  tripId: string,
  txHash: string,
  actionHint?: EscrowAction,
) {
  const hash = txHash.trim();
  const trip = await loadTrip(tripId);
  if (!trip) fail("Trip not found", "NotFoundError");
  const isRider = trip.rider.userId === userId;
  const isDriver = trip.driver?.userId === userId;
  if (!isRider && !isDriver) fail("Trip not found", "NotFoundError");

  const action = actionHint ?? inferAction(trip, userId);
  if ((action === "deposit" || action === "dispute" || action === "refund") && !isRider) {
    fail("Only the rider can submit this transaction", "ForbiddenError");
  }
  if ((action === "startSettlement" || action === "finalize") && !isDriver) {
    fail("Only the driver can submit this transaction", "ForbiddenError");
  }

  if (action === "deposit" && trip.paymentStatus === "ESCROWED" && trip.escrowDepositTx === hash) {
    return snapshot(trip);
  }
  if (action === "startSettlement" && trip.escrowStartTx === hash) {
    return snapshot(trip);
  }
  if (action === "finalize" && trip.paymentStatus === "COMPLETED" && trip.escrowReleaseTx === hash) {
    return snapshot(trip);
  }
  if (action === "refund" && trip.paymentStatus === "CANCELLED" && trip.escrowRefundTx === hash) {
    return snapshot(trip);
  }
  if (action === "dispute" && trip.paymentStatus === "DISPUTED" && trip.escrowDisputeTx === hash) {
    return snapshot(trip);
  }

  const confirmed = await escrowOps().confirm({
    txHash: hash,
    expectedFrom: expectedFrom(trip, action),
    expectedPayee: requireDriverWallet(trip),
    tripIdHash: tripIdHash(trip.id),
    amountWei: fareWei(Number(trip.fareTotal)),
    action,
  });

  if (confirmed.action === "deposit") {
    const updated = await persistDeposit(trip, confirmed.txHash);
    return snapshot({ ...trip, ...updated });
  }

  if (confirmed.action === "startSettlement") {
    const updated = await persistSettlement(trip, confirmed.txHash, confirmed.settleFromMs);
    return snapshot({ ...trip, ...updated });
  }

  if (confirmed.action === "dispute") {
    const updated = await prisma.trip.update({
      where: { id: trip.id },
      data: {
        paymentStatus: "DISPUTED",
        escrowDisputeTx: confirmed.txHash,
      },
    });
    const merged = { ...trip, ...updated, paymentStatus: "DISPUTED" as const, escrowDisputeTx: confirmed.txHash };
    await cacheTripPayment(merged);
    await publishPaymentEvent("escrow.disputed", trip.id, {
      ...partyFields(merged),
      txHash: confirmed.txHash,
    });
    await onEscrowDisputed(trip.id, confirmed.txHash);
    const latest = await prisma.trip.findUnique({ where: { id: trip.id } });
    return snapshot({ ...trip, ...updated, ...latest, paymentStatus: latest?.paymentStatus ?? "DISPUTED", escrowDisputeTx: confirmed.txHash });
  }

  if (confirmed.action === "finalize") {
    cancelEscrowFinalize(trip.id);
    await applyFinalize(trip, confirmed.txHash);
    const updated = await prisma.trip.findUnique({ where: { id: trip.id } });
    return snapshot({ ...trip, ...updated! });
  }

  if (confirmed.action === "refund") {
    await applyRefund(trip, confirmed.txHash);
    const updated = await prisma.trip.findUnique({ where: { id: trip.id } });
    return snapshot({ ...trip, ...updated! });
  }

  fail("Unknown escrow action", "ValidationError");
}

async function applyFinalize(trip: TripWithParties, txHash: string) {
  const driverUserId = trip.driver?.userId;
  const driverProfileId = trip.driverId;
  if (!driverUserId || !driverProfileId) fail("Driver is missing", "ConflictError");
  const driverNetEarnings = Number(trip.fareTotal);
  let released = false;

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.trip.updateMany({
      where: {
        id: trip.id,
        paymentStatus: { in: ["SETTLING", "DISPUTED"] },
      },
      data: {
        paymentStatus: "COMPLETED",
        escrowReleaseTx: txHash,
      },
    });
    if (claimed.count !== 1) return;
    released = true;
    await tx.driverProfile.update({
      where: { id: driverProfileId },
      data: { earningsTotal: { increment: driverNetEarnings } },
    });
    const existingCharge = await tx.ledgerEntry.findFirst({
      where: { tripId: trip.id, type: "CHARGE" },
    });
    if (existingCharge) {
      await tx.ledgerEntry.update({
        where: { id: existingCharge.id },
        data: {
          status: "COMPLETED",
          providerRef: txHash,
          note: `USDC released on Arc Testnet for trip ${trip.bookingCode}`,
        },
      });
    }
    if (!existingCharge || existingCharge.userId !== driverUserId) {
      await tx.ledgerEntry.create({
        data: {
          tripId: trip.id,
          userId: driverUserId,
          type: "CHARGE",
          status: "COMPLETED",
          method: trip.paymentMethod,
          amount: trip.fareTotal,
          providerRef: txHash,
          note: `USDC released on Arc Testnet for trip ${trip.bookingCode}`,
        },
      });
    }
  });
  if (released) {
    await cacheTripPayment({ ...trip, paymentStatus: "COMPLETED", status: "COMPLETED" });
    await publishPaymentEvent("escrow.released", trip.id, { ...partyFields({ ...trip, paymentStatus: "COMPLETED" }), txHash });
  }
}

async function applyRefund(trip: TripWithParties, txHash: string) {
  if (trip.paymentStatus === "CANCELLED" && trip.escrowRefundTx) return;
  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      escrowRefundTx: txHash,
      paymentStatus: "CANCELLED",
      status: trip.status === "COMPLETED" ? trip.status : "CANCELLED",
    },
  });
  const existing = await prisma.ledgerEntry.findFirst({
    where: { tripId: trip.id, type: "REFUND", providerRef: txHash },
  });
  if (existing) return;
  await prisma.ledgerEntry.create({
    data: {
      tripId: trip.id,
      userId: trip.rider.userId,
      type: "REFUND",
      status: "COMPLETED",
      method: "WALLET",
      amount: trip.fareTotal,
      providerRef: txHash,
      note: `USDC refunded from escrow for trip ${trip.bookingCode}`,
    },
  });
  await publishPaymentEvent("escrow.refunded", trip.id, { ...partyFields({ ...trip, paymentStatus: "CANCELLED" }), txHash });
}

export async function operatorFinalizeTrip(tripId: string) {
  const trip = await loadTrip(tripId);
  if (!trip || trip.paymentStatus !== "SETTLING" || !trip.escrowStartTx) return;
  if (escrowNowMs() < (trip.escrowSettleFrom?.getTime() ?? 0)) return;
  try {
    const result = await escrowOps().operatorFinalize(tripIdHash(trip.id));
    await applyFinalize(trip, result.txHash);
  } catch {
    /* dispute or already released */
  }
}

export async function operatorResolveTrip(tripId: string, releaseToPayee: boolean, note?: string) {
  const trip = await loadTrip(tripId);
  if (!trip) fail("Trip not found", "NotFoundError");
  if (trip.paymentStatus === "COMPLETED" || trip.paymentStatus === "CANCELLED") {
    fail("This dispute is already resolved", "ConflictError");
  }
  if (trip.paymentStatus !== "DISPUTED") {
    fail("This trip is not held for dispute review", "ConflictError");
  }
  const result = await escrowOps().operatorResolve(tripIdHash(trip.id), releaseToPayee);
  if (releaseToPayee) await applyFinalize(trip, result.txHash);
  else await applyRefund(trip, result.txHash);
  if (note) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { tripId, category: "escrow_dispute" },
      orderBy: { createdAt: "desc" },
    });
    if (ticket) {
      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: trip.rider.userId,
          body: note,
          internal: true,
        },
      });
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "RESOLVED" },
      });
    }
  }
  const updated = await prisma.trip.findUnique({ where: { id: trip.id } });
  return snapshot({ ...trip, ...updated! });
}

export async function onEscrowDisputed(tripId: string, disputeTx: string | null) {
  cancelEscrowFinalize(tripId);
  const trip = await loadTrip(tripId);
  if (!trip) return;
  if (trip.paymentStatus === "COMPLETED" || trip.paymentStatus === "CANCELLED") return;
  if (trip.paymentStatus !== "DISPUTED") {
    if (trip.paymentStatus !== "SETTLING") return;
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        paymentStatus: "DISPUTED",
        ...(disputeTx ? { escrowDisputeTx: disputeTx } : {}),
      },
    });
  }
  await ensureDisputeTicket(tripId);
  const run = async () => {
    const latest = await loadTrip(tripId);
    if (!latest || latest.paymentStatus !== "DISPUTED") return;
    const decision = await decideEscrowDispute(tripId);
    await operatorResolveTrip(
      tripId,
      decision.decision === "RELEASE",
      `[admin AI:${decision.source}] ${decision.decision}: ${decision.rationale}`,
    );
  };
  if (process.env.VITEST) await run();
  else void run().catch(() => undefined);
}

export async function applyChainDeposit(tripId: string, txHash: string) {
  const hash = txHash.trim();
  if (!hash) return;
  const trip = await loadTrip(tripId);
  if (!trip) return;
  await persistDeposit(trip, hash);
}

export async function applyChainSettlement(
  tripId: string,
  txHash: string,
  settleFromMs?: number,
) {
  const hash = txHash.trim();
  if (!hash) return;
  const trip = await loadTrip(tripId);
  if (!trip) return;
  await persistSettlement(trip, hash, settleFromMs);
}

export async function applyChainRelease(tripId: string, txHash: string) {
  cancelEscrowFinalize(tripId);
  const trip = await loadTrip(tripId);
  if (!trip || trip.paymentStatus === "COMPLETED") return;
  await applyFinalize(trip, txHash);
}

export async function applyChainRefund(tripId: string, txHash: string) {
  cancelEscrowFinalize(tripId);
  const trip = await loadTrip(tripId);
  if (!trip || trip.escrowRefundTx) return;
  await applyRefund(trip, txHash);
}

async function ensureDisputeTicket(tripId: string) {
  const trip = await loadTrip(tripId);
  if (!trip) return;
  const existing = await prisma.supportTicket.findFirst({
    where: { tripId, category: "escrow_dispute" },
  });
  if (existing) return;
  await prisma.supportTicket.create({
    data: {
      subject: `Escrow dispute ${trip.bookingCode}`,
      category: "escrow_dispute",
      priority: "HIGH",
      channel: "SYSTEM",
      requesterId: trip.rider.userId,
      riderId: trip.riderId,
      tripId: trip.id,
      messages: {
        create: {
          authorId: trip.rider.userId,
          body: "The rider disputed this fare within the 5-minute window. Funds stay in escrow until review.",
          internal: false,
        },
      },
    },
  });
}

function snapshot(trip: {
  id: string;
  paymentStatus: string;
  escrowDepositTx?: string | null;
  escrowStartTx?: string | null;
  escrowSettleFrom?: Date | null;
  escrowDisputeTx?: string | null;
  escrowReleaseTx?: string | null;
  escrowRefundTx?: string | null;
  status?: string;
}) {
  return {
    tripId: trip.id,
    paymentStatus: trip.paymentStatus,
    status: trip.status,
    escrowDepositTx: trip.escrowDepositTx ?? null,
    escrowStartTx: trip.escrowStartTx ?? null,
    escrowSettleFrom: trip.escrowSettleFrom?.toISOString() ?? null,
    escrowDisputeTx: trip.escrowDisputeTx ?? null,
    escrowReleaseTx: trip.escrowReleaseTx ?? null,
    escrowRefundTx: trip.escrowRefundTx ?? null,
    disputeWindowMs: disputeWindowMs(),
  };
}

/** @deprecated Apps sign refund; kept for unfunded trips. */
export async function refundTripEscrow(tripId: string) {
  const trip = await loadTrip(tripId);
  if (!trip) fail("Trip not found", "NotFoundError");
  if (trip.paymentStatus !== "ESCROWED") {
    return { txHash: null };
  }
  return { quote: await quoteTripRefund(trip.rider.userId, tripId) };
}

export async function quoteStartSettlementForTrip(tripId: string): Promise<CallQuote> {
  const trip = await loadTrip(tripId);
  if (!trip?.driver?.userId) fail("Trip not found", "NotFoundError");
  return quoteTripSettlement(trip.driver.userId, tripId);
}

function serializeLedger(entry: {
  id: string;
  type: string;
  status: string;
  method: string;
  amount: unknown;
  currency: string;
  brand: string | null;
  providerRef: string | null;
  note: string | null;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    type: entry.type,
    status: entry.status,
    method: entry.method,
    amount: money(entry.amount as { toString(): string }),
    currency: entry.currency,
    brand: entry.brand,
    providerRef: entry.providerRef,
    note: entry.note,
    createdAt: entry.createdAt,
  };
}

async function walletActivity(userId: string) {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      userId,
      type: {
        in: ["CREDIT", "WALLET_WITHDRAW", "PAYOUT", "CHARGE", "REFUND"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return entries.map(serializeLedger);
}

export async function getDriverWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { driverProfile: true },
  });

  if (!user?.driverProfile) {
    fail("Driver profile not found", "NotFoundError");
  }

  const onChainUsdc = await getUsdcBalance(user.ethereumWallet);

  return {
    walletBalance: money(user.driverProfile.walletBalance),
    onChainUsdc,
    lifetimeEarnings: money(user.driverProfile.earningsTotal),
    ethereumWallet: user.ethereumWallet,
    ethereumWalletId: user.ethereumWalletId,
    solanaWallet: user.solanaWallet,
    chain: publicPaymentConfig(),
    minWithdrawUsd: 1,
    entries: await walletActivity(userId),
  };
}

export async function getRiderWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { riderProfile: true },
  });
  if (!user?.riderProfile) {
    fail("Rider profile not found", "NotFoundError");
  }
  const onChainUsdc = await getUsdcBalance(user.ethereumWallet);
  return {
    onChainUsdc,
    ethereumWallet: user.ethereumWallet,
    ethereumWalletId: user.ethereumWalletId,
    solanaWallet: user.solanaWallet,
    chain: publicPaymentConfig(),
    entries: await walletActivity(userId),
  };
}

export { serializeLedger };

const MIN_WITHDRAW_USD = 1;
const MAX_WITHDRAW_USD = 10_000;

export async function recordOnChainTransfer(
  userId: string,
  body: { amount: number; txHash: string; address: string },
) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_USD) {
    fail(`Minimum cash-out is $${MIN_WITHDRAW_USD.toFixed(2)}`, "ValidationError");
  }
  if (amount > MAX_WITHDRAW_USD) {
    fail(`Maximum cash-out is $${MAX_WITHDRAW_USD.toFixed(2)}`, "ValidationError");
  }
  const txHash = body.txHash?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    fail("Provide a valid transaction hash", "ValidationError");
  }
  const destination = body.address?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(destination)) {
    fail("Provide a valid Ethereum address", "ValidationError");
  }

  const existing = await prisma.ledgerEntry.findFirst({
    where: { userId, type: "WALLET_WITHDRAW", providerRef: txHash },
  });
  if (existing) {
    return { entry: serializeLedger(existing), replayed: true };
  }

  const rounded = Number(amount.toFixed(2));
  const entry = await prisma.ledgerEntry.create({
    data: {
      userId,
      type: "WALLET_WITHDRAW",
      status: "COMPLETED",
      method: "WALLET",
      amount: rounded,
      providerRef: txHash,
      brand: destination,
      note: `Cash-out to ${destination}`,
    },
  });
  return { entry: serializeLedger(entry), replayed: false };
}

export async function withdrawRiderWallet(
  userId: string,
  body: { amount: number; idempotencyKey?: string; address?: string },
) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_USD) {
    fail(`Minimum cash-out is $${MIN_WITHDRAW_USD.toFixed(2)}`, "ValidationError");
  }
  if (amount > MAX_WITHDRAW_USD) {
    fail(`Maximum cash-out is $${MAX_WITHDRAW_USD.toFixed(2)}`, "ValidationError");
  }

  const rounded = Number(amount.toFixed(2));
  const idempotencyKey = body.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        userId,
        type: "WALLET_WITHDRAW",
        brand: `idemp:${idempotencyKey}`,
      },
    });
    if (existing) {
      const profile = await prisma.riderProfile.findUnique({ where: { userId } });
      return {
        entry: serializeLedger(existing),
        walletBalance: money(profile?.walletBalance),
        replayed: true,
      };
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { riderProfile: true },
  });

  if (!user?.riderProfile) {
    fail("Rider profile not found", "NotFoundError");
  }

  const destination = body.address?.trim() || user.ethereumWallet?.trim();
  if (!destination || !/^0x[a-fA-F0-9]{40}$/.test(destination)) {
    fail("Provide a valid Ethereum address or link a Privy Ethereum wallet", "ValidationError");
  }

  if (Number(user.riderProfile.walletBalance) < rounded) {
    fail("Insufficient Eve wallet balance", "ConflictError");
  }

  const entry = await prisma.$transaction(async (tx) => {
    const updated = await tx.riderProfile.updateMany({
      where: {
        userId,
        walletBalance: { gte: rounded },
      },
      data: { walletBalance: { decrement: rounded } },
    });

    if (updated.count !== 1) {
      fail("Insufficient Eve wallet balance", "ConflictError");
    }

    return tx.ledgerEntry.create({
      data: {
        userId,
        type: "WALLET_WITHDRAW",
        status: "PENDING",
        method: "WALLET",
        amount: rounded,
        brand: idempotencyKey ? `idemp:${idempotencyKey}` : destination,
        note: `Cash-out to ${destination}`,
      },
    });
  });

  if (isTreasuryConfigured()) {
    try {
      const { txHash: providerRef } = await executePayout(destination, rounded);
      const completed = await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: { status: "COMPLETED", providerRef },
      });
      publishPaymentEvent("wallet.withdraw.completed", userId, {
        userId,
        amount: rounded,
        destination,
        txHash: providerRef,
      });
      return {
        entry: serializeLedger(completed),
        walletBalance: money(Number(user.riderProfile.walletBalance) - rounded),
        replayed: false,
      };
    } catch (error) {
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: { status: "FAILED" },
      });
      fail("On-chain payout failed", "ConflictError");
    }
  }

  publishPaymentEvent("wallet.withdraw.pending", userId, {
    userId,
    amount: rounded,
    destination,
  });

  return {
    entry: serializeLedger(entry),
    walletBalance: money(Number(user.riderProfile.walletBalance) - rounded),
    replayed: false,
  };
}

export async function withdrawDriverWallet(
  userId: string,
  body: { amount: number; idempotencyKey?: string },
) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW_USD) {
    fail(`Minimum cash-out is $${MIN_WITHDRAW_USD.toFixed(2)}`, "ValidationError");
  }
  if (amount > MAX_WITHDRAW_USD) {
    fail(`Maximum cash-out is $${MAX_WITHDRAW_USD.toFixed(2)}`, "ValidationError");
  }

  const rounded = Number(amount.toFixed(2));
  const idempotencyKey = body.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        userId,
        type: "WALLET_WITHDRAW",
        brand: `idemp:${idempotencyKey}`,
      },
    });
    if (existing) {
      const profile = await prisma.driverProfile.findUnique({ where: { userId } });
      return {
        entry: serializeLedger(existing),
        walletBalance: money(profile?.walletBalance),
        replayed: true,
      };
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { driverProfile: true },
  });

  if (!user?.driverProfile) {
    fail("Driver profile not found", "NotFoundError");
  }

  const destination = user.ethereumWallet?.trim();
  if (!destination || !/^0x[a-fA-F0-9]{40}$/.test(destination)) {
    fail("Link a Privy Ethereum wallet before cashing out", "ValidationError");
  }

  if (Number(user.driverProfile.walletBalance) < rounded) {
    fail("Insufficient Eve wallet balance", "ConflictError");
  }

  const entry = await prisma.$transaction(async (tx) => {
    const updated = await tx.driverProfile.updateMany({
      where: {
        userId,
        walletBalance: { gte: rounded },
      },
      data: { walletBalance: { decrement: rounded } },
    });

    if (updated.count !== 1) {
      fail("Insufficient Eve wallet balance", "ConflictError");
    }

    return tx.ledgerEntry.create({
      data: {
        userId,
        type: "WALLET_WITHDRAW",
        status: "PENDING",
        method: "WALLET",
        amount: rounded,
        brand: idempotencyKey ? `idemp:${idempotencyKey}` : destination,
        note: `Cash-out to ${destination}`,
      },
    });
  });

  if (!isTreasuryConfigured()) {
    return {
      entry: serializeLedger(entry),
      walletBalance: money(Number(user.driverProfile.walletBalance) - rounded),
      replayed: false,
    };
  }

  try {
    const { txHash } = await executePayout(destination, rounded);
    const completed = await prisma.ledgerEntry.update({
      where: { id: entry.id },
      data: {
        status: "COMPLETED",
        providerRef: txHash,
      },
    });
    const profile = await prisma.driverProfile.findUnique({ where: { userId } });
    return {
      entry: serializeLedger(completed),
      walletBalance: money(profile?.walletBalance),
      replayed: false,
    };
  } catch (error) {
    await prisma.$transaction([
      prisma.driverProfile.update({
        where: { userId },
        data: { walletBalance: { increment: rounded } },
      }),
      prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: {
          status: "FAILED",
          note: `Cash-out to ${destination} failed`,
        },
      }),
    ]);
    const message = error instanceof Error ? error.message : "Payout failed";
    fail(message, "ConflictError");
  }
}
