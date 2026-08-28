import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export default function CompletedScreen() {
  const { dropoff, fare, net } = useLocalSearchParams<{ dropoff?: string; fare?: string; net?: string }>();
  const [rating, setRating] = useState(0);
  const amount = net ?? fare;
  const destination = dropoff ?? "your dropoff";
  const hasTrip = Boolean(dropoff || fare || net);

  useEffect(() => {
    if (!hasTrip) router.replace("/(tabs)/home");
  }, [hasTrip]);

  if (!hasTrip) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2E4ED5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.check}>
        <Feather name="check" size={34} color="#15803D" />
      </View>
      <Text style={styles.eyebrow}>TRIP COMPLETE</Text>
      <Text style={styles.title}>How was your rider?</Text>
      <Text style={styles.subtitle}>Trip to {destination} is complete.</Text>
      {amount ? (
        <View style={styles.fare}>
          <Text style={styles.fareLabel}>Matched fare (cash)</Text>
          <Text style={styles.amount}>${Number(amount).toFixed(2)}</Text>
          <Text style={styles.receipt}>Collect payment from the rider off-platform</Text>
        </View>
      ) : null}
      <Text style={styles.rateLabel}>Rate your rider</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setRating(star)} accessibilityLabel={`${star} stars`}>
            <Feather name="star" size={30} color={star <= rating ? "#F59E0B" : "#D1D5DB"} />
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.button} onPress={() => router.replace("/(tabs)/home")}>
        <Text style={styles.buttonText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 24, paddingTop: 90, backgroundColor: "#F7F8EF" },
  check: { alignItems: "center", justifyContent: "center", width: 72, height: 72, marginBottom: 28, borderRadius: 36, backgroundColor: "#DCFCE7" },
  eyebrow: { color: "#6B7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { marginTop: 7, color: "#111827", fontSize: 27, fontWeight: "800" },
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
