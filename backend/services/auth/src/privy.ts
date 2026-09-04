import { PrivyClient, type User } from "@privy-io/node";
import { fail } from "@eve/shared";

export type PrivyIdentity = {
  privyDid: string;
  email?: string;
  phone?: string;
  name?: string;
  ethereumWallet?: string;
  solanaWallet?: string;
};

function privyConfig() {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be configured");
  }
  return { appId, appSecret };
}

function asRecord(account: unknown): Record<string, unknown> {
  return account !== null && typeof account === "object"
    ? (account as Record<string, unknown>)
    : {};
}

function stringField(account: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = account[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export function identityFromPrivyUser(user: User): PrivyIdentity {
  if (!user.id) {
    fail("Invalid Privy token", "UnauthorizedError");
  }

  let email: string | undefined;
  let phone: string | undefined;
  let name: string | undefined;
  let ethereumWallet: string | undefined;
  let solanaWallet: string | undefined;

  for (const account of user.linked_accounts ?? []) {
    const record = asRecord(account);
    const type = stringField(record, "type");

    if (type === "email") {
      email ??= stringField(record, "address")?.toLowerCase();
    }

    if (type === "phone") {
      phone ??= stringField(record, "phoneNumber", "number");
    }

    if (type === "wallet") {
      const chainType = stringField(record, "chain_type");
      const address = stringField(record, "address");
      if (chainType === "ethereum" && address) {
        ethereumWallet ??= address;
      }
      if (chainType === "solana" && address) {
        solanaWallet ??= address;
      }
    }

    if (!name) {
      name =
        stringField(record, "name", "display_name", "username") ?? name;
    }
  }

  return {
    privyDid: user.id,
    email,
    phone,
    name,
    ethereumWallet,
    solanaWallet,
  };
}

export async function verifyPrivyIdentityToken(
  identityToken: string,
): Promise<PrivyIdentity> {
  const { appId, appSecret } = privyConfig();

  try {
    const client = new PrivyClient({ appId, appSecret });
    const user = await client.users().get({ id_token: identityToken });
    return identityFromPrivyUser(user);
  } catch (error) {
    if (error instanceof Error && error.name === "UnauthorizedError") {
      throw error;
    }
    fail("Invalid Privy token", "UnauthorizedError");
  }
}
