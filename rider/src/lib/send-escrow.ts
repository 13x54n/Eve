import { useCallback } from "react";
import { useEmbeddedEthereumWallet } from "@privy-io/expo";
import type { CallQuote } from "@/services/wallet";
import { eveArcTestnet } from "@/lib/arc-chain";
import { encodeFunctionData, getAddress, parseUnits } from "viem";

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
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: hex }],
  });
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

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
] as const;

export function useSendUsdcTransfer() {
  const { wallets } = useEmbeddedEthereumWallet();

  return useCallback(
    async (input: {
      to: string;
      amountUsd: number;
      tokenAddress: string;
      chainId?: number;
      decimals?: number;
    }) => {
      const wallet = wallets[0];
      if (!wallet) {
        throw new Error("Link a Privy Ethereum wallet first");
      }
      const provider = (await wallet.getProvider()) as EthereumProvider;
      await ensureArcTestnet(provider, input.chainId ?? eveArcTestnet.id);
      const decimals = input.decimals ?? 6;
      const data = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [getAddress(input.to), parseUnits(input.amountUsd.toFixed(decimals), decimals)],
      });
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet.address,
            to: getAddress(input.tokenAddress),
            data,
          },
        ],
      });
      if (typeof hash !== "string" || !hash.startsWith("0x")) {
        throw new Error("Wallet did not return a transaction hash");
      }
      return hash;
    },
    [wallets],
  );
}
