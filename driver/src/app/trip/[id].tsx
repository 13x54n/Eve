import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  ActiveTrip,
  arrivedAtPickup,
  cancelTrip,
  completeTrip,
  getDriverProfile,
  startTrip,
} from '@/services/driver';
import { sendDriverLocation } from '@/services/socket';

export default function ActiveTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [hasArrived, setHasArrived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const refresh = useCallback(async () => {
    try {
      const driver = await getDriverProfile();
      if (driver?.activeTrip && driver.activeTrip.id === id) {
        setTrip(driver.activeTrip);
      } else if (!driver?.activeTrip) {
        // Trip finished or was cancelled elsewhere — leave the screen.
        router.replace('/(tabs)/home');
      }
    } catch { /* keep last known trip state */ }
  }, [id]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    let subscription: Location.LocationSubscription | null = null;
    void Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
      if (status !== 'granted') return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 25 },
        (location) => {
          setDriverLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
          sendDriverLocation(location.coords.latitude, location.coords.longitude);
        },
      );
    });
    return () => { clearInterval(timer); subscription?.remove(); };
  }, [refresh]);

  function openDirections(lat: number, lng: number) {
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    const url = Platform.OS === 'ios' ? `maps://?daddr=${lat},${lng}&dirflg=d` : fallback;
    void Linking.openURL(url).catch(() => void Linking.openURL(fallback));
  }

  async function handleArrived() {
    if (!trip) return;
    try {
      setBusy(true);
      await arrivedAtPickup(trip.id);
      setHasArrived(true);
    } catch {
      Alert.alert('Could not update trip', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!trip) return;
    try {
      setBusy(true);
      const updated = await startTrip(trip.id);
      setTrip(updated);
    } catch {
      Alert.alert('Could not start trip', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!trip) return;
    try {
      setBusy(true);
      await completeTrip(trip.id);
      router.replace('/(tabs)/home');
    } catch {
      Alert.alert('Could not complete trip', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    if (!trip) return;
    Alert.alert('Cancel trip', 'Are you sure you want to cancel this trip?', [
      { text: 'Keep trip', style: 'cancel' },
      {
        text: 'Cancel trip',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setBusy(true);
              await cancelTrip(trip.id, 'driver_cancelled');
              router.replace('/(tabs)/home');
            } catch {
              Alert.alert('Could not cancel trip', 'Please try again.');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e4ed2" />
        <Text style={styles.loadingText}>Loading trip...</Text>
      </SafeAreaView>
    );
  }

  const isHeadingToPickup = trip.status === 'ASSIGNED' && !hasArrived;
  const destinationLat = isHeadingToPickup ? trip.pickupLat : trip.dropoffLat;
  const destinationLng = isHeadingToPickup ? trip.pickupLng : trip.dropoffLng;
  const stageLabel = isHeadingToPickup
    ? 'Heading to pickup'
    : trip.status === 'ASSIGNED'
      ? 'Arrived — waiting for rider'
      : 'Heading to destination';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{
            latitude: driverLocation?.latitude ?? trip.pickupLat,
            longitude: driverLocation?.longitude ?? trip.pickupLng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
          {driverLocation ? <Marker coordinate={driverLocation} pinColor="#2e4ed2" title="You" /> : null}
          <Marker coordinate={{ latitude: trip.pickupLat, longitude: trip.pickupLng }} pinColor="#16A34A" title="Pickup" />
          <Marker coordinate={{ latitude: trip.dropoffLat, longitude: trip.dropoffLng }} pinColor="#DC2626" title="Dropoff" />
          {driverLocation ? (
            <Polyline
              coordinates={[driverLocation, { latitude: destinationLat, longitude: destinationLng }]}
              strokeColor="#2e4ed2"
              strokeWidth={4}
            />
          ) : null}
        </MapView>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)/home')} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.stageLabel}>{stageLabel}</Text>
        <Text style={styles.bookingCode}>{trip.bookingCode}</Text>

        <View style={styles.riderRow}>
          <View style={styles.riderAvatar}>
            <Text style={styles.riderInitial}>{trip.rider.user.name[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.riderCopy}>
            <Text style={styles.riderName}>{trip.rider.user.name}</Text>
            <Text style={styles.riderFare}>Cash fare · ${trip.fareTotal.toFixed(2)}</Text>
          </View>
          {trip.rider.user.phone ? (
            <TouchableOpacity style={styles.callButton} onPress={() => void Linking.openURL(`tel:${trip.rider.user.phone}`)}>
              <Feather name="phone" size={18} color="#16A34A" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.addressRow}>
          <View style={[styles.addressDot, { backgroundColor: '#16A34A' }]} />
          <Text style={styles.addressText} numberOfLines={1}>{trip.pickupAddress}</Text>
        </View>
        <View style={styles.addressRow}>
          <View style={[styles.addressDot, { backgroundColor: '#DC2626' }]} />
          <Text style={styles.addressText} numberOfLines={1}>{trip.dropoffAddress}</Text>
        </View>

        <TouchableOpacity style={styles.navigateButton} onPress={() => openDirections(destinationLat, destinationLng)} activeOpacity={0.85}>
          <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFFFFF" />
          <Text style={styles.navigateText}>
            {isHeadingToPickup ? 'Navigate to pickup' : 'Navigate to destination'}
          </Text>
        </TouchableOpacity>

        {isHeadingToPickup ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleArrived()} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>{busy ? 'Updating...' : "I've arrived"}</Text>
          </TouchableOpacity>
        ) : trip.status === 'ASSIGNED' ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleStart()} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>{busy ? 'Starting...' : 'Start trip'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={() => void handleComplete()} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>{busy ? 'Completing...' : 'Complete trip'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={busy}>
          <Text style={styles.cancelText}>Cancel trip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8EF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F7F8EF' },
  loadingText: { color: '#6B7280', fontSize: 13 },
  mapWrap: { height: '45%' },
  map: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sheet: {
    flex: 1,
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    backgroundColor: '#FFFFFF',
  },
  stageLabel: { color: '#2e4ed2', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  bookingCode: { marginTop: 4, color: '#111827', fontSize: 20, fontWeight: '800' },
  riderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDE68A' },
  riderInitial: { color: '#111827', fontSize: 17, fontWeight: '800' },
  riderCopy: { flex: 1, marginLeft: 12 },
  riderName: { color: '#111827', fontSize: 15, fontWeight: '700' },
  riderFare: { marginTop: 3, color: '#6B7280', fontSize: 12 },
  callButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  addressDot: { width: 8, height: 8, borderRadius: 4 },
  addressText: { flex: 1, color: '#374151', fontSize: 13 },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111827',
  },
  navigateText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2e4ed2',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cancelButton: { alignItems: 'center', marginTop: 14, padding: 8 },
  cancelText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
});
