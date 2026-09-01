import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  acceptDispatch,
  ActiveDispatch,
  declineDispatch,
  getIncomingTrips,
} from "@/services/driver";
import { ActionButton } from "@/components/action-button";
import { EveMap, EveMarker, EveRoute } from "@/components/map/eve-map";
import { useDrivingRoute } from "@/components/map/use-driving-route";
import { Brand } from "@/constants/theme";
import { lightImpact, notifyImpact } from "@/lib/haptics";

function remainingSeconds(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export default function TripOfferScreen() {
  const params = useLocalSearchParams<{ tripId?: string | string[]; expiresAt?: string | string[] }>();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const expiresAtParam = Array.isArray(params.expiresAt) ? params.expiresAt[0] : params.expiresAt;
  const insets = useSafeAreaInsets();
  const [dispatch, setDispatch] = useState<ActiveDispatch | null>(null);
  const [seconds, setSeconds] = useState(() => (expiresAtParam ? remainingSeconds(expiresAtParam) : 30));
  const [fareText, setFareText] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const resolved = useRef(false);

  const pickup = dispatch
    ? { latitude: dispatch.pickupLat, longitude: dispatch.pickupLng }
    : null;
  const dropoff = dispatch
    ? { latitude: dispatch.dropoffLat, longitude: dispatch.dropoffLng }
    : null;
  const { coordinates: routeCoordinates } = useDrivingRoute(pickup, dropoff);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  }, []);

  const decline = useCallback(async () => {
    if (!tripId || resolved.current) return;
    resolved.current = true;
    try {
      setBusy(true);
      await declineDispatch(tripId);
      lightImpact();
    } catch {
      /* already expired or gone */
    } finally {
      leave();
    }
  }, [leave, tripId]);

  useEffect(() => {
    if (!tripId) {
      leave();
      return;
    }
    let mounted = true;
    void getIncomingTrips().then((incoming) => {
      if (!mounted) return;
      if (incoming.activeDispatch?.tripId === tripId) {
        setDispatch(incoming.activeDispatch);
        setFareText(incoming.activeDispatch.fareTotal.toFixed(2));
        setSeconds(remainingSeconds(incoming.activeDispatch.expiresAt));
        return;
      }
      if (incoming.pendingOffer?.tripId === tripId) {
        leave();
      }
    }).catch(() => {
      /* keep the countdown from route params until the next poll */
    });
    return () => {
      mounted = false;
    };
  }, [leave, tripId]);

  useEffect(() => {
    const expiresAt = dispatch?.expiresAt ?? expiresAtParam;
    if (!expiresAt) return;
    const tick = () => {
      const next = remainingSeconds(expiresAt);
      if (!Number.isFinite(next)) return;
      setSeconds(next);
      if (next <= 0) void decline();
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [decline, dispatch?.expiresAt, expiresAtParam]);

  async function accept() {
    if (!tripId || resolved.current) return;
    const fare = Number(fareText);
    const minFare = dispatch?.minFare ?? 0;
    const maxFare = (dispatch?.fareTotal ?? 0) * 2;
    if (!Number.isFinite(fare) || fare <= 0) {
      Alert.alert("Invalid offer", "Enter a fare greater than zero.");
      return;
    }
    if (fare < minFare) {
      Alert.alert("Offer too low", `The minimum fare for this trip is $${minFare.toFixed(2)}.`);
      return;
    }
    if (maxFare > 0 && fare > maxFare) {
      Alert.alert("Offer too high", "You can offer up to double the suggested fare.");
      return;
    }
    resolved.current = true;
    try {
      setBusy(true);
      await acceptDispatch(tripId, fare);
      notifyImpact();
      leave();
    } catch (error: unknown) {
      resolved.current = false;
      setBusy(false);
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert("Could not accept trip", message ?? "The trip may no longer be available. Please try again.");
    }
  }

  const isCourier = dispatch?.rideType === "COURIER";
  const mapCenter = pickup ?? { latitude: 40.7128, longitude: -74.006 };
  const sheetPad = keyboardHeight > 0 ? 12 : Math.max(20, insets.bottom + 10);

  return (
    <View style={styles.container}>
      <EveMap
        style={styles.map}
        camera={{
          center: mapCenter,
          zoom: 13,
          bounds: pickup && dropoff ? [pickup, dropoff] : undefined,
          padding: { top: insets.top + 72, right: 48, bottom: 360, left: 48 },
        }}
      >
        {pickup ? <EveMarker id="pickup" coordinate={pickup} color="#16A34A" title="Pickup" /> : null}
        {dropoff ? <EveMarker id="dropoff" coordinate={dropoff} color="#DC2626" title="Dropoff" /> : null}
        {routeCoordinates.length >= 2 ? <EveRoute coordinates={routeCoordinates} color="#2e4ed2" /> : null}
      </EveMap>

      <View style={[styles.timerWrap, { top: insets.top + 8 }]} pointerEvents="none">
        <View style={styles.timerBadge}>
          <Text style={styles.timerLabel}>NEW REQUEST</Text>
          <Text style={styles.timer}>{seconds}s</Text>
        </View>
      </View>

      <View
        style={[styles.sheetWrap, { bottom: keyboardHeight }]}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: sheetPad }]}>
          {dispatch ? (
            <>
              <Text style={styles.rider}>{isCourier ? "Courier · " : ""}{dispatch.riderName}</Text>
              {dispatch.recipientName ? (
                <Text style={styles.meta}>
                  {isCourier ? `Deliver to ${dispatch.recipientName}` : `Passenger: ${dispatch.recipientName}`}
                </Text>
              ) : null}
              <Text style={styles.route}>{dispatch.pickupAddress}</Text>
              <Text style={styles.route}>to {dispatch.dropoffAddress}</Text>
              <Text style={styles.meta}>
                {dispatch.distanceKm.toFixed(1)} km · suggested ${dispatch.fareTotal.toFixed(2)} cash
              </Text>
              <TextInput
                style={styles.fareInput}
                placeholder={`Suggested $${dispatch.fareTotal.toFixed(2)}`}
                keyboardType="decimal-pad"
                value={fareText}
                onChangeText={setFareText}
                editable={!busy}
              />
            </>
          ) : (
            <Text style={styles.meta}>Loading request…</Text>
          )}

          <View style={styles.actions}>
            <ActionButton
              style={styles.decline}
              textStyle={styles.declineText}
              label="Decline"
              disabled={busy}
              spinnerColor={Brand.danger}
              onPress={() => void decline()}
            />
            <ActionButton
              style={styles.accept}
              textStyle={styles.acceptText}
              label="Accept"
              loading={busy}
              loadingLabel="Accepting..."
              onPress={() => void accept()}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.canvas },
  map: { ...StyleSheet.absoluteFillObject },
  timerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  timerBadge: {
    minWidth: 120,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  timerLabel: { color: Brand.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  timer: { color: Brand.text, fontSize: 28, fontWeight: "800" },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  rider: { color: Brand.text, fontSize: 20, fontWeight: "800" },
  route: { marginTop: 4, color: Brand.text, fontSize: 15 },
  meta: { marginTop: 8, color: Brand.textSecondary, fontSize: 13 },
  fareInput: {
    marginTop: 14,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },
  actions: { marginTop: 16, flexDirection: "row", gap: 12 },
  accept: { flex: 1, backgroundColor: Brand.accent, borderRadius: 16, minHeight: 52, alignItems: "center", justifyContent: "center" },
  acceptText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  decline: { flex: 1, backgroundColor: Brand.border, borderRadius: 16, minHeight: 52, alignItems: "center", justifyContent: "center" },
  declineText: { color: Brand.danger, fontWeight: "800", fontSize: 16 },
});
