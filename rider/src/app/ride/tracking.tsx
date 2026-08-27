import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { connectSocket, disconnectSocket, subscribeTrip } from "@/services/socket";

export default function TrackingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!tripId) return;
    void connectSocket((event, payload) => {
      if (event !== "driver:location" || !payload || typeof payload !== "object") return;
      const location = payload as { latitude?: number; longitude?: number };
      if (typeof location.latitude === "number" && typeof location.longitude === "number") {
        setDriverLocation({ latitude: location.latitude, longitude: location.longitude });
      }
    }).then(() => subscribeTrip(tripId));
    return disconnectSocket;
  }, [tripId]);

  return (
    <View style={styles.container}>
      <View style={styles.map}>
        <View style={styles.mapRoad} />
        <View style={styles.car}><Feather name="navigation" size={17} color="#FFFFFF" /></View>
        <View style={styles.you}><View style={styles.youDot} /></View>
      </View>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.arrival}>
          <View><Text style={styles.eyebrow}>ARRIVING IN</Text><Text style={styles.time}>4 min</Text></View>
          <View style={styles.contact}><Feather name="phone" size={18} color="#15803D" /></View>
          <View style={styles.contact}><Feather name="message-circle" size={18} color="#2E4ED5" /></View>
        </View>
        <View style={styles.driverRow}>
          <View style={styles.driverAvatar}><Text style={styles.driverInitial}>A</Text></View>
          <View style={styles.driverCopy}>
            <Text style={styles.driver}>Your driver</Text>
            <Text style={styles.vehicle}>Assigned vehicle</Text>
            <Text style={styles.locationStatus}>
              {driverLocation ? `Live location ${driverLocation.latitude.toFixed(4)}, ${driverLocation.longitude.toFixed(4)}` : "Waiting for live location"}
            </Text>
          </View>
          <Text style={styles.rating}>Live</Text>
        </View>
        <Pressable style={styles.button} onPress={() => router.replace("/ride/completed")}>
          <Text style={styles.buttonText}>Complete demo ride</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8EF" },
  map: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "#DCE8E6" },
  mapRoad: { position: "absolute", width: "140%", height: 130, transform: [{ rotate: "-25deg" }], backgroundColor: "#F8FAFC", borderTopWidth: 28, borderBottomWidth: 28, borderColor: "#C8DCD4" },
  car: { alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 19, backgroundColor: "#111827", borderWidth: 4, borderColor: "#FFFFFF" },
  you: { position: "absolute", bottom: "32%", right: "28%", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 12, backgroundColor: "#2E4ED5" },
  youDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  sheet: { padding: 20, paddingBottom: 30, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "#FFFFFF" },
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
  locationStatus: { marginTop: 3, color: "#2E4ED5", fontSize: 10 },
  rating: { color: "#374151", fontSize: 12, fontWeight: "700" },
  button: { alignItems: "center", marginTop: 22, padding: 16, borderRadius: 12, backgroundColor: "#2E4ED5" },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
