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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { connectDriverSocket, disconnectDriverSocket, sendDriverLocation, subscribeTrip } from '@/services/socket';

export default function ActiveTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const refresh = useCallback(async (isFirst = false) => {
    try {
      const driver = await getDriverProfile();
      if (driver?.activeTrip && driver.activeTrip.id === id) {
        setLoadError(false);
        setTrip(driver.activeTrip);
      } else if (!driver?.activeTrip) {
        router.replace('/(tabs)/home');
      } else if (isFirst) {
        setLoadError(true);
      }
    } catch {
      if (isFirst) setLoadError(true);
    }
  }, [id]);

  useEffect(() => {
    void refresh(true);
    const timer = setInterval(() => void refresh(), 5000);
    let subscription: Location.LocationSubscription | null = null;
    void connectDriverSocket(() => { /* location is sent from this screen; status is polled */ })
      .then(() => { if (id) subscribeTrip(id); })
      .catch(() => { /* GPS still updates locally; rider may lag until reconnect */ });
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
    return () => { clearInterval(timer); subscription?.remove(); disconnectDriverSocket(); };
  }, [id, refresh]);

  useEffect(() => {
    if (!trip || !mapRef.current) return;
    const headingToPickup = trip.status === 'ASSIGNED' && !hasArrived;
    const points = [
      ...(driverLocation ? [driverLocation] : []),
      {
        latitude: headingToPickup ? trip.pickupLat : trip.dropoffLat,
        longitude: headingToPickup ? trip.pickupLng : trip.dropoffLng,
      },
    ];
    if (points.length === 1) {
      mapRef.current.animateToRegion({
        ...points[0],
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 400);
      return;
    }
    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 88, right: 48, bottom: 320, left: 48 },
      animated: true,
    });
  }, [driverLocation, trip, hasArrived]);

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
      const result = await completeTrip(trip.id);
      router.replace({
        pathname: '/ride/completed',
        params: {
          dropoff: trip.dropoffAddress,
          fare: String(result.trip?.fareTotal ?? trip.fareTotal),
          net: String(result.earnings?.netEarnings ?? trip.fareTotal),
        },
      });
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

  if (!id) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>This trip is no longer available.</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.homeLink}>Back home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.loadingContainer}>
        {loadError ? (
          <>
            <Text style={styles.loadingText}>Could not load this trip.</Text>
            <TouchableOpacity style={styles.retry} onPress={() => { setLoadError(false); void refresh(true); }}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/(tabs)/home')}>
              <Text style={styles.homeLink}>Back home</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#2e4ed2" />
            <Text style={styles.loadingText}>Loading trip...</Text>
          </>
        )}
      </View>
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
  const etaLabel = `${Math.max(1, trip.durationMin)} min`;

  return (
    <View style={styles.container}>
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

      <TouchableOpacity
        style={[styles.fab, { top: insets.top + 8 }]}
        onPress={() => router.replace('/(tabs)/home')}
        activeOpacity={0.7}
        accessibilityLabel="Back home"
      >
        <Ionicons name="chevron-down" size={22} color="#111827" />
      </TouchableOpacity>

      <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
        <View style={styles.handle} />
        <Text style={styles.stageLabel}>{stageLabel.toUpperCase()}</Text>
        <Text style={styles.bookingCode}>{trip.bookingCode} · {etaLabel}</Text>

        <View style={styles.riderRow}>
          <View style={styles.riderAvatar}>
            <Text style={styles.riderInitial}>{trip.rider.user.name[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.riderCopy}>
            <Text style={styles.riderName}>{trip.rider.user.name}</Text>
            <Text style={styles.riderFare}>Cash · ${Number(trip.fareTotal).toFixed(2)}</Text>
          </View>
          {trip.rider.user.phone ? (
            <TouchableOpacity style={styles.callButton} onPress={() => void Linking.openURL(`tel:${trip.rider.user.phone}`)}>
              <Feather name="phone" size={18} color="#16A34A" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => router.push({ pathname: '/trip/chat', params: { id: trip.id } })}
          >
            <Feather name="message-circle" size={18} color="#2E4ED5" />
          </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8EF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#F7F8EF' },
  loadingText: { color: '#6B7280', fontSize: 13, textAlign: 'center' },
  retry: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#2E4ED5' },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  homeLink: { color: '#2E4ED5', fontWeight: '700' },
  map: { ...StyleSheet.absoluteFill },
  fab: {
    position: 'absolute',
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  handle: { alignSelf: 'center', width: 38, height: 4, marginBottom: 16, borderRadius: 2, backgroundColor: '#D1D5DB' },
  stageLabel: { color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  bookingCode: { marginTop: 4, color: '#111827', fontSize: 22, fontWeight: '800' },
  riderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDE68A' },
  riderInitial: { color: '#111827', fontSize: 17, fontWeight: '800' },
  riderCopy: { flex: 1, marginLeft: 12 },
  riderName: { color: '#111827', fontSize: 15, fontWeight: '700' },
  riderFare: { marginTop: 3, color: '#6B7280', fontSize: 12 },
  callButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', marginLeft: 8 },
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
  cancelButton: { alignItems: 'center', marginTop: 10, padding: 8 },
  cancelText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },
});
