import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { TabScreen } from '@/components/tab-screen';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { DriverTripDetail, getTripEarnings } from '@/services/driver';
import { ActionButton } from '@/components/action-button';

function formatMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function prettyLabel(value: string) {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWhen(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function TripEarningsDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<DriverTripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setTrip(await getTripEarnings(id));
    } catch {
      setTrip(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TabScreen style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Trip earnings</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2E4ED2" />
        </View>
      ) : error || !trip ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load this trip</Text>
          <Text style={styles.errorCopy}>Check your connection and try again.</Text>
          <ActionButton
            label="Retry"
            onPress={() => void load()}
            style={styles.retryButton}
            textStyle={styles.retryText}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#2E4ED2', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.walletCard}
          >
            <View style={styles.walletChip}>
              <MaterialCommunityIcons name="cash" size={14} color="#FFFFFF" />
              <Text style={styles.walletChipText}>Net earnings</Text>
            </View>
            <Text style={styles.balanceText}>{formatMoney(trip.netEarnings)}</Text>
            <Text style={styles.bookingCode}>{trip.bookingCode}</Text>
            <View pointerEvents="none" style={styles.cardGlowOne} />
            <View pointerEvents="none" style={styles.cardGlowTwo} />
          </LinearGradient>

          <View style={styles.card}>
            <DetailRow label="Trip fare" value={formatMoney(trip.fareTotal)} />
            <View style={styles.rowDivider} />
            <DetailRow label="Net earnings" value={formatMoney(trip.netEarnings)} />
            <View style={styles.rowDivider} />
            <DetailRow label="Payment" value={prettyLabel(trip.paymentMethod)} />
          </View>

          <View style={styles.card}>
            <View style={styles.addressBlock}>
              <View style={[styles.dot, { backgroundColor: '#16A34A' }]} />
              <View style={styles.addressCopy}>
                <Text style={styles.detailLabel}>Pickup</Text>
                <Text style={styles.addressText}>{trip.pickupAddress}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.addressBlock}>
              <View style={[styles.dot, { backgroundColor: '#2E4ED2' }]} />
              <View style={styles.addressCopy}>
                <Text style={styles.detailLabel}>Dropoff</Text>
                <Text style={styles.addressText}>{trip.dropoffAddress}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <DetailRow label="Rider" value={trip.riderName} />
            <View style={styles.rowDivider} />
            <DetailRow label="Distance" value={`${trip.distanceKm.toFixed(1)} km`} />
            <View style={styles.rowDivider} />
            <DetailRow label="Duration" value={`${trip.durationMin} min`} />
            <View style={styles.rowDivider} />
            <DetailRow label="Ride type" value={prettyLabel(trip.rideType)} />
            <View style={styles.rowDivider} />
            <DetailRow label="Completed" value={formatWhen(trip.endedAt ?? trip.createdAt)} />
          </View>

          <TouchableOpacity
            style={styles.helpRow}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/trip/support', params: { tripId: trip.id } })}
          >
            <Ionicons name="help-circle-outline" size={20} color="#2E4ED2" />
            <Text style={styles.helpText}>Help with this trip</Text>
            <Ionicons name="chevron-forward" size={16} color="#C4C9D4" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8ef',
  },
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
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  errorCopy: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2E4ED2',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  walletCard: {
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
    overflow: 'hidden',
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
  bookingCode: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
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
  card: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'right',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEF0EA',
  },
  addressBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  addressCopy: {
    flex: 1,
  },
  addressText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  routeLine: {
    width: 2,
    height: 12,
    marginLeft: 4,
    backgroundColor: '#E5E7EB',
  },
  helpRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
});
