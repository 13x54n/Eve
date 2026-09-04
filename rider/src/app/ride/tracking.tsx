import Feather from "@expo/vector-icons/Feather";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ExpoLinking from "expo-linking";
import { cancelTrip, getTrip, getTripMessages, addTripStop, updateTripDestination, Trip } from "@/services/trips";
import { MapLocationPicker } from "@/components/map-location-picker";
import { addSocketListener, connectSocket, subscribeTrip } from "@/services/socket";
import { useAuth } from "@/context/auth-context";
import { Brand } from "@/constants/theme";
import { ActionButton } from "@/components/action-button";
import { EveMap, EveMarker, EveRoute } from "@/components/map/eve-map";
import { useDrivingRoute } from "@/components/map/use-driving-route";

const STATUS_EVENTS = ["trip:assigned", "trip:started", "trip:completed", "trip:cancelled", "driver:arrived", "trip:route_updated"];
const MAP_BOTTOM_INSET = 360;

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

export default function TrackingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [routeEdit, setRouteEdit] = useState<"stop" | "dropoff" | null>(null);

  const applyTrip = useCallback((next: Trip) => {
    setLoadError(false);
    setTrip(next);
    if (typeof next.driver?.latitude === "number" && typeof next.driver?.longitude === "number") {
      setDriverLocation((current) => current ?? {
        latitude: next.driver!.latitude!,
        longitude: next.driver!.longitude!,
      });
    }
    if (next.status === "COMPLETED") {
      router.replace({ pathname: "/ride/completed", params: { tripId: next.id } });
    } else if (next.status === "CANCELLED") {
      router.replace("/(tabs)/home");
    } else if (next.status === "SEARCHING" && next.viewerRole !== "recipient") {
      router.replace({ pathname: "/ride/searching", params: { tripId: next.id } });
    }
  }, []);

  const refresh = useCallback(async (isFirst = false) => {
    if (!tripId) return;
    try {
      applyTrip(await getTrip(tripId));
    } catch {
      if (isFirst) setLoadError(true);
    }
  }, [applyTrip, tripId]);

  const refreshUnread = useCallback(async () => {
    if (!tripId || !user?.id) return;
    if (trip?.viewerRole === "recipient") return;
    try {
      const messages = await getTripMessages(tripId);
      setUnreadCount(messages.filter((row) => row.authorId !== user.id && !row.readAt).length);
    } catch {
      /* keep last count */
    }
  }, [tripId, user?.id, trip?.viewerRole]);

  useFocusEffect(
    useCallback(() => {
      void refreshUnread();
    }, [refreshUnread]),
  );

  useEffect(() => {
    if (!tripId) return;
    let mounted = true;
    void connectSocket().then(() => subscribeTrip(tripId)).catch(() => { /* HTTP poll still loads the trip */ });
    const remove = addSocketListener((event, payload) => {
      if (!mounted) return;
      if (event === "driver:location" && payload && typeof payload === "object") {
        const location = payload as { latitude?: number; longitude?: number };
        if (typeof location.latitude === "number" && typeof location.longitude === "number") {
          setDriverLocation({ latitude: location.latitude, longitude: location.longitude });
        }
        return;
      }
      if (event === "trip:message" && payload && typeof payload === "object") {
        const message = payload as { tripId?: string; authorId?: string };
        if (message.tripId === tripId && message.authorId && message.authorId !== user?.id) {
          setUnreadCount((current) => current + 1);
        }
        return;
      }
      if (STATUS_EVENTS.includes(event)) void refresh();
    });
    void refresh(true);
    const timer = setInterval(() => void refresh(), 4000);
    return () => { mounted = false; clearInterval(timer); remove(); };
  }, [refresh, tripId, user?.id]);

  const destination = trip
    ? trip.status === "ASSIGNED"
      ? { latitude: trip.pickupLat, longitude: trip.pickupLng }
      : { latitude: trip.dropoffLat, longitude: trip.dropoffLng }
    : null;
  const { coordinates: routeCoordinates, durationMin: routeDurationMin } = useDrivingRoute(driverLocation, destination);

  function handleCancel() {
    if (!tripId) return;
    Alert.alert("Cancel trip", "Are you sure you want to cancel this trip?", [
      { text: "Keep trip", style: "cancel" },
      {
        text: "Cancel trip",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              setBusy(true);
              await cancelTrip(tripId);
              router.replace("/(tabs)/home");
            } catch {
              Alert.alert("Could not cancel trip", "Please try again.");
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  async function confirmRouteEdit(location: { latitude: number; longitude: number; label: string }) {
    if (!trip) return;
    const point = {
      address: location.label || "Selected location",
      lat: location.latitude,
      lng: location.longitude,
    };
    try {
      setBusy(true);
      if (routeEdit === "stop" && trip.rideType === "COURIER") {
        Alert.alert("Stops not available", "Courier deliveries can only change the dropoff.");
        setRouteEdit(null);
        return;
      }
      const next = routeEdit === "stop"
        ? await addTripStop(trip.id, point)
        : await updateTripDestination(trip.id, point);
      applyTrip(next);
      setRouteEdit(null);
    } catch (error: unknown) {
      const message = error && typeof error === "object" && "response" in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      Alert.alert("Could not update route", message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!tripId) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>This trip is no longer available.</Text>
        <Pressable style={styles.retry} onPress={() => router.replace("/(tabs)/home")}>
          <Text style={styles.retryText}>Back home</Text>
        </Pressable>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.loading}>
        {loadError ? (
          <>
            <Text style={styles.loadingText}>Could not load this trip.</Text>
            <Pressable style={styles.retry} onPress={() => { setLoadError(false); void refresh(true); }}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
            <Pressable onPress={() => router.replace("/(tabs)/home")}>
              <Text style={styles.homeLink}>Back home</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={Brand.accent} />
            <Text style={styles.loadingText}>Loading trip...</Text>
          </>
        )}
      </View>
    );
  }

  const isCourier = trip.rideType === "COURIER";
  const isRecipient = trip.viewerRole === "recipient";
  const canManage = trip.canManage !== false;
  const headingToPickup = trip.status === "ASSIGNED";
  const driverName = trip.driver?.user?.name ?? (trip.status === "SEARCHING" ? "Finding a driver" : "Your driver");
  const vehicleLabel = trip.vehicle
    ? `${trip.vehicle.make} ${trip.vehicle.model}`
    : isCourier
      ? "Courier delivery"
      : "Assigned vehicle";
  const plate = trip.vehicle?.plateNumber;
  const stageLabel = trip.status === "SEARCHING"
    ? (isCourier ? "Finding a courier driver" : "Finding your driver")
    : headingToPickup
      ? (isCourier ? "Pickup package" : "Meet at pickup")
      : (isCourier ? `Delivering to ${trip.recipientName ?? "recipient"}` : "On the way to dropoff");
  const pickup = { latitude: trip.pickupLat, longitude: trip.pickupLng };
  const dropoff = { latitude: trip.dropoffLat, longitude: trip.dropoffLng };
  const pickupEtaMin = headingToPickup
    ? (routeDurationMin ?? fallbackDurationMin(driverLocation, pickup))
    : null;
  const dropoffEtaMin = headingToPickup
    ? (pickupEtaMin ?? 5) + Math.max(1, trip.durationMin)
    : (routeDurationMin ?? Math.max(1, trip.durationMin));
  const destEtaLabel = isCourier ? "Deliver" : "Dropoff";
  const ratingLabel = trip.driver?.rating != null ? Number(trip.driver.rating).toFixed(1) : null;
  const stops = trip.stops ?? [];
  const cameraPoints = [
    ...(driverLocation ? [driverLocation] : []),
    pickup,
    ...stops.map((stop) => ({ latitude: stop.lat, longitude: stop.lng })),
    dropoff,
  ];

  async function shareTracking() {
    const token = trip?.trackingToken;
    const code = trip?.bookingCode;
    if (!token || !code) return;
    const url = ExpoLinking.createURL(`/courier/track/${token}`);
    await Share.share({
      message: isCourier
        ? `Track this Eve courier (${code}): ${url}`
        : `Track this Eve ride (${code}): ${url}`,
      url,
    });
  }

  return (
    <View style={styles.container}>
      <EveMap
        style={styles.map}
        camera={{
          center: driverLocation ?? pickup,
          zoom: 13,
          bounds: cameraPoints,
          padding: { top: 88, right: 48, bottom: MAP_BOTTOM_INSET, left: 48 },
        }}
      >
        {driverLocation ? <EveMarker id="driver" coordinate={driverLocation} color={Brand.accent} title="Driver" /> : null}
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
        {routeCoordinates.length >= 2 ? (
          <EveRoute coordinates={routeCoordinates} color={Brand.accent} />
        ) : null}
      </EveMap>

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.card, { paddingBottom: Math.max(20, insets.bottom + 10) }]} pointerEvents="auto">
          {/* <View style={styles.handle} /> */}
          <View style={styles.statusRow}>
            <Text style={styles.eyebrow}>{stageLabel.toUpperCase()}</Text>
            <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverInitial}>{driverName[0]?.toUpperCase() ?? "?"}</Text>
            </View>
            <View style={styles.driverCopy}>
              <View style={styles.driverNameRow}>
                <Text style={styles.driver} numberOfLines={1}>{driverName}</Text>
                {ratingLabel ? <Text style={styles.rating}>★ {ratingLabel}</Text> : null}
              </View>
              <Text style={styles.vehicle} numberOfLines={1}>{vehicleLabel}</Text>
              {isRecipient ? null : <Text style={styles.fare}>Cash · ${Number(trip.fareTotal).toFixed(2)}</Text>}
              {trip.recipientName ? (
                <Text style={styles.fare}>
                  {isCourier ? `To ${trip.recipientName}` : `Passenger: ${trip.recipientName}`}
                </Text>
              ) : null}
            </View>
            {plate ? <Text style={styles.plate}>{plate}</Text> : null}
          </View>
            <View style={styles.etaRow}>
              {headingToPickup && pickupEtaMin != null ? (
                <View style={styles.etaItem}>
                  <Text style={styles.etaCaption}>Pickup</Text>
                  <Text style={styles.time}>{pickupEtaMin} min</Text>
                </View>
              ) : null}
              <View style={styles.etaItem}>
                <Text style={styles.etaCaption}>{destEtaLabel}</Text>
                <Text style={styles.time}>{dropoffEtaMin} min</Text>
              </View>
            </View>
          </View>

          

          {isRecipient ? null : (
          <View style={styles.actions}>
            <Pressable
              style={[styles.action, !trip.driver?.user?.phone && styles.actionDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Call driver"
              onPress={() => {
                if (!trip.driver?.user?.phone) {
                  Alert.alert("No phone on file", "This driver has not added a phone number yet.");
                  return;
                }
                void Linking.openURL(`tel:${trip.driver.user.phone}`);
              }}
            >
              <Feather name="phone" size={18} color="#15803D" />
              <Text style={styles.actionText}>Call</Text>
            </Pressable>
            <Pressable
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `Chat, ${unreadCount} unread` : "Chat"}
              onPress={() => router.push({ pathname: "/ride/chat", params: { tripId: trip.id } })}
            >
              <View style={styles.actionIcon}>
                <Feather name="message-circle" size={18} color={Brand.accent} />
                {unreadCount > 0 ? (
                  <View style={styles.badge}>
                    {unreadCount > 1 ? (
                      <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <Text style={styles.actionText}>Chat</Text>
            </Pressable>
            <Pressable
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel="Help"
              onPress={() => router.push({ pathname: "/ride/support", params: { tripId: trip.id } })}
            >
              <Feather name="help-circle" size={18} color="#B45309" />
              <Text style={styles.actionText}>Help</Text>
            </Pressable>
          </View>
          )}

          {trip.trackingToken && canManage ? (
            <Pressable style={styles.share} onPress={() => void shareTracking()}>
              <Feather name="share-2" size={16} color={Brand.accent} />
              <Text style={styles.shareText}>{isCourier ? "Share tracking with recipient" : "Share with rider"}</Text>
            </Pressable>
          ) : null}

          <View style={styles.route}>
            <View style={styles.routeRail}>
              <View style={[styles.addressDot, { backgroundColor: "#16A34A" }]} />
              <View style={styles.routeLine} />
              {stops.map((stop) => (
                <View key={stop.id} style={[styles.addressDot, { backgroundColor: "#F59E0B", marginVertical: 4 }]} />
              ))}
              {stops.length > 0 ? <View style={styles.routeLine} /> : null}
              <View style={[styles.addressDot, { backgroundColor: "#DC2626" }]} />
            </View>
            <View style={styles.routeCopy}>
              <Text style={styles.addressText} numberOfLines={1}>{trip.pickupAddress}</Text>
              {stops.map((stop) => (
                <Text key={stop.id} style={styles.addressText} numberOfLines={1}>{stop.address}</Text>
              ))}
              <Text style={styles.addressText} numberOfLines={1}>{trip.dropoffAddress}</Text>
            </View>
          </View>

          {canManage && (trip.status === "ASSIGNED" || trip.status === "ONGOING") ? (
            <View style={styles.routeActions}>
              {!isCourier && stops.length < 3 ? (
                <Pressable style={styles.routeAction} onPress={() => setRouteEdit("stop")}>
                  <Text style={styles.routeActionText}>Add stop</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.routeAction} onPress={() => setRouteEdit("dropoff")}>
                <Text style={styles.routeActionText}>Change dropoff</Text>
              </Pressable>
            </View>
          ) : null}

          {canManage && (trip.status === "ASSIGNED" || trip.status === "ONGOING") ? (
            <ActionButton
              style={styles.cancel}
              textStyle={styles.cancelText}
              label="Cancel trip"
              loadingLabel="Cancelling..."
              loading={busy}
              spinnerColor={Brand.danger}
              onPress={handleCancel}
            />
          ) : null}
        </View>
      </View>

      <MapLocationPicker
        visible={routeEdit != null}
        initial={dropoff}
        title={routeEdit === "stop" ? "Add a stop" : "Change dropoff"}
        hint={routeEdit === "stop" ? "Choose a stop before dropoff." : "Choose a new dropoff."}
        onClose={() => setRouteEdit(null)}
        onConfirm={(location) => void confirmRouteEdit(location)}
      />

      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.canvas },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: Brand.canvas },
  loadingText: { color: Brand.textSecondary, fontSize: 13, textAlign: "center" },
  retry: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: Brand.accent },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
  homeLink: { color: Brand.accent, fontWeight: "700", marginTop: 8 },
  map: { ...StyleSheet.absoluteFill },
  fab: {
    position: "absolute",
    left: 16,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Brand.surface,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
  },
  card: {
    paddingHorizontal: 30,
    paddingTop: 20,
    backgroundColor: Brand.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    marginBottom: 14,
    borderRadius: 2,
    backgroundColor: Brand.border,
  },
  statusRow: {
    gap: 8,
  },
  eyebrow: { color: Brand.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1, textAlign: "center" },
  etaRow: { flexDirection: "row", alignItems: "flex-end", gap: 20 },
  etaItem: { minWidth: 88 },
  etaCaption: { color: Brand.textSecondary, fontSize: 11, fontWeight: "700" },
  time: { color: Brand.text, fontSize: 26, fontWeight: "800" },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
  },
  driverAvatar: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FDE68A",
  },
  driverInitial: { color: Brand.text, fontSize: 18, fontWeight: "800" },
  driverCopy: { flex: 1, marginLeft: 12, marginRight: 8, minWidth: 0 },
  driverNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  driver: { color: Brand.text, fontWeight: "800", flexShrink: 1 },
  vehicle: { marginTop: 4, color: Brand.textSecondary, fontSize: 12 },
  fare: { marginTop: 3, color: Brand.text, fontSize: 12 },
  plate: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Brand.border,
    color: Brand.text,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
  },
  rating: { color: Brand.textSecondary, fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  action: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Brand.border,
  },
  actionDisabled: { opacity: 0.55 },
  actionIcon: { position: "relative" },
  actionText: { color: Brand.text, fontSize: 12, fontWeight: "700" },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  route: { flexDirection: "row", marginTop: 16, gap: 12 },
  routeRail: { alignItems: "center", paddingTop: 5, paddingBottom: 5 },
  routeLine: { width: 2, flex: 1, marginVertical: 4, backgroundColor: Brand.border },
  routeCopy: { flex: 1, minWidth: 0, justifyContent: "space-between", gap: 14 },
  addressDot: { width: 8, height: 8, borderRadius: 4 },
  addressText: { color: Brand.text, fontSize: 13 },
  cancel: { alignItems: "center", marginTop: 8, minHeight: 44, paddingVertical: 8, backgroundColor: Brand.danger },
  routeActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  routeAction: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Brand.border,
  },
  routeActionText: { color: Brand.accent, fontWeight: "700", fontSize: 13 },
  share: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, paddingVertical: 10 },
  shareText: { color: Brand.accent, fontWeight: "700", fontSize: 13 },
  cancelText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
});
