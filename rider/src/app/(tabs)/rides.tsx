import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabScreen } from "@/components/tab-screen";
import { getTrips, Trip } from "@/services/trips";
import { Image } from "expo-image";
import { ActionButton } from "@/components/action-button";
import { PullRefresh, usePullToRefresh } from "@/components/pull-refresh";

function displayStatus(status: string) {
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "SEARCHING") return "Finding driver";
  if (status === "ASSIGNED" || status === "ONGOING") return "In progress";
  return status;
}

function openTrip(trip: Trip) {
  const asRecipient = trip.viewerRole === "recipient" || trip.direction === "receiving";
  if (trip.status === "SEARCHING" && !asRecipient) {
    router.push({ pathname: "/ride/searching", params: { tripId: trip.id } });
    return;
  }
  if (trip.status === "ASSIGNED" || trip.status === "ONGOING" || (trip.status === "SEARCHING" && asRecipient)) {
    router.push({ pathname: "/ride/tracking", params: { tripId: trip.id } });
    return;
  }
  router.push({ pathname: "/ride/completed", params: { tripId: trip.id } });
}

export default function RidesScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<"All" | "Completed" | "Cancelled">("All");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      setTrips(await getTrips());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { refreshing, onRefresh } = usePullToRefresh(load);

  const visibleRides = trips.filter((trip) => filter === "All" || displayStatus(trip.status) === filter);

  return (
    <TabScreen style={styles.safeArea}>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + (Platform.OS === "ios" ? 18 : 36) },
        ]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={<PullRefresh refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        <View style={styles.header}>
          <Image
            source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png?updatedAt=1787590363742" }}
            style={{ width: 66, height: 66 }}
          />
          {/* <View>
            <Text style={styles.title}>Your trips</Text>
          </View> */}
          {/* <Pressable style={styles.iconButton} accessibilityLabel="Settings"><Feather name="settings" size={20} color="#111827" /></Pressable> */}
          {/* <Image source={{ uri: "https://images.unsplash.com/vector-1738924826826-dcfeb80c5ef4?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" }} style={{ width: 42, height: 42, borderRadius: 16 }} contentFit="contain" /> */}


        </View>

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
            <Pressable key={trip.id} style={styles.rideCard} onPress={() => openTrip(trip)}>
              <View style={styles.rideHeader}>
                <View style={[styles.statusIcon, { backgroundColor: status === "Cancelled" ? "#FEE2E2" : "#DCFCE7" }]}><Feather name={status === "Cancelled" ? "x" : "check"} size={16} color={status === "Cancelled" ? "#B91C1C" : "#15803D"} /></View>
                <View style={styles.rideMeta}>
                  <Text style={styles.date}>
                    {trip.dropoffAddress}
                  </Text>
                  <Text style={styles.status}>
                    {trip.rideType === "COURIER" ? (trip.direction === "receiving" ? "Receiving · " : "Sent · ") : ""}
                    {status}
                  </Text>
                  <Text style={styles.place}>{new Date(trip.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
                </View>
                {trip.direction === "receiving" ? null : <Text style={styles.price}>${trip.fareTotal.toFixed(2)}</Text>}
              </View>
            </Pressable>
          );
        })}
        {loadError ? (
          <Pressable onPress={() => void load()}>
            <Text style={styles.empty}>Could not load trips. Tap to retry.</Text>
          </Pressable>
        ) : null}
        {!loadError && visibleRides.length === 0 ? <Text style={styles.empty}>No rides in this filter.</Text> : null}
        <ActionButton
          style={styles.bookButton}
          textStyle={styles.bookText}
          label="Book a new ride"
          onPress={() => router.push("/(tabs)/home")}
        />
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F8EF" },
  scroll: { flex: 1 },
  container: { padding:20, backgroundColor: "#F7F8EF", paddingTop: 0 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 4, justifyContent: "center" },
  eyebrow: { color: "#6B7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { color: "#111827", fontSize: 30, fontWeight: "800" },
  iconButton: { alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 28, justifyContent: "center" },
  filter: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 20, backgroundColor: "#E5E7EB" },
  filterActive: { backgroundColor: "#111827" },
  filterText: { color: "#6B7280", fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: "#FFFFFF" },
  monthRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: "#111827", fontSize: 17, fontWeight: "700" },
  count: { color: "#6B7280", fontSize: 13 },
  rideCard: { marginBottom: 12, paddingBottom: 12, backgroundColor: "#FFFFFF", padding: 12, borderRadius: 12 },
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
