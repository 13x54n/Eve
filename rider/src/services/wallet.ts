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

export type DepositQuote = {
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
};

export async function getRiderWallet() {
  const { data } = await api.get<RiderWallet>('/rider/wallet');
  return data;
}

export async function getDepositQuote(tripId: string) {
  const { data } = await api.get<{ deposit: DepositQuote }>(`/payment/trips/${tripId}/deposit`);
  return data.deposit;
}

export async function confirmDeposit(tripId: string, txHash: string) {
  const { data } = await api.post(`/payment/trips/${tripId}/confirm`, { txHash });
  return data;
}
