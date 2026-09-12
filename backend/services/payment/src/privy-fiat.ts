import { fail } from "@eve/shared";

export type FiatEnvironment = "sandbox" | "production";

export type UsBankAccountInput = {
  accountOwnerName: string;
  bankName?: string;
  currency?: string;
  accountNumber: string;
  routingNumber: string;
  checkingOrSavings?: "checking" | "savings";
  streetLine1: string;
  streetLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
};

export type PrivyBankAccount = {
  id: string;
  user_id?: string;
  provider: "bridge";
  environment: FiatEnvironment;
  currency: string;
  account_type: string;
  bank_name?: string;
  last_4: string;
  account_owner_name: string;
  created_at?: string;
};

export function fiatEnvironment(): FiatEnvironment {
  return process.env.PRIVY_FIAT_ENVIRONMENT?.trim() === "production"
    ? "production"
    : "sandbox";
}

export function privyFiatConfigured() {
  return Boolean(process.env.PRIVY_APP_ID?.trim() && process.env.PRIVY_APP_SECRET?.trim());
}

function basicAuth() {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    fail("PRIVY_APP_ID and PRIVY_APP_SECRET must be configured", "ConflictError");
  }
  return {
    appId,
    authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
  };
}

async function privyFetch<T>(path: string, init: RequestInit): Promise<T> {
  const { appId, authorization } = basicAuth();
  const response = await fetch(`https://api.privy.io${path}`, {
    ...init,
    headers: {
      Authorization: authorization,
      "privy-app-id": appId,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error?: { message?: string } }).error?.message ?? text)
        : text || `Privy request failed (${response.status})`;
    const error = new Error(message);
    error.name = "PrivyFiatError";
    throw error;
  }
  return body as T;
}

export async function createPrivyBankAccount(privyDid: string, input: UsBankAccountInput) {
  const environment = fiatEnvironment();
  const payload = {
    provider: "bridge",
    environment,
    currency: (input.currency ?? "usd").toLowerCase(),
    account_owner_name: input.accountOwnerName,
    bank_name: input.bankName,
    account: {
      type: "us",
      account_number: input.accountNumber,
      routing_number: input.routingNumber,
      checking_or_savings: input.checkingOrSavings ?? "checking",
    },
    address: {
      street_line_1: input.streetLine1,
      street_line_2: input.streetLine2,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      country: (input.country ?? "USA").toUpperCase(),
    },
  };

  const result = await privyFetch<{ external_fiat_account?: PrivyBankAccount } & PrivyBankAccount>(
    `/v1/users/${encodeURIComponent(privyDid)}/external_fiat_accounts`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return result.external_fiat_account ?? result;
}

export async function listPrivyBankAccounts(privyDid: string) {
  const result = await privyFetch<{
    external_fiat_accounts?: PrivyBankAccount[];
    data?: PrivyBankAccount[];
  }>(`/v1/users/${encodeURIComponent(privyDid)}/external_fiat_accounts`, { method: "GET" });
  return result.external_fiat_accounts ?? result.data ?? [];
}

export async function deletePrivyBankAccount(privyDid: string, fiatAccountId: string) {
  await privyFetch(`/v1/users/${encodeURIComponent(privyDid)}/external_fiat_accounts/${encodeURIComponent(fiatAccountId)}`, {
    method: "DELETE",
  });
}
