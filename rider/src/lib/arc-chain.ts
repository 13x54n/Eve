import { arcTestnet } from "viem/chains";

// viem ships `arcTestnet` (chain id 5042002). Overlay RPC only.
const RPC = process.env.EXPO_PUBLIC_CHAIN_RPC_URL?.trim() || "https://rpc.testnet.arc.io";

export const eveArcTestnet = {
  ...arcTestnet,
  rpcUrls: {
    ...arcTestnet.rpcUrls,
    default: { http: [RPC] },
  },
};

export const privyChainConfig = {
  defaultChain: eveArcTestnet,
  supportedChains: [eveArcTestnet],
} as const;
