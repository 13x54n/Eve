import { api } from './api';

export type VehicleType = 'BIKE' | 'CAR';

export type DriverDocumentType =
  | 'IDENTITY'
  | 'LICENSE'
  | 'INSURANCE'
  | 'VEHICLE_REGISTRATION'
  | 'VEHICLE_INSPECTION';

export type DriverApprovalStatus =
  | 'PENDING'
  | 'NEEDS_INFO'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type DriverPresence = 'ONLINE' | 'OFFLINE' | 'IDLE' | 'ON_TRIP';

export type DriverVehicle = {
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  color?: string;
};

export type DriverDocument = {
  type: DriverDocumentType;
  status: ReviewStatus;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
};

export type DriverProfile = {
  approvalStatus: DriverApprovalStatus;
  presence: DriverPresence;
  vehicles: DriverVehicle[];
  documents: DriverDocument[];
  activeTrip?: ActiveTrip | null;
};

export async function getDriverProfile() {
  const { data } = await api.get<{ driver: DriverProfile }>('/driver/me');
  return data.driver;
}

export async function updatePresence(input: {
  presence: DriverPresence;
  latitude?: number;
  longitude?: number;
}) {
  const { data } = await api.patch<{ driver: any }>('/driver/presence', input);
  return data.driver;
}

export type EarningsSummary = {
  todayEarnings: number;
  todayTrips: number;
  todayOnlineHours: number;
  weekEarnings: number;
  weekTrips: number;
  lifetimeEarnings: number;
  walletBalance?: number;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
};

export type EarningsTrip = {
  id: string;
  bookingCode: string;
  pickupAddress: string;
  dropoffAddress: string;
  fareTotal: number;
  netEarnings: number;
  distanceKm: number;
  durationMin: number;
  createdAt: string;
};

export async function getEarnings() {
  const { data } = await api.get<{ summary: EarningsSummary; recentTrips: EarningsTrip[] }>('/driver/earnings');
  return data;
}

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

export type DriverWallet = {
  walletBalance: number;
  onChainUsdc: number;
  lifetimeEarnings: number;
  ethereumWallet: string | null;
  ethereumWalletId?: string | null;
  solanaWallet: string | null;
  chain: WalletChain;
  minWithdrawUsd: number;
  entries: WalletLedgerEntry[];
};

export async function getWallet() {
  const { data } = await api.get<DriverWallet>('/driver/wallet');
  return data;
}

export async function withdrawWallet(amount: number, idempotencyKey?: string) {
  const { data } = await api.post<{
    entry: WalletLedgerEntry;
    walletBalance: number;
    replayed: boolean;
  }>('/driver/wallet/withdraw', { amount, idempotencyKey });
  return data;
}

export async function recordDriverTransfer(amount: number, txHash: string, address: string) {
  const { data } = await api.post<{
    entry: WalletLedgerEntry;
    replayed: boolean;
  }>('/driver/wallet/transfers', { amount, txHash, address });
  return data;
}

export type PrivyBankAccount = {
  id: string;
  user_id?: string;
  provider: string;
  environment: string;
  currency: string;
  bank_name?: string | null;
  account_type: string;
  last_4: string;
  account_owner_name: string;
  created_at: string;
};

