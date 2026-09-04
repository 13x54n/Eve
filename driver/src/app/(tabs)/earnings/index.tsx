import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SectionList,
  Platform,
  Alert,
  Linking,
  Share,
  ActivityIndicator,
} from 'react-native';
import { TabScreen } from '@/components/tab-screen';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { EarningsSummary, EarningsTrip, getEarnings } from '@/services/driver';
import { getDriverWallet, type UsdcWallet } from '@/services/wallet';
import { PullRefresh, usePullToRefresh } from '@/components/pull-refresh';

type TxType = 'trip' | 'tip' | 'bonus' | 'cashout';

type Transaction = {
  id: string;
  type: TxType;
  title: string;
  time: string;
  amount: number; // positive = earned, negative = cashed out
};

type Section = {
  title: string;
  total: number;
  data: Transaction[];
};

// Groups completed trips returned by the backend into day-based sections.
function groupTripsIntoSections(trips: EarningsTrip[]): Section[] {
  const todayLabel = new Date().toDateString();
  const byDay = new Map<string, Transaction[]>();
  for (const trip of trips) {
    const created = new Date(trip.createdAt);
    const dayKey = created.toDateString();
    const title = dayKey === todayLabel
      ? 'Today'
      : created.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const list = byDay.get(title) ?? [];
    list.push({
      id: trip.id,
      type: 'trip',
      title: 'Trip earnings',
      time: created.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      amount: trip.netEarnings,
    });
    byDay.set(title, list);
  }
  return Array.from(byDay.entries()).map(([title, data]) => ({
    title,
    total: data.reduce((sum, item) => sum + item.amount, 0),
    data,
  }));
}

const TX_ICON: Record<TxType, { name: any; lib: 'ion' | 'mci'; bg: string; fg: string }> = {
  trip: { name: 'car', lib: 'mci', bg: '#EFF6FF', fg: '#3B82F6' },
  tip: { name: 'gift', lib: 'ion', bg: '#F0FDF4', fg: '#16A34A' },
  bonus: { name: 'star', lib: 'ion', bg: '#FFFBEB', fg: '#D97706' },
  cashout: { name: 'arrow-down-circle', lib: 'ion', bg: '#FEF2F2', fg: '#DC2626' },
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

function formatUsdc(balance: string) {
  const value = Number(balance);
  return Number.isFinite(value) ? value.toFixed(6) : balance;
}

export default function Earnings() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [recentTrips, setRecentTrips] = useState<EarningsTrip[]>([]);
  const [wallet, setWallet] = useState<UsdcWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    const [earningsResult, walletResult] = await Promise.allSettled([
      getEarnings(),
      getDriverWallet(),
    ]);

    if (earningsResult.status === 'fulfilled') {
      setSummary(earningsResult.value.summary);
      setRecentTrips(earningsResult.value.recentTrips);
      setError(false);
    } else {
      setError(true);
    }

    if (walletResult.status === 'fulfilled') {
      setWallet(walletResult.value);
      setWalletError(null);
    } else {
      setWallet(null);
      setWalletError('Could not load your USDC wallet.');
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load({ silent: true });
    }, [load]),
  );

  const { refreshing, onRefresh } = usePullToRefresh(() => load({ silent: true }));

  const sections = useMemo(() => groupTripsIntoSections(recentTrips), [recentTrips]);

  return (
    <TabScreen style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.backButton} />
        <Text style={styles.topBarTitle}>Eve Wallet</Text>
        <View style={styles.backButton} />
      </View>

      <SectionList
        style={styles.list}
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
                  <Text style={styles.walletChipText}>USDC balance</Text>
                </View>
              </View>

              {wallet ? (
                <Text style={styles.balanceText}>{formatUsdc(wallet.balance)} USDC</Text>
              ) : walletError ? (
                <Text style={styles.walletCardError}>{walletError}</Text>
              ) : (
                <ActivityIndicator color="#FFFFFF" style={styles.walletSpinner} />
              )}

              <Text style={styles.walletDisclaimer}>
                Arc Testnet USDC. Completed trip fares are released here. This is testnet value, not mainnet dollars.
              </Text>

              <View pointerEvents="none" style={styles.cardGlowOne} />
              <View pointerEvents="none" style={styles.cardGlowTwo} />
            </LinearGradient>

            {/* {wallet ? (
              <View style={styles.addressCard}>
                <Text style={styles.addressLabel}>Address</Text>
                <Text selectable style={styles.addressText}>{wallet.address}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Copy wallet address"
                  onPress={() => {
                    void Share.share({ message: wallet.address }).catch(() => {
                      Alert.alert('Wallet address', wallet.address);
                    });
                  }}
                >
                  <Text style={styles.addressLink}>Copy address</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="View wallet on Arcscan"
                  onPress={() => void Linking.openURL(wallet.explorerUrl)}
                >
                  <Text style={styles.addressLink}>View on Arcscan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Get testnet USDC from Circle faucet"
                  onPress={() => void Linking.openURL('https://faucet.circle.com')}
                >
                  <Text style={[styles.addressLink, styles.addressLinkLast]}>Get testnet USDC from Circle faucet</Text>
                </TouchableOpacity>
              </View>
            ) : null} */}

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
                <Text style={styles.statLabel}>Trips</Text>
                <Text style={styles.statValue}>{summary?.weekTrips ?? 0}</Text>
              </View>
            </View>

            <Text style={styles.historyTitle}>Payout history</Text>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.txRow}
            activeOpacity={0.6}
            onPress={() =>
              router.push({ pathname: '/(tabs)/earnings/[id]', params: { id: item.id } })
            }
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
            <Ionicons name="chevron-forward" size={16} color="#C4C9D4" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.txSeparator} />}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle" size={48} color="#B91C1C" />
              <Text style={styles.emptyText}>Could not load earnings</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <Text style={styles.loadingText}>Loading earnings...</Text>
          ) : (
            <Text style={styles.emptyText}>No earnings yet</Text>
          )
        }
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8ef',
  },
  list: {
    flex: 1,
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
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginTop: 14,
  },
  walletCardError: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  walletSpinner: {
    marginTop: 18,
    alignSelf: 'flex-start',
  },
  walletDisclaimer: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
  addressCard: {
    marginTop: 14,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F1EC',
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 6,
  },
  addressText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#0F172A',
    marginBottom: 12,
  },
  addressLink: {
    marginBottom: 10,
    color: '#2E4ED2',
    fontSize: 14,
    fontWeight: '700',
  },
  addressLinkLast: {
    marginBottom: 0,
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
