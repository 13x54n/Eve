import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { acceptOffer, cancelTrip, getTrip, Trip } from "@/services/trips";
import { addSocketListener, connectSocket, subscribeTrip } from "@/services/socket";
import { useRideSession } from "@/context/ride-session";
import { ActionButton } from "@/components/action-button";

export default function SearchingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { refreshActive } = useRideSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    let mounted = true;
    void connectSocket().then(() => subscribeTrip(tripId)).catch(() => { /* offers still refresh over HTTP */ });
    const refresh = async (isFirst = false) => {
      try {
        const next = await getTrip(tripId);
        if (!mounted) return;
        setLoadError(false);
        setTrip(next);
        if (next.status === "ASSIGNED" || next.status === "ONGOING") {
          router.replace({ pathname: "/ride/tracking", params: { tripId } });
        } else if (next.status === "CANCELLED" || next.status === "COMPLETED") {
          router.replace("/(tabs)/home");
        }
      } catch {
        if (mounted && isFirst) setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void refresh(true);
    const remove = addSocketListener((event) => {
      if (!mounted) return;
      if (["offer:created", "trip:assigned", "trip:cancelled"].includes(event)) void refresh();
    });
    const timer = setInterval(() => void refresh(), 3000);
    return () => { mounted = false; clearInterval(timer); remove(); };
  }, [tripId]);

  const offers = trip?.offers?.filter((offer) => offer.status === "PENDING") ?? [];

  async function chooseOffer(offerId: string) {
    if (!tripId || acceptingId) return;
    try {
      setAcceptingId(offerId);
      await acceptOffer(tripId, offerId);
      router.replace({ pathname: "/ride/tracking", params: { tripId } });
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert("Offer unavailable", message ?? "Please choose another offer.");
    } finally {
      setAcceptingId(null);
    }
  }

  function handleCancel() {
    if (!tripId) {
      router.replace("/(tabs)/home");
      return;
    }
    Alert.alert("Cancel request", "Stop looking for a driver?", [
      { text: "Keep waiting", style: "cancel" },
      {
        text: "Cancel request",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              setCancelling(true);
              await cancelTrip(tripId);
              await refreshActive();
              router.replace("/(tabs)/home");
            } catch {
              Alert.alert("Could not cancel", "Please try again.");
            } finally {
              setCancelling(false);
            }
          })();
        },
      },
    ]);
  }

  if (!tripId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No trip found</Text>
        <Pressable style={styles.cancel} onPress={() => router.replace("/(tabs)/home")}>
          <Text style={styles.cancelText}>Back home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.radar}>
        <View style={styles.radarRing}>
          <View style={styles.radarCore}>
            <Feather name="navigation" size={24} color="#FFFFFF" />
          </View>
        </View>
      </View>
      <Text style={styles.eyebrow}>{offers.length ? "DRIVERS AVAILABLE" : "JUST A MOMENT"}</Text>
      <Text style={styles.title}>{offers.length ? "Choose your offer" : "Finding your driver"}</Text>
      <Text style={styles.subtitle}>
        {offers.length ? "Compare prices and arrival times." : "Matching you with a nearby driver."}
      </Text>
      {loading ? <ActivityIndicator color="#2E4ED5" style={styles.loader} /> : null}
      {loadError && !trip ? (
        <Text style={styles.subtitle}>Could not refresh offers. Retrying…</Text>
      ) : null}
      <View style={styles.offers}>
        {offers.map((offer) => (
          <View style={styles.offer} key={offer.id}>
            <View style={styles.offerCopy}>
              <Text style={styles.driver}>{offer.driver?.user.name ?? "Nearby driver"}</Text>
              <Text style={styles.detailText}>
                ★ {offer.driver?.rating?.toFixed(1) ?? "New"} · {offer.etaMinutes} min away
              </Text>
            </View>
            <Text style={styles.fare}>${offer.proposedFare.toFixed(2)}</Text>
            <ActionButton
              style={styles.accept}
              textStyle={styles.acceptText}
              label="Choose"
              compact
              loading={acceptingId === offer.id}
              disabled={acceptingId !== null}
              onPress={() => void chooseOffer(offer.id)}
            />
          </View>
        ))}
      </View>
      <ActionButton
        style={styles.cancel}
        textStyle={styles.cancelText}
        label="Cancel request"
        loadingLabel="Cancelling..."
        loading={cancelling}
        spinnerColor="#B91C1C"
        onPress={handleCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 24, paddingTop: 90, backgroundColor: "#F7F8EF" },
  radar: { alignItems: "center", justifyContent: "center", width: 150, height: 150, marginBottom: 28, borderRadius: 75, backgroundColor: "#E4E9FF" },
  radarRing: { alignItems: "center", justifyContent: "center", width: 102, height: 102, borderRadius: 51, backgroundColor: "#CBD5FF" },
  radarCore: { alignItems: "center", justifyContent: "center", width: 54, height: 54, borderRadius: 27, backgroundColor: "#2E4ED5" },
  eyebrow: { color: "#6B7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { marginTop: 7, color: "#111827", fontSize: 26, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 10, color: "#6B7280", textAlign: "center" },
  loader: { marginTop: 22 },
  offers: { width: "100%", marginTop: 24, gap: 10 },
  offer: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, backgroundColor: "#FFFFFF" },
  offerCopy: { flex: 1 },
  driver: { color: "#111827", fontWeight: "800" },
  detailText: { marginTop: 4, color: "#6B7280", fontSize: 12 },
  fare: { marginHorizontal: 10, color: "#111827", fontSize: 18, fontWeight: "800" },
  accept: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9, backgroundColor: "#2E4ED5" },
  acceptText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  cancel: { position: "absolute", bottom: 38, left: 24, right: 24, alignItems: "center", padding: 16, borderWidth: 1, borderColor: "#FECACA", borderRadius: 12 },
  cancelText: { color: "#B91C1C", fontWeight: "700" },
});
