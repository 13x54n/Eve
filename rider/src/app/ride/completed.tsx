import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { getTrip, Trip } from "@/services/trips";

export default function CompletedScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const [rating, setRating] = useState(0);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      router.replace("/(tabs)/home");
      return;
    }
    let mounted = true;
    void getTrip(tripId)
      .then((next) => { if (mounted) setTrip(next); })
      .catch(() => { /* show generic copy */ })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [tripId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2E4ED5" />
      </View>
    );
  }

  const cancelled = trip?.status === "CANCELLED";
  const destination = trip?.dropoffAddress ?? "your destination";
  const fare = trip ? Number(trip.fareTotal).toFixed(2) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.check, cancelled && styles.checkCancelled]}>
        <Feather name={cancelled ? "x" : "check"} size={34} color={cancelled ? "#B91C1C" : "#15803D"} />
      </View>
      <Text style={styles.eyebrow}>{cancelled ? "TRIP CANCELLED" : "TRIP COMPLETE"}</Text>
      <Text style={styles.title}>{cancelled ? "This trip was cancelled" : "How was your ride?"}</Text>
      <Text style={styles.subtitle}>
        {cancelled ? "No cash is due for this trip." : `Your trip to ${destination} is complete.`}
      </Text>
      {!cancelled && fare ? (
        <View style={styles.fare}>
          <Text style={styles.fareLabel}>Amount due in cash</Text>
          <Text style={styles.amount}>${fare}</Text>
          <Text style={styles.receipt}>Pay your driver directly</Text>
        </View>
      ) : null}
      {!cancelled ? (
        <>
          <Text style={styles.rateLabel}>Rate your driver</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)} accessibilityLabel={`${star} stars`}>
                <Feather name="star" size={30} color={star <= rating ? "#F59E0B" : "#D1D5DB"} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <Pressable style={styles.button} onPress={() => router.replace("/(tabs)/home")}>
        <Text style={styles.buttonText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 24, paddingTop: 90, backgroundColor: "#F7F8EF" },
  check: { alignItems: "center", justifyContent: "center", width: 72, height: 72, marginBottom: 28, borderRadius: 36, backgroundColor: "#DCFCE7" },
  checkCancelled: { backgroundColor: "#FEE2E2" },
  eyebrow: { color: "#6B7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { marginTop: 7, color: "#111827", fontSize: 27, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 9, color: "#6B7280", textAlign: "center" },
  fare: { alignItems: "center", width: "100%", marginTop: 32, padding: 20, borderRadius: 16, backgroundColor: "#FFFFFF" },
  fareLabel: { color: "#6B7280", fontSize: 12 },
  amount: { marginTop: 5, color: "#111827", fontSize: 30, fontWeight: "800" },
  receipt: { marginTop: 5, color: "#6B7280", fontSize: 12 },
  rateLabel: { marginTop: 30, color: "#374151", fontWeight: "700" },
  stars: { flexDirection: "row", gap: 12, marginTop: 14 },
  button: { position: "absolute", bottom: 38, left: 24, right: 24, alignItems: "center", padding: 16, borderRadius: 12, backgroundColor: "#2E4ED5" },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
