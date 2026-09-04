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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabScreen } from '@/components/tab-screen';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect, usePathname, type Href } from 'expo-router';
import BusyHoursChart from '@/components/busyHourChart';
import { ActionButton } from '@/components/action-button';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTripOffer,
  DriverPresence,
  DriverProfile,
  getDriverProfile,
  getIncomingTrips,
  IncomingTrip,
  PendingOffer,
  ActiveDispatch,
  updatePresence,
} from '@/services/driver';
import { getOnboardingProgress } from '@/lib/onboarding-steps';
import { addDriverSocketListener, connectDriverSocket, disconnectDriverSocket, sendDriverLocation } from '@/services/socket';
import * as Location from 'expo-location';
import { notifyRideEvent, requestRideNotificationPermission } from '@/services/notifications';
import { lightImpact, notifyImpact } from '@/lib/haptics';
import { Brand } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { PullRefresh, usePullToRefresh } from '@/components/pull-refresh';

export default function Home() {
  const { brand } = useAppTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const [incomingTrips, setIncomingTrips] = useState<IncomingTrip[]>([]);
  const [pendingOffer, setPendingOffer] = useState<PendingOffer | null>(null);
  const [activeDispatch, setActiveDispatch] = useState<ActiveDispatch | null>(null);
  const [offerFare, setOfferFare] = useState<Record<string, string>>({});
  const [offeringTripId, setOfferingTripId] = useState<string | null>(null);
  const [presence, setPresence] = useState<DriverPresence>('OFFLINE');
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const presenceRef = useRef<DriverPresence>('OFFLINE');
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const openingOfferRef = useRef<string | null>(null);
  const onboarding = getOnboardingProgress(profile);

  function openOfferScreen(tripId: string, expiresAt?: string) {
    if (openingOfferRef.current === tripId) return;
    const path = pathnameRef.current;
    if (path.includes('/trip/offer')) return;
    if (/^\/trip\/[^/]+$/.test(path)) return;
    openingOfferRef.current = tripId;
    router.push({ pathname: '/trip/offer', params: { tripId, expiresAt: expiresAt ?? '' } });
  }

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      if (presenceRef.current !== 'ONLINE' && presenceRef.current !== 'IDLE') {
        if (mounted) {
          openingOfferRef.current = null;
          setIncomingTrips([]);
          setPendingOffer(null);
          setActiveDispatch(null);
        }
        return;
      }
      try {
        const incoming = await getIncomingTrips();
        if (mounted) {
          setIncomingTrips(incoming.trips);
          setPendingOffer(incoming.pendingOffer);
          setActiveDispatch(incoming.activeDispatch);
          if (incoming.activeDispatch) {
            openOfferScreen(incoming.activeDispatch.tripId, incoming.activeDispatch.expiresAt);
          } else {
            openingOfferRef.current = null;
          }
        }
      } catch { /* retry on next poll */ }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    const removeSocket = addDriverSocketListener((event, payload) => {
      if (!mounted) return;
      if (event === 'trip:requested') {
        void refresh();
        notifyImpact();
        const trip = payload as { id?: string; pickupAddress?: string; fareTotal?: number; dispatchExpiresAt?: string } | undefined;
        if (trip?.id) openOfferScreen(trip.id, trip.dispatchExpiresAt);
        void notifyRideEvent(
          'New ride request',
          trip?.pickupAddress ? `Pickup at ${trip.pickupAddress} · est. $${Number(trip.fareTotal ?? 0).toFixed(2)}` : 'A rider nearby is requesting a trip.',
          {},
        );
      } else if (event === 'trip:assigned') {
        const assignedTrip = payload as { id?: string } | undefined;
        if (assignedTrip?.id) router.push(`/trip/${assignedTrip.id}`);
      } else if (event === 'offer:rejected') {
        void refresh();
      }
    });
    void connectDriverSocket().catch(() => { /* HTTP polling still lists incoming trips */ });
    void requestRideNotificationPermission();
    void Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
      if (!mounted || status !== 'granted') return;
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 25 },
        (location) => {
          if (presenceRef.current === 'ONLINE') {
            sendDriverLocation(location.coords.latitude, location.coords.longitude);
          }
        },
      );
    });
    return () => { mounted = false; removeSocket(); clearInterval(timer); locationSubscriptionRef.current?.remove(); disconnectDriverSocket(); };
  }, []);

  const reloadHome = useCallback(async () => {
    try {
      const driver = await getDriverProfile();
      setProfile(driver);
      if (driver?.presence) {
        presenceRef.current = driver.presence;
        setPresence(driver.presence);
      }
      if (driver?.activeTrip?.id && pathnameRef.current === '/home') {
        router.push(`/trip/${driver.activeTrip.id}`);
      }
      if (driver?.presence === 'ONLINE' || driver?.presence === 'IDLE') {
        try {
          const incoming = await getIncomingTrips();
          setIncomingTrips(incoming.trips);
          setPendingOffer(incoming.pendingOffer);
          setActiveDispatch(incoming.activeDispatch);
          if (incoming.activeDispatch) {
            openOfferScreen(incoming.activeDispatch.tripId, incoming.activeDispatch.expiresAt);
          } else {
            openingOfferRef.current = null;
          }
        } catch {
          /* poller will retry */
        }
      } else {
        openingOfferRef.current = null;
        setIncomingTrips([]);
        setPendingOffer(null);
        setActiveDispatch(null);
      }
    } catch {
      /* keep current screen */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadHome();
    }, [reloadHome]),
  );

  const { refreshing, onRefresh } = usePullToRefresh(reloadHome);

  async function togglePresence() {
    if (presenceBusy) return;
    if (presence !== 'ONLINE' && profile && !onboarding.approved) {
      Alert.alert(
        onboarding.title || 'Finish setup to go online',
        onboarding.subtitle || 'Complete the remaining steps on this screen before going online.',
      );
      return;
    }
    const next: DriverPresence = presence === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    try {
      setPresenceBusy(true);
      if (next === 'ONLINE') {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await updatePresence({ presence: next, latitude: current.coords.latitude, longitude: current.coords.longitude });
      } else {
        await updatePresence({ presence: next });
      }
      presenceRef.current = next;
      setPresence(next);
      lightImpact();
      if (next === 'ONLINE') {
        const incoming = await getIncomingTrips();
        setIncomingTrips(incoming.trips);
        setPendingOffer(incoming.pendingOffer);
        setActiveDispatch(incoming.activeDispatch);
        if (incoming.activeDispatch) {
          openOfferScreen(incoming.activeDispatch.tripId, incoming.activeDispatch.expiresAt);
        } else {
          openingOfferRef.current = null;
        }
      } else {
        openingOfferRef.current = null;
        setIncomingTrips([]);
        setPendingOffer(null);
        setActiveDispatch(null);
      }
    } catch (error: any) {
      Alert.alert(
        next === 'ONLINE' ? 'Could not go online' : 'Could not go offline',
        error?.response?.data?.message ?? 'Please try again.',
      );
    } finally {
      setPresenceBusy(false);
    }
  }

  async function submitOffer(trip: IncomingTrip) {
    if (offeringTripId) return;
    const fare = Number(offerFare[trip.id] ?? trip.fareTotal);
    const minFare = trip.minFare ?? 0;
    if (!Number.isFinite(fare) || fare <= 0) {
      Alert.alert('Invalid offer', 'Enter a fare greater than zero.');
      return;
    }
    if (fare < minFare) {
      Alert.alert('Offer too low', `The minimum fare for this trip is $${minFare.toFixed(2)}.`);
      return;
    }
    if (fare > trip.fareTotal * 2) {
      Alert.alert('Offer too high', 'You can offer up to double the suggested fare.');
      return;
    }
    try {
      setOfferingTripId(trip.id);
      await createTripOffer(trip.id, fare, Math.max(1, Math.ceil(trip.durationMin / 3)));
      lightImpact();
      const incoming = await getIncomingTrips();
      setIncomingTrips(incoming.trips);
      setPendingOffer(incoming.pendingOffer);
      setActiveDispatch(incoming.activeDispatch);
    } catch (error: any) {
      Alert.alert('Could not send offer', error?.response?.data?.message ?? 'Please try again.');
    }
    finally { setOfferingTripId(null); }
  }

  return (
    <TabScreen style={[styles.safeArea, { backgroundColor: brand.canvas }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.scrollHost} collapsable={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={<PullRefresh refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Image
            source={{ uri: 'https://ik.imagekit.io/lexy/Eve/logo.png' }}
            style={{ width: 60, height: 60, marginRight: 'auto' }}
          />
        </View>

        <View style={styles.requestSection}>
          {/* <Text style={styles.presenceLabel}>
            {presence === 'ONLINE' || presence === 'IDLE' ? 'You are online' : 'You are offline'}
          </Text> */}
        </View>
        {pendingOffer ? (
          <View style={styles.requestSection}>
            <Text style={styles.sectionTitle}>Waiting for match</Text>
            <View style={styles.requestCard}>
              <Text style={styles.requestTitle}>
                {pendingOffer.rideType === 'COURIER' ? 'Courier · ' : ''}
                {pendingOffer.riderName}
              </Text>
              {pendingOffer.recipientName ? (
                <Text style={styles.requestRoute}>
                  {pendingOffer.rideType === 'COURIER'
                    ? `Deliver to ${pendingOffer.recipientName}`
                    : `Passenger: ${pendingOffer.recipientName}`}
                </Text>
              ) : null}
              <Text style={styles.requestRoute}>{pendingOffer.pickupAddress}</Text>
              <Text style={styles.requestRoute}>to {pendingOffer.dropoffAddress}</Text>
              <Text style={styles.requestMeta}>
                Offered ${Number(pendingOffer.proposedFare).toFixed(2)} · you can only wait on one match at a time
              </Text>
            </View>
          </View>
        ) : incomingTrips.length > 0 && !activeDispatch ? (
          <View style={styles.requestSection}>
            <Text style={styles.sectionTitle}>Ride requests nearby</Text>
            {incomingTrips.map((trip) => (
              <View style={styles.requestCard} key={trip.id}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestTitle}>
                    {trip.rideType === 'COURIER' ? 'Courier · ' : ''}
                    {trip.riderName}
                  </Text>
                  <Text style={styles.requestType}>{trip.vehicleType === 'BIKE' ? 'Bike' : 'Car'}</Text>
                </View>
                {trip.recipientName ? (
                  <Text style={styles.requestRoute}>
                    {trip.rideType === 'COURIER'
                      ? `Deliver to ${trip.recipientName}`
                      : `Passenger: ${trip.recipientName}`}
                  </Text>
                ) : null}
                <Text style={styles.requestRoute}>{trip.pickupAddress}</Text>
                <Text style={styles.requestRoute}>to {trip.dropoffAddress}</Text>
                <Text style={styles.requestMeta}>{trip.distanceKm.toFixed(1)} km · suggested ${trip.fareTotal.toFixed(2)} USDC</Text>
                <View style={styles.offerRow}>
                  <TextInput
                    style={styles.offerInput}
                    placeholder={`Suggested $${trip.fareTotal.toFixed(2)} — you can go lower`}
                    keyboardType="decimal-pad"
                    value={offerFare[trip.id] ?? String(trip.fareTotal.toFixed(2))}
                    onChangeText={(value) => setOfferFare((current) => ({ ...current, [trip.id]: value }))}
                  />
                  <ActionButton
                    style={styles.offerButton}
                    textStyle={styles.offerButtonText}
                    label="Offer price"
                    loadingLabel="Sending..."
                    loading={offeringTripId === trip.id}
                    onPress={() => void submitOffer(trip)}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {onboarding.showCard ? (
          <View style={styles.setupCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{onboarding.title}</Text>
              <Text style={styles.sectionBody}>{onboarding.subtitle}</Text>
            </View>
            {onboarding.blocked ? null : (
              <View style={styles.setupList}>
                {onboarding.steps.map((step) => {
                  const row = (
                    <View style={styles.setupRow}>
                      <View style={[styles.setupCheck, step.complete && styles.setupCheckDone, step.rejected && styles.setupCheckRejected]}>
                        {step.complete ? (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        ) : (
                          <Ionicons name={step.rejected ? 'alert' : 'ellipse-outline'} size={14} color={step.rejected ? '#FFFFFF' : '#9CA3AF'} />
                        )}
                      </View>
                      <Text style={[styles.setupLabel, step.complete && styles.setupLabelDone]}>
                        {step.label}
                        {step.rejected ? ' — re-upload required' : ''}
                      </Text>
                      {!step.complete && step.href ? (
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                      ) : null}
                    </View>
                  );
                  if (!step.complete && step.href) {
                    return (
                      <TouchableOpacity
                        key={step.id}
                        activeOpacity={0.7}
                        onPress={() => router.push(step.href as Href)}
                      >
                        {row}
                      </TouchableOpacity>
                    );
                  }
                  return <View key={step.id}>{row}</View>;
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* Section: Earnings */}
        <View style={{  backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', marginBottom: 12, marginHorizontal: 16, borderRadius: 20,  }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <Text style={styles.sectionSubtitle}>
              Example hourly demand pattern
            </Text>
            <Text style={styles.sectionBody}>
              This is sample data to show typical busy hours. Real-time demand data coming soon.
            </Text>
          </View>

          <BusyHoursChart />
        </View>

        {/* Spacer so content isn't hidden behind the fixed button */}
        <View style={{ height: insets.bottom + 140 }} />
      </ScrollView>
      </View>

      {/* Fixed "Go Online" button — pinned above the bottom tab bar.
          Sits outside the ScrollView so it stays put while scrolling.
          Because this screen's content area is already sized to end where
          the tab navigator's tab bar begins, position: 'absolute' + bottom: 0
          here places it directly above the tabs without covering them. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.goOnlineWrapper,
          { paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 26 : 12) },
        ]}
      >
        {presence === 'ONLINE' ? (
          <ActionButton
            style={styles.goOfflineButton}
            compact
            loading={presenceBusy}
            accessibilityLabel="Go offline"
            onPress={() => void togglePresence()}
          >
            <MaterialCommunityIcons name="stop" size={22} color="#FFFFFF" />
          </ActionButton>
        ) : (
          <ActionButton
            style={styles.goOnlineButton}
            textStyle={styles.goOnlineText}
            label="Go Online"
            loadingLabel="Going online"
            loading={presenceBusy}
            icon={<MaterialCommunityIcons name="car" size={20} color="#FFFFFF" />}
            onPress={() => void togglePresence()}
          />
        )}
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Brand.canvas,
  },
  scrollHost: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 2,
  },
  requestSection: {
    paddingHorizontal: 16,
    // paddingTop: 12,
  },
  presenceLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  requestCard: {
    marginVertical: 10,
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
  setupCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    marginBottom: 12,
    marginHorizontal: 16,
    borderRadius: 20,
  },
  setupList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 4,
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
  },
  setupCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  setupCheckDone: {
    borderColor: '#16A34A',
    backgroundColor: '#16A34A',
  },
  setupCheckRejected: {
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  setupLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  setupLabelDone: {
    color: '#6B7280',
    fontWeight: '500',
  },
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

  // --- Fixed Go Online button ---
  goOnlineWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    // backgroundColor: 'rgba(255,255,255,0.96)',
    // borderTopWidth: 1,
    // borderTopColor: '#F0F0F0',
  },
  goOnlineButton: {
    width: '100%',
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