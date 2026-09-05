import {
  createWalletClient,
  getAddress,
  http,
  parseGwei,
  parseUnits,
  publicActions,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
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

/** Circle Arc Testnet. Native gas is USDC. */
export const DEFAULT_PAYOUT_CHAIN_ID = 5042002;
export const DEFAULT_CHAIN_RPC_URL = "https://rpc.testnet.arc.io";
const DEFAULT_EXPLORER_TX = "https://testnet.arcscan.app/tx/";
const MIN_MAX_FEE_PER_GAS = parseGwei("20");
const DEFAULT_PRIORITY_FEE = parseGwei("1");
const NATIVE_USDC_DECIMALS = 6;

export type PayoutSendResult = { txHash: string };

export type PayoutSender = (
  to: string,
  usdAmount: number,
) => Promise<PayoutSendResult>;

let payoutSenderOverride: PayoutSender | null = null;

export function setPayoutSenderForTests(sender: PayoutSender | null) {
  payoutSenderOverride = sender;
}

export function getChainRpcUrl() {
  return process.env.CHAIN_RPC_URL?.trim() || DEFAULT_CHAIN_RPC_URL;
}

export function isTreasuryConfigured() {
  return Boolean(process.env.TREASURY_PRIVATE_KEY?.trim() && getChainRpcUrl());
}

export function getPayoutChainPublicConfig() {
  const chainId = Number(process.env.PAYOUT_CHAIN_ID || DEFAULT_PAYOUT_CHAIN_ID);
  const tokenAddress = process.env.PAYOUT_TOKEN_ADDRESS?.trim() || null;
  return {
    chainId,
    chainName: process.env.PAYOUT_CHAIN_NAME?.trim() || defaultChainName(chainId),
    explorerTxUrl:
      process.env.PAYOUT_EXPLORER_TX_URL?.trim() || DEFAULT_EXPLORER_TX,
    tokenSymbol:
      process.env.PAYOUT_TOKEN_SYMBOL?.trim() || "USDC",
    tokenAddress,
    treasuryConfigured: isTreasuryConfigured(),
    usdPerToken: Number(process.env.PAYOUT_USD_PER_TOKEN || 1),
  };
}

function defaultChainName(chainId: number) {
  if (chainId === DEFAULT_PAYOUT_CHAIN_ID || chainId === arcTestnet.id) {
    return "Arc Testnet";
  }
  return `Chain ${chainId}`;
}

function chainForId(chainId: number): Chain {
  if (chainId === arcTestnet.id || chainId === DEFAULT_PAYOUT_CHAIN_ID) {
    return arcTestnet;
  }
  return { ...arcTestnet, id: chainId };
}

async function eip1559Fees(client: {
  getGasPrice: () => Promise<bigint>;
}) {
  const gasPrice = await client.getGasPrice();
  const maxFeePerGas =
    gasPrice > MIN_MAX_FEE_PER_GAS ? gasPrice : MIN_MAX_FEE_PER_GAS;
  return {
    maxFeePerGas,
    maxPriorityFeePerGas: DEFAULT_PRIORITY_FEE,
  };
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
  const chainId = Number(process.env.PAYOUT_CHAIN_ID || DEFAULT_PAYOUT_CHAIN_ID);
  const chain = chainForId(chainId);
  const client = createWalletClient({
    account,
    chain,
    transport: http(getChainRpcUrl()),
  }).extend(publicActions);

  const rate = Number(process.env.PAYOUT_USD_PER_TOKEN || 1) || 1;
  const tokenAmount = usdAmount / rate;
  const toAddr = getAddress(to);
  const token = process.env.PAYOUT_TOKEN_ADDRESS?.trim();
  const fees = await eip1559Fees(client);

  if (token) {
    const decimals = Number(process.env.PAYOUT_TOKEN_DECIMALS || NATIVE_USDC_DECIMALS);
    const hash = await client.writeContract({
      address: getAddress(token),
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [toAddr, parseUnits(tokenAmount.toFixed(decimals), decimals)],
      ...fees,
    });
    await client.waitForTransactionReceipt({ hash });
    return { txHash: hash };
  }

  const hash = await client.sendTransaction({
    to: toAddr,
    value: parseUnits(tokenAmount.toFixed(NATIVE_USDC_DECIMALS), NATIVE_USDC_DECIMALS),
    ...fees,
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
