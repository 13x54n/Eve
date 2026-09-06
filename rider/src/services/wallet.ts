import { api } from './api';

export type WalletChain = {
  chainId: number;
  chainName: string;
  explorerTxUrl: string;
  tokenSymbol: string;
  tokenAddress: string | null;
  tokenDecimals?: number;
  nativeDecimals?: number;
  treasuryConfigured: boolean;
  usdPerToken: number;
  escrowAddress?: string | null;
  escrowConfigured?: boolean;
};

export type WalletLedgerEntry = {
  id: string;
  type: string;
  status: string;
  method: string;
  amount: number;
  currency: string;
  brand: string | null;
  providerRef: string | null;
  note: string | null;
  createdAt: string;
};

export type RiderWallet = {
  onChainUsdc: number;
  ethereumWallet: string | null;
  ethereumWalletId?: string | null;
  solanaWallet: string | null;
  chain: WalletChain;
  entries: WalletLedgerEntry[];
};

export type CallQuote = {
  action?: string;
  chainId: number;
  chainName: string;
  to: string;
  value: string;
  data: `0x${string}`;
  tripIdHash: `0x${string}`;
  amountUsd: number;
  tokenSymbol: string;
  decimals: number;
  explorerTxUrl: string;
  disputeWindowMs?: number;
  settleFrom?: string | null;
};

export type DepositQuote = CallQuote;

export async function getRiderWallet() {
  const { data } = await api.get<RiderWallet>("/rider/wallet");
  return data;
}

export async function getDepositQuote(tripId: string) {
  const { data } = await api.get<{ deposit: CallQuote }>(`/payment/trips/${tripId}/deposit`);
  return data.deposit;
}

export async function getDisputeQuote(tripId: string) {
  const { data } = await api.get<{ dispute: CallQuote }>(`/payment/trips/${tripId}/dispute`);
  return data.dispute;
}

export async function getRefundQuote(tripId: string) {
  const { data } = await api.get<{ refund: CallQuote }>(`/payment/trips/${tripId}/refund`);
  return data.refund;
}

export async function confirmEscrow(
  tripId: string,
  txHash: string,
  action?: "deposit" | "startSettlement" | "dispute" | "finalize" | "refund",
) {
  const { data } = await api.post(`/payment/trips/${tripId}/confirm`, { txHash, action });
  return data;
}

export async function confirmDeposit(tripId: string, txHash: string) {
  return confirmEscrow(tripId, txHash, "deposit");
}
