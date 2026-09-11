import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getPublicCourier, type PublicCourier } from "@/services/courier";
import { useBrand } from "@/context/theme-context";
import { EveMap, EveMarker, EveRoute } from "@/components/map/eve-map";
import { useDrivingRoute } from "@/components/map/use-driving-route";

function statusLabel(status: string, rideType?: string) {
  const isCourier = rideType === "COURIER";
  if (status === "SEARCHING") return "Finding a driver";
  if (status === "ASSIGNED") return "Driver on the way";
  if (status === "ONGOING") return isCourier ? "Out for delivery" : "On the way";
  if (status === "COMPLETED") return isCourier ? "Delivered" : "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return status;
}

export default function PublicCourierTrackScreen() {
  const brand = useBrand();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const insets = useSafeAreaInsets();
  const [courier, setCourier] = useState<PublicCourier | null>(null);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setCourier(await getPublicCourier(token));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const destination = courier
    ? courier.status === "ASSIGNED"
      ? { latitude: courier.pickupLat, longitude: courier.pickupLng }
      : { latitude: courier.dropoffLat, longitude: courier.dropoffLng }
    : null;
  const { coordinates: routeCoordinates } = useDrivingRoute(courier?.driverLocation ?? null, destination);

  const styles = makeStyles(brand);

  if (!token) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>This tracking link is invalid.</Text>
      </View>
    );
  }

  if (!courier) {
    return (
      <View style={styles.loading}>
        {loadError ? (
          <>
            <Text style={styles.loadingText}>Could not load this courier.</Text>
            <Pressable style={styles.retry} onPress={() => void refresh()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={brand.accent} />
        )}
      </View>
    );
  }

  const driver = courier.driverLocation;
  const pickup = { latitude: courier.pickupLat, longitude: courier.pickupLng };
  const dropoff = { latitude: courier.dropoffLat, longitude: courier.dropoffLng };

  return (
    <View style={styles.container}>
      <EveMap
        style={styles.map}
        camera={{
          center: driver ?? pickup,
          zoom: 13,
          bounds: [pickup, dropoff, ...(driver ? [driver] : [])],
          padding: { top: 88, right: 40, bottom: 220, left: 40 },
        }}
      >
        <EveMarker id="pickup" coordinate={pickup} color="#16A34A" />
        <EveMarker id="dropoff" coordinate={dropoff} color="#DC2626" />
        {driver ? <EveMarker id="driver" coordinate={driver} color={brand.accent} /> : null}
        {routeCoordinates.length >= 2 ? <EveRoute coordinates={routeCoordinates} color={brand.accent} /> : null}
      </EveMap>
      <Pressable
        style={[styles.fab, { top: insets.top + 8 }]}
        onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
        accessibilityLabel="Close tracking"
      >
        <Feather name="x" size={20} color={brand.text} />
      </Pressable>
      <View style={[styles.card, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
        <Text style={styles.eyebrow}>{statusLabel(courier.status, courier.rideType).toUpperCase()}</Text>
        <Text style={styles.code}>{courier.bookingCode}</Text>
        {courier.recipientName ? (
          <Text style={styles.meta}>
            {courier.rideType === "COURIER" ? `Package for ${courier.recipientName}` : `Ride for ${courier.recipientName}`}
          </Text>
        ) : null}
        {courier.packageNote ? <Text style={styles.meta}>{courier.packageNote}</Text> : null}
        {courier.vehicle ? (
          <Text style={styles.meta}>
            {courier.vehicle.color} {courier.vehicle.make} {courier.vehicle.model} · {courier.vehicle.plateNumber}
          </Text>
        ) : null}
        <Text style={styles.address} numberOfLines={1}>{courier.pickupAddress}</Text>
        <Text style={styles.address} numberOfLines={1}>{courier.dropoffAddress}</Text>
      </View>
    </View>
  );
}

function makeStyles(brand: ReturnType<typeof useBrand>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: brand.canvas },
    loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: brand.canvas },
    loadingText: { color: brand.textSecondary, textAlign: "center" },
    retry: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: brand.accent },
    retryText: { color: "#FFFFFF", fontWeight: "700" },
    map: { ...StyleSheet.absoluteFill },
    fab: {
      position: "absolute",
      left: 16,
      zIndex: 2,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: brand.surface,
    },
    card: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      padding: 20,
      backgroundColor: brand.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    eyebrow: { color: brand.accent, fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
    code: { marginTop: 6, color: brand.text, fontSize: 22, fontWeight: "800" },
    meta: { marginTop: 6, color: brand.textSecondary, fontSize: 13 },
    address: { marginTop: 8, color: brand.text, fontSize: 14 },
  });
}
