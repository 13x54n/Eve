import { randomUUID } from "crypto";
import { PrivyClient } from "@privy-io/node";
import { prisma } from "@eve/db";
import { fail } from "@eve/shared";
import { emitUserEvent } from "@eve/notify";
import { publishPaymentEvent } from "./payment-events.js";
import { serializeLedger } from "./payment.service.js";

export interface PrivyBankAccount {
  id: string;
  user_id?: string;
  provider: string;
  environment: string;
  currency: string;
  bank_name?: string | null;
  account_type: string;
  last_4: string;
  account_owner_name: string;
  created_at: string;
}

export interface RegisterBankAccountInput {
  accountOwnerName: string;
  bankName?: string;
  accountType?: "us" | "gb" | "iban" | "pix" | "swift";
  accountNumber: string;
  routingNumber: string;
  checkingOrSavings?: "checking" | "savings";
  address: {
    streetLine1: string;
    streetLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
}

export interface PayoutResponse {
  id: string;
  wallet_id: string;
  type: "payout";
  status: "pending" | "succeeded" | "rejected" | "failed";
  provider: string;
  environment: string;
  source: {
    asset: string;
    chain: string;
    amount: string;
  };
  destination: {
    fiat_account_id: string;
  };
  created_at: string;
  failure_reason?: string | null;
}

export function privyConfig() {
  const appId = process.env.PRIVY_APP_ID?.trim() || "test-privy-app-id";
  const appSecret = process.env.PRIVY_APP_SECRET?.trim() || "test-privy-app-secret";
  const environment = (process.env.PRIVY_ENVIRONMENT?.trim() ||
    (process.env.NODE_ENV === "production" ? "production" : "sandbox")) as "production" | "sandbox";
  const defaultChain = process.env.PRIVY_PAYOUT_CHAIN?.trim() || "base";
  const defaultAsset = process.env.PRIVY_PAYOUT_ASSET?.trim() || "usdc";
  const apiUrl = process.env.PRIVY_API_URL?.trim() || "https://api.privy.io";

  return { appId, appSecret, environment, defaultChain, defaultAsset, apiUrl };
}

let privyClientInstance: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!privyClientInstance) {
    const { appId, appSecret } = privyConfig();
    privyClientInstance = new PrivyClient({ appId, appSecret });
  }
  return privyClientInstance;
}

export function resetPrivyClient(): void {
  privyClientInstance = null;
}

// In-memory mock store for tests / local dev when live Privy Bridge is not configured
const mockAccountsByDid = new Map<string, PrivyBankAccount[]>();
const mockPayoutsById = new Map<string, PayoutResponse>();

export function isMockMode(): boolean {
  const { appId, appSecret } = privyConfig();
  return (
    Boolean(process.env.VITEST) ||
    process.env.PRIVY_MOCK === "1" ||
    appId.startsWith("test-") ||
    appSecret.startsWith("test-")
  );
}

export function resetMockFiatStore(): void {
  mockAccountsByDid.clear();
  mockPayoutsById.clear();
}

/**
 * Resolves a driver's Privy User ID (DID) and embedded Ethereum wallet ID.
 * If the wallet ID was not saved during auth exchange, fetches it from Privy and saves it.
 */
export async function resolveDriverPrivyWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { driverProfile: true },
  });

  if (!user) {
    fail("User not found", "NotFoundError");
  }

  if (!user.driverProfile) {
    fail("Driver profile not found", "NotFoundError");
  }

  if (!user.privyDid) {
    fail("Driver has no linked Privy account", "ConflictError");
  }

  let walletId = user.ethereumWalletId?.trim() || null;

  if (!walletId && !isMockMode()) {
    try {
      const client = getPrivyClient();
      const privyUser = await (client.users() as any)._get(user.privyDid);
      for (const account of privyUser.linked_accounts ?? []) {
        const record = account as unknown as Record<string, unknown>;
        if (record.type === "wallet" && record.chain_type === "ethereum") {
          const foundId = (record.id || record.wallet_id || record.walletId) as string | undefined;
          if (foundId) {
            walletId = foundId;
            await prisma.user.update({
              where: { id: userId },
              data: { ethereumWalletId: foundId },
            });
            break;
          }
        }
      }
    } catch {
      // If fetching from Privy fails, continue below
    }
  }

  // In test / mock mode, provide a deterministic wallet ID if not set
  if (!walletId && isMockMode()) {
    walletId = `wallet_${user.id}`;
  }

  if (!walletId) {
    fail("Driver has no Privy embedded wallet. Link wallet before withdrawing to bank.", "ConflictError");
  }

  return {
    user,
    privyDid: user.privyDid,
    walletId,
    ethereumWallet: user.ethereumWallet,
  };
}

