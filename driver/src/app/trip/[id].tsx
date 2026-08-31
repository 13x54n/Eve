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
import { useFocusEffect, useLocalSearchParams, usePathname, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  ActiveTrip,
  arrivedAtPickup,
  cancelTrip,
  completeTrip,
  getDriverProfile,
  getTripMessages,
  startTrip,
} from '@/services/driver';
import { addDriverSocketListener, connectDriverSocket, disconnectDriverSocket, sendDriverLocation, subscribeTrip } from '@/services/socket';
import { useAuth } from '@/context/auth-context';
import { ActionButton } from '@/components/action-button';
import { EveMap, EveMarker, EveRoute } from '@/components/map/eve-map';
import { useDrivingRoute } from '@/components/map/use-driving-route';

function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fallbackDurationMin(
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number },
) {
  if (!from) return 5;
  return Math.max(5, Math.ceil(haversineKm(from, to) / 0.45));
}

export default function ActiveTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const refresh = useCallback(async (isFirst = false) => {
    try {
      const driver = await getDriverProfile();
      if (driver?.activeTrip && driver.activeTrip.id === id) {
        setLoadError(false);
        setTrip(driver.activeTrip);
      } else if (!driver?.activeTrip) {
        if (pathnameRef.current.startsWith('/trip/')) {
          router.replace('/(tabs)/home');
        }
      } else if (isFirst) {
        setLoadError(true);
      }
    } catch {
      if (isFirst) setLoadError(true);
    }
  }, [id]);

  const refreshUnread = useCallback(async () => {
    if (!id || !user?.id) return;
    try {
      const messages = await getTripMessages(id);
      setUnreadCount(messages.filter((row) => row.authorId !== user.id && !row.readAt).length);
    } catch {
      /* keep last count */
    }
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnread();
    }, [refreshUnread]),
  );

  useEffect(() => {
    void refresh(true);
    const timer = setInterval(() => void refresh(), 5000);
    let subscription: Location.LocationSubscription | null = null;
    void connectDriverSocket()
      .then(() => { if (id) subscribeTrip(id); })
      .catch(() => { /* GPS still updates locally; rider may lag until reconnect */ });
    const removeSocket = addDriverSocketListener((event, payload) => {
      if (event === 'trip:route_updated') {
        const next = payload as { id?: string; fareTotal?: number; dropoffAddress?: string };
        if (next.id && next.id !== id) return;
        Alert.alert(
          'Route updated',
          next.dropoffAddress
            ? `The rider changed the route. New dropoff: ${next.dropoffAddress}${next.fareTotal != null ? ` · $${Number(next.fareTotal).toFixed(2)}` : ''}`
            : 'The rider added a stop or changed the dropoff.',
        );
        void refresh();
        return;
      }
      if (event !== 'trip:message' || !payload || typeof payload !== 'object') return;
      const message = payload as { tripId?: string; authorId?: string };
      if (message.tripId === id && message.authorId && message.authorId !== user?.id) {
        setUnreadCount((current) => current + 1);
      }
    });
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
    return () => { removeSocket(); clearInterval(timer); subscription?.remove(); disconnectDriverSocket(); };
  }, [id, refresh, user?.id]);

  const headingToPickup = trip?.status === 'ASSIGNED' && !hasArrived;
  const nextStop = !headingToPickup ? trip?.stops?.[0] : undefined;
  const destination = trip
    ? headingToPickup
      ? { latitude: trip.pickupLat, longitude: trip.pickupLng }
      : nextStop
        ? { latitude: nextStop.lat, longitude: nextStop.lng }
        : { latitude: trip.dropoffLat, longitude: trip.dropoffLng }
    : null;
  const { coordinates: routeCoordinates, durationMin: routeDurationMin } = useDrivingRoute(driverLocation, destination);

  function openDirections() {
    if (!trip) return;
    const dest = headingToPickup
      ? { lat: trip.pickupLat, lng: trip.pickupLng }
      : { lat: trip.dropoffLat, lng: trip.dropoffLng };
    const waypoints = headingToPickup
      ? []
      : (trip.stops ?? []).map((stop) => `${stop.lat},${stop.lng}`);
    const waypointParam = waypoints.length ? `&waypoints=${waypoints.join('|')}` : '';
    const fallback = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${waypointParam}&travelmode=driving`;
    const url = Platform.OS === 'ios' && waypoints.length === 0
      ? `maps://?daddr=${dest.lat},${dest.lng}&dirflg=d`
      : fallback;
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

  const isCourier = trip.rideType === 'COURIER';
  const passengerName = !isCourier ? trip.recipientName : null;
  const isHeadingToPickup = trip.status === 'ASSIGNED' && !hasArrived;
  const stops = trip.stops ?? [];
  const stageLabel = isHeadingToPickup
    ? (isCourier ? 'Pickup package' : 'Heading to pickup')
    : trip.status === 'ASSIGNED'
      ? (isCourier ? 'Package collected — ready to deliver' : passengerName ? `Arrived — waiting for ${passengerName}` : 'Arrived — waiting for rider')
      : (isCourier ? `Deliver to ${trip.recipientName ?? 'recipient'}` : passengerName ? `Drop off ${passengerName}` : 'Heading to destination');
  const pickup = { latitude: trip.pickupLat, longitude: trip.pickupLng };
  const dropoff = { latitude: trip.dropoffLat, longitude: trip.dropoffLng };
  const pickupEtaMin = isHeadingToPickup
    ? (routeDurationMin ?? fallbackDurationMin(driverLocation, pickup))
    : null;
  const dropoffEtaMin = isHeadingToPickup
    ? (pickupEtaMin ?? 5) + Math.max(1, trip.durationMin)
    : (routeDurationMin ?? Math.max(1, trip.durationMin));
  const destEtaLabel = isCourier ? 'Deliver' : 'Dropoff';
  const you = driverLocation ?? pickup;

  return (
    <View style={styles.container}>
      <EveMap
        style={styles.map}
        camera={{
          center: you,
          zoom: 13,
          bounds: [
            pickup,
            dropoff,
            ...stops.map((stop) => ({ latitude: stop.lat, longitude: stop.lng })),
            ...(driverLocation ? [driverLocation] : []),
          ],
          padding: { top: 88, right: 48, bottom: 340, left: 48 },
        }}
      >
        {driverLocation ? <EveMarker id="you" coordinate={driverLocation} color="#2e4ed2" title="You" /> : null}
        <EveMarker id="pickup" coordinate={pickup} color="#16A34A" title="Pickup" />
        {stops.map((stop) => (
          <EveMarker
            key={stop.id}
            id={`stop-${stop.id}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            color="#F59E0B"
            title={stop.address}
          />
        ))}
        <EveMarker id="dropoff" coordinate={dropoff} color="#DC2626" title="Dropoff" />
        {routeCoordinates.length >= 2 ? <EveRoute coordinates={routeCoordinates} color="#2e4ed2" /> : null}
      </EveMap>

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
        <Text style={styles.bookingCode}>{trip.bookingCode}</Text>
        <View style={styles.etaRow}>
          {isHeadingToPickup && pickupEtaMin != null ? (
            <View style={styles.etaItem}>
              <Text style={styles.etaCaption}>Pickup</Text>
              <Text style={styles.etaValue}>{pickupEtaMin} min</Text>
            </View>
          ) : null}
          <View style={styles.etaItem}>
            <Text style={styles.etaCaption}>{destEtaLabel}</Text>
            <Text style={styles.etaValue}>{dropoffEtaMin} min</Text>
          </View>
        </View>

        <View style={styles.riderRow}>
          <View style={styles.riderAvatar}>
            <Text style={styles.riderInitial}>{trip.rider.user.name[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.riderCopy}>
            <Text style={styles.riderName}>{trip.rider.user.name}</Text>
            {trip.recipientName ? (
              <Text style={styles.riderFare}>
                {isCourier ? `Deliver to ${trip.recipientName}` : `Passenger: ${trip.recipientName}`}
              </Text>
            ) : null}
            <Text style={styles.riderFare}>Cash · ${Number(trip.fareTotal).toFixed(2)}</Text>
          </View>
          {trip.recipientPhone ? (
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => void Linking.openURL(`tel:${trip.recipientPhone}`)}
              accessibilityLabel={isCourier ? 'Call recipient' : 'Call passenger'}
            >
              <Feather name="phone" size={18} color="#16A34A" />
            </TouchableOpacity>
          ) : trip.rider.user.phone ? (
            <TouchableOpacity style={styles.callButton} onPress={() => void Linking.openURL(`tel:${trip.rider.user.phone}`)}>
              <Feather name="phone" size={18} color="#16A34A" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => router.push({ pathname: '/trip/chat', params: { id: trip.id } })}
          >
            <Feather name="message-circle" size={18} color="#2E4ED5" />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                {unreadCount > 1 ? (
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                ) : null}
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => router.push({ pathname: '/trip/support', params: { tripId: trip.id } })}
            accessibilityLabel="Chat with support"
          >
            <Feather name="headphones" size={18} color="#2E4ED5" />
          </TouchableOpacity>
        </View>

        <View style={styles.addressRow}>
          <View style={[styles.addressDot, { backgroundColor: '#16A34A' }]} />
          <Text style={styles.addressText} numberOfLines={1}>{trip.pickupAddress}</Text>
        </View>
        {stops.map((stop) => (
          <View style={styles.addressRow} key={stop.id}>
            <View style={[styles.addressDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.addressText} numberOfLines={1}>{stop.address}</Text>
          </View>
        ))}
        <View style={styles.addressRow}>
          <View style={[styles.addressDot, { backgroundColor: '#DC2626' }]} />
          <Text style={styles.addressText} numberOfLines={1}>{trip.dropoffAddress}</Text>
        </View>

        <TouchableOpacity style={styles.navigateButton} onPress={() => openDirections()} activeOpacity={0.85}>
          <MaterialCommunityIcons name="navigation-variant" size={18} color="#FFFFFF" />
          <Text style={styles.navigateText}>
            {isHeadingToPickup ? 'Navigate to pickup' : isCourier ? 'Navigate to recipient' : 'Navigate to destination'}
          </Text>
        </TouchableOpacity>

        {isHeadingToPickup ? (
          <ActionButton
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
            label={isCourier ? "I've arrived" : "I've arrived"}
            loadingLabel="Updating..."
            loading={busy}
            onPress={() => void handleArrived()}
          />
        ) : trip.status === 'ASSIGNED' ? (
          <ActionButton
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
            label={isCourier ? 'Start delivery' : 'Start trip'}
            loadingLabel="Starting..."
            loading={busy}
            onPress={() => void handleStart()}
          />
        ) : (
          <ActionButton
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
            label={isCourier ? 'Complete delivery' : 'Complete trip'}
            loadingLabel="Completing..."
            loading={busy}
            onPress={() => void handleComplete()}
          />
        )}

        <ActionButton
          style={styles.cancelButton}
          textStyle={styles.cancelText}
          label="Cancel trip"
          disabled={busy}
          spinnerColor="#B91C1C"
          onPress={handleCancel}
        />
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
  etaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 20, marginTop: 10 },
  etaItem: { minWidth: 88 },
  etaCaption: { color: '#6B7280', fontSize: 11, fontWeight: '700' },
  etaValue: { color: '#111827', fontSize: 22, fontWeight: '800' },
  riderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDE68A' },
  riderInitial: { color: '#111827', fontSize: 17, fontWeight: '800' },
  riderCopy: { flex: 1, marginLeft: 12 },
  riderName: { color: '#111827', fontSize: 15, fontWeight: '700' },
  riderFare: { marginTop: 3, color: '#6B7280', fontSize: 12 },
  callButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', marginLeft: 8 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
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
