import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  type Chain,
} from "viem";
import { arcTestnet } from "viem/chains";
import {
  ARC_EURC_ERC20_ADDRESS,
  ARC_EURC_ERC20_DECIMALS,
  ARC_USDC_ERC20_ADDRESS,
  ARC_USDC_ERC20_DECIMALS,
  DEFAULT_PAYOUT_CHAIN_ID,
  getChainRpcUrl,
  getPayoutChainPublicConfig,
  getPayoutTokenAddress,
  getUsdcErc20Decimals,
} from "@eve/shared/treasury";

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

let balanceOverride: ((address: string) => Promise<bigint>) | null = null;

export function setBalanceReaderForTests(
  reader: ((address: string) => Promise<bigint>) | null,
) {
  balanceOverride = reader;
}

export function payoutChain(): Chain {
  const { chainId } = getPayoutChainPublicConfig();
  if (chainId === arcTestnet.id || chainId === DEFAULT_PAYOUT_CHAIN_ID) {
    return {
      ...arcTestnet,
      rpcUrls: {
        ...arcTestnet.rpcUrls,
        default: { http: [getChainRpcUrl()] },
      },
    };
  }
  return { ...arcTestnet, id: chainId, rpcUrls: { default: { http: [getChainRpcUrl()] } } };
}

export function usdcErc20Address() {
  return getPayoutTokenAddress() || ARC_USDC_ERC20_ADDRESS;
}

/** 6-decimal ERC-20 USDC view. Do not use native `getBalance` for display. */
export async function getUsdcBalance(address: string | null | undefined) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return 0;
  }
  const decimals = getUsdcErc20Decimals() || ARC_USDC_ERC20_DECIMALS;
  try {
    if (balanceOverride) {
      return Number(formatUnits(await balanceOverride(address), decimals));
    }
    if (process.env.VITEST) {
      return 0;
    }
    const client = createPublicClient({
      chain: payoutChain(),
      transport: http(getChainRpcUrl()),
    });
    const raw = await client.readContract({
      address: getAddress(usdcErc20Address()),
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [getAddress(address)],
    });
    return Number(formatUnits(raw, decimals));
  } catch {
    return 0;
  }
}

export function eurcErc20Address() {
  return ARC_EURC_ERC20_ADDRESS;
}

/** 6-decimal ERC-20 EURC view. */
export async function getEurcBalance(address: string | null | undefined) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return 0;
  }
  const decimals = ARC_EURC_ERC20_DECIMALS;
  try {
    if (process.env.VITEST) {
      return 0;
    }
    const client = createPublicClient({
      chain: payoutChain(),
      transport: http(getChainRpcUrl()),
    });
    const raw = await client.readContract({
      address: getAddress(eurcErc20Address()),
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [getAddress(address)],
    });
    return Number(formatUnits(raw, decimals));
  } catch {
    return 0;
  }
}

export const getNativeUsdcBalance = getUsdcBalance;
