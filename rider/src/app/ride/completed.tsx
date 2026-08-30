import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionButton } from "@/components/action-button";
import { getTrip, Trip } from "@/services/trips";

function formatMoney(n: number) {
  return `$${Number(n).toFixed(2)}`;
}

function prettyLabel(value: string | undefined) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return prettyLabel(status);
}

function vehicleLabel(trip: Trip) {
  if (!trip.vehicle) return prettyLabel(trip.vehicleType);
  const parts = [trip.vehicle.color, trip.vehicle.make, trip.vehicle.model].filter(Boolean);
  const name = parts.join(" ") || "—";
  return trip.vehicle.plateNumber ? `${name} · ${trip.vehicle.plateNumber}` : name;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function CompletedScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const [rating, setRating] = useState(0);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setTrip(await getTrip(tripId));
    } catch {
      setTrip(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/home");
  }

  const cancelled = trip?.status === "CANCELLED";
  const hideFare = trip?.direction === "receiving" || trip?.viewerRole === "recipient";
  const showRating = Boolean(trip && !cancelled);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={goBack}
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.topBarTitle}>Trip details</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2E4ED5" />
        </View>
      ) : error || !trip ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load this trip</Text>
          <Text style={styles.errorCopy}>Check your connection and try again.</Text>
          <ActionButton
            label="Retry"
            onPress={() => void load()}
            style={styles.retryButton}
            textStyle={styles.retryText}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, cancelled && styles.heroCancelled]}>
            <View style={styles.heroChip}>
              <Feather name={cancelled ? "x" : "check"} size={14} color="#FFFFFF" />
              <Text style={styles.heroChipText}>{statusLabel(trip.status)}</Text>
            </View>
            {hideFare ? (
              <Text style={styles.heroTitle}>Delivery details</Text>
            ) : cancelled ? (
              <>
                <Text style={styles.heroAmount}>$0.00</Text>
                <Text style={styles.heroHint}>No cash is due for this trip.</Text>
              </>
            ) : (
              <>
                <Text style={styles.heroAmount}>{formatMoney(trip.fareTotal)}</Text>
                <Text style={styles.heroHint}>Pay your driver in cash</Text>
              </>
            )}
            <Text style={styles.bookingCode}>{trip.bookingCode}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.addressBlock}>
              <View style={[styles.dot, { backgroundColor: "#16A34A" }]} />
              <View style={styles.addressCopy}>
                <Text style={styles.detailLabel}>Pickup</Text>
                <Text style={styles.addressText}>{trip.pickupAddress}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.addressBlock}>
              <View style={[styles.dot, { backgroundColor: "#2E4ED5" }]} />
              <View style={styles.addressCopy}>
                <Text style={styles.detailLabel}>Dropoff</Text>
                <Text style={styles.addressText}>{trip.dropoffAddress}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            {trip.driver?.user?.name ? (
              <>
                <DetailRow label="Driver" value={trip.driver.user.name} />
                <View style={styles.rowDivider} />
              </>
            ) : null}
            <DetailRow label="Vehicle" value={vehicleLabel(trip)} />
            <View style={styles.rowDivider} />
            <DetailRow label="Distance" value={`${Number(trip.distanceKm).toFixed(1)} km`} />
            <View style={styles.rowDivider} />
            <DetailRow label="Duration" value={`${trip.durationMin} min`} />
            <View style={styles.rowDivider} />
            <DetailRow label="Ride type" value={prettyLabel(trip.rideType)} />
            {!hideFare ? (
              <>
                <View style={styles.rowDivider} />
                <DetailRow label="Payment" value={prettyLabel(trip.paymentMethod)} />
              </>
            ) : null}
            {trip.recipientName ? (
              <>
                <View style={styles.rowDivider} />
                <DetailRow label="Recipient" value={trip.recipientName} />
              </>
            ) : null}
            {trip.packageNote ? (
              <>
                <View style={styles.rowDivider} />
                <DetailRow label="Package note" value={trip.packageNote} />
              </>
            ) : null}
            {cancelled && trip.cancellationReason ? (
              <>
                <View style={styles.rowDivider} />
                <DetailRow label="Reason" value={trip.cancellationReason} />
              </>
            ) : null}
            <View style={styles.rowDivider} />
            <DetailRow
              label={cancelled ? "Cancelled" : "Completed"}
              value={formatWhen(trip.endedAt ?? trip.createdAt)}
            />
          </View>

          {showRating ? (
            <View style={styles.card}>
              <Text style={styles.rateLabel}>Rate your driver</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} onPress={() => setRating(star)} accessibilityLabel={`${star} stars`}>
                    <Feather name="star" size={28} color={star <= rating ? "#F59E0B" : "#D1D5DB"} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable
            style={styles.helpRow}
            onPress={() => router.push({ pathname: "/ride/support", params: { tripId: trip.id } })}
          >
            <Feather name="help-circle" size={20} color="#2E4ED5" />
            <Text style={styles.helpText}>Help with this trip</Text>
            <Feather name="chevron-right" size={16} color="#C4C9D4" />
          </Pressable>

          <ActionButton
            label="Done"
            onPress={() => router.replace("/(tabs)/home")}
            style={styles.doneButton}
            textStyle={styles.doneText}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F8EF",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 8 : 4,
    paddingBottom: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  errorCopy: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    alignSelf: "stretch",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#2E4ED5",
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
    backgroundColor: "#2E4ED5",
    overflow: "hidden",
  },
  heroCancelled: {
    backgroundColor: "#B91C1C",
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.6,
  },
  heroAmount: {
    marginTop: 14,
    fontSize: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  heroHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
  },
  bookingCode: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  card: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    textAlign: "right",
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#EEF0EA",
  },
  addressBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  addressCopy: {
    flex: 1,
  },
  addressText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  routeLine: {
    width: 2,
    height: 12,
    marginLeft: 4,
    backgroundColor: "#E5E7EB",
  },
  rateLabel: {
    paddingTop: 12,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  stars: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  helpRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  doneButton: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#2E4ED5",
  },
  doneText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
