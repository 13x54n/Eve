import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SectionList,
  Platform,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Camera, CameraView } from 'expo-camera';
import {
  DriverWallet,
  EarningsSummary,
  EarningsTrip,
  WalletLedgerEntry,
  getEarnings,
  getWallet,
  withdrawWallet,
} from '@/services/driver';
import { PullRefresh, usePullToRefresh } from '@/components/pull-refresh';
import { useCompletePrivySession } from '@/lib/complete-privy-session';
import { truncateWalletAddress } from '@/lib/privy';

type TxType = 'trip' | 'credit' | 'withdraw' | 'payout' | 'charge' | 'refund';

type Transaction = {
  id: string;
  type: TxType;
  title: string;
  time: string;
  amount: number;
  tripId?: string;
};

type Section = {
  title: string;
  total: number;
  data: Transaction[];
};

function ledgerType(entry: WalletLedgerEntry): TxType {
  if (entry.type === 'CREDIT') return 'credit';
  if (entry.type === 'WALLET_WITHDRAW') return 'withdraw';
  if (entry.type === 'CHARGE') return 'charge';
  if (entry.type === 'REFUND') return 'refund';
  return 'payout';
}

function ledgerTitle(entry: WalletLedgerEntry) {
  if (entry.type === 'CREDIT') return entry.note || 'Platform credit';
  if (entry.type === 'CHARGE') return entry.note || 'Trip USDC';
  if (entry.type === 'REFUND') return entry.note || 'Escrow refund';
  if (entry.type === 'WALLET_WITHDRAW') {
    const status = entry.status === 'COMPLETED' ? 'Cashed out' : entry.status === 'FAILED' ? 'Cash-out failed' : 'Cash-out pending';
    return status;
  }
  return entry.note || 'Admin payout';
}

function groupHistory(
  trips: EarningsTrip[],
  entries: WalletLedgerEntry[],
): Section[] {
  const todayLabel = new Date().toDateString();
  const byDay = new Map<string, Transaction[]>();

  function push(_createdAt: string, tx: Omit<Transaction, 'time'> & { created: Date }) {
    const dayKey = tx.created.toDateString();
    const title =
      dayKey === todayLabel
        ? 'Today'
        : tx.created.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const list = byDay.get(title) ?? [];
    list.push({
      id: tx.id,
      type: tx.type,
      title: tx.title,
      amount: tx.amount,
      tripId: tx.tripId,
      time: tx.created.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    });
    byDay.set(title, list);
  }

  for (const trip of trips) {
    const created = new Date(trip.createdAt);
    push(trip.createdAt, {
      id: `trip-${trip.id}`,
      type: 'trip',
      title: 'Trip fare',
      amount: trip.netEarnings,
      tripId: trip.id,
      created,
    });
  }
  for (const entry of entries) {
    const created = new Date(entry.createdAt);
    const signed =
      entry.type === 'WALLET_WITHDRAW' || entry.type === 'PAYOUT' || entry.type === 'REFUND'
        ? -Math.abs(entry.amount)
        : Math.abs(entry.amount);
    push(entry.createdAt, {
      id: entry.id,
      type: ledgerType(entry),
      title: ledgerTitle(entry),
      amount: signed,
      created,
    });
  }

  return Array.from(byDay.entries()).map(([title, data]) => ({
    title,
    total: data.reduce((sum, item) => sum + (item.type === 'trip' ? item.amount : 0), 0),
    data: data.sort((a, b) => b.time.localeCompare(a.time)),
  }));
}

const TX_ICON: Record<TxType, { name: any; lib: 'ion' | 'mci'; bg: string; fg: string }> = {
  trip: { name: 'car', lib: 'mci', bg: '#EFF6FF', fg: '#3B82F6' },
  credit: { name: 'gift', lib: 'ion', bg: '#F0FDF4', fg: '#16A34A' },
  withdraw: { name: 'arrow-down-circle', lib: 'ion', bg: '#FEF2F2', fg: '#DC2626' },
  payout: { name: 'wallet', lib: 'ion', bg: '#FFFBEB', fg: '#D97706' },
  charge: { name: 'arrow-down', lib: 'ion', bg: '#ECFDF5', fg: '#059669' },
  refund: { name: 'return-up-back', lib: 'ion', bg: '#F8FAFC', fg: '#64748B' },
};

