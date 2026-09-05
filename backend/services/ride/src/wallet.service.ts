import { prisma } from "@eve/db";
import {
  executePayout,
  fail,
  getPayoutChainPublicConfig,
  isTreasuryConfigured,
  money,
} from "@eve/shared";

const MIN_WITHDRAW_USD = 1;
const MAX_WITHDRAW_USD = 10_000;

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

export async function getDriverWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { driverProfile: true },
  });

  if (!user?.driverProfile) {
    fail("Driver profile not found", "NotFoundError");
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      userId,
      type: { in: ["CREDIT", "WALLET_WITHDRAW", "PAYOUT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    walletBalance: money(user.driverProfile.walletBalance),
    lifetimeEarnings: money(user.driverProfile.earningsTotal),
    ethereumWallet: user.ethereumWallet,
    solanaWallet: user.solanaWallet,
    chain: getPayoutChainPublicConfig(),
    minWithdrawUsd: MIN_WITHDRAW_USD,
    entries: entries.map(serializeLedger),
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
    fail(
      "Link a Privy Ethereum wallet before cashing out",
      "ValidationError",
    );
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
        status: isTreasuryConfigured() ? "PENDING" : "PENDING",
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
      walletBalance: money(
        Number(user.driverProfile.walletBalance) - rounded,
      ),
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
