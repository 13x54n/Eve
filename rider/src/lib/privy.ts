export function requirePrivyConfig() {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID?.trim();
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID?.trim();
  if (!appId || !clientId) {
    throw new Error(
      "EXPO_PUBLIC_PRIVY_APP_ID and EXPO_PUBLIC_PRIVY_CLIENT_ID are not set",
    );
  }
  return { appId, clientId };
}

export function formatEmailForPrivy(input: string) {
  return input.trim().toLowerCase();
}

export function formatPhoneForPrivy(input: string) {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length > 0 ? `+${digits}` : trimmed;
}

export function truncateWalletAddress(address: string | null | undefined) {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  const nested = (error as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  return nested ?? "";
}

export function isAlreadyAuthenticatedPrivyError(error: unknown) {
  const message = errorMessage(error).toLowerCase().replace(/\s+/g, " ");
  return (
    message.includes("already logged in") ||
    message.includes("already loggedin") ||
    message.includes("already authenticated")
  );
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForIdentityToken(
  getIdentityToken: () => Promise<string | null | undefined>,
  options?: {
    attempts?: number;
    delayMs?: number;
    refresh?: () => Promise<unknown>;
  },
) {
  const attempts = options?.attempts ?? 5;
  const delayMs = options?.delayMs ?? 400;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await wait(delayMs);
    try {
      await options?.refresh?.();
    } catch {
      /* identity token may already be current */
    }
    const token = await getIdentityToken();
    if (token) return token;
  }
  throw new Error(
    "Privy identity token is unavailable. Enable identity tokens in the Privy Dashboard.",
  );
}