/**
 * Lists external bank accounts registered against the driver's Privy identity.
 */
export async function listExternalBankAccounts(userId: string): Promise<PrivyBankAccount[]> {
  const { privyDid } = await resolveDriverPrivyWallet(userId);
  const { appId, appSecret, environment, apiUrl } = privyConfig();

  if (isMockMode()) {
    return mockAccountsByDid.get(privyDid) ?? [];
  }

  const client = getPrivyClient();
  try {
    const res = await client.users().externalFiatAccounts.list(privyDid, {
      provider: "bridge",
      environment,
    });
    return (res.accounts || []) as PrivyBankAccount[];
  } catch (sdkError) {
    // Fallback to direct REST call if SDK wrapper differs
    try {
      const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");
      const resp = await fetch(
        `${apiUrl}/v1/users/${encodeURIComponent(privyDid)}/external_fiat_accounts?provider=bridge&environment=${environment}`,
        {
          headers: {
            "privy-app-id": appId,
            Authorization: `Basic ${basicAuth}`,
          },
        },
      );
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Privy HTTP ${resp.status}: ${errText}`);
      }
      const data = (await resp.json()) as { accounts?: PrivyBankAccount[] };
      return data.accounts || [];
    } catch (fallbackError) {
      fail("Failed to list bank accounts from Privy", "ConflictError");
    }
  }
}

/**
 * Registers an external bank account against the driver's Privy identity.
 */
export async function registerExternalBankAccount(
  userId: string,
  input: RegisterBankAccountInput,
): Promise<PrivyBankAccount> {
  const { privyDid } = await resolveDriverPrivyWallet(userId);
  const { appId, appSecret, environment, apiUrl } = privyConfig();

  const routing = input.routingNumber.trim();
  if (!/^\d{9}$/.test(routing)) {
    fail("US routing number must be exactly 9 digits", "ValidationError");
  }
  const accountNum = input.accountNumber.trim();
  if (accountNum.length < 4 || accountNum.length > 20) {
    fail("Provide a valid bank account number", "ValidationError");
  }
  const ownerName = input.accountOwnerName.trim();
  if (!ownerName) {
    fail("Account owner name is required", "ValidationError");
  }
  const bankName = input.bankName?.trim() || "Bank Account";

  if (isMockMode()) {
    const last4 = accountNum.slice(-4);
    const mockAccount: PrivyBankAccount = {
      id: `fa_${randomUUID()}`,
      user_id: privyDid,
      provider: "bridge",
      environment,
      currency: "usd",
      bank_name: bankName,
      account_type: input.accountType || "us",
      last_4: last4,
      account_owner_name: ownerName,
      created_at: new Date().toISOString(),
    };
    const list = mockAccountsByDid.get(privyDid) ?? [];
    list.push(mockAccount);
    mockAccountsByDid.set(privyDid, list);
    return mockAccount;
  }

  const payload = {
    provider: "bridge" as const,
    environment,
    currency: "usd",
    account_owner_name: ownerName,
    bank_name: bankName,
    account: {
      type: (input.accountType || "us") as "us",
      account_number: accountNum,
      routing_number: routing,
      checking_or_savings: (input.checkingOrSavings || "checking") as "checking" | "savings",
    },
    address: {
      street_line_1: input.address.streetLine1.trim(),
      ...(input.address.streetLine2?.trim() ? { street_line_2: input.address.streetLine2.trim() } : {}),
      city: input.address.city.trim(),
      state: input.address.state.trim().toUpperCase(),
      postal_code: input.address.postalCode.trim(),
      country: input.address.country?.trim() || "USA",
    },
  };

  const client = getPrivyClient();
  try {
    const res = await client.users().externalFiatAccounts.create(privyDid, payload);
    return res.external_fiat_account as PrivyBankAccount;
  } catch (sdkError) {
    // Direct REST API fallback
    try {
      const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");
      const resp = await fetch(`${apiUrl}/v1/users/${encodeURIComponent(privyDid)}/external_fiat_accounts`, {
        method: "POST",
        headers: {
          "privy-app-id": appId,
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Privy HTTP ${resp.status}: ${errText}`);
      }
      const data = (await resp.json()) as { external_fiat_account: PrivyBankAccount };
      return data.external_fiat_account;
    } catch (fallbackError) {
      fail("Failed to register bank account with Privy", "ConflictError");
    }
  }
}

/**
 * Deletes a registered external bank account from Privy.
 */
