import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import Feather from "@expo/vector-icons/Feather";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { Image } from "expo-image";
import { searchAddresses, AddressSuggestion } from "@/services/location"; // adjust path if needed


export default function HomeScreen() {
  const [region, setRegion] = useState<Region>(fallbackRegion);
  const [loading, setLoading] = useState(true);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

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
          <Text style={styles.suggestionsTitle}>
            {destination ? "Suggested destinations" : "Popular destinations"}
          </Text>
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
    </View>
  );
}

const fallbackRegion: Region = {
  latitude: 43.6532,
  longitude: -79.3832,
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
});