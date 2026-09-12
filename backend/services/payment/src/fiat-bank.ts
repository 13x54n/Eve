import { prisma } from "@eve/db";
import { fail } from "@eve/shared";
import {
  createPrivyBankAccount,
  deletePrivyBankAccount,
  fiatEnvironment,
  listPrivyBankAccounts,
  privyFiatConfigured,
  type UsBankAccountInput,
} from "./privy-fiat.js";

export type BankAccountView = {
  id: string;
  providerAccountId: string | null;
  provider: string;
  environment: string;
  currency: string;
  accountType: string;
  bankName: string | null;
  last4: string;
  accountOwnerName: string;
  providerStatus: string;
  payoutsLive: boolean;
  createdAt: string;
};

function last4(accountNumber: string) {
  const digits = accountNumber.replace(/\D/g, "");
  return digits.slice(-4).padStart(4, "0");
}

function serialize(row: {
  id: string;
  providerAccountId: string | null;
  provider: string;
  environment: string;
  currency: string;
  accountType: string;
  bankName: string | null;
  last4: string;
  accountOwnerName: string;
  providerStatus: string;
  createdAt: Date;
}): BankAccountView {
  return {
    id: row.id,
    providerAccountId: row.providerAccountId,
    provider: row.provider,
    environment: row.environment,
    currency: row.currency,
    accountType: row.accountType,
    bankName: row.bankName,
    last4: row.last4,
    accountOwnerName: row.accountOwnerName,
    providerStatus: row.providerStatus,
    payoutsLive: row.providerStatus === "READY" && row.environment === "production",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDriverBankAccounts(userId: string) {
  const rows = await prisma.fiatBankAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return { accounts: rows.map(serialize), environment: fiatEnvironment() };
}

export async function registerDriverBankAccount(userId: string, input: UsBankAccountInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { driverProfile: true },
  });
  if (!user?.driverProfile) {
    fail("Driver profile not found", "NotFoundError");
  }
  const accountNumber = input.accountNumber.replace(/\s+/g, "");
  const routingNumber = input.routingNumber.replace(/\s+/g, "");
  if (!/^\d{6,17}$/.test(accountNumber)) {
    fail("Enter a valid US account number", "ValidationError");
  }
  if (!/^\d{9}$/.test(routingNumber)) {
    fail("Routing number must be 9 digits", "ValidationError");
  }
  if (input.accountOwnerName.trim().length < 3) {
    fail("Account owner name is required", "ValidationError");
  }
  if (input.streetLine1.trim().length < 3 || input.city.trim().length < 2 || input.state.trim().length < 2) {
    fail("A US address is required to register a bank account", "ValidationError");
  }

  let providerAccountId: string | null = null;
  let providerStatus = "LOCAL_ONLY";
  let providerError: string | null = null;

  if (user.privyDid && privyFiatConfigured()) {
    try {
      const remote = await createPrivyBankAccount(user.privyDid, {
        ...input,
        accountNumber,
        routingNumber,
      });
      providerAccountId = remote.id;
      providerStatus = "READY";
    } catch (error) {
      providerError = error instanceof Error ? error.message : "Privy bank registration failed";
      providerStatus = "LOCAL_ONLY";
      console.warn("[fiat-bank] Privy registration deferred (expected until production + KYC/Bridge):", providerError);
    }
  }

  const row = await prisma.fiatBankAccount.create({
    data: {
      userId,
      provider: "bridge",
      environment: fiatEnvironment(),
      currency: (input.currency ?? "usd").toLowerCase(),
      accountType: "us",
      bankName: input.bankName?.trim() || null,
      last4: last4(accountNumber),
      accountOwnerName: input.accountOwnerName.trim(),
      providerAccountId,
      providerStatus,
    },
  });

  return {
    account: serialize(row),
    providerError,
    note:
      providerStatus === "READY"
        ? "Bank account registered with Privy Bridge."
        : "Saved locally. Privy Bridge payouts do not settle on Arc Testnet — this record is ready for production once KYC and Bridge server-side flows are enabled.",
  };
}

export async function deleteDriverBankAccount(userId: string, accountId: string) {
  const row = await prisma.fiatBankAccount.findFirst({
    where: { id: accountId, userId },
  });
  if (!row) {
    fail("Bank account not found", "NotFoundError");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (row.providerAccountId && user?.privyDid && privyFiatConfigured()) {
    try {
      await deletePrivyBankAccount(user.privyDid, row.providerAccountId);
    } catch (error) {
      console.warn("[fiat-bank] Privy delete skipped:", error);
    }
  }
  await prisma.fiatBankAccount.delete({ where: { id: row.id } });
  return { deleted: true };
}

export async function syncDriverBankAccounts(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.privyDid || !privyFiatConfigured()) {
    return listDriverBankAccounts(userId);
  }
  try {
    const remote = await listPrivyBankAccounts(user.privyDid);
    for (const item of remote) {
      const existing = await prisma.fiatBankAccount.findFirst({
        where: { userId, providerAccountId: item.id },
      });
      if (existing) {
        await prisma.fiatBankAccount.update({
          where: { id: existing.id },
          data: {
            bankName: item.bank_name ?? undefined,
            last4: item.last_4,
            accountOwnerName: item.account_owner_name,
            providerStatus: "READY",
            environment: item.environment,
            currency: item.currency,
            accountType: item.account_type,
          },
        });
      } else {
        await prisma.fiatBankAccount.create({
          data: {
            userId,
            provider: "bridge",
            environment: item.environment,
            currency: item.currency,
            accountType: item.account_type,
            bankName: item.bank_name ?? null,
            last4: item.last_4,
            accountOwnerName: item.account_owner_name,
            providerAccountId: item.id,
            providerStatus: "READY",
          },
        });
      }
    }
  } catch (error) {
    console.warn("[fiat-bank] Privy list skipped:", error);
  }
  return listDriverBankAccounts(userId);
}
