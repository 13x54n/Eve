import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  type Chain,
} from "viem";
import { appendFileSync } from "node:fs";
import { arcTestnet } from "viem/chains";
import {
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
  const addrOk = Boolean(address && /^0x[a-fA-F0-9]{40}$/.test(address));
  const token = usdcErc20Address();
  const decimals = getUsdcErc20Decimals() || ARC_USDC_ERC20_DECIMALS;
  const rpc = getChainRpcUrl();
  if (!addrOk) {
    // #region agent log
    try { appendFileSync("/Users/lex-work/Eve/.cursor/debug-288cb3.log", JSON.stringify({sessionId:"288cb3",runId:"pre-fix",hypothesisId:"A",location:"payment/chain.ts:getUsdcBalance",message:"skip invalid wallet address",data:{hasAddress:Boolean(address),addrLen:address?.length??0,token,decimals,rpcHost:rpc.replace(/^https?:\/\//,"").split("/")[0]},timestamp:Date.now()})+"\n"); } catch { /* ignore */ }
    // #endregion
    return 0;
  }
  try {
    if (balanceOverride) {
      const formatted = Number(formatUnits(await balanceOverride(address!), decimals));
      // #region agent log
      try { appendFileSync("/Users/lex-work/Eve/.cursor/debug-288cb3.log", JSON.stringify({sessionId:"288cb3",runId:"pre-fix",hypothesisId:"C",location:"payment/chain.ts:getUsdcBalance",message:"balanceOverride path",data:{formatted,decimals,token},timestamp:Date.now()})+"\n"); } catch { /* ignore */ }
      // #endregion
      return formatted;
    }
    if (process.env.VITEST) {
      // #region agent log
      try { appendFileSync("/Users/lex-work/Eve/.cursor/debug-288cb3.log", JSON.stringify({sessionId:"288cb3",runId:"pre-fix",hypothesisId:"E",location:"payment/chain.ts:getUsdcBalance",message:"VITEST short-circuit 0",data:{vitest:true},timestamp:Date.now()})+"\n"); } catch { /* ignore */ }
      // #endregion
      return 0;
    }
    const client = createPublicClient({
      chain: payoutChain(),
      transport: http(getChainRpcUrl()),
    });
    const raw = await client.readContract({
      address: getAddress(token),
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [getAddress(address!)],
    });
    const formatted = Number(formatUnits(raw, decimals));
    // #region agent log
    try { appendFileSync("/Users/lex-work/Eve/.cursor/debug-288cb3.log", JSON.stringify({sessionId:"288cb3",runId:"pre-fix",hypothesisId:"C",location:"payment/chain.ts:getUsdcBalance",message:"erc20 balanceOf result",data:{raw:raw.toString(),formatted,decimals,token,rpcHost:rpc.replace(/^https?:\/\//,"").split("/")[0],chainId:payoutChain().id},timestamp:Date.now()})+"\n"); } catch { /* ignore */ }
    // #endregion
    return formatted;
  } catch (error) {
    // #region agent log
    try { appendFileSync("/Users/lex-work/Eve/.cursor/debug-288cb3.log", JSON.stringify({sessionId:"288cb3",runId:"pre-fix",hypothesisId:"B",location:"payment/chain.ts:getUsdcBalance",message:"readContract failed, returning 0",data:{err:error instanceof Error?error.message:String(error),token,decimals,rpcHost:rpc.replace(/^https?:\/\//,"").split("/")[0]},timestamp:Date.now()})+"\n"); } catch { /* ignore */ }
    // #endregion
    return 0;
  }
}

export const getNativeUsdcBalance = getUsdcBalance;
