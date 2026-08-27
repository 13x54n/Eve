import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Button, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getTrips, Trip } from "@/services/trips";
import { Image } from "expo-image";

function displayStatus(status: string) {
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return status;
}

export default function RidesScreen() {
  const [filter, setFilter] = useState<"All" | "Completed" | "Cancelled">("All");
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    let mounted = true;
    void getTrips().then((result) => { if (mounted) setTrips(result); }).catch(() => { /* keep empty state on failure */ });
    return () => { mounted = false; };
  }, []);

  const visibleRides = trips.filter((trip) => filter === "All" || displayStatus(trip.status) === filter);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your trips</Text>
        </View>
        {/* <Pressable style={styles.iconButton} accessibilityLabel="Settings"><Feather name="settings" size={20} color="#111827" /></Pressable> */}
      </View>

      <View style={styles.monthRow}><Text style={styles.sectionTitle}>Upcoming</Text></View>

      <View style={{ marginBottom: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, paddingHorizontal: 16, paddingBottom: 8 }}>

        <View >
          <Text style={styles.sectionTitle}>No upcoming rides.</Text>
          <Text style={{ color: "#2e4ed2", textDecorationLine: "underline", fontWeight: "bold" }}>Reserve your ride</Text>
        </View>

        <Image source={{ uri: "https://images.unsplash.com/vector-1738924826826-dcfeb80c5ef4?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" }} style={{ width: "100%", height: 62, borderRadius: 16 }} contentFit="contain" />
      </View>
      <View style={styles.monthRow}><Text style={styles.sectionTitle}>Recent activity</Text><Text style={styles.count}>{visibleRides.length} rides</Text></View>

      <View style={styles.filterRow}>
        {(["All", "Completed", "Cancelled"] as const).map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}

        {/* <Pressable style={styles.iconButton} accessibilityLabel="Search rides"><Feather name="search" size={20} color="#111827" /></Pressable> */}

      </View>
      {visibleRides.map((trip) => {
        const status = displayStatus(trip.status);
        return (
          <Pressable key={trip.id} style={styles.rideCard} onPress={() => router.push("/ride/completed")}>
            <View style={styles.rideHeader}>
              <View style={[styles.statusIcon, { backgroundColor: status === "Cancelled" ? "#FEE2E2" : "#DCFCE7" }]}><Feather name={status === "Cancelled" ? "x" : "check"} size={16} color={status === "Cancelled" ? "#B91C1C" : "#15803D"} /></View>
              <View style={styles.rideMeta}>
                <Text style={styles.date}>
                  {trip.dropoffAddress}
                </Text>
                <Text style={styles.status}>{status}</Text>
            <Text style={styles.place}>{new Date(trip.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
              </View>
              <Text style={styles.price}>${trip.fareTotal.toFixed(2)}</Text>
            </View>
          </Pressable>
        );
      })}
      {visibleRides.length === 0 && <Text style={styles.empty}>No rides in this filter.</Text>}
      <Pressable style={styles.bookButton} onPress={() => router.push("/(tabs)/home")}><Feather name="plus" size={18} color="#FFFFFF" /><Text style={styles.bookText}>Book a new ride</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 56, backgroundColor: "#F7F8EF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  eyebrow: { color: "#6B7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { marginTop: 4, color: "#111827", fontSize: 30, fontWeight: "800" },
  iconButton: { alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 28 },
  filter: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 20, backgroundColor: "#E5E7EB" },
  filterActive: { backgroundColor: "#111827" },
  filterText: { color: "#6B7280", fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: "#FFFFFF" },
  monthRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "700" },
  count: { color: "#6B7280", fontSize: 13 },
  rideCard: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 12 },
  rideHeader: { flexDirection: "row", alignItems: "center" },
  statusIcon: { alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 17 },
  rideMeta: { flex: 1, marginLeft: 10 },
  date: { color: "#111827", fontSize: 13, fontWeight: "700" },
  status: { marginTop: 3, color: "#6B7280", fontSize: 12 },
  price: { color: "#111827", fontSize: 15, fontWeight: "800" },
  route: { flexDirection: "row", marginTop: 14, marginLeft: 9 },
  routeDots: { alignItems: "center", width: 10, paddingTop: 5 },
  startDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2E4ED5" },
  routeLine: { width: 1, height: 34, backgroundColor: "#D1D5DB" },
  endDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: "#111827" },
  places: { justifyContent: "space-between", height: 52, marginLeft: 15 },
  place: { color: "#374151", fontSize: 14 },
  receipt: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  receiptText: { color: "#2E4ED5", fontSize: 13, fontWeight: "700" },
  empty: { marginTop: 40, color: "#6B7280", textAlign: "center" },
  bookButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: "auto", padding: 16, borderRadius: 12, backgroundColor: "#2E4ED5" },
  bookText: { color: "#FFFFFF", fontWeight: "700" },
});