export async function deleteExternalBankAccount(
  userId: string,
  accountId: string,
): Promise<{ success: boolean }> {
  const { privyDid } = await resolveDriverPrivyWallet(userId);
  const { appId, appSecret, apiUrl } = privyConfig();

  if (isMockMode()) {
    const list = mockAccountsByDid.get(privyDid) ?? [];
    const filtered = list.filter((a) => a.id !== accountId);
    mockAccountsByDid.set(privyDid, filtered);
    return { success: true };
  }

  const client = getPrivyClient();
  try {
    await client.users().externalFiatAccounts.delete(accountId, { user_id: privyDid });
    return { success: true };
  } catch (sdkError) {
    try {
      const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");
      const resp = await fetch(
        `${apiUrl}/v1/users/${encodeURIComponent(privyDid)}/external_fiat_accounts/${encodeURIComponent(accountId)}`,
        {
          method: "DELETE",
          headers: {
            "privy-app-id": appId,
            Authorization: `Basic ${basicAuth}`,
          },
        },
      );
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Privy HTTP ${resp.status}: ${errText}`);
      }
      return { success: true };
    } catch (fallbackError) {
      fail("Failed to delete bank account from Privy", "ConflictError");
    }
  }
}

/**
 * Executes a fiat payout from a driver's Privy wallet to their registered external bank account.
 */
export async function executeFiatPayout(
  userId: string,
  body: {
    amount: number;
    fiatAccountId: string;
    chain?: string;
    asset?: string;
    idempotencyKey?: string;
  },
) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 1) {
    fail("Minimum withdrawal to bank is $1.00", "ValidationError");
  }
  if (amount > 10000) {
    fail("Maximum withdrawal to bank is $10,000.00", "ValidationError");
  }

  const fiatAccountId = body.fiatAccountId?.trim();
  if (!fiatAccountId) {
    fail("Select a registered bank account for payout", "ValidationError");
  }

  const idempotencyKey = body.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        userId,
        type: "PAYOUT",
        brand: `idemp:${idempotencyKey}`,
      },
    });
    if (existing) {
      return {
        entry: serializeLedger(existing),
        replayed: true,
      };
    }
  }

  const { walletId } = await resolveDriverPrivyWallet(userId);
  const { appId, appSecret, environment, defaultChain, defaultAsset, apiUrl } = privyConfig();

  const payoutChain = body.chain?.trim() || defaultChain;
  const payoutAsset = body.asset?.trim() || defaultAsset;
  const roundedAmount = Number(amount.toFixed(2));

  // Verify bank account exists in user's registered accounts for audit brand label
  const accounts = await listExternalBankAccounts(userId);
  const targetAccount = accounts.find((a) => a.id === fiatAccountId);
  const bankBrand = targetAccount
    ? `${targetAccount.bank_name || "Bank"} ••••${targetAccount.last_4}`
    : `Bank (${fiatAccountId.slice(-6)})`;

  // Create PENDING ledger entry
  const entry = await prisma.ledgerEntry.create({
    data: {
      userId,
      type: "PAYOUT",
      status: "PENDING",
      method: "WALLET",
      amount: roundedAmount,
      currency: "USD",
      brand: idempotencyKey ? `idemp:${idempotencyKey}` : bankBrand,
      last4: targetAccount?.last_4,
      note: `Fiat payout to ${bankBrand}`,
    },
  });

  let payout: PayoutResponse;

  if (isMockMode()) {
    payout = {
      id: `payout_${randomUUID()}`,
      wallet_id: walletId,
      type: "payout",
      status: "pending",
      provider: "bridge",
      environment,
      source: {
        asset: payoutAsset,
        chain: payoutChain,
        amount: roundedAmount.toFixed(2),
      },
      destination: {
        fiat_account_id: fiatAccountId,
      },
      created_at: new Date().toISOString(),
    };
    mockPayoutsById.set(payout.id, payout);
  } else {
    try {
      const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");
      const resp = await fetch(`${apiUrl}/v1/wallets/${encodeURIComponent(walletId)}/payout/fiat`, {
        method: "POST",
        headers: {
          "privy-app-id": appId,
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "privy-idempotency-key": idempotencyKey } : {}),
        },
        body: JSON.stringify({
          source: {
            asset: payoutAsset,
            chain: payoutChain,
            amount: roundedAmount.toFixed(2),
          },
          destination: {
            fiat_account_id: fiatAccountId,
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        await prisma.ledgerEntry.update({
          where: { id: entry.id },
          data: { status: "FAILED", note: `Payout rejected: ${errText}` },
        });
        throw new Error(`Privy payout error (${resp.status}): ${errText}`);
      }

      payout = (await resp.json()) as PayoutResponse;
    } catch (error) {
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: { status: "FAILED" },
      });
      const message = error instanceof Error ? error.message : "Fiat payout failed";
      fail(message, "ConflictError");
    }
  }

  // Update entry with providerRef
  const updated = await prisma.ledgerEntry.update({
    where: { id: entry.id },
    data: {
      providerRef: payout.id,
      status: payout.status === "succeeded" ? "COMPLETED" : payout.status === "failed" ? "FAILED" : "PENDING",
    },
  });

  publishPaymentEvent("wallet.payout.initiated", userId, {
    userId,
    amount: roundedAmount,
    payoutId: payout.id,
    bankBrand,
  });

  void emitUserEvent("DRIVER", userId, "wallet.payout", {
    action: "payout_initiated",
    amount: roundedAmount,
    status: updated.status,
    bankBrand,
  });

  return {
    payout,
    entry: serializeLedger(updated),
    replayed: false,
  };
}

/**
 * Gets the current status of a fiat payout wallet action from Privy and updates the local ledger.
 */
export async function getFiatPayoutStatus(userId: string, actionId: string) {
  const { walletId } = await resolveDriverPrivyWallet(userId);
  const { appId, appSecret, apiUrl } = privyConfig();

  let payout: PayoutResponse;

  if (isMockMode()) {
    const existing = mockPayoutsById.get(actionId);
    if (!existing) {
      fail("Payout action not found", "NotFoundError");
    }
    payout = existing;
  } else {
    try {
      const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString("base64");
      const resp = await fetch(
        `${apiUrl}/v1/wallets/${encodeURIComponent(walletId)}/actions/${encodeURIComponent(actionId)}`,
        {
          headers: {
            "privy-app-id": appId,
            Authorization: `Basic ${basicAuth}`,
          },
        },
      );
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Privy action status error (${resp.status}): ${errText}`);
      }
      payout = (await resp.json()) as PayoutResponse;
    } catch (error) {
      fail("Could not fetch payout status", "ConflictError");
    }
  }

  // Sync ledger entry status
  const ledger = await prisma.ledgerEntry.findFirst({
    where: { providerRef: actionId, userId },
  });

  let serialized = ledger ? serializeLedger(ledger) : null;

  if (ledger) {
    let nextStatus = ledger.status;
    if (payout.status === "succeeded" && ledger.status !== "COMPLETED") {
      nextStatus = "COMPLETED";
    } else if ((payout.status === "failed" || payout.status === "rejected") && ledger.status !== "FAILED") {
      nextStatus = "FAILED";
    }

    if (nextStatus !== ledger.status) {
      const updated = await prisma.ledgerEntry.update({
        where: { id: ledger.id },
        data: { status: nextStatus },
      });
      serialized = serializeLedger(updated);

      publishPaymentEvent("wallet.payout.updated", userId, {
        userId,
        payoutId: actionId,
        status: nextStatus,
      });
    }
  }

  return {
    payout,
    entry: serialized,
  };
}

