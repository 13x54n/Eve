import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, UrlTile } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cancelTrip, getTrip, Trip } from "@/services/trips";
import { connectSocket, disconnectSocket, subscribeTrip } from "@/services/socket";

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const STATUS_EVENTS = ["trip:assigned", "trip:started", "trip:completed", "trip:cancelled", "driver:arrived"];

export default function TrackingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<MapView | null>(null);

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
    } else if (next.status === "SEARCHING") {
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

  useEffect(() => {
    if (!tripId) return;
    let mounted = true;
    void connectSocket((event, payload) => {
      if (!mounted) return;
      if (event === "driver:location" && payload && typeof payload === "object") {
        const location = payload as { latitude?: number; longitude?: number };
        if (typeof location.latitude === "number" && typeof location.longitude === "number") {
          setDriverLocation({ latitude: location.latitude, longitude: location.longitude });
        }
        return;
      }
      if (STATUS_EVENTS.includes(event)) void refresh();
    }).then(() => subscribeTrip(tripId)).catch(() => { /* HTTP poll still loads the trip */ });
    void refresh(true);
    const timer = setInterval(() => void refresh(), 4000);
    return () => { mounted = false; clearInterval(timer); disconnectSocket(); };
  }, [refresh, tripId]);

  useEffect(() => {
    if (!trip || !mapRef.current) return;
    const headingToPickup = trip.status === "ASSIGNED";
    const dest = headingToPickup
      ? { latitude: trip.pickupLat, longitude: trip.pickupLng }
      : { latitude: trip.dropoffLat, longitude: trip.dropoffLng };
    const points = [...(driverLocation ? [driverLocation] : []), dest];
    if (points.length === 1) {
      mapRef.current.animateToRegion({ ...points[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
      return;
    }
    mapRef.current.fitToCoordinates(points, {
      edgePadding: { top: 88, right: 48, bottom: 280, left: 48 },
      animated: true,
    });
  }, [driverLocation, trip]);

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
            <ActivityIndicator size="large" color="#2E4ED5" />
            <Text style={styles.loadingText}>Loading trip...</Text>
          </>
        )}
      </View>
    );
  }

  const headingToPickup = trip.status === "ASSIGNED";
  const destination = headingToPickup
    ? { latitude: trip.pickupLat, longitude: trip.pickupLng }
    : { latitude: trip.dropoffLat, longitude: trip.dropoffLng };
  const driverName = trip.driver?.user?.name ?? "Your driver";
  const vehicleLabel = trip.vehicle
    ? `${trip.vehicle.make} ${trip.vehicle.model}`
    : "Assigned vehicle";
  const plate = trip.vehicle?.plateNumber;
  const stageLabel = headingToPickup ? "Meet at pickup" : "On the way to dropoff";
  const etaLabel = `${Math.max(1, trip.durationMin)} min`;
  const initialRegion = {
    latitude: driverLocation?.latitude ?? trip.pickupLat,
    longitude: driverLocation?.longitude ?? trip.pickupLng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} provider={PROVIDER_DEFAULT} style={styles.map} initialRegion={initialRegion}>
        <UrlTile urlTemplate={OSM_TILES} maximumZ={19} flipY={false} />
        {driverLocation ? <Marker coordinate={driverLocation} pinColor="#2E4ED5" title="Driver" /> : null}
        <Marker coordinate={{ latitude: trip.pickupLat, longitude: trip.pickupLng }} pinColor="#16A34A" title="Pickup" />
        <Marker coordinate={{ latitude: trip.dropoffLat, longitude: trip.dropoffLng }} pinColor="#DC2626" title="Dropoff" />
        {driverLocation ? (
          <Polyline coordinates={[driverLocation, destination]} strokeColor="#2E4ED5" strokeWidth={4} />
        ) : null}
      </MapView>

      <Pressable
        style={[styles.fab, { top: insets.top + 8 }]}
        onPress={() => router.replace("/(tabs)/home")}
        accessibilityLabel="Back home"
      >
        <Feather name="chevron-down" size={22} color="#111827" />
      </Pressable>

      <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
        <View style={styles.handle} />
        <View style={styles.arrival}>
          <View style={styles.arrivalCopy}>
            <Text style={styles.eyebrow}>{stageLabel.toUpperCase()}</Text>
            <Text style={styles.time}>{etaLabel}</Text>
          </View>
          {trip.driver?.user?.phone ? (
            <Pressable style={styles.contact} onPress={() => void Linking.openURL(`tel:${trip.driver?.user?.phone}`)}>
              <Feather name="phone" size={18} color="#15803D" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.driverRow}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverInitial}>{driverName[0]?.toUpperCase() ?? "?"}</Text>
          </View>
          <View style={styles.driverCopy}>
            <Text style={styles.driver}>{driverName}</Text>
            <Text style={styles.vehicle}>{vehicleLabel}</Text>
            <Text style={styles.fare}>Cash · ${Number(trip.fareTotal).toFixed(2)}</Text>
          </View>
          {plate ? <Text style={styles.plate}>{plate}</Text> : null}
          {trip.driver?.rating != null ? (
            <Text style={styles.rating}>★ {Number(trip.driver.rating).toFixed(1)}</Text>
          ) : null}
        </View>
        <View style={styles.addressRow}>
          <View style={[styles.addressDot, { backgroundColor: "#16A34A" }]} />
          <Text style={styles.addressText} numberOfLines={1}>{trip.pickupAddress}</Text>
        </View>
        <View style={styles.addressRow}>
          <View style={[styles.addressDot, { backgroundColor: "#DC2626" }]} />
          <Text style={styles.addressText} numberOfLines={1}>{trip.dropoffAddress}</Text>
        </View>
        {trip.status === "ASSIGNED" || trip.status === "ONGOING" ? (
          <Pressable style={styles.cancel} onPress={handleCancel} disabled={busy}>
            <Text style={styles.cancelText}>{busy ? "Cancelling..." : "Cancel trip"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8EF" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: "#F7F8EF" },
  loadingText: { color: "#6B7280", fontSize: 13, textAlign: "center" },
  retry: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: "#2E4ED5" },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
  homeLink: { color: "#2E4ED5", fontWeight: "700", marginTop: 8 },
  map: { ...StyleSheet.absoluteFill },
  fab: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  handle: { alignSelf: "center", width: 38, height: 4, marginBottom: 16, borderRadius: 2, backgroundColor: "#D1D5DB" },
  arrival: { flexDirection: "row", alignItems: "center" },
  arrivalCopy: { flex: 1 },
  eyebrow: { color: "#6B7280", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  time: { marginTop: 3, color: "#111827", fontSize: 24, fontWeight: "800" },
  contact: { alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 21, backgroundColor: "#ECFDF5" },
  driverRow: { flexDirection: "row", alignItems: "center", marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  driverAvatar: { alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 23, backgroundColor: "#FDE68A" },
  driverInitial: { color: "#111827", fontSize: 18, fontWeight: "800" },
  driverCopy: { flex: 1, marginLeft: 12 },
  driver: { color: "#111827", fontWeight: "800" },
  vehicle: { marginTop: 4, color: "#6B7280", fontSize: 12 },
  fare: { marginTop: 3, color: "#374151", fontSize: 12 },
  plate: { marginRight: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: "#F3F4F6", color: "#111827", fontSize: 12, fontWeight: "800" },
  rating: { color: "#374151", fontSize: 12, fontWeight: "700" },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  addressDot: { width: 8, height: 8, borderRadius: 4 },
  addressText: { flex: 1, color: "#374151", fontSize: 13 },
  cancel: { alignItems: "center", marginTop: 18, padding: 8 },
  cancelText: { color: "#B91C1C", fontWeight: "700", fontSize: 13 },
});
