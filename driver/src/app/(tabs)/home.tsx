import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import Feather from "@expo/vector-icons/Feather";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
} from "react-native";
import MapView, { Marker, Region, UrlTile } from "react-native-maps";
import { Image } from "expo-image";
import { searchAddresses, AddressSuggestion } from "@/services/location"; // adjust path if needed


export default function HomeScreen() {
  const [region, setRegion] = useState<Region>(fallbackRegion);
  const [loading, setLoading] = useState(true);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [mapPin, setMapPin] = useState({
    latitude: fallbackRegion.latitude,
    longitude: fallbackRegion.longitude,
  });
  const mapPickerRef = useRef<MapView | null>(null);

  useEffect(() => {
    async function loadLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationMessage("Location permission is off. Showing the default map area.");
          return;
        }
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = location.coords;
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch {
        setLocationMessage("Could not find your location. Showing the default map area.");
      } finally {
        setLoading(false);
      }
    }
    loadLocation();
  }, []);

  // inside HomeScreen
function handleDestinationChange(text: string) {
  setDestination(text);
  searchAddresses(
    text,
    (results) => setSuggestions(results),
    { lat: region.latitude, lng: region.longitude } // bias to current location
  );
}


  function handleSelectSuggestion(item: AddressSuggestion) {
    setDestination(item.label);
    setSuggestions([]);
    setSearchFocused(false);
    router.push({
      pathname: "/ride/request",
      params: {
        pickup: "Current location",
        dropoff: item.display_name,
      },
    });
  }

  async function openMapPicker() {
    let nextRegion = region;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        nextRegion = {
          ...region,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setRegion(nextRegion);
      }
    } catch {
      // Keep the last known location or fallback region.
    }

    const coordinate = {
      latitude: nextRegion.latitude,
      longitude: nextRegion.longitude,
    };
    setMapPin(coordinate);
    setMapPickerVisible(true);
    requestAnimationFrame(() => {
      mapPickerRef.current?.animateToRegion({
        ...nextRegion,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      });
    });
  }

  if (loading) {
    return (
      <View>
        <ActivityIndicator size="large" />
        <Text>Finding your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nice to see you, Lex</Text>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 10,
        }}
      >
        <View style={styles.featuresButton}>
          <Image
            source={{
              uri: "https://images.unsplash.com/vector-1768383602208-c45d3af52271?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            }}
            style={{ width: 60, height: 60, marginBottom: 5 }}
          />
          <Text style={styles.featureText}>Schedule</Text>
          <Text>Book Ahead</Text>
        </View>
        <View style={styles.featuresButton}>
          <Image
            source={{
              uri: "https://images.unsplash.com/vector-1763972891818-fbae102da51e?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            }}
            style={{ width: 60, height: 60, marginBottom: 5 }}
          />
          <Text style={styles.featureText}>Courier</Text>
          <Text>Let's get moving!</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={24} color="#2e4ed2" />
        <TextInput
          style={styles.searchText}
          placeholder="Enter destination"
          value={destination}
          onChangeText={handleDestinationChange}
          onFocus={() => setSearchFocused(true)}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {destination ? (
          <Pressable
            onPress={() => {
              setDestination("");
              setSuggestions([]);
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear destination"
          >
            <Feather name="x-circle" size={20} color="#9CA3AF" />
          </Pressable>
        ) : null}
      </View>

      {searchFocused && (destination || suggestions.length > 0) ? (
        <View style={styles.suggestionsCard}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>
              {destination ? "Suggested destinations" : "Popular destinations"}
            </Text>
            <Pressable
              style={styles.mapChoiceButton}
              onPress={openMapPicker}
              accessibilityRole="button"
              accessibilityLabel="Choose destination on map"
            >
              <Feather name="map" size={14} color="#2E4ED5" />
              <Text style={styles.mapChoiceText}>Choose on map</Text>
            </Pressable>
          </View>
          <FlatList
            data={suggestions}
            keyExtractor={(i) => i.display_name}
            style={{ maxHeight: 220 }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.suggestionRow}
                onPress={() => handleSelectSuggestion(item)}
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
            )}
            ListEmptyComponent={
              destination ? (
                <Text style={{ padding: 10, color: "#6B7280" }}>No results found</Text>
              ) : null
            }
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
            <Pressable
              onPress={() => setMapPickerVisible(false)}
              accessibilityLabel="Close map picker"
            >
              <Feather name="x" size={22} color="#111827" />
            </Pressable>
            <Text style={styles.mapPickerTitle}>Choose on map</Text>
            <View style={{ width: 22 }} />
          </View>
          <MapView
            ref={mapPickerRef}
            style={styles.mapPickerView}
            initialRegion={{ ...region, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
            onPress={(event) => setMapPin(event.nativeEvent.coordinate)}
          >
            <UrlTile
              urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              tileSize={256}
            />
            <Marker coordinate={mapPin} />
          </MapView>
          <Text style={styles.mapAttribution}>© OpenStreetMap contributors</Text>
          <View style={styles.mapPickerFooter}>
            <Text style={styles.mapPickerHint}>Tap the map to place your destination pin.</Text>
            <Pressable
              style={styles.confirmMapButton}
              onPress={() => {
                setDestination("Pinned map location");
                setSearchFocused(false);
                setMapPickerVisible(false);
                router.push({
                  pathname: "/ride/request",
                  params: {
                    pickup: "Current location",
                    dropoff: "Pinned map location",
                    dropoff_lat: String(mapPin.latitude),
                    dropoff_lng: String(mapPin.longitude),
                  },
                });
              }}
            >
              <Text style={styles.confirmMapText}>Use this location</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const fallbackRegion: Region = {
  latitude: 27.7172,
  longitude: 85.324,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "#f7f8ef",
  },
  searchText: { fontSize: 14, color: "gray", width: "80%" },
  title: { fontSize: 24, fontWeight: "700", marginTop: 35, marginBottom: 15 },
  searchContainer: {
    flexDirection: "row",
    borderColor: "#2e4ed2",
    borderWidth: 2,
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    gap: 10,
  },
  destinationText: { fontSize: 14, fontWeight: "700" },
  featuresButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    flexDirection: "column",
    alignItems: "center",
    alignSelf: "center",
    padding: 10,
    borderRadius: 10,
  },
  featureText: { fontSize: 14, fontWeight: "700", color: "#2e4ed2" },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  suggestionsCard: {
    marginTop: -8,
    marginBottom: 16,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestionsTitle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mapChoiceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
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
  suggestionCopy: { flex: 1, marginLeft: 10 },
  suggestionTitle: { color: "#111827", fontSize: 14, fontWeight: "700" },
  suggestionSubtitle: { marginTop: 3, color: "#6B7280", fontSize: 12 },
  mapPicker: { flex: 1, backgroundColor: "#F7F8EF" },
  mapPickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: 56, backgroundColor: "#FFFFFF" },
  mapPickerTitle: { color: "#111827", fontSize: 18, fontWeight: "800" },
  mapPickerView: { flex: 1 },
  mapAttribution: { position: "absolute", right: 8, bottom: 8, paddingHorizontal: 6, paddingVertical: 3, color: "#374151", fontSize: 10, backgroundColor: "rgba(255, 255, 255, 0.82)" },
  mapPickerFooter: { padding: 20, backgroundColor: "#FFFFFF" },
  mapPickerHint: { marginBottom: 14, color: "#6B7280", fontSize: 13 },
  confirmMapButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, backgroundColor: "#2E4ED5" },
  confirmMapText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});