import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  decodeEventLog,
  parseAbiItem,
  type Chain,
  type Hex,
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

function isVitestRuntime() {
  const value = process.env.VITEST?.trim().toLowerCase();
  return value === "true" || value === "1";
}

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
    if (isVitestRuntime()) {
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
    if (isVitestRuntime()) {
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

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export async function waitForErc20Transfer(input: {
  txHash: string;
  token: string;
  from: string;
  to: string;
  minAmount: number;
  decimals: number;
}) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.txHash)) {
    throw new Error("Provide a valid deposit transaction hash");
  }
  const client = createPublicClient({
    chain: payoutChain(),
    transport: http(getChainRpcUrl()),
  });
  const receipt = await client.waitForTransactionReceipt({
    hash: input.txHash as Hex,
    timeout: 120_000,
  });
  if (receipt.status !== "success") {
    throw new Error("Deposit transaction failed on-chain");
  }
  const token = getAddress(input.token);
  const from = getAddress(input.from);
  const to = getAddress(input.to);
  let transferred = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== token.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics,
      });
      if (
        getAddress(decoded.args.from) === from &&
        getAddress(decoded.args.to) === to
      ) {
        transferred += decoded.args.value;
      }
    } catch {
      /* not a Transfer */
    }
  }
  const amount = Number(formatUnits(transferred, input.decimals));
  if (amount + 1e-9 < input.minAmount) {
    throw new Error(
      `Deposit amount ${amount} is below the swap input ${input.minAmount}`,
    );
  }
  return { txHash: input.txHash, amount };
}
