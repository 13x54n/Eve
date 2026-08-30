import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  SectionList,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { EarningsSummary, EarningsTrip, getEarnings } from '@/services/driver';

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

export default function Earnings() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [recentTrips, setRecentTrips] = useState<EarningsTrip[]>([]);

  useEffect(() => {
    let mounted = true;
    void getEarnings().then((result) => {
      if (!mounted) return;
      setSummary(result.summary);
      setRecentTrips(result.recentTrips);
    }).catch(() => { /* keep empty state on failure */ });
    return () => { mounted = false; };
  }, []);

  const sections = useMemo(() => groupTripsIntoSections(recentTrips), [recentTrips]);
  const balance = summary?.lifetimeEarnings ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Eve Wallet</Text>
        {/* <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
          <Ionicons name="time-outline" size={20} color="#0F172A" />
        </TouchableOpacity> */}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Wallet balance card */}
            <LinearGradient
              colors={['#2E4ED2', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.walletCard}
            >
              <View style={styles.walletCardTopRow}>
                <View style={styles.walletChip}>
                  <MaterialCommunityIcons name="wallet" size={14} color="#FFFFFF" />
                  <Text style={styles.walletChipText}>Total Earnings</Text>
                </View>
                <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.85)" />
              </View>

              <Text style={styles.balanceText}>${balance.toFixed(2)}</Text>


              {/* Decorative card texture */}
              <View pointerEvents="none" style={styles.cardGlowOne} />
              <View pointerEvents="none" style={styles.cardGlowTwo} />
            </LinearGradient>

            {/* Quick stats */}
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

            <Text style={styles.historyTitle}>Transaction history</Text>
          </>
        }
        // renderSectionHeader={({ section }) => (
        //   <View style={styles.sectionHeaderRow}>
        //     <Text style={styles.sectionHeaderText}>{section.title}</Text>
        //     <Text style={styles.sectionHeaderTotal}>
        //       +${section.total.toFixed(2)}
        //     </Text>
        //   </View>
        // )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.txRow} activeOpacity={0.6}>
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
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.txSeparator} />}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
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
    // borderRadius: 16,
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
  },
  txSeparator: {
    height: 8,
  },
});