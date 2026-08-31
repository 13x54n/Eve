import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { searchAddresses, AddressSuggestion, geocodeSuggestion } from "@/services/location";
import { Image } from "expo-image";
import { createTrip, getActiveTrip } from "@/services/trips";
import { useRideSession } from "@/context/ride-session";
import { lightImpact } from "@/lib/haptics";
import { ActionButton } from "@/components/action-button";
import { MapLocationPicker } from "@/components/map-location-picker";
import { EveMap, EveMarker, EveRoute } from "@/components/map/eve-map";
import { useDrivingRoute } from "@/components/map/use-driving-route";

const vehicleOptions = [
  ["Car", "Comfortable private ride", "car", "https://images.unsplash.com/vector-1738924826826-dcfeb80c5ef4?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"],
  ["Bike", "Quick rides through traffic", "zap", "https://images.unsplash.com/vector-1738924827087-0609ce088bfd?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"],
] as const;
const riderOptions = [
  ["For me", "Comfortable private ride", "car", "https://images.unsplash.com/vector-1738924826826-dcfeb80c5ef4?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"],
  ["For Others", "Book a ride for someone else", "user", "https://images.unsplash.com/vector-1738924826826-dcfeb80c5ef4?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"],
] as const;

export default function RequestRideScreen() {
  const { refreshActive } = useRideSession();
  const params = useLocalSearchParams<{
    pickup?: string;
    dropoff?: string;
    dropoff_lat?: string;
    dropoff_lng?: string;
    forOthers?: string;
  }>();
  const [pickup, setPickup] = useState(params.pickup ?? "");
  const [dropoff, setDropoff] = useState(params.dropoff ?? "");

  const [pickupSuggestions, setPickupSuggestions] = useState<AddressSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeField, setActiveField] = useState<"pickup" | "dropoff" | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState("Car");
  const [selectedRider, setSelectedRider] = useState(params.forOthers === "1" ? "For Others" : "For me");
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [mapCoordinate, setMapCoordinate] = useState({
    latitude: Number(params.dropoff_lat) || 27.7172,
    longitude: Number(params.dropoff_lng) || 85.324,
  });

  const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupCoord, setPickupCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoord, setDropoffCoord] = useState<{ lat: number; lng: number } | null>(
    params.dropoff_lat && params.dropoff_lng
      ? { lat: Number(params.dropoff_lat), lng: Number(params.dropoff_lng) }
      : null,
  );
  const [pickupCity, setPickupCity] = useState("");
  const [dropoffCity, setDropoffCity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (params.dropoff) setDropoff(params.dropoff);
    if (params.pickup) setPickup(params.pickup);
    const lat = params.dropoff_lat ? Number(params.dropoff_lat) : NaN;
    const lng = params.dropoff_lng ? Number(params.dropoff_lng) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setDropoffCoord({ lat, lng });
      setMapCoordinate({ latitude: lat, longitude: lng });
    }
  }, [params.dropoff, params.dropoff_lat, params.dropoff_lng, params.pickup]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: 3 });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCurrentLoc(coords);
        setPickupCoord((current) => current ?? coords);
      } catch {
        // ignore
      }
    })();
  }, []);

  function onChangePickup(text: string) {
    setPickup(text);
    setActiveField("pickup");
    setSuggesting(true);
    searchAddresses(
      text,
      (results) => {
        setPickupSuggestions(results);
        setSuggesting(false);
      },
      currentLoc ?? undefined
    );
  }

  function onChangeDropoff(text: string) {
    setDropoff(text);
    setActiveField("dropoff");
    setSuggesting(true);
    searchAddresses(
      text,
      (results) => {
        setDropoffSuggestions(results);
        setSuggesting(false);
      },
      currentLoc ?? undefined
    );
  }


  async function handleSelectSuggestion(item: AddressSuggestion, field: "pickup" | "dropoff") {
    const city = item.municipality || item.district || item.province || "";
    const coords = await geocodeSuggestion(item, currentLoc ?? undefined);
    if (field === "pickup") {
      setPickup(item.label);
      setPickupSuggestions([]);
      setPickupCity(city);
      if (coords) setPickupCoord(coords);
    } else if (field === "dropoff") {
      setDropoff(item.label);
      setDropoffSuggestions([]);
      setDropoffCity(city);
      if (coords) {
        setDropoffCoord(coords);
        setMapCoordinate({ latitude: coords.lat, longitude: coords.lng });
      }
    }
    setActiveField(null);
  }


  function swapLocations() {
    setPickup(dropoff);
    setDropoff(pickup);
    setPickupCity(dropoffCity);
    setDropoffCity(pickupCity);
    setPickupCoord(dropoffCoord);
    setDropoffCoord(pickupCoord);
    if (pickupCoord) {
      setMapCoordinate({ latitude: pickupCoord.lat, longitude: pickupCoord.lng });
    }
  }

  function openMapPicker() {
    const coordinate = currentLoc
      ? { latitude: currentLoc.lat, longitude: currentLoc.lng }
      : mapCoordinate;
    setMapCoordinate(coordinate);
    setMapPickerVisible(true);
  }

  function applyMapLocation(location: { latitude: number; longitude: number; label: string }) {
    const pinned = { lat: location.latitude, lng: location.longitude };
    const label = location.label;

    if (activeField === "pickup") {
      setPickup(label);
      setPickupSuggestions([]);
      setPickupCoord(pinned);
    } else if (activeField === "dropoff") {
      setDropoff(label);
      setDropoffSuggestions([]);
      setDropoffCoord(pinned);
    }

    setMapCoordinate({ latitude: location.latitude, longitude: location.longitude });
    setActiveField(null);
    setMapPickerVisible(false);
  }

  function openExternalMap(provider: "google" | "apple") {
    const pickupCoordinate = currentLoc ?? {
      lat: mapCoordinate.latitude - 0.01,
      lng: mapCoordinate.longitude - 0.01,
    };
    const destination = `${mapCoordinate.latitude},${mapCoordinate.longitude}`;
    const origin = `${pickupCoordinate.lat},${pickupCoordinate.lng}`;
    const url =
      provider === "apple" && Platform.OS === "ios"
        ? `http://maps.apple.com/?saddr=${origin}&daddr=${destination}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

    void Linking.openURL(url);
  }

  const pickupCoordinate = pickupCoord ?? currentLoc ?? {
    lat: mapCoordinate.latitude - 0.01,
    lng: mapCoordinate.longitude - 0.01,
  };
  const pickupPoint = { latitude: pickupCoordinate.lat, longitude: pickupCoordinate.lng };
  const dropoffPoint = { latitude: mapCoordinate.latitude, longitude: mapCoordinate.longitude };
  const hasDropoff = Boolean(dropoffCoord) || Boolean(params.dropoff_lat && params.dropoff_lng);
  const { coordinates: routeCoordinates } = useDrivingRoute(
    hasDropoff ? pickupPoint : null,
    hasDropoff ? dropoffPoint : null,
  );

  const riderDetailsValid =
    selectedRider === "For me" || (riderName.trim().length > 1 && riderPhone.trim().length >= 7);

  async function submitRideRequest() {
    if (submitting) return;
    const pickupPoint = pickupCoord ?? currentLoc;
    const dropoffPoint = dropoffCoord ?? (params.dropoff_lat && params.dropoff_lng
      ? { lat: Number(params.dropoff_lat), lng: Number(params.dropoff_lng) }
      : null);
    if (!pickup.trim() || !dropoff.trim() || !pickupPoint || !dropoffPoint) {
      Alert.alert("Choose both locations", "Select a pickup and drop-off location before requesting a ride.");
      return;
    }

    try {
      setSubmitting(true);
      await createTrip({
        pickupAddress: pickup.trim(),
        dropoffAddress: dropoff.trim(),
        city: pickupCity || dropoffCity || "Kathmandu",
        pickupLat: pickupPoint.lat,
        pickupLng: pickupPoint.lng,
        dropoffLat: dropoffPoint.lat,
        dropoffLng: dropoffPoint.lng,
        vehicleType: selectedVehicle === "Bike" ? "BIKE" : "CAR",
        ...(selectedRider === "For Others"
          ? { recipientName: riderName.trim(), recipientPhone: riderPhone.trim() }
          : {}),
      });
      await refreshActive();
      lightImpact();
      router.replace("/ride/searching");
    } catch (error: any) {
      if (error.response?.status === 409) {
        try {
          const active = await getActiveTrip();
          await refreshActive();
          if (active?.status === "ASSIGNED" || active?.status === "ONGOING") {
            router.replace({ pathname: "/ride/tracking", params: { tripId: active.id } });
            return;
          }
          router.replace("/(tabs)/home");
          return;
        } catch {
          /* fall through */
        }
      }
      Alert.alert("Could not request ride", error.response?.data?.message ?? "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasSuggestions =
    activeField !== null;

  const currentSuggestions =
    activeField === null
      ? []
      : activeField === "pickup"
        ? pickupSuggestions
        : dropoffSuggestions;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={21} color="#111827" />
        </Pressable>
        <Text style={styles.eyebrow}>Confirm your trip</Text>
        <View />
      </View>

      <View style={styles.routeCard}>
        <View style={styles.routeRail}>
          <View style={styles.startDot} />
          <View style={styles.line} />
          <View style={styles.endDot} />
        </View>
        <View style={styles.routeInputs}>
          <Text style={styles.label}>Pick-up</Text>
          <TextInput
            style={styles.input}
            value={pickup}
            onChangeText={onChangePickup}
            onFocus={() => setActiveField("pickup")}
            placeholder="Current location"
          />

          <Text style={styles.label}>Drop-off</Text>
          <TextInput
            style={styles.input}
            value={dropoff}
            onChangeText={onChangeDropoff}
            onFocus={() => setActiveField("dropoff")}
            placeholder="Where are you going?"
          />
        </View>
      </View>

      <View style={styles.routeActions}>
        <Pressable style={styles.routeAction} onPress={swapLocations} accessibilityRole="button">
          <Feather name="repeat" size={16} color="#2E4ED5" />
          <Text style={styles.routeActionText}>Swap locations</Text>
        </Pressable>
      </View>
      {hasSuggestions && (
        <View style={styles.suggestionsCard}>
          <Text style={styles.suggestionsTitle}>
            {activeField === "pickup"
              ? "Pickup suggestions"
              : "Dropoff suggestions"}
          </Text>
          <Pressable
            style={styles.mapChoiceButton}
            onPress={openMapPicker}
            accessibilityRole="button"
            accessibilityLabel="Choose this address on map"
          >
            <Feather name="map" size={14} color="#2E4ED5" />
            <Text style={styles.mapChoiceText}>Choose on map</Text>
          </Pressable>
          {suggesting && <ActivityIndicator style={{ marginVertical: 8 }} />}
          {currentSuggestions.length === 0 && !suggesting ? (
            <Text style={{ padding: 10, color: "#6B7280" }}>No results found</Text>
          ) : (
            currentSuggestions.map((item) => (
              <Pressable
                key={item.display_name}
                style={styles.suggestionRow}
                onPress={() => void handleSelectSuggestion(item, activeField!)}
              >
                <View style={styles.suggestionIcon}>
                  <Feather name="map-pin" size={17} color="#2e4ed2" />
                </View>
                <View style={styles.suggestionCopy}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#9CA3AF" />
              </Pressable>
            ))
          )}
        </View>
      )}
      <Text style={styles.sectionTitle}>Rider</Text>

      <View style={styles.vehicleRow}>
        {riderOptions.map(([name, description, iconName, imageUri]) => (
          <Pressable
            key={name}
            style={[
              styles.riderOption,
              selectedRider === name && styles.vehicleOptionSelected,
            ]}
            onPress={() => setSelectedRider(name)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedRider === name }}
          >
            <Text style={styles.vehicleName}>{name}</Text>
            <Text style={styles.vehicleDescription}>{description}</Text>
            <View
              style={[
                styles.vehicleRadio,
                selectedRider === name && styles.vehicleRadioSelected,
              ]}
            />
          </Pressable>
        ))}
      </View>

      {selectedRider === "For Others" ? (
        <View style={styles.riderDetailsCard}>
          <Text style={styles.riderDetailsTitle}>Rider details</Text>
          <TextInput
            style={styles.riderInput}
            value={riderName}
            onChangeText={setRiderName}
            placeholder="Rider name"
            autoCapitalize="words"
          />
          <TextInput
            style={styles.riderInput}
            value={riderPhone}
            onChangeText={setRiderPhone}
            placeholder="Rider phone number"
            keyboardType="phone-pad"
          />
        </View>
      ) : null}

      <View style={styles.routePreviewCard}>
        <View style={styles.routePreviewHeader}>
          <View>
            <Text style={styles.routePreviewTitle}>Your route</Text>
            <Text style={styles.routePreviewSubtitle}>Review the journey before booking</Text>
          </View>
          <Feather name="navigation" size={20} color="#2E4ED5" />
        </View>
        {hasDropoff ? (
          <>
            <EveMap
              style={styles.routePreviewMap}
              interactive={false}
              camera={{
                center: {
                  latitude: (pickupPoint.latitude + dropoffPoint.latitude) / 2,
                  longitude: (pickupPoint.longitude + dropoffPoint.longitude) / 2,
                },
                zoom: 12,
                bounds: [pickupPoint, dropoffPoint],
                padding: { top: 28, right: 28, bottom: 28, left: 28 },
              }}
            >
              <EveMarker id="pickup" coordinate={pickupPoint} color="#2E4ED5" />
              <EveMarker id="dropoff" coordinate={dropoffPoint} color="#111827" />
              {routeCoordinates.length >= 2 ? (
                <EveRoute coordinates={routeCoordinates} color="#2E4ED5" />
              ) : null}
            </EveMap>

            <View style={styles.mapLinks}>
              <Pressable style={styles.mapLink} onPress={() => openExternalMap("google")}>
                <Feather name="map" size={15} color="#2E4ED5" />
                <Text style={styles.mapLinkText}>Google Maps</Text>
              </Pressable>
              {Platform.OS === "ios" ? (
                <Pressable style={styles.mapLink} onPress={() => openExternalMap("apple")}>
                  <Feather name="map-pin" size={15} color="#2E4ED5" />
                  <Text style={styles.mapLinkText}>Apple Maps</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.routePreviewEmpty}>
            <Text style={styles.routePreviewSubtitle}>Choose a drop-off to preview the route</Text>
          </View>
        )}
      </View>


      <Text style={styles.sectionTitle}>Preferred vehicle</Text>
      <View style={styles.vehicleRow}>
        {vehicleOptions.map(([name, description, iconName, imageUri]) => (
          <Pressable
            key={name}
            style={[
              styles.vehicleOption,
              selectedVehicle === name && styles.vehicleOptionSelected,
            ]}
            onPress={() => setSelectedVehicle(name)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedVehicle === name }}
          >
            <View style={styles.vehicleIcon}>
              <Image
                source={{ uri: imageUri }}
                style={styles.vehicleImage}
                contentFit="contain"
              />
            </View>
            <Text style={styles.vehicleName}>{name}</Text>
            <Text style={styles.vehicleDescription}>{description}</Text>
            <View
              style={[
                styles.vehicleRadio,
                selectedVehicle === name && styles.vehicleRadioSelected,
              ]}
            />
          </Pressable>
        ))}
      </View>


      {mapPickerVisible ? (
        <MapLocationPicker
          visible={mapPickerVisible}
          initial={mapCoordinate}
          title="Choose on map"
          hint="Search or tap the map to place this address."
          onClose={() => setMapPickerVisible(false)}
          onConfirm={applyMapLocation}
        />
      ) : null}

      <ActionButton
        disabled={!dropoff.trim() || !riderDetailsValid}
        loading={submitting}
        style={[styles.button, (!dropoff.trim() || !riderDetailsValid) && styles.disabled]}
        textStyle={styles.buttonText}
        loadingLabel="Finding a driver..."
        onPress={() => void submitRideRequest()}
      >
        <Text style={styles.buttonText}>Find a driver</Text>
        <Feather name="arrow-right" size={18} color="#FFFFFF" />
      </ActionButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 68,
    backgroundColor: "#F7F8EF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  eyebrow: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
  routeCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  routeRail: {
    alignItems: "center",
    width: 16,
    paddingTop: 8,
  },
  startDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#2E4ED5",
  },
  line: {
    width: 1,
    height: 50,
    backgroundColor: "#D1D5DB",
  },
  endDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#111827",
  },
  routeInputs: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    marginBottom: 5,
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
  },
  input: {
    flex: 1,
    padding: 0,
    marginBottom: 16,
    color: "#111827",
    fontSize: 15,
  },
  routeActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  routePreviewCard: {
    marginTop: 20,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  routePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  routePreviewTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  routePreviewSubtitle: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12,
  },
  routePreviewMap: {
    height: 190,
    borderRadius: 12,
  },
  routePreviewEmpty: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  routeMapAttribution: { position: "absolute", right: 16, top: 190, paddingHorizontal: 5, paddingVertical: 2, color: "#374151", fontSize: 9, backgroundColor: "rgba(255, 255, 255, 0.82)" },
  mapLinks: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
  },
  mapLinkText: {
    color: "#2E4ED5",
    fontSize: 12,
    fontWeight: "700",
  },
  routeAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
  },
  routeActionText: {
    color: "#2E4ED5",
    fontSize: 12,
    fontWeight: "700",
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  stopMarker: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E0E7FF",
  },
  stopNumber: {
    color: "#2E4ED5",
    fontSize: 12,
    fontWeight: "700",
  },
  stopInput: {
    flex: 1,
    marginHorizontal: 10,
    color: "#111827",
    fontSize: 14,
  },
  suggestionsCard: {
    marginTop: 12,
    marginBottom: 16,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: "100%",
    alignSelf: "center",
    maxWidth: 360,
  },
  suggestionsTitle: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
  },
  mapChoiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-end",
    marginBottom: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#EEF2FF",
  },
  mapChoiceText: {
    color: "#2E4ED5",
    fontSize: 11,
    fontWeight: "700",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  suggestionIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EEF2FF",
  },
  suggestionCopy: {
    flex: 1,
    marginLeft: 10,
  },
  suggestionTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  suggestionSubtitle: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12,
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 12,
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
  },
  rideOption: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  rideOptionSelected: {
    borderColor: "#2E4ED5",
    backgroundColor: "#F5F7FF",
  },
  rideIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#EEF2FF",
  },
  rideCopy: {
    flex: 1,
    marginLeft: 11,
  },
  rideName: {
    color: "#111827",
    fontWeight: "700",
  },
  rideDescription: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12,
  },
  ridePrice: {
    marginRight: 12,
    color: "#111827",
    fontWeight: "700",
  },
  radio: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 9,
  },
  radioSelected: {
    borderWidth: 5,
    borderColor: "#2E4ED5",
  },
  vehicleRow: {
    flexDirection: "row",
    gap: 10,
  },
  vehicleOption: {
    position: "relative",
    flex: 1,
    minHeight: 132,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  riderOption: {
    position: "relative",
    flex: 1,

    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  vehicleOptionSelected: {
    borderColor: "#2E4ED5",
    backgroundColor: "#F5F7FF",
  },
  vehicleIcon: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 46,
    height: 46,
  },
  vehicleImage: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 8,
  },
  vehicleName: {
    marginTop: 10,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  vehicleDescription: {
    marginTop: 4,
    paddingRight: 4,
    color: "#6B7280",
    fontSize: 11,
    lineHeight: 16,
  },
  vehicleRadio: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 9,
  },
  vehicleRadioSelected: {
    borderWidth: 5,
    borderColor: "#2E4ED5",
  },
  payment: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  paymentIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
  },
  paymentCopy: {
    flex: 1,
    marginLeft: 10,
  },
  paymentLabel: {
    color: "#6B7280",
    fontSize: 11,
  },
  paymentValue: {
    marginTop: 3,
    color: "#111827",
    fontWeight: "700",
  },
  riderDetailsCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  riderDetailsTitle: {
    marginBottom: 10,
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  riderInput: {
    marginTop: 8,
    padding: 13,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    color: "#111827",
    fontSize: 14,
  },
  mapPicker: {
    flex: 1,
    backgroundColor: "#F7F8EF",
  },
  mapPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 56,
    backgroundColor: "#FFFFFF",
  },
  mapPickerTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  mapPickerView: {
    flex: 1,
  },
  mapPickerAttribution: { position: "absolute", right: 8, bottom: 92, paddingHorizontal: 6, paddingVertical: 3, color: "#374151", fontSize: 10, backgroundColor: "rgba(255, 255, 255, 0.82)" },
  mapPickerFooter: {
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  mapPickerHint: {
    marginBottom: 14,
    color: "#6B7280",
    fontSize: 13,
  },
  confirmMapButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#2E4ED5",
  },
  confirmMapText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#2E4ED5",
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});