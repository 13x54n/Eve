import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  Linking,
  Platform,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { searchAddresses, AddressSuggestion } from "@/services/location"; // adjust path if needed
import { Image } from "expo-image";
import MapView, { Marker, Polyline, UrlTile } from "react-native-maps";

const vehicleOptions = [
  ["Car", "Comfortable private ride", "car", "https://images.unsplash.com/vector-1738924826826-dcfeb80c5ef4?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"],
  ["Bike", "Quick rides through traffic", "zap", "https://images.unsplash.com/vector-1738924827087-0609ce088bfd?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"],
] as const;
const riderOptions = [
  ["For me", "Comfortable private ride", "car", "https://images.unsplash.com/vector-1738924826826-dcfeb80c5ef4?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"],
  ["For Others", "Quick rides through traffic", "zap", "https://images.unsplash.com/vector-1738924827087-0609ce088bfd?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"],
] as const;

type ActiveField = "pickup" | "dropoff" | { type: "stop"; index: number };

export default function RequestRideScreen() {
  const params = useLocalSearchParams<{
    pickup?: string;
    dropoff?: string;
    dropoff_lat?: string;
    dropoff_lng?: string;
  }>();
  const [pickup, setPickup] = useState(params.pickup ?? "");
  const [dropoff, setDropoff] = useState(params.dropoff ?? "");

  const [pickupSuggestions, setPickupSuggestions] = useState<AddressSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<AddressSuggestion[]>([]);
  const [stopSuggestions, setStopSuggestions] = useState<AddressSuggestion[][]>([]);
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [stops, setStops] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("Car");
  const [selectedRider, setSelectedRider] = useState("For me");
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [mapCoordinate, setMapCoordinate] = useState({
    latitude: Number(params.dropoff_lat) || 27.7172,
    longitude: Number(params.dropoff_lng) || 85.324,
  });

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

  function openMapPicker() {
    const coordinate = currentLoc
      ? { latitude: currentLoc.lat, longitude: currentLoc.lng }
      : mapCoordinate;
    setMapCoordinate(coordinate);
    setMapPickerVisible(true);
  }

  function applyMapLocation() {
    const label = `Pinned location (${mapCoordinate.latitude.toFixed(5)}, ${mapCoordinate.longitude.toFixed(5)})`;

    if (activeField === "pickup") {
      setPickup(label);
      setPickupSuggestions([]);
    } else if (activeField === "dropoff") {
      setDropoff(label);
      setDropoffSuggestions([]);
    } else if (activeField && activeField.type === "stop") {
      setStops((currentStops) =>
        currentStops.map((stop, index) => (index === activeField.index ? label : stop)),
      );
      setStopSuggestions((currentSuggestions) =>
        currentSuggestions.map((suggestions, index) =>
          index === activeField.index ? [] : suggestions,
        ),
      );
    }

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

  const pickupCoordinate = currentLoc ?? {
    lat: mapCoordinate.latitude - 0.01,
    lng: mapCoordinate.longitude - 0.01,
  };
  const routeRegion = {
    latitude: (pickupCoordinate.lat + mapCoordinate.latitude) / 2,
    longitude: (pickupCoordinate.lng + mapCoordinate.longitude) / 2,
    latitudeDelta: Math.max(Math.abs(pickupCoordinate.lat - mapCoordinate.latitude) * 2.5, 0.03),
    longitudeDelta: Math.max(Math.abs(pickupCoordinate.lng - mapCoordinate.longitude) * 2.5, 0.03),
  };

  const riderDetailsValid =
    selectedRider === "For me" || (riderName.trim().length > 1 && riderPhone.trim().length >= 7);

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
      {hasSuggestions && (
        <View style={styles.suggestionsCard}>
          <Text style={styles.suggestionsTitle}>
            {activeField === "pickup"
              ? "Pickup suggestions"
              : activeField === "dropoff"
                ? "Dropoff suggestions"
                : `Stop ${activeField.index + 1} suggestions`}
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
      <View style={styles.routePreviewCard}>
        <View style={styles.routePreviewHeader}>
          <View>
            <Text style={styles.routePreviewTitle}>Your route</Text>
            <Text style={styles.routePreviewSubtitle}>Review the journey before booking</Text>
          </View>
          <Feather name="navigation" size={20} color="#2E4ED5" />
        </View>
        <MapView style={styles.routePreviewMap} initialRegion={routeRegion} scrollEnabled={false}>
          <UrlTile
            urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            tileSize={256}
          />
          <Marker coordinate={{ latitude: pickupCoordinate.lat, longitude: pickupCoordinate.lng }} pinColor="#2E4ED5" />
          <Marker coordinate={mapCoordinate} pinColor="#111827" />
          <Polyline
            coordinates={[
              { latitude: pickupCoordinate.lat, longitude: pickupCoordinate.lng },
              { latitude: mapCoordinate.latitude, longitude: mapCoordinate.longitude },
            ]}
            strokeColor="#2E4ED5"
            strokeWidth={4}
            lineDashPattern={[10, 7]}
          />
        </MapView>
        <Text style={styles.routeMapAttribution}>© OpenStreetMap contributors</Text>
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
      </View>

      

      {hasSuggestions && (
        <View style={styles.suggestionsCard}>
          <Text style={styles.suggestionsTitle}>
            {activeField === "pickup"
              ? "Pickup suggestions"
              : activeField === "dropoff"
                ? "Dropoff suggestions"
                : `Stop ${activeField.index + 1} suggestions`}
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

      <Modal
        visible={mapPickerVisible}
        animationType="slide"
        onRequestClose={() => setMapPickerVisible(false)}
      >
        <View style={styles.mapPicker}>
          <View style={styles.mapPickerHeader}>
            <Pressable onPress={() => setMapPickerVisible(false)} accessibilityLabel="Close map picker">
              <Feather name="x" size={22} color="#111827" />
            </Pressable>
            <Text style={styles.mapPickerTitle}>Choose on map</Text>
            <View style={{ width: 22 }} />
          </View>
          <MapView
            style={styles.mapPickerView}
            initialRegion={{
              latitude: mapCoordinate.latitude,
              longitude: mapCoordinate.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            onPress={(event) => setMapCoordinate(event.nativeEvent.coordinate)}
          >
            <UrlTile
              urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              tileSize={256}
            />
            <Marker coordinate={mapCoordinate} />
          </MapView>
          <Text style={styles.mapPickerAttribution}>© OpenStreetMap contributors</Text>
          <View style={styles.mapPickerFooter}>
            <Text style={styles.mapPickerHint}>Tap the map to place this address.</Text>
            <Pressable style={styles.confirmMapButton} onPress={applyMapLocation}>
              <Text style={styles.confirmMapText}>Use this location</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Modal>

      <Pressable
        disabled={!dropoff.trim() || !riderDetailsValid}
        style={[styles.button, (!dropoff.trim() || !riderDetailsValid) && styles.disabled]}
        onPress={() =>
          router.replace({
            pathname: "/ride/searching",
            params: { vehicle: selectedVehicle, rider: selectedRider },
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