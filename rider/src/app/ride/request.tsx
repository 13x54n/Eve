import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { searchAddresses, AddressSuggestion } from "@/services/location"; // adjust path if needed

const vehicleOptions = [
  ["Car", "Comfortable private ride", "car"],
  ["Bike", "Quick rides through traffic", "zap"],
] as const;

type ActiveField = "pickup" | "dropoff" | { type: "stop"; index: number };

export default function RequestRideScreen() {
  const params = useLocalSearchParams<{ pickup?: string; dropoff?: string }>();
  const [pickup, setPickup] = useState(params.pickup ?? "");
  const [dropoff, setDropoff] = useState(params.dropoff ?? "");

  const [pickupSuggestions, setPickupSuggestions] = useState<AddressSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<AddressSuggestion[]>([]);
  const [stopSuggestions, setStopSuggestions] = useState<AddressSuggestion[][]>([]);
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [stops, setStops] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("Car");

  const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: 3 });
        setCurrentLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
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

  function onChangeStop(index: number, text: string) {
    setStops((currentStops) =>
      currentStops.map((stop, stopIndex) => (stopIndex === index ? text : stop)),
    );
    setActiveField({ type: "stop", index });
    setSuggesting(true);
    searchAddresses(
      text,
      (results) => {
        setStopSuggestions((currentSuggestions) =>
          currentSuggestions.map((suggestions, stopIndex) =>
            stopIndex === index ? results : suggestions,
          ),
        );
        setSuggesting(false);
      },
      currentLoc ?? undefined,
    );
  }

  function handleSelectSuggestion(item: AddressSuggestion, field: ActiveField) {
    if (field === "pickup") {
      setPickup(item.label);
      setPickupSuggestions([]);
    } else if (field === "dropoff") {
      setDropoff(item.label);
      setDropoffSuggestions([]);
    } else {
      setStops((currentStops) =>
        currentStops.map((stop, index) =>
          index === field.index ? item.label : stop,
        ),
      );
      setStopSuggestions((currentSuggestions) =>
        currentSuggestions.map((suggestions, index) =>
          index === field.index ? [] : suggestions,
        ),
      );
    }
    setActiveField(null);
  }

  function addStop() {
    setStops((currentStops) => [...currentStops, ""]);
    setStopSuggestions((currentSuggestions) => [...currentSuggestions, []]);
  }

  function removeStop(index: number) {
    setStops((currentStops) => currentStops.filter((_, stopIndex) => stopIndex !== index));
    setStopSuggestions((currentSuggestions) =>
      currentSuggestions.filter((_, stopIndex) => stopIndex !== index),
    );
    setActiveField((field) =>
      field && typeof field !== "string" && field.type === "stop" && field.index === index
        ? null
        : field,
    );
  }

  function swapLocations() {
    setPickup(dropoff);
    setDropoff(pickup);
    setStops((currentStops) => [...currentStops].reverse());
    setStopSuggestions((currentSuggestions) => [...currentSuggestions].reverse());
  }

  const hasSuggestions =
    activeField !== null;

  const currentSuggestions =
    activeField === null
      ? []
      : activeField === "pickup"
        ? pickupSuggestions
        : activeField === "dropoff"
          ? dropoffSuggestions
          : stopSuggestions[activeField.index] ?? [];

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
        <Pressable style={styles.routeAction} onPress={addStop} accessibilityRole="button">
          <Feather name="plus" size={16} color="#2E4ED5" />
          <Text style={styles.routeActionText}>Add stop</Text>
        </Pressable>
        <Pressable style={styles.routeAction} onPress={swapLocations} accessibilityRole="button">
          <Feather name="repeat" size={16} color="#2E4ED5" />
          <Text style={styles.routeActionText}>Swap locations</Text>
        </Pressable>
      </View>

      {stops.map((stop, index) => (
        <View key={`stop-${index}`} style={styles.stopRow}>
          <View style={styles.stopMarker}>
            <Text style={styles.stopNumber}>{index + 1}</Text>
          </View>
          <TextInput
            style={styles.stopInput}
            value={stop}
            onChangeText={(text) => onChangeStop(index, text)}
            onFocus={() => setActiveField({ type: "stop", index })}
            placeholder={`Stop ${index + 1}`}
          />
          <Pressable
            onPress={() => removeStop(index)}
            accessibilityLabel={`Remove stop ${index + 1}`}
          >
            <Feather name="x" size={18} color="#9CA3AF" />
          </Pressable>
        </View>
      ))}

      {hasSuggestions && (
        <View style={styles.suggestionsCard}>
          <Text style={styles.suggestionsTitle}>
            {activeField === "pickup"
              ? "Pickup suggestions"
              : activeField === "dropoff"
                ? "Dropoff suggestions"
                : `Stop ${activeField.index + 1} suggestions`}
          </Text>
          {suggesting && <ActivityIndicator style={{ marginVertical: 8 }} />}
          {currentSuggestions.length === 0 && !suggesting ? (
            <Text style={{ padding: 10, color: "#6B7280" }}>No results found</Text>
          ) : (
            currentSuggestions.map((item) => (
              <Pressable
                key={item.display_name}
                style={styles.suggestionRow}
                onPress={() => handleSelectSuggestion(item, activeField!)}
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

      <Text style={styles.sectionTitle}>Preferred vehicle</Text>
      <View style={styles.vehicleRow}>
        {vehicleOptions.map(([name, description, icon]) => (
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
              <Feather name={icon} size={20} color="#2E4ED5" />
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

      <Pressable
        disabled={!dropoff.trim()}
        style={[styles.button, !dropoff.trim() && styles.disabled]}
        onPress={() =>
          router.replace({
            pathname: "/ride/searching",
            params: { vehicle: selectedVehicle },
          })
        }
      >
        <Text style={styles.buttonText}>Find a driver</Text>
        <Feather name="arrow-right" size={18} color="#FFFFFF" />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 48,
    backgroundColor: "#F7F8EF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  eyebrow: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#6B7280",
    fontSize: 12,
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
  vehicleOptionSelected: {
    borderColor: "#2E4ED5",
    backgroundColor: "#F5F7FF",
  },
  vehicleIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#EEF2FF",
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
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: "auto",
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