/**
 * Handles Privy wallet action webhooks for payouts:
 * - wallet_action.payout.created
 * - wallet_action.payout.succeeded
 * - wallet_action.payout.failed
 * - wallet_action.payout.rejected
 */
export async function handlePrivyWebhook(payload: any) {
  if (!payload || typeof payload !== "object") return;
  const eventType = payload.type || payload.event;
  const action = payload.data || payload;
  const actionId = action.id;

  if (!actionId || typeof eventType !== "string") return;

  let newStatus: "COMPLETED" | "FAILED" | "PENDING" | null = null;
  if (eventType === "wallet_action.payout.succeeded") {
    newStatus = "COMPLETED";
  } else if (eventType === "wallet_action.payout.failed" || eventType === "wallet_action.payout.rejected") {
    newStatus = "FAILED";
  }

  if (newStatus) {
    const entry = await prisma.ledgerEntry.findFirst({
      where: { providerRef: actionId },
    });
    if (entry && entry.status !== newStatus) {
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: { status: newStatus },
      });
      publishPaymentEvent("wallet.payout.status_changed", entry.userId, {
        userId: entry.userId,
        payoutId: actionId,
        status: newStatus,
      });
    }
  }
}

// Testing helper to simulate status changes in mock mode
export function setMockPayoutStatus(actionId: string, status: "pending" | "succeeded" | "failed" | "rejected") {
  const payout = mockPayoutsById.get(actionId);
  if (payout) {
    payout.status = status;
    mockPayoutsById.set(actionId, payout);
  }
}

