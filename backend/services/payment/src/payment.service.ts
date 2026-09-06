import { keccak256, toBytes, type Hex } from "viem";
import { prisma } from "@eve/db";
import { fail, money } from "@eve/shared";
import {
  executePayout,
  getPayoutChainPublicConfig,
  isTreasuryConfigured,
  usdToNativeUsdcWei,
} from "@eve/shared/treasury";
import { getUsdcBalance } from "./chain.js";
import { escrowOps, getEscrowAddress, type DepositQuote } from "./escrow.js";

export function tripIdHash(tripId: string): Hex {
  return keccak256(toBytes(tripId));
}

function fareWei(amountUsd: number) {
  return usdToNativeUsdcWei(amountUsd);
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

export function publicPaymentConfig() {
  return {
    ...getPayoutChainPublicConfig(),
    escrowAddress: getEscrowAddress(),
    escrowConfigured: Boolean(getEscrowAddress()) || Boolean(process.env.VITEST),
  };
}

export async function quoteTripDeposit(userId: string, tripId: string): Promise<DepositQuote> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, rider: { userId } },
    include: {
      rider: { include: { user: true } },
      driver: { include: { user: true } },
    },
  });
  if (!trip) fail("Trip not found", "NotFoundError");
  if (trip.status !== "ASSIGNED" || trip.paymentStatus !== "PENDING") {
    fail("This trip cannot be funded", "ConflictError");
  }
  if (!trip.driver?.user.ethereumWallet) {
    fail("Driver has no Privy Ethereum wallet", "ConflictError");
  }
  if (!trip.rider.user.ethereumWallet) {
    fail("Link a Privy Ethereum wallet before paying", "ValidationError");
  }
  return escrowOps().quote({
    tripIdHash: tripIdHash(trip.id),
    payee: trip.driver.user.ethereumWallet,
    amountWei: fareWei(Number(trip.fareTotal)),
  });
}

export async function confirmTripDeposit(
  userId: string,
  tripId: string,
  txHash: string,
) {
  const hash = txHash.trim();
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, rider: { userId } },
    include: {
      rider: { include: { user: true } },
      driver: { include: { user: true } },
    },
  });
  if (!trip) fail("Trip not found", "NotFoundError");
  if (trip.paymentStatus === "ESCROWED" && trip.escrowDepositTx === hash) {
    return {
      tripId: trip.id,
      paymentStatus: trip.paymentStatus,
      escrowDepositTx: trip.escrowDepositTx,
    };
  }
  if (trip.paymentStatus === "ESCROWED") {
    fail("Fare is already in escrow", "ConflictError");
  }
  if (trip.status !== "ASSIGNED") {
    fail("Accept a driver before depositing", "ConflictError");
  }
  const riderWallet = trip.rider.user.ethereumWallet?.trim();
  const driverWallet = trip.driver?.user.ethereumWallet?.trim();
  if (!riderWallet || !driverWallet) {
    fail("Both rider and driver need Privy Ethereum wallets", "ValidationError");
  }

  const confirmed = await escrowOps().confirm({
    txHash: hash,
    expectedFrom: riderWallet,
    expectedPayee: driverWallet,
    tripIdHash: tripIdHash(trip.id),
    amountWei: fareWei(Number(trip.fareTotal)),
  });

  const updated = await prisma.trip.update({
    where: { id: trip.id },
    data: {
      paymentStatus: "ESCROWED",
      paymentMethod: "WALLET",
      escrowDepositTx: confirmed.txHash,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      tripId: trip.id,
      userId,
      type: "CHARGE",
      status: "PENDING",
      method: "WALLET",
      amount: trip.fareTotal,
      providerRef: confirmed.txHash,
      note: `USDC escrowed on Arc Testnet for trip ${trip.bookingCode}`,
    },
  });

  return {
    tripId: updated.id,
    paymentStatus: updated.paymentStatus,
    escrowDepositTx: updated.escrowDepositTx,
  };
}

export async function releaseTripEscrow(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { driver: { include: { user: true } } },
  });
  if (!trip) fail("Trip not found", "NotFoundError");
  if (trip.paymentStatus === "COMPLETED" && trip.escrowReleaseTx) {
    return { txHash: trip.escrowReleaseTx };
  }
  if (trip.paymentStatus !== "ESCROWED") {
    fail("Fare is not in escrow", "ConflictError");
  }
  const { txHash } = await escrowOps().release(tripIdHash(trip.id));
  await prisma.trip.update({
    where: { id: trip.id },
    data: { escrowReleaseTx: txHash },
  });
  return { txHash };
}

export async function refundTripEscrow(tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) fail("Trip not found", "NotFoundError");
  if (trip.paymentStatus === "CANCELLED" && trip.escrowRefundTx) {
    return { txHash: trip.escrowRefundTx };
  }
  if (trip.paymentStatus !== "ESCROWED") {
    return { txHash: null };
  }
  const { txHash } = await escrowOps().refund(tripIdHash(trip.id));
  const zero =
    txHash ===
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      escrowRefundTx: zero ? null : txHash,
      paymentStatus: "CANCELLED",
    },
  });
  if (!zero) {
    await prisma.ledgerEntry.create({
      data: {
        tripId: trip.id,
        userId: (await prisma.riderProfile.findUnique({
          where: { id: trip.riderId },
          select: { userId: true },
        }))!.userId,
        type: "REFUND",
        status: "COMPLETED",
        method: "WALLET",
        amount: trip.fareTotal,
        providerRef: txHash,
        note: `USDC refunded from escrow for trip ${trip.bookingCode}`,
      },
    });
  }
  return { txHash: zero ? null : txHash };
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