function TxIcon({ type }: { type: TxType }) {
  const cfg = TX_ICON[type];
  const IconComp = cfg.lib === 'ion' ? Ionicons : MaterialCommunityIcons;
  return (
    <View style={[styles.txIcon, { backgroundColor: cfg.bg }]}>
      <IconComp name={cfg.name} size={18} color={cfg.fg} />
    </View>
  );
}

function formatMoney(n: number) {
  const sign = n < 0 ? '-' : '+';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export default function Earnings() {
  const completePrivy = useCompletePrivySession();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [recentTrips, setRecentTrips] = useState<EarningsTrip[]>([]);
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [amount, setAmount] = useState('');
  const [cashingOut, setCashingOut] = useState(false);
  const [linking, setLinking] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [showReceiveQR, setShowReceiveQR] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cashOutAddress, setCashOutAddress] = useState('');

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      setError(false);
      const [earningsResult, walletResult] = await Promise.all([getEarnings(), getWallet()]);
      setSummary(earningsResult.summary);
      setRecentTrips(earningsResult.recentTrips);
      setWallet(walletResult);
      // #region agent log
      fetch('http://127.0.0.1:7543/ingest/ac1371f8-8dc3-4f47-81e9-ffb1ee8fc7f0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cb3'},body:JSON.stringify({sessionId:'288cb3',runId:'pre-fix',hypothesisId:'E',location:'driver/earnings/index.tsx:load',message:'driver wallet API payload',data:{onChainUsdc:walletResult.onChainUsdc,dbWalletBalance:walletResult.walletBalance,hasEthWallet:Boolean(walletResult.ethereumWallet),tokenAddress:walletResult.chain?.tokenAddress??null,tokenDecimals:walletResult.chain?.tokenDecimals??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (loadErr) {
      // #region agent log
      fetch('http://127.0.0.1:7543/ingest/ac1371f8-8dc3-4f47-81e9-ffb1ee8fc7f0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'288cb3'},body:JSON.stringify({sessionId:'288cb3',runId:'pre-fix',hypothesisId:'E',location:'driver/earnings/index.tsx:load',message:'driver wallet load failed',data:{err:loadErr instanceof Error?loadErr.message:'unknown'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { refreshing, onRefresh } = usePullToRefresh(() => load({ silent: true }));

  const sections = useMemo(
    () => groupHistory(recentTrips, wallet?.entries ?? []),
    [recentTrips, wallet?.entries],
  );
  const onChain = wallet?.onChainUsdc ?? 0;
  const credits = wallet?.walletBalance ?? summary?.walletBalance ?? 0;
  const symbol = wallet?.chain.tokenSymbol ?? 'USDC';

  async function onLinkWallet() {
    try {
      setLinking(true);
      await completePrivy();
      await load({ silent: true });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not link Privy wallet';
      Alert.alert('Wallet', message);
    } finally {
      setLinking(false);
    }
  }

  async function onReceive() {
    const addr = wallet?.ethereumWallet;
    if (!addr) return;
    setShowReceiveQR(true);
  }

  async function onShareAddress() {
    const addr = wallet?.ethereumWallet;
    if (!addr) return;
    await Share.share({ message: addr });
  }

  async function onScanQR() {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    if (status === 'granted') {
      setShowQRScanner(true);
    } else {
      Alert.alert('Camera', 'Camera permission is required to scan QR codes');
    }
  }

  function onQRScanned(data: string) {
    setShowQRScanner(false);
    if (/^0x[a-fA-F0-9]{40}$/.test(data)) {
      setCashOutAddress(data);
      setShowCashOut(true);
    } else {
      Alert.alert('Invalid QR', 'The scanned QR code is not a valid Ethereum address');
    }
  }

  async function onCashOut() {
    const value = Number(amount);
    const min = wallet?.minWithdrawUsd ?? 1;
    const address = cashOutAddress.trim();

    if (!Number.isFinite(value) || value < min) {
      Alert.alert('Cash out', `Enter at least $${min.toFixed(2)}.`);
      return;
    }

    if (!wallet?.ethereumWallet && !address) {
      Alert.alert('Cash out', 'Link your Privy Ethereum wallet or scan an address.');
      return;
    }

    if (address && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      Alert.alert('Cash out', 'Enter a valid Ethereum address');
      return;
    }
    try {
      setCashingOut(true);
      const result = await withdrawWallet(value, `mobile-${Date.now()}`);
      setAmount('');
      setCashOutAddress('');
      setShowCashOut(false);
      await load({ silent: true });
      const status = result.entry.status;
      const extra = result.entry.providerRef ? `\nTx ${result.entry.providerRef}` : '';
      Alert.alert(
        'Cash out',
        status === 'COMPLETED'
          ? `Sent ${symbol} to your wallet on Arc Testnet.${extra}`
          : status === 'PENDING'
            ? 'Requested. An admin will complete the on-chain send when the treasury is configured.'
            : `Status: ${status}`,
      );
    } catch (caught: unknown) {
      const message =
        (caught as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (caught instanceof Error ? caught.message : 'Cash-out failed');
      Alert.alert('Cash out', message);
    } finally {
      setCashingOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <Modal
        visible={showReceiveQR}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReceiveQR(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowReceiveQR(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receive {symbol}</Text>
              <Pressable onPress={() => setShowReceiveQR(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color="#0F172A" />
              </Pressable>
            </View>
            <View style={styles.qrContainer}>
              {wallet?.ethereumWallet ? (
                <QRCode value={wallet.ethereumWallet} size={220} />
              ) : null}
            </View>
            <Text style={styles.qrAddress}>{wallet?.ethereumWallet}</Text>
            <Pressable style={styles.shareButton} onPress={() => void onShareAddress()}>
              <Ionicons name="share-outline" size={18} color="#2E4ED2" />
              <Text style={styles.shareButtonText}>Share address</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showQRScanner} animationType="slide" onRequestClose={() => setShowQRScanner(false)}>
        <View style={styles.scannerContainer}>
          {hasPermission ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={(result) => {
                if (result.data) {
                  onQRScanned(result.data);
                }
              }}
            />
          ) : (
            <View style={styles.scannerPlaceholder}>
              <Text style={styles.scannerText}>No camera permission</Text>
            </View>
          )}
          <Pressable style={styles.scannerClose} onPress={() => setShowQRScanner(false)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>

      <View style={styles.topBar}>
        <View style={styles.backButton} />
        <Text style={styles.topBarTitle}>Wallet</Text>
        <View style={styles.backButton} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<PullRefresh refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={['#2E4ED2', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.walletCard}
            >
              <View style={styles.walletCardTopRow}>
                <View style={styles.walletChip}>
                  <MaterialCommunityIcons name="circle-slice-8" size={14} color="#FFFFFF" />
                  <Text style={styles.walletChipText}>{wallet?.chain.chainName ?? 'Arc Testnet'}</Text>
                </View>
                <TouchableOpacity onPress={() => setHidden((value) => !value)}>
                  <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              </View>

              <Text style={styles.balanceText}>
                {hidden ? '••••' : `${onChain.toFixed(2)} ${symbol}`}
              </Text>

              <TouchableOpacity style={styles.addressRow} onPress={() => void onReceive()}>
                <Text style={styles.addressLabel}>
                  {wallet?.ethereumWallet
                    ? truncateWalletAddress(wallet.ethereumWallet)
                    : 'No Privy Ethereum wallet yet'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void onReceive()} disabled={!wallet?.ethereumWallet}>
                <Ionicons name="arrow-down" size={18} color="#2E4ED2" />
                <Text style={styles.actionLabel}>Receive</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowCashOut((value) => !value)}>
                <Ionicons name="arrow-up" size={18} color="#2E4ED2" />
                <Text style={styles.actionLabel}>Cash out</Text>
              </TouchableOpacity>
              {!wallet?.ethereumWallet ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => void onLinkWallet()} disabled={linking}>
                  <Ionicons name="link" size={18} color="#2E4ED2" />
                  <Text style={styles.actionLabel}>{linking ? 'Linking' : 'Link'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>


            {showCashOut ? (
              <View style={styles.cashOutSection}>
                <Text style={styles.cashOutTitle}>Cash out to wallet</Text>
                <Text style={styles.inputLabel}>Amount (USD)</Text>
                <TextInput
                  style={styles.cashOutInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
                <Text style={styles.inputLabel}>Destination address (optional)</Text>
                <View style={styles.cashOutRow}>
                  <TextInput
                    style={[styles.cashOutInput, { flex: 1, marginTop: 0 }]}
                    placeholder={wallet?.ethereumWallet ? 'Your wallet' : '0x...'}
                    value={cashOutAddress}
                    onChangeText={setCashOutAddress}
                  />
                  <TouchableOpacity style={styles.scanButton} onPress={() => void onScanQR()}>
                    <Ionicons name="qr-code-outline" size={18} color="#2E4ED2" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.cashOutConfirm, cashingOut && styles.cashOutConfirmDisabled]}
                  onPress={() => void onCashOut()}
                  disabled={cashingOut}
                >
                  <Text style={styles.cashOutConfirmText}>{cashingOut ? 'Processing...' : 'Confirm'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {credits > 0 ? (
              <View style={styles.tokenRow}>
                <View style={[styles.tokenIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="gift" size={16} color="#2E4ED2" />
                </View>
                <View style={styles.txMiddle}>
                  <Text style={styles.txTitle}>Eve credits</Text>
                  <Text style={styles.txTime}>Cash out to Arc USDC</Text>
                </View>
                <Text style={styles.tokenAmount}>{hidden ? '••••' : `$${credits.toFixed(2)}`}</Text>
              </View>
            ) : null}

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Today</Text>
                <Text style={styles.statValue}>${(summary?.todayEarnings ?? 0).toFixed(2)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>This week</Text>
                <Text style={styles.statValue}>${(summary?.weekEarnings ?? 0).toFixed(2)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Lifetime</Text>
                <Text style={styles.statValue}>${(summary?.lifetimeEarnings ?? 0).toFixed(2)}</Text>
              </View>
            </View>

            <Text style={styles.historyTitle}>Activity</Text>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.txRow}
            activeOpacity={item.tripId ? 0.6 : 1}
            onPress={() => {
              if (item.tripId) {
                router.push({ pathname: '/(tabs)/earnings/[id]', params: { id: item.tripId } });
              }
            }}
          >
            <TxIcon type={item.type} />
            <View style={styles.txMiddle}>
              <Text style={styles.txTitle}>{item.title}</Text>
              <Text style={styles.txTime}>{item.time}</Text>
            </View>
            <Text style={[styles.txAmount, { color: item.amount < 0 ? '#DC2626' : '#16A34A' }]}>
              {formatMoney(item.amount)}
            </Text>
            {item.tripId ? <Ionicons name="chevron-forward" size={16} color="#C4C9D4" /> : null}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.txSeparator} />}
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle" size={48} color="#B91C1C" />
              <Text style={styles.emptyText}>Could not load wallet</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <Text style={styles.loadingText}>Loading wallet...</Text>
          ) : (
            <Text style={styles.emptyText}>No wallet activity yet</Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f8ef' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 8,
  },
  backButton: { width: 38, height: 38 },
  topBarTitle: { fontSize: 27, fontWeight: '700', color: '#0F172A', letterSpacing: -0.2 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  walletCard: {
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
    overflow: 'hidden',
  },
  walletCardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  balanceText: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginTop: 14 },
  walletFooterHint: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.75)', marginTop: 10 },
  addressRow: { marginTop: 14 },
  addressLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.92)' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECEF',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: { fontSize: 13, fontWeight: '700', color: '#2E4ED2' },
  cashOutButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 108,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAECEF',
  },
  cashOutText: { fontSize: 14, fontWeight: '700', color: '#2E4ED2' },
  cashOutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  cashOutInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECEF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginTop: 10,
    borderRadius: 16,
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenIconText: { fontSize: 18, fontWeight: '800', color: '#16A34A' },
  tokenAmount: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#F0F1EC' },
  statLabel: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  historyTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginTop: 24, marginBottom: 4 },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txMiddle: { flex: 1, marginLeft: 12 },
  txTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  txTime: { fontSize: 12, fontWeight: '400', color: '#9CA3AF', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700', marginRight: 4 },
  txSeparator: { height: 8 },
  emptyContainer: { alignItems: 'center', padding: 40, marginTop: 20 },
  emptyText: { marginTop: 16, color: '#6B7280', fontSize: 16, textAlign: 'center' },
  loadingText: { marginTop: 40, color: '#6B7280', fontSize: 16, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2E4ED5' },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#EAECEF',
  },
  qrAddress: {
    marginTop: 16,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  shareButtonText: {
    color: '#2E4ED2',
    fontWeight: '600',
    fontSize: 15,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  scannerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  cashOutSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
  },
  cashOutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 6,
  },
  scanButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#EAECEF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashOutConfirm: {
    backgroundColor: '#2E4ED2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  cashOutConfirmDisabled: {
    opacity: 0.5,
  },
  cashOutConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
