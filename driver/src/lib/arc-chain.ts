import { arcTestnet } from "viem/chains";
import { createPublicClient, formatUnits, getAddress, http } from "viem";

// viem ships `arcTestnet` (chain id 5042002). Overlay RPC only.
const RPC = process.env.EXPO_PUBLIC_CHAIN_RPC_URL?.trim() || "https://rpc.testnet.arc.io";

export const eveArcTestnet = {
  ...arcTestnet,
  rpcUrls: {
    ...arcTestnet.rpcUrls,
    default: { http: [RPC] },
  },
};

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const DEFAULT_USDC = "0x3600000000000000000000000000000000000000";
export const ARC_EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

/** On-chain ERC-20 USDC (6 decimals). Independent of the payment API. */
export async function getArcUsdcBalance(
  address: string | null | undefined,
  tokenAddress?: string | null,
  decimals = 6,
) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return 0;
  const token = tokenAddress || DEFAULT_USDC;
  const client = createPublicClient({
    chain: eveArcTestnet,
    transport: http(RPC),
  });
  const raw = await client.readContract({
    address: getAddress(token),
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [getAddress(address)],
  });
  return Number(formatUnits(raw, decimals));
}

/** On-chain ERC-20 EURC (6 decimals). Independent of the payment API. */
export async function getArcEurcBalance(
  address: string | null | undefined,
  tokenAddress?: string | null,
  decimals = 6,
) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return 0;
  const token = tokenAddress || ARC_EURC_ADDRESS;
  const client = createPublicClient({
    chain: eveArcTestnet,
    transport: http(RPC),
  });
  const raw = await client.readContract({
    address: getAddress(token),
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [getAddress(address)],
  });
  return Number(formatUnits(raw, decimals));
}
