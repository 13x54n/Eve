import { useCallback } from "react";
import {
  useEmbeddedEthereumWallet,
  useEmbeddedSolanaWallet,
  useIdentityToken,
  usePrivy,
} from "@privy-io/expo";
import { exchangePrivy, type AuthResponse } from "@/services/auth";

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function useCompletePrivySession() {
  const { getIdentityToken } = useIdentityToken();
  const { refreshUser } = usePrivy();
  const { wallets: ethWallets, create: createEthWallet } = useEmbeddedEthereumWallet();
  const solana = useEmbeddedSolanaWallet();

  return useCallback(async (): Promise<AuthResponse> => {
    try {
      if (ethWallets.length === 0) {
        await createEthWallet();
      }
    } catch {
      /* wallet may already exist or still be creating */
    }

    try {
      if (!solana.wallets?.length && typeof solana.create === "function") {
        await solana.create();
      }
    } catch {
      /* wallet may already exist or still be creating */
    }

    await wait(400);
    try {
      await refreshUser();
    } catch {
      /* identity token may already be current */
    }

    const identityToken = await getIdentityToken();
    if (!identityToken) {
      throw new Error(
        "Privy identity token is unavailable. Enable identity tokens in the Privy Dashboard.",
      );
    }

    return exchangePrivy({
      identityToken,
      ethereumWallet: ethWallets[0]?.address,
      solanaWallet: solana.wallets?.[0]?.address,
    });
  }, [createEthWallet, ethWallets, getIdentityToken, refreshUser, solana]);
}
