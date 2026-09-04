import { useCallback } from "react";
import {
  useEmbeddedEthereumWallet,
  useEmbeddedSolanaWallet,
  useIdentityToken,
  usePrivy,
} from "@privy-io/expo";
import { exchangePrivy, type AuthResponse } from "@/services/auth";
import { waitForIdentityToken } from "@/lib/privy";

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

    const identityToken = await waitForIdentityToken(getIdentityToken, {
      refresh: refreshUser,
    });

    return exchangePrivy({
      identityToken,
      ethereumWallet: ethWallets[0]?.address,
      solanaWallet: solana.wallets?.[0]?.address,
    });
  }, [createEthWallet, ethWallets, getIdentityToken, refreshUser, solana]);
}