export type RegisterBankAccountInput = {
  accountOwnerName: string;
  bankName?: string;
  accountType?: 'us' | 'gb' | 'iban' | 'pix' | 'swift';
  accountNumber: string;
  routingNumber: string;
  checkingOrSavings?: 'checking' | 'savings';
  address: {
    streetLine1: string;
    streetLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
};

export type PrivyPayoutResponse = {
  id: string;
  wallet_id: string;
  type: 'payout';
  status: 'pending' | 'succeeded' | 'rejected' | 'failed';
  provider: string;
  environment: string;
  source: {
    asset: string;
    chain: string;
    amount: string;
  };
  destination: {
    fiat_account_id: string;
  };
  created_at: string;
  failure_reason?: string | null;
};

export async function getBankAccounts(): Promise<PrivyBankAccount[]> {
  const { data } = await api.get<{ accounts: PrivyBankAccount[] }>('/driver/wallet/bank-accounts');
  return data.accounts || [];
}

export async function registerBankAccount(input: RegisterBankAccountInput): Promise<PrivyBankAccount> {
  const { data } = await api.post<{ external_fiat_account: PrivyBankAccount }>(
    '/driver/wallet/bank-accounts',
    input,
  );
  return data.external_fiat_account;
}

export async function deleteBankAccount(id: string): Promise<{ success: boolean }> {
  const { data } = await api.delete<{ success: boolean }>(`/driver/wallet/bank-accounts/${id}`);
  return data;
}

export async function createFiatPayout(payload: {
  amount: number;
  fiatAccountId: string;
  idempotencyKey?: string;
}): Promise<{ payout: PrivyPayoutResponse; entry: WalletLedgerEntry; replayed: boolean }> {
  const { data } = await api.post<{
    payout: PrivyPayoutResponse;
    entry: WalletLedgerEntry;
    replayed: boolean;
  }>('/driver/wallet/payout', payload);
  return data;
}

export async function getPayoutStatus(
  actionId: string,
): Promise<{ payout: PrivyPayoutResponse; entry: WalletLedgerEntry | null }> {
  const { data } = await api.get<{
    payout: PrivyPayoutResponse;
    entry: WalletLedgerEntry | null;
  }>(`/driver/wallet/payout/${actionId}`);
  return data;
}


export type DriverTripDetail = {
  id: string;
  bookingCode: string;
  status: string;
  rideType: string;
  city: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  durationMin: number;
  fareTotal: number;
  netEarnings: number;
  paymentStatus: string;
  paymentMethod: string;
  escrowSettleFrom?: string | null;
  riderName: string;
  riderRating: number;
  cancellationReason: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
};

export async function getTripEarnings(tripId: string) {
  const { data } = await api.get<{ trip: DriverTripDetail }>(`/driver/trips/${tripId}`);
  return data.trip;
}

export type IncomingTrip = {
  id: string;
  bookingCode: string;
  riderName: string;
  pickupAddress: string;
  dropoffAddress: string;
  fareTotal: number;
  minFare?: number;
  distanceKm: number;
  durationMin: number;
  vehicleType: VehicleType;
  rideType?: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  packageNote?: string | null;
};

export type PendingOffer = {
  id: string;
  tripId: string;
  proposedFare: number;
  etaMinutes: number;
  riderName: string;
  pickupAddress: string;
  dropoffAddress: string;
  rideType?: string;
  recipientName?: string | null;
};

export type ActiveDispatch = {
  tripId: string;
  bookingCode: string;
  riderName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  durationMin: number;
  fareTotal: number;
  minFare: number;
  vehicleType: VehicleType;
  rideType?: string;
  recipientName?: string | null;
  expiresAt: string;
};

export async function getIncomingTrips() {
  const { data } = await api.get<{
    trips: IncomingTrip[];
    pendingOffer: PendingOffer | null;
    activeDispatch: ActiveDispatch | null;
    pendingEscrowTrip: PendingEscrowTrip | null;
    activeTripId: string | null;
  }>('/driver/trips/incoming');
  return data;
}

export type PendingEscrowTrip = {
  tripId: string;
  pickupAddress: string;
  dropoffAddress: string;
  fareTotal: number;
};

export async function acceptDispatch(tripId: string, proposedFare?: number) {
  const { data } = await api.post<{ offer: { id: string } }>(
    `/driver/trips/${tripId}/dispatch/accept`,
    proposedFare != null ? { proposedFare } : {},
  );
  return data.offer;
}

export async function declineDispatch(tripId: string) {
  const { data } = await api.post<{ status: string }>(`/driver/trips/${tripId}/dispatch/decline`);
  return data;
}

export async function createTripOffer(tripId: string, proposedFare: number, etaMinutes: number) {
  const { data } = await api.post<{ offer: { id: string } }>(`/driver/trips/${tripId}/offers`, {
    proposedFare,
    etaMinutes,
  });
  return data.offer;
}

export type ActiveTrip = {
  id: string;
  bookingCode: string;
  status: 'ASSIGNED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  fareTotal: number;
  distanceKm: number;
  durationMin: number;
  paymentStatus: string;
  arrivedAt?: string | null;
  rider: { user: { name: string; phone: string | null } };
  rideType?: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  packageNote?: string | null;
  stops?: {
    id: string;
    sequence: number;
    address: string;
    lat: number;
    lng: number;
    kind: string;
  }[];
};

export async function arrivedAtPickup(tripId: string) {
  const { data } = await api.post<{ trip: ActiveTrip }>(`/driver/trips/${tripId}/arrived`);
  return data.trip;
}

export async function startTrip(tripId: string) {
  const { data } = await api.post<{ trip: ActiveTrip }>(`/driver/trips/${tripId}/start`);
  return data.trip;
}

export async function completeTrip(tripId: string, input: { rating?: number; feedback?: string } = {}) {
  const { data } = await api.post<{
    trip: ActiveTrip;
    earnings: { netEarnings: number; pending?: boolean };
    settlement?: { startQuote: import("./payment").CallQuote };
  }>(`/driver/trips/${tripId}/complete`, input);
  return data;
}

export async function cancelTrip(tripId: string, reason?: string) {
  const { data } = await api.post<{ trip: ActiveTrip }>(`/driver/trips/${tripId}/cancel`, { reason });
  return data.trip;
}

export type TripMessage = {
  id: string;
  tripId: string;
  authorId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  authorName: string;
  authorRole: string;
};

export async function getTripMessages(tripId: string) {
  const { data } = await api.get<{ messages: TripMessage[] }>(`/driver/trips/${tripId}/messages`);
  return data.messages;
}

export async function sendTripMessage(tripId: string, body: string) {
  const { data } = await api.post<{ message: TripMessage }>(`/driver/trips/${tripId}/messages`, { body });
  return data.message;
}

export async function markTripMessagesRead(tripId: string) {
  await api.post(`/driver/trips/${tripId}/messages/read`);
}

export async function saveVehicle(input: {
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  vehicleType: VehicleType;
  capacity: number;
}) {
  const { data } = await api.post<{ driver: any }>('/driver/vehicles', input);
  return data.driver;
}

export async function submitDocument(input: {
  type: DriverDocumentType;
  notes?: string;
  imageKitFileId?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}) {
  const { data } = await api.post<{ driver: any }>('/driver/documents', input);
  return data.driver;
}

export async function getDocumentUploadAuth() {
  const { data } = await api.get<{
    token: string;
    expire: number;
    signature: string;
    publicKey: string;
    folder: string;
  }>('/driver/documents/upload-auth');
  return data;
}

export interface SupportedTestnet {
  caip2: string;
  chainId: number;
  name: string;
  currencySymbol: string;
  explorerUrl: string;
  defaultDestinationToken: string;
  defaultDestinationSymbol: string;
}

export type SwapWallet = {
  id: string;
  address: string;
  chainType: 'ethereum';
  ownerPublicKey: string;
  gasSponsored: boolean;
  status: 'active' | 'initializing';
  createdAt: string;
  testnets: SupportedTestnet[];
};

export type AgentWallet = SwapWallet;

export type SupportedSwapToken = 'USDC' | 'EURC' | 'cirBTC';

export interface SwapQuoteInput {
  chain?: string;
  tokenIn?: SupportedSwapToken | string;
  tokenOut?: SupportedSwapToken | string;
  amountIn?: string;
  sourceAsset?: string;
  destinationAsset?: string;
  baseAmount?: string;
  amountType?: 'exact_input' | 'exact_output';
  slippageBps?: number;
  sourceSymbol?: string;
  destinationSymbol?: string;
}

export interface SwapQuoteResult {
  chain?: string;
  caip2?: string;
  tokenIn?: string;
  tokenOut?: string;
  inputAmount: string;
  inputToken: string;
  estOutputAmount: string;
  minimumOutputAmount: string;
  outputToken: string;
  estimatedGas?: string;
  priceImpact?: string;
  provider?: string;
}

export interface SwapExecuteInput {
  chain?: string;
  tokenIn?: SupportedSwapToken | string;
  tokenOut?: SupportedSwapToken | string;
  amountIn?: string;
  sourceAsset?: string;
  destinationAsset?: string;
  baseAmount?: string;
  amountType?: 'exact_input' | 'exact_output';
  slippageBps?: number;
  sourceSymbol?: string;
  destinationSymbol?: string;
}

export interface SwapRecord {
  id: string;
  actionId: string;
  walletId: string;
  userId: string;
  chain: string;
  sourceAsset: string;
  sourceSymbol: string;
  destinationAsset: string;
  destinationSymbol: string;
  inputAmount: string;
  outputAmount: string;
  status: 'pending' | 'succeeded' | 'failed';
  hash?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SwapTrade = SwapRecord;

export async function getSwapWallet(): Promise<SwapWallet> {
  const { data } = await api.get<{ wallet: SwapWallet }>('/driver/wallet/swap/wallet');
  return data.wallet;
}

export async function getAgentWallet(): Promise<AgentWallet> {
  return getSwapWallet();
}

export async function getSwapQuote(input: SwapQuoteInput): Promise<SwapQuoteResult> {
  const { data } = await api.post<{ quote: SwapQuoteResult }>('/driver/wallet/swap/quote', input);
  return data.quote;
}

export async function executeSwap(input: SwapExecuteInput): Promise<{ actionId: string; swap: SwapRecord }> {
  const { data } = await api.post<{ actionId: string; swap: SwapRecord }>('/driver/wallet/swap/execute', input);
  return data;
}

export async function executeSwapTrade(input: SwapExecuteInput): Promise<SwapRecord> {
  const res = await executeSwap(input);
  return res.swap;
}

export async function getSwapStatus(
  actionId: string,
): Promise<{ status: 'pending' | 'succeeded' | 'failed'; hash?: string | null; swap?: SwapRecord }> {
  const { data } = await api.get<{
    status: 'pending' | 'succeeded' | 'failed';
    hash?: string | null;
    swap?: SwapRecord;
  }>(`/driver/wallet/swap/actions/${actionId}`);
  return data;
}

export async function getSwapActionStatus(actionId: string): Promise<SwapRecord> {
  const res = await getSwapStatus(actionId);
  return res.swap || {
    id: actionId,
    actionId,
    walletId: '',
    userId: '',
    chain: '',
    sourceAsset: '',
    sourceSymbol: '',
    destinationAsset: '',
    destinationSymbol: '',
    inputAmount: '',
    outputAmount: '',
    status: res.status,
    hash: res.hash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getSwapHistory(): Promise<SwapRecord[]> {
  const { data } = await api.get<{ history: SwapRecord[] }>('/driver/wallet/swap/history');
  return data.history || [];
}

export async function getAgentTrades(): Promise<SwapRecord[]> {
  return getSwapHistory();
}