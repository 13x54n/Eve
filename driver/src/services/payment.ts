import { api } from "./api";

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

export async function getSettlementQuote(tripId: string) {
  const { data } = await api.get<{ settlement: CallQuote }>(`/payment/trips/${tripId}/settlement`);
  return data.settlement;
}

export async function confirmEscrow(
  tripId: string,
  txHash: string,
  action: "startSettlement",
) {
  const { data } = await api.post(`/payment/trips/${tripId}/confirm`, { txHash, action });
  return data;
}
