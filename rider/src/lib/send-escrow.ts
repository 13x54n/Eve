import { useCallback } from "react";
import { useEmbeddedEthereumWallet } from "@privy-io/expo";
import type { CallQuote } from "@/services/wallet";
import { eveArcTestnet } from "@/lib/arc-chain";

function chainIdHex(id: number) {
  return `0x${id.toString(16)}`;
}

function parseProviderChainId(value: unknown) {
  if (typeof value === "string") {
    return Number.parseInt(value, 16);
  }
  if (typeof value === "number") return value;
  return NaN;
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

async function ensureArcTestnet(provider: EthereumProvider, chainId: number) {
  const current = parseProviderChainId(
    await provider.request({ method: "eth_chainId" }),
  );
  if (current === chainId) return;

  const hex = chainIdHex(chainId);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex }],
    });
    return;
  } catch {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hex,
          chainName: eveArcTestnet.name,
          nativeCurrency: eveArcTestnet.nativeCurrency,
          rpcUrls: [eveArcTestnet.rpcUrls.default.http[0]],
          blockExplorerUrls: eveArcTestnet.blockExplorers?.default
            ? [eveArcTestnet.blockExplorers.default.url]
            : ["https://testnet.arcscan.app"],
        },
      ],
    });
  }
}

function isZeroValue(value: string | undefined) {
  if (!value) return true;
  try {
    return BigInt(value) === 0n;
  } catch {
    return value === "0x" || value === "0x0";
  }
}

export function useSendEscrowTx() {
  const { wallets } = useEmbeddedEthereumWallet();

  return useCallback(
    async (quote: CallQuote) => {
      const wallet = wallets[0];
      if (!wallet) {
        throw new Error("Link a Privy Ethereum wallet first");
      }
      const provider = (await wallet.getProvider()) as EthereumProvider;
      await ensureArcTestnet(provider, quote.chainId);
      const from = wallet.address;
      const tx: Record<string, string> = {
        from,
        to: quote.to,
        data: quote.data,
      };
      if (!isZeroValue(quote.value)) {
        tx.value = quote.value;
      }
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [tx],
      });
      if (typeof hash !== "string" || !hash.startsWith("0x")) {
        throw new Error("Wallet did not return a transaction hash");
      }
      return hash;
    },
    [wallets],
  );
}

/** @deprecated use useSendEscrowTx */
export const useSendEscrowDeposit = useSendEscrowTx;
