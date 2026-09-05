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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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

type TxType = 'trip' | 'credit' | 'withdraw' | 'payout';

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
  return 'payout';
}

function ledgerTitle(entry: WalletLedgerEntry) {
  if (entry.type === 'CREDIT') return entry.note || 'Platform credit';
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
      title: 'Trip (off-platform)',
      amount: trip.netEarnings,
      tripId: trip.id,
      created,
    });
  }
  for (const entry of entries) {
    const created = new Date(entry.createdAt);
    const signed =
      entry.type === 'WALLET_WITHDRAW' || entry.type === 'PAYOUT'
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

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      setError(false);
      const [earningsResult, walletResult] = await Promise.all([getEarnings(), getWallet()]);
      setSummary(earningsResult.summary);
      setRecentTrips(earningsResult.recentTrips);
      setWallet(walletResult);
    } catch {
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
  const balance = wallet?.walletBalance ?? summary?.walletBalance ?? 0;

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

  async function onCashOut() {
    const value = Number(amount);
    const min = wallet?.minWithdrawUsd ?? 1;
    if (!Number.isFinite(value) || value < min) {
      Alert.alert('Cash out', `Enter at least $${min.toFixed(2)}.`);
      return;
    }
    if (!wallet?.ethereumWallet) {
      Alert.alert('Cash out', 'Link your Privy Ethereum wallet first.');
      return;
    }
    try {
      setCashingOut(true);
      const result = await withdrawWallet(value, `mobile-${Date.now()}`);
      setAmount('');
      await load({ silent: true });
      const status = result.entry.status;
      const extra = result.entry.providerRef ? `\nTx ${result.entry.providerRef}` : '';
      Alert.alert(
        'Cash out',
        status === 'COMPLETED'
          ? `Sent to your Privy wallet.${extra}`
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

      <View style={styles.topBar}>
        <View style={styles.backButton} />
        <Text style={styles.topBarTitle}>Eve Wallet</Text>
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
                  <MaterialCommunityIcons name="wallet" size={14} color="#FFFFFF" />
                  <Text style={styles.walletChipText}>Available (platform credits)</Text>
                </View>
                <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.85)" />
              </View>

              <Text style={styles.balanceText}>${balance.toFixed(2)}</Text>
              <Text style={styles.walletFooterHint}>
                Trip fares are collected off-platform. This balance is Eve credits paid to your Privy
                Ethereum wallet.
              </Text>

              <TouchableOpacity
                style={styles.addressRow}
                onPress={() => {
                  const addr = wallet?.ethereumWallet;
                  if (!addr) return;
                  void Share.share({ message: addr });
                }}
              >
                <Text style={styles.addressLabel}>
                  {wallet?.ethereumWallet
                    ? `Privy ${truncateWalletAddress(wallet.ethereumWallet)} · ${wallet.chain.chainName}`
                    : 'No Privy Ethereum wallet yet'}
                </Text>
              </TouchableOpacity>

              <View pointerEvents="none" style={styles.cardGlowOne} />
              <View pointerEvents="none" style={styles.cardGlowTwo} />
            </LinearGradient>

            {wallet?.ethereumWallet ? (
              <View style={styles.cashOutRow}>
                <TextInput
                  style={styles.cashOutInput}
                  keyboardType="decimal-pad"
                  placeholder="Amount USD"
                  placeholderTextColor="#9CA3AF"
                  value={amount}
                  onChangeText={setAmount}
                />
                <TouchableOpacity
                  style={styles.cashOutButton}
                  onPress={() => void onCashOut()}
                  disabled={cashingOut}
                >
                  {cashingOut ? (
                    <ActivityIndicator color="#2E4ED2" />
                  ) : (
                    <Text style={styles.cashOutText}>Cash out</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.linkButton} onPress={() => void onLinkWallet()} disabled={linking}>
                <Text style={styles.linkButtonText}>
                  {linking ? 'Linking…' : 'Link Privy Ethereum wallet'}
                </Text>
              </TouchableOpacity>
            )}

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
                <Text style={styles.statLabel}>Lifetime fares</Text>
                <Text style={styles.statValue}>${(summary?.lifetimeEarnings ?? 0).toFixed(2)}</Text>
              </View>
            </View>

            <Text style={styles.historyTitle}>Transaction history</Text>
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
            <Text
              style={[
                styles.txAmount,
                { color: item.amount < 0 ? '#DC2626' : '#16A34A' },
              ]}
            >
              {formatMoney(item.amount)}
            </Text>
            {item.tripId ? <Ionicons name="chevron-forward" size={16} color="#C4C9D4" /> : null}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.txSeparator} />}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
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
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8ef',
  },

  // --- Top bar ---
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 27,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EAECEF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // --- Wallet card ---
  walletCard: {
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: '#2E4ED2',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  walletCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  balanceText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginTop: 14,
  },
  walletCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 12,
  },
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
  cashOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E4ED2',
  },
  walletFooterHint: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    flexShrink: 1,
    marginTop: 10,
  },
  addressRow: {
    marginTop: 14,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  cashOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
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
  linkButton: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECEF',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E4ED2',
  },
  cardGlowOne: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -40,
  },
  cardGlowTwo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -50,
    left: -30,
  },

  // --- Stats row ---
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F0F1EC',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },

  // --- Transaction list ---
  historyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 24,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionHeaderTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  txTime: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: 4,
  },
  txSeparator: {
    height: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 40,
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2E4ED5',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
