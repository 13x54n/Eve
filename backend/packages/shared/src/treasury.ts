import {
  createWalletClient,
  getAddress,
  http,
  parseEther,
  parseUnits,
  publicActions,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { fail } from "./errors.js";

const ERC20_ABI = [
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

export type PayoutSendResult = { txHash: string };

export type PayoutSender = (
  to: string,
  usdAmount: number,
) => Promise<PayoutSendResult>;

let payoutSenderOverride: PayoutSender | null = null;

export function setPayoutSenderForTests(sender: PayoutSender | null) {
  payoutSenderOverride = sender;
}

export function isTreasuryConfigured() {
  return Boolean(
    process.env.TREASURY_PRIVATE_KEY?.trim() &&
      process.env.CHAIN_RPC_URL?.trim(),
  );
}

export function getPayoutChainPublicConfig() {
  const chainId = Number(process.env.PAYOUT_CHAIN_ID || 84532);
  const tokenAddress = process.env.PAYOUT_TOKEN_ADDRESS?.trim() || null;
  return {
    chainId,
    chainName: process.env.PAYOUT_CHAIN_NAME?.trim() || defaultChainName(chainId),
    explorerTxUrl:
      process.env.PAYOUT_EXPLORER_TX_URL?.trim() || defaultExplorerTxUrl(chainId),
    tokenSymbol:
      process.env.PAYOUT_TOKEN_SYMBOL?.trim() || (tokenAddress ? "USDC" : "ETH"),
    tokenAddress,
    treasuryConfigured: isTreasuryConfigured(),
    usdPerToken: Number(process.env.PAYOUT_USD_PER_TOKEN || 1),
  };
}

function defaultChainName(chainId: number) {
  if (chainId === 8453) return "Base";
  if (chainId === 84532) return "Base Sepolia";
  return `Chain ${chainId}`;
}

function defaultExplorerTxUrl(chainId: number) {
  if (chainId === 8453) return "https://basescan.org/tx/";
  return "https://sepolia.basescan.org/tx/";
}

function chainForId(chainId: number) {
  if (chainId === 8453) return base;
  return { ...baseSepolia, id: chainId };
}

export async function sendTreasuryPayout(
  to: string,
  usdAmount: number,
): Promise<PayoutSendResult> {
  if (!isTreasuryConfigured()) {
    fail("Treasury is not configured", "ConflictError");
  }

  const key = process.env.TREASURY_PRIVATE_KEY!.trim();
  const privateKey = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
  const account = privateKeyToAccount(privateKey);
  const chainId = Number(process.env.PAYOUT_CHAIN_ID || 84532);
  const chain = chainForId(chainId);
  const client = createWalletClient({
    account,
    chain,
    transport: http(process.env.CHAIN_RPC_URL),
  }).extend(publicActions);

  const rate = Number(process.env.PAYOUT_USD_PER_TOKEN || 1) || 1;
  const tokenAmount = usdAmount / rate;
  const toAddr = getAddress(to);
  const token = process.env.PAYOUT_TOKEN_ADDRESS?.trim();

  if (token) {
    const decimals = Number(process.env.PAYOUT_TOKEN_DECIMALS || 6);
    const hash = await client.writeContract({
      address: getAddress(token),
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [toAddr, parseUnits(tokenAmount.toFixed(decimals), decimals)],
    });
    await client.waitForTransactionReceipt({ hash });
    return { txHash: hash };
  }

  const hash = await client.sendTransaction({
    to: toAddr,
    value: parseEther(tokenAmount.toFixed(8)),
  });
  await client.waitForTransactionReceipt({ hash });
  return { txHash: hash };
}

export async function executePayout(
  to: string,
  usdAmount: number,
): Promise<PayoutSendResult> {
  const sender = payoutSenderOverride ?? sendTreasuryPayout;
  return sender(to, usdAmount);
}
