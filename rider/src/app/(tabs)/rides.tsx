import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const rides = [
  ["Today, 9:42 AM", "King St W", "Union Station", "$18.40", "Completed"],
  ["Yesterday, 6:18 PM", "Queen St E", "Yorkdale Mall", "$27.80", "Completed"],
  ["Aug 18, 12:05 PM", "Dufferin St", "Kensington Market", "$14.25", "Cancelled"],
] as const;

export default function RidesScreen() {
  const [filter, setFilter] = useState<"All" | "Completed" | "Cancelled">("All");
  const visibleRides = rides.filter((ride) => filter === "All" || ride[5] === filter);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>YOUR ACTIVITY</Text><Text style={styles.title}>Rides</Text></View>
        <Pressable style={styles.iconButton} accessibilityLabel="Search rides"><Feather name="search" size={20} color="#111827" /></Pressable>
      </View>
      <View style={styles.filterRow}>
        {(["All", "Completed", "Cancelled"] as const).map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.monthRow}><Text style={styles.sectionTitle}>Recent activity</Text><Text style={styles.count}>{visibleRides.length} rides</Text></View>
      {visibleRides.map((ride) => (
        <Pressable key={ride[0]} style={styles.rideCard} onPress={() => router.push("/ride/completed")}>
          <View style={styles.rideHeader}>
            <View style={[styles.statusIcon, { backgroundColor: ride[5] === "Cancelled" ? "#FEE2E2" : "#DCFCE7" }]}><Feather name={ride[5] === "Cancelled" ? "x" : "check"} size={16} color={ride[5] === "Cancelled" ? "#B91C1C" : "#15803D"} /></View>
            <View style={styles.rideMeta}><Text style={styles.date}>{ride[0]}</Text><Text style={styles.status}>{ride[5]}</Text></View>
            <Text style={styles.price}>{ride[4]}</Text>
          </View>
          <View style={styles.route}><View style={styles.routeDots}><View style={styles.startDot} /><View style={styles.routeLine} /><View style={styles.endDot} /></View><View style={styles.places}><Text style={styles.place}>{ride[1]}</Text><Text style={styles.place}>{ride[2]}</Text></View></View>
          <View style={styles.receipt}><Text style={styles.receiptText}>View receipt</Text><Feather name="chevron-right" size={16} color="#9CA3AF" /></View>
        </Pressable>
      ))}
      {visibleRides.length === 0 && <Text style={styles.empty}>No rides in this filter.</Text>}
      <Pressable style={styles.bookButton} onPress={() => router.push("/(tabs)/home")}><Feather name="plus" size={18} color="#FFFFFF" /><Text style={styles.bookText}>Book a new ride</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 36, backgroundColor: "#F7F8EF" },
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
  rideCard: { marginBottom: 12, padding: 16, borderRadius: 16, backgroundColor: "#FFFFFF" },
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
