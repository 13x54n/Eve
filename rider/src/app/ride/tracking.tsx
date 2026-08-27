import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, UrlTile } from "react-native-maps";
import { cancelTrip, getTrip, Trip } from "@/services/trips";
import { connectSocket, disconnectSocket, subscribeTrip } from "@/services/socket";

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const STATUS_EVENTS = ["trip:assigned", "trip:started", "trip:completed", "trip:cancelled", "driver:arrived"];

export default function TrackingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const mapRef = useRef<MapView | null>(null);

  const applyTrip = useCallback((next: Trip) => {
    setTrip(next);
    if (typeof next.driver?.latitude === "number" && typeof next.driver?.longitude === "number") {
      setDriverLocation((current) => current ?? {
        latitude: next.driver!.latitude!,
        longitude: next.driver!.longitude!,
      });
    }
    if (next.status === "COMPLETED") {
      router.replace("/ride/completed");
    } else if (next.status === "CANCELLED") {
      router.replace("/(tabs)/home");
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    try {
      applyTrip(await getTrip(tripId));
    } catch { /* keep last known trip */ }
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
    void refresh();
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
      edgePadding: { top: 48, right: 48, bottom: 120, left: 48 },
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

  if (!trip) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2E4ED5" />
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  const headingToPickup = trip.status === "ASSIGNED";
  const destination = headingToPickup
    ? { latitude: trip.pickupLat, longitude: trip.pickupLng }
    : { latitude: trip.dropoffLat, longitude: trip.dropoffLng };
  const driverName = trip.driver?.user?.name ?? "Your driver";
  const vehicleLabel = trip.vehicle
    ? `${trip.vehicle.make} ${trip.vehicle.model} · ${trip.vehicle.plateNumber}`
    : "Assigned vehicle";
  const stageLabel = headingToPickup ? "Heading to you" : "On the way";
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
          <Polyline
            coordinates={[driverLocation, destination]}
            strokeColor="#2E4ED5"
            strokeWidth={4}
          />
        ) : null}
      </MapView>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.arrival}>
          <View>
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
          <Pressable style={styles.button} onPress={handleCancel} disabled={busy}>
            <Text style={styles.buttonText}>{busy ? "Cancelling..." : "Cancel trip"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8EF" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#F7F8EF" },
  loadingText: { color: "#6B7280", fontSize: 13 },
  map: { flex: 1 },
  sheet: { padding: 20, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, backgroundColor: "#FFFFFF" },
  handle: { alignSelf: "center", width: 38, height: 4, marginBottom: 20, borderRadius: 2, backgroundColor: "#D1D5DB" },
  arrival: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { color: "#6B7280", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  time: { marginTop: 3, color: "#111827", fontSize: 24, fontWeight: "800" },
  contact: { alignItems: "center", justifyContent: "center", width: 42, height: 42, marginLeft: "auto", borderRadius: 21, backgroundColor: "#ECFDF5" },
  driverRow: { flexDirection: "row", alignItems: "center", marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  driverAvatar: { alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: 23, backgroundColor: "#FDE68A" },
  driverInitial: { color: "#111827", fontSize: 18, fontWeight: "800" },
  driverCopy: { flex: 1, marginLeft: 12 },
  driver: { color: "#111827", fontWeight: "800" },
  vehicle: { marginTop: 4, color: "#6B7280", fontSize: 12 },
  fare: { marginTop: 3, color: "#374151", fontSize: 12 },
  rating: { color: "#374151", fontSize: 12, fontWeight: "700" },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  addressDot: { width: 8, height: 8, borderRadius: 4 },
  addressText: { flex: 1, color: "#374151", fontSize: 13 },
  button: { alignItems: "center", marginTop: 22, padding: 16, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#FECACA" },
  buttonText: { color: "#B91C1C", fontWeight: "700", fontSize: 16 },
});
