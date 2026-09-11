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

/**
 * Circle Arc Testnet (`use-arc`): USDC is one asset with two views.
 * Native 18-decimal units are only for gas and `msg.value`.
 * ERC-20 6-decimal units at `ARC_USDC_ERC20_ADDRESS` are for balances,
 * transfers, approvals, and display. Do not sum or swap the two views.
 */
export const DEFAULT_PAYOUT_CHAIN_ID = 5042002;
export const DEFAULT_CHAIN_RPC_URL = "https://rpc.testnet.arc.io";
export const ARC_USDC_ERC20_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;
export const ARC_USDC_ERC20_DECIMALS = 6;
export const ARC_NATIVE_DECIMALS = 18;
const DEFAULT_EXPLORER_TX = "https://testnet.arcscan.app/tx/";
const MIN_MAX_FEE_PER_GAS = parseGwei("20");
const DEFAULT_PRIORITY_FEE = parseGwei("1");

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

export function treasuryAccount() {
  const key = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!key) return null;
  const privateKey = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
  return privateKeyToAccount(privateKey);
}

/** RideEscrow operator; defaults to the treasury key address. */
export function getEscrowOperatorAddress(): string | null {
  const explicit = process.env.ESCROW_OPERATOR_ADDRESS?.trim();
  if (explicit) return getAddress(explicit);
  return treasuryAccount()?.address ?? null;
}

/** ERC-20 USDC for transfers/display. `PAYOUT_TOKEN_ADDRESS=native` forces native sends. */
export function getPayoutTokenAddress(): string | null {
  const raw = process.env.PAYOUT_TOKEN_ADDRESS?.trim();
  if (!raw || raw.toLowerCase() === "usdc") return ARC_USDC_ERC20_ADDRESS;
  if (raw.toLowerCase() === "native") return null;
  return raw;
}

export function getUsdcErc20Decimals() {
  return Number(process.env.PAYOUT_TOKEN_DECIMALS || ARC_USDC_ERC20_DECIMALS);
}

export function usdToNativeUsdcWei(amountUsd: number) {
  const rate = Number(process.env.PAYOUT_USD_PER_TOKEN || 1) || 1;
  return parseUnits((amountUsd / rate).toFixed(2), ARC_NATIVE_DECIMALS);
}

export function getPayoutChainPublicConfig() {
  const chainId = Number(process.env.PAYOUT_CHAIN_ID || DEFAULT_PAYOUT_CHAIN_ID);
  return {
    chainId,
    chainName: process.env.PAYOUT_CHAIN_NAME?.trim() || defaultChainName(chainId),
    explorerTxUrl:
      process.env.PAYOUT_EXPLORER_TX_URL?.trim() || DEFAULT_EXPLORER_TX,
    tokenSymbol:
      process.env.PAYOUT_TOKEN_SYMBOL?.trim() || "USDC",
    tokenAddress: getPayoutTokenAddress(),
    tokenDecimals: getUsdcErc20Decimals(),
    nativeDecimals: ARC_NATIVE_DECIMALS,
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

function treasuryWallet() {
  if (!isTreasuryConfigured()) {
    fail("Treasury is not configured", "ConflictError");
  }
  const account = treasuryAccount();
  if (!account) fail("Treasury is not configured", "ConflictError");
  const chainId = Number(process.env.PAYOUT_CHAIN_ID || DEFAULT_PAYOUT_CHAIN_ID);
  const chain = chainForId(chainId);
  return createWalletClient({
    account,
    chain,
    transport: http(getChainRpcUrl()),
  }).extend(publicActions);
}

export async function sendTreasuryWriteContract(input: {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}): Promise<PayoutSendResult> {
  const client = treasuryWallet();
  const fees = await eip1559Fees(client);
  const hash = await client.writeContract({
    address: getAddress(input.address),
    abi: input.abi as typeof ERC20_ABI,
    functionName: input.functionName as "transfer",
    args: input.args as never,
    ...fees,
  });
  await client.waitForTransactionReceipt({ hash });
  return { txHash: hash };
}

export async function sendTreasuryPayout(
  to: string,
  usdAmount: number,
): Promise<PayoutSendResult> {
  const client = treasuryWallet();

  const rate = Number(process.env.PAYOUT_USD_PER_TOKEN || 1) || 1;
  const tokenAmount = usdAmount / rate;
  const toAddr = getAddress(to);
  const token = getPayoutTokenAddress();
  const fees = await eip1559Fees(client);

  if (token) {
    const decimals = getUsdcErc20Decimals();
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
    value: parseUnits(tokenAmount.toFixed(ARC_NATIVE_DECIMALS), ARC_NATIVE_DECIMALS),
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
