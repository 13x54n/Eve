import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ScrollView,
  TextInput,
  Vibration,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { UrlTile, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import BusyHoursChart from '@/components/busyHourChart';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  createTripOffer,
  DriverPresence,
  getDriverProfile,
  getIncomingTrips,
  IncomingTrip,
  PendingOffer,
  updatePresence,
} from '@/services/driver';
import { connectDriverSocket, disconnectDriverSocket } from '@/services/socket';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { sendDriverLocation } from '@/services/socket';

// npm install react-native-maps @expo/vector-icons expo-image
// Native map — requires a custom dev client (won't run in plain Expo Go):
//   npx expo install react-native-maps
//   npx expo prebuild
//   npx expo run:ios      (or: npx expo run:android)
// Tiles are OpenStreetMap via UrlTile, no API key needed.
// OSM's free tile server has usage limits — swap the urlTemplate for a paid
// provider (MapTiler, Stadia Maps, etc.) before shipping to production.

// Fallback region only used until the device's real location is available.
const DEFAULT_REGION: Region = {
  latitude: 60.1699,
  longitude: 24.9384,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Home() {
  const [incomingTrips, setIncomingTrips] = useState<IncomingTrip[]>([]);
  const [pendingOffer, setPendingOffer] = useState<PendingOffer | null>(null);
  const [offerFare, setOfferFare] = useState<Record<string, string>>({});
  const [offeringTripId, setOfferingTripId] = useState<string | null>(null);
  const [presence, setPresence] = useState<DriverPresence>('OFFLINE');
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const mapRef = useRef<MapView | null>(null);
  const presenceRef = useRef<DriverPresence>('OFFLINE');
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      if (presenceRef.current !== 'ONLINE' && presenceRef.current !== 'IDLE') {
        if (mounted) {
          setIncomingTrips([]);
          setPendingOffer(null);
        }
        return;
      }
      try {
        const incoming = await getIncomingTrips();
        if (mounted) {
          setIncomingTrips(incoming.trips);
          setPendingOffer(incoming.pendingOffer);
        }
      } catch { /* retry on next poll */ }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    void connectDriverSocket((event, payload) => {
      if (!mounted) return;
      if (event === 'trip:requested') {
        void refresh();
        Vibration.vibrate();
        const trip = payload as { pickupAddress?: string; fareTotal?: number } | undefined;
        void Notifications.scheduleNotificationAsync({
          content: {
            title: 'New ride request',
            body: trip?.pickupAddress ? `Pickup at ${trip.pickupAddress} · est. $${Number(trip.fareTotal ?? 0).toFixed(2)}` : 'A rider nearby is requesting a trip.',
          },
          trigger: null,
        });
      } else if (event === 'trip:assigned') {
        const assignedTrip = payload as { id?: string } | undefined;
        if (assignedTrip?.id) router.push(`/trip/${assignedTrip.id}`);
      } else if (event === 'offer:rejected') {
        void refresh();
      }
    }).catch(() => { /* HTTP polling still lists incoming trips */ });
    void getDriverProfile().then((driver) => {
      if (!mounted) return;
      if (driver?.presence) {
        presenceRef.current = driver.presence;
        setPresence(driver.presence);
      }
      if (driver?.activeTrip?.id) {
        router.push(`/trip/${driver.activeTrip.id}`);
      }
      if (driver?.presence === 'ONLINE' || driver?.presence === 'IDLE') {
        void refresh();
      }
    }).catch(() => { /* keep default OFFLINE state */ });
    void Notifications.requestPermissionsAsync();
    void Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
      if (!mounted || status !== 'granted') return;
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (mounted) {
        setRegion({ latitude: current.coords.latitude, longitude: current.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
      }
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 25 },
        (location) => {
          if (presenceRef.current === 'ONLINE') {
            sendDriverLocation(location.coords.latitude, location.coords.longitude);
          }
        },
      );
    });
    return () => { mounted = false; clearInterval(timer); locationSubscriptionRef.current?.remove(); disconnectDriverSocket(); };
  }, []);

  async function togglePresence() {
    const next: DriverPresence = presence === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    try {
      if (next === 'ONLINE') {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await updatePresence({ presence: next, latitude: current.coords.latitude, longitude: current.coords.longitude });
      } else {
        await updatePresence({ presence: next });
      }
      presenceRef.current = next;
      setPresence(next);
      if (next === 'ONLINE') {
        const incoming = await getIncomingTrips();
        setIncomingTrips(incoming.trips);
        setPendingOffer(incoming.pendingOffer);
      } else {
        setIncomingTrips([]);
        setPendingOffer(null);
      }
    } catch (error: any) {
      Alert.alert(
        next === 'ONLINE' ? 'Could not go online' : 'Could not go offline',
        error?.response?.data?.message ?? 'Please try again.',
      );
    }
  }

  function recenter() {
    mapRef.current?.animateToRegion(region, 300);
  }

  async function submitOffer(trip: IncomingTrip) {
    const fare = Number(offerFare[trip.id] ?? trip.fareTotal);
    if (!Number.isFinite(fare) || fare < trip.fareTotal) return;
    try {
      setOfferingTripId(trip.id);
      await createTripOffer(trip.id, fare, Math.max(1, Math.ceil(trip.durationMin / 3)));
      const incoming = await getIncomingTrips();
      setIncomingTrips(incoming.trips);
      setPendingOffer(incoming.pendingOffer);
    } catch (error: any) {
      Alert.alert('Could not send offer', error?.response?.data?.message ?? 'Please try again.');
    }
    finally { setOfferingTripId(null); }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Image
            source={{ uri: 'https://ik.imagekit.io/lexy/Eve/logo.png' }}
            style={{ width: 60, height: 60, marginRight: 'auto' }}
          />
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <Ionicons name="shield-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.requestSection}>
          <Text style={styles.presenceLabel}>
            {presence === 'ONLINE' || presence === 'IDLE' ? 'You are online' : 'You are offline'}
          </Text>
        </View>
        {pendingOffer ? (
          <View style={styles.requestSection}>
            <Text style={styles.sectionTitle}>Waiting for match</Text>
            <View style={styles.requestCard}>
              <Text style={styles.requestTitle}>{pendingOffer.riderName}</Text>
              <Text style={styles.requestRoute}>{pendingOffer.pickupAddress}</Text>
              <Text style={styles.requestRoute}>to {pendingOffer.dropoffAddress}</Text>
              <Text style={styles.requestMeta}>
                Offered ${Number(pendingOffer.proposedFare).toFixed(2)} · you can only wait on one match at a time
              </Text>
            </View>
          </View>
        ) : incomingTrips.length > 0 ? (
          <View style={styles.requestSection}>
            <Text style={styles.sectionTitle}>Ride requests nearby</Text>
            {incomingTrips.map((trip) => (
              <View style={styles.requestCard} key={trip.id}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestTitle}>{trip.riderName}</Text>
                  <Text style={styles.requestType}>{trip.vehicleType === 'BIKE' ? 'Bike' : 'Car'}</Text>
                </View>
                <Text style={styles.requestRoute}>{trip.pickupAddress}</Text>
                <Text style={styles.requestRoute}>to {trip.dropoffAddress}</Text>
                <Text style={styles.requestMeta}>{trip.distanceKm.toFixed(1)} km · base fare ${trip.fareTotal.toFixed(2)} (cash on arrival)</Text>
                <View style={styles.offerRow}>
                  <TextInput
                    style={styles.offerInput}
                    placeholder={`From $${trip.fareTotal.toFixed(2)}`}
                    keyboardType="decimal-pad"
                    value={offerFare[trip.id] ?? String(trip.fareTotal.toFixed(2))}
                    onChangeText={(value) => setOfferFare((current) => ({ ...current, [trip.id]: value }))}
                  />
                  <TouchableOpacity style={styles.offerButton} onPress={() => void submitOffer(trip)} disabled={offeringTripId === trip.id}>
                    <Text style={styles.offerButtonText}>{offeringTripId === trip.id ? 'Sending...' : 'Offer price'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Section: Your Progress */}
        {/* <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ready to go?</Text>
        </View> */}

        {/* Map */}
        

        {/* Section: Earnings */}
        <View style={{ borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, marginHorizontal: 16, borderRadius: 20, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
          <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <Text style={styles.sectionSubtitle}>
            Earning trends for drivers in your current area
          </Text>
          <Text style={styles.sectionBody}>
            Explore the best times and places to deliver today.
          </Text>
        </View>

        <BusyHoursChart />
        </View>

        {/* Spacer so content isn't hidden behind the fixed button */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Fixed "Go Online" button — pinned above the bottom tab bar.
          Sits outside the ScrollView so it stays put while scrolling.
          Because this screen's content area is already sized to end where
          the tab navigator's tab bar begins, position: 'absolute' + bottom: 0
          here places it directly above the tabs without covering them. */}
      <View style={styles.goOnlineWrapper} pointerEvents="box-none">
        {presence === 'ONLINE' ? (
          <TouchableOpacity
            style={styles.goOfflineButton}
            activeOpacity={0.85}
            onPress={() => void togglePresence()}
          >
            <MaterialCommunityIcons name="stop" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.goOnlineButton}
            activeOpacity={0.85}
            onPress={() => void togglePresence()}
          >
            <MaterialCommunityIcons name="car" size={20} color="#FFFFFF" />
            <Text style={styles.goOnlineText}>Go Online</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8ef',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  requestSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  presenceLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  requestCard: {
    marginTop: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestTitle: {
    color: '#111827',
    fontWeight: '800',
  },
  requestType: {
    color: '#2E4ED5',
    fontSize: 12,
    fontWeight: '700',
  },
  requestRoute: {
    marginTop: 5,
    color: '#374151',
    fontSize: 13,
  },
  requestMeta: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 12,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  offerInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    color: '#111827',
  },
  offerButton: {
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#2E4ED5',
  },
  offerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // --- Top bar ---
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#EAECEF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // --- Section headers / text ---
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 6,
    lineHeight: 20,
  },
  sectionBody: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 18,
  },

  // --- Map ---
  mapCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#ECEFF1',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  mapContainer: {
    height: 360,
    overflow: 'hidden',
  },
  heatCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 300,
    height: 300,
    marginLeft: -150,
    marginTop: -150,
    borderRadius: 150,
    backgroundColor: 'rgba(180,180,190,0.35)',
  },
  locationDotOuter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -18,
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  locationDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B82F6',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },

  // --- Fixed Go Online button ---
  goOnlineWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    // backgroundColor: 'rgba(255,255,255,0.96)',
    // borderTopWidth: 1,
    // borderTopColor: '#F0F0F0',
  },
  goOnlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2e4ed2',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  goOnlineText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  goOfflineButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});