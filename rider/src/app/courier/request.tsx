import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import { searchAddresses, geocodeSuggestion, type AddressSuggestion } from "@/services/location";
import { MapLocationPicker } from "@/components/map-location-picker";
import { createTrip } from "@/services/trips";
import { useRideSession } from "@/context/ride-session";
import { ActionButton } from "@/components/action-button";
import { useBrand } from "@/context/theme-context";

export default function CourierRequestScreen() {
  const brand = useBrand();
  const { refreshActive } = useRideSession();
  const [pickup, setPickup] = useState("Current location");
  const [dropoff, setDropoff] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<AddressSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeField, setActiveField] = useState<"pickup" | "dropoff">("dropoff");
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupCoord, setPickupCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoord, setDropoffCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [vehicleType, setVehicleType] = useState<"CAR" | "BIKE">("CAR");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [packageNote, setPackageNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: 3 });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCurrentLoc(coords);
        setPickupCoord((current) => current ?? coords);
      } catch {
        /* keep empty coords */
      }
    })();
  }, []);

  function mapCenter() {
    if (activeField === "dropoff" && dropoffCoord) {
      return { latitude: dropoffCoord.lat, longitude: dropoffCoord.lng };
    }
    if (pickupCoord) return { latitude: pickupCoord.lat, longitude: pickupCoord.lng };
    if (currentLoc) return { latitude: currentLoc.lat, longitude: currentLoc.lng };
    return { latitude: 27.7172, longitude: 85.324 };
  }

  async function selectSuggestion(item: AddressSuggestion, field: "pickup" | "dropoff") {
    const coords = await geocodeSuggestion(item, currentLoc ?? undefined);
    if (field === "pickup") {
      setPickup(item.display_name || item.label);
      setPickupSuggestions([]);
      if (coords) setPickupCoord(coords);
    } else {
      setDropoff(item.display_name || item.label);
      setDropoffSuggestions([]);
      if (coords) setDropoffCoord(coords);
    }
  }

  async function submit() {
    const pickupPoint = pickupCoord ?? currentLoc;
    if (!pickupPoint || !dropoffCoord) {
      Alert.alert("Choose locations", "Set pickup and drop-off on the map or from search.");
      return;
    }
    if (recipientName.trim().length < 2 || recipientPhone.trim().length < 7) {
      Alert.alert("Recipient required", "Enter the recipient's name and phone number.");
      return;
    }
    try {
      setSubmitting(true);
      const trip = await createTrip({
        pickupAddress: pickup.trim() || "Current location",
        dropoffAddress: dropoff.trim(),
        city: "Kathmandu",
        pickupLat: pickupPoint.lat,
        pickupLng: pickupPoint.lng,
        dropoffLat: dropoffCoord.lat,
        dropoffLng: dropoffCoord.lng,
        vehicleType,
        rideType: "COURIER",
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        packageNote: packageNote.trim() || undefined,
      });
      await refreshActive();
      router.replace({ pathname: "/ride/searching", params: { tripId: trip.id } });
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (status === 409) {
        const active = await refreshActive();
        if (active?.status === "ASSIGNED" || active?.status === "ONGOING") {
          router.replace({ pathname: "/ride/tracking", params: { tripId: active.id } });
          return;
        }
        router.replace("/(tabs)/home");
        return;
      }
      Alert.alert("Could not send courier", message ?? "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const styles = makeStyles(brand);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
            <Feather name="chevron-left" size={24} color={brand.text} />
          </Pressable>
          <Text style={styles.title}>Send a courier</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.label}>Pickup</Text>
        <TextInput
          style={styles.input}
          value={pickup}
          onChangeText={(text) => {
            setPickup(text);
            setActiveField("pickup");
            searchAddresses(text, setPickupSuggestions, currentLoc ?? undefined);
          }}
          placeholder="Pickup address"
          placeholderTextColor={brand.muted}
        />
        {pickupSuggestions.map((item) => (
          <Pressable key={item.id ?? item.label} style={styles.suggestion} onPress={() => void selectSuggestion(item, "pickup")}>
            <Text style={styles.suggestionText}>{item.display_name || item.label}</Text>
          </Pressable>
        ))}

        <Text style={styles.label}>Drop-off</Text>
        <TextInput
          style={styles.input}
          value={dropoff}
          onChangeText={(text) => {
            setDropoff(text);
            setActiveField("dropoff");
            searchAddresses(text, setDropoffSuggestions, currentLoc ?? undefined);
          }}
          placeholder="Where should we deliver?"
          placeholderTextColor={brand.muted}
        />
        {dropoffSuggestions.map((item) => (
          <Pressable key={item.id ?? item.label} style={styles.suggestion} onPress={() => void selectSuggestion(item, "dropoff")}>
            <Text style={styles.suggestionText}>{item.display_name || item.label}</Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.mapChoice}
          onPress={() => setMapPickerVisible(true)}
        >
          <Feather name="map" size={16} color={brand.accent} />
          <Text style={styles.mapChoiceText}>Choose on map</Text>
        </Pressable>

        <Text style={styles.label}>Recipient</Text>
        <TextInput
          style={styles.input}
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder="Full name"
          placeholderTextColor={brand.muted}
        />
        <TextInput
          style={styles.input}
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
          placeholderTextColor={brand.muted}
        />
        <TextInput
          style={[styles.input, styles.note]}
          value={packageNote}
          onChangeText={setPackageNote}
          placeholder="What's in the package? (optional)"
          placeholderTextColor={brand.muted}
          multiline
        />

        <Text style={styles.label}>Vehicle</Text>
        <View style={styles.vehicleRow}>
          {(["BIKE", "CAR"] as const).map((type) => (
            <Pressable
              key={type}
              style={[styles.vehicleChip, vehicleType === type && styles.vehicleChipActive]}
              onPress={() => setVehicleType(type)}
            >
              <Text style={[styles.vehicleChipText, vehicleType === type && styles.vehicleChipTextActive]}>
                {type === "BIKE" ? "Bike" : "Car"}
              </Text>
            </Pressable>
          ))}
        </View>

        <ActionButton
          disabled={!dropoff.trim()}
          loading={submitting}
          style={styles.button}
          textStyle={styles.buttonText}
          loadingLabel="Finding a driver..."
          onPress={() => void submit()}
          label="Find a driver"
        />
      </ScrollView>

      <MapLocationPicker
        visible={mapPickerVisible}
        initial={mapCenter()}
        title="Choose on map"
        hint={activeField === "pickup" ? "Set the pickup pin." : "Set the drop-off pin."}
        onClose={() => setMapPickerVisible(false)}
        onConfirm={(location) => {
          const coords = { lat: location.latitude, lng: location.longitude };
          if (activeField === "pickup") {
            setPickup(location.label);
            setPickupCoord(coords);
            setPickupSuggestions([]);
          } else {
            setDropoff(location.label);
            setDropoffCoord(coords);
            setDropoffSuggestions([]);
          }
          setMapPickerVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function makeStyles(brand: ReturnType<typeof useBrand>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: brand.canvas },
    container: { padding: 20, paddingTop: 72, paddingBottom: 40 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
    title: { color: brand.text, fontSize: 20, fontWeight: "800" },
    label: { marginTop: 14, marginBottom: 8, color: brand.textSecondary, fontSize: 12, fontWeight: "700" },
    input: {
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: brand.surface,
      color: brand.text,
      fontSize: 15,
    },
    note: { minHeight: 80, textAlignVertical: "top" },
    suggestion: { paddingVertical: 10, paddingHorizontal: 6 },
    suggestionText: { color: brand.textSecondary, fontSize: 13 },
    mapChoice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      marginVertical: 8,
      paddingVertical: 8,
    },
    mapChoiceText: { color: brand.accent, fontWeight: "700" },
    vehicleRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
    vehicleChip: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 20,
      backgroundColor: brand.surface,
    },
    vehicleChipActive: { backgroundColor: brand.text },
    vehicleChipText: { color: brand.textSecondary, fontWeight: "700" },
    vehicleChipTextActive: { color: brand.surface },
    button: { marginTop: 8,paddingVertical: 16, borderRadius: 12, backgroundColor: brand.accent },
    buttonText: { color: "#FFFFFF", fontWeight: "700" },
  });
}
