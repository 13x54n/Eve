import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { confirmEscrow, getSettlementQuote } from "@/services/payment";
import { useSendEscrowTx } from "@/lib/send-escrow";

export default function CompletedScreen() {
  const { dropoff, fare, net, tripId } = useLocalSearchParams<{
    dropoff?: string;
    fare?: string;
    net?: string;
    tripId?: string;
  }>();
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<"settling" | "ready" | "released" | "idle">(
    tripId ? "settling" : "idle",
  );
  const [remainingSec, setRemainingSec] = useState(300);
  const sendEscrowTx = useSendEscrowTx();
  const amount = net ?? fare;
  const destination = dropoff ?? "your dropoff";
  const hasTrip = Boolean(dropoff || fare || net || tripId);

  const tryFinalize = useCallback(async () => {
    if (!tripId) return;
    try {
      const quote = await getSettlementQuote(tripId);
      if (quote.action === "startSettlement") {
        await confirmEscrow(tripId, await sendEscrowTx(quote), "startSettlement");
        return;
      }
      if (quote.action === "finalize") {
        setStatus("ready");
        const txHash = await sendEscrowTx(quote);
        await confirmEscrow(tripId, txHash, "finalize");
        setStatus("released");
      } else if (quote.settleFrom) {
        const ms = new Date(quote.settleFrom).getTime() - Date.now();
        setRemainingSec(Math.max(0, Math.ceil(ms / 1000)));
        setStatus("settling");
      }
    } catch {
      /* window still open or disputed */
    }
  }, [sendEscrowTx, tripId]);

  useEffect(() => {
    if (!hasTrip) router.replace("/(tabs)/home");
  }, [hasTrip]);

  useEffect(() => {
    if (!tripId) return;
    void tryFinalize();
    const timer = setInterval(() => void tryFinalize(), 5000);
    return () => clearInterval(timer);
  }, [tripId, tryFinalize]);

  if (!hasTrip) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2E4ED5" />
      </View>
    );
  }

  const settleCopy =
    status === "released"
      ? "Fare released to your wallet."
      : status === "ready"
        ? "Signing finalize…"
        : `Funds release in ${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")} unless the rider disputes.`;

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
          <Text style={styles.fareLabel}>Matched fare (USDC escrow)</Text>
          <Text style={styles.amount}>${Number(amount).toFixed(2)}</Text>
          <Text style={styles.receipt}>{settleCopy}</Text>
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
  receipt: { marginTop: 5, color: "#6B7280", fontSize: 12, textAlign: "center" },
  rateLabel: { marginTop: 30, color: "#374151", fontWeight: "700" },
  stars: { flexDirection: "row", gap: 12, marginTop: 14 },
  button: { position: "absolute", bottom: 38, left: 24, right: 24, alignItems: "center", padding: 16, borderRadius: 12, backgroundColor: "#2E4ED5" },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
