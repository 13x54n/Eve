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

export function requireRelyingParty() {
  const relyingParty = process.env.EXPO_PUBLIC_PRIVY_RELYING_PARTY?.trim();
  if (!relyingParty) {
    throw new Error("EXPO_PUBLIC_PRIVY_RELYING_PARTY is not set");
  }
  return relyingParty.replace(/\/+$/, "");
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
