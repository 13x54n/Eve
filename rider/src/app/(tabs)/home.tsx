import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import Feather from "@expo/vector-icons/Feather";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
} from "react-native";
import { TabScreen } from "@/components/tab-screen";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import { searchAddresses, AddressSuggestion, geocodeSuggestion } from "@/services/location";
import { cancelTrip } from "@/services/trips";
import { useRideSession } from "@/context/ride-session";
import { useAuth } from "@/context/auth-context";
import { PullRefresh, usePullToRefresh } from "@/components/pull-refresh";
import { FindingBanner } from "@/components/finding-banner";
import { MapLocationPicker } from "@/components/map-location-picker";
import { FALLBACK_CENTER } from "@/components/map/config";
import { useBrand } from "@/context/theme-context";
import {
  DEFAULT_GREETING_TEMPLATE,
  getGreetingTemplate,
  interpolateGreeting,
} from "@/services/greetings";

export default function HomeScreen() {
  const brand = useBrand();
  const { activeTrip, refreshActive } = useRideSession();
  const { user } = useAuth();
  const [greetingTemplate, setGreetingTemplate] = useState(DEFAULT_GREETING_TEMPLATE);
  const [region, setRegion] = useState(FALLBACK_CENTER);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [mapPin, setMapPin] = useState(FALLBACK_CENTER);

  useFocusEffect(
    useCallback(() => {
      void refreshActive();
      void getGreetingTemplate()
        .then(setGreetingTemplate)
        .catch(() => { });
      if (activeTrip?.status === "ASSIGNED" || activeTrip?.status === "ONGOING") {
        router.replace({ pathname: "/ride/tracking", params: { tripId: activeTrip.id } });
      }
    }, [activeTrip?.id, activeTrip?.status, refreshActive]),
  );

  const loadLocation = useCallback(async () => {
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
      setRegion({ latitude, longitude });
      setLocationMessage(null);
    } catch {
      setLocationMessage("Could not find your location. Showing the default map area.");
    }
  }, []);

  useEffect(() => {
    void loadLocation();
  }, [loadLocation]);

  const reloadHome = useCallback(async () => {
    await Promise.all([
      refreshActive(),
      getGreetingTemplate().then(setGreetingTemplate).catch(() => {}),
      loadLocation(),
    ]);
  }, [loadLocation, refreshActive]);

  const { refreshing, onRefresh } = usePullToRefresh(reloadHome);

  // inside HomeScreen
  function handleDestinationChange(text: string) {
    setDestination(text);
    searchAddresses(
      text,
      (results) => setSuggestions(results),
      { lat: region.latitude, lng: region.longitude } // bias to current location
    );
  }


  async function handleSelectSuggestion(item: AddressSuggestion) {
    setDestination(item.label);
    setSuggestions([]);
    setSearchFocused(false);
    const coords =
      item.lat != null && item.lng != null
        ? { lat: item.lat, lng: item.lng }
        : await geocodeSuggestion(item, { lat: region.latitude, lng: region.longitude });
    router.push({
      pathname: "/ride/request",
      params: {
        pickup: "Current location",
        dropoff: item.label,
        ...(coords
          ? {
            dropoff_lat: String(coords.lat),
            dropoff_lng: String(coords.lng),
          }
          : {}),
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
  }

  async function handleCancelSearch() {
    if (!activeTrip) return;
    Alert.alert("Cancel request", "Stop looking for a driver?", [
      { text: "Keep waiting", style: "cancel" },
      {
        text: "Cancel request",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              setCancelling(true);
              await cancelTrip(activeTrip.id);
              await refreshActive();
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

  return (
    <TabScreen style={[styles.container, { backgroundColor: brand.canvas }]}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical
      keyboardShouldPersistTaps="handled"
      refreshControl={<PullRefresh refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Image
        source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png?updatedAt=1787590363742" }}
        style={{ width: 66, height: 66,  alignSelf: "center" }}
      />



      {locationMessage ? (
        <View style={styles.locationMessage}>
          <Feather name="alert-circle" size={16} color="#D97706" />
          <Text style={styles.locationMessageText}>{locationMessage}</Text>
        </View>
      ) : null}

      {activeTrip?.status === "SEARCHING" ? (
        <FindingBanner
          destination={activeTrip.dropoffAddress}
          offerCount={activeTrip.offers?.filter((offer) => offer.status === "PENDING").length ?? 0}
          cancelling={cancelling}
          onOpen={() => router.push({ pathname: "/ride/searching", params: { tripId: activeTrip.id } })}
          onCancel={() => void handleCancelSearch()}
        />
      ) : null}
      <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.searchContainer}>
        <Feather name="search" size={24} color="#2e4ed2" />
        <TextInput
          style={styles.searchText}
          placeholder="Where are you going?"
          placeholderTextColor="#9CA3AF"
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
      </Animated.View>

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
                onPress={() => void handleSelectSuggestion(item)}
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

      <MapLocationPicker
        visible={mapPickerVisible}
        initial={mapPin}
        title="Choose on map"
        hint="Search or tap the map to place your destination pin."
        onClose={() => setMapPickerVisible(false)}
        onConfirm={(location) => {
          setDestination(location.label);
          setSearchFocused(false);
          setMapPickerVisible(false);
          router.push({
            pathname: "/ride/request",
            params: {
              pickup: "Current location",
              dropoff: location.label,
              dropoff_lat: String(location.latitude),
              dropoff_lng: String(location.longitude),
            },
          });
        }}
      />

      <Animated.View
        entering={FadeInDown.delay(160).duration(420)}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 10,
        }}
      >
        <Pressable
          style={styles.featuresButton}
          onPress={() =>
            router.push({
              pathname: "/ride/request",
              params: { pickup: "Current location", forOthers: "1" },
            })
          }
        >
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1778230060412-5703970b7aea?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            }}
            style={{ width: 60, height: 60, marginBottom: 5 }}
          />
          <Text style={styles.featureText}>Book for others</Text>
          <Text>Help family around</Text>
        </Pressable>
        <Pressable style={styles.featuresButton} onPress={() => router.push("/courier/request")}>
          <Image
            source={{
              uri: "https://images.unsplash.com/vector-1763972891818-fbae102da51e?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            }}
            style={{ width: 60, height: 60, marginBottom: 5 }}
          />
          <Text style={styles.featureText}>Courier</Text>
          <Text>Let's get moving!</Text>
        </Pressable>
      </Animated.View>

      <Image
        source={{ uri: "https://images.unsplash.com/vector-1786329675328-b975cece8a57?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" }}
        style={{ width: "90%", height: 230, marginBottom: 16, alignSelf: "center" }}
      />
    </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8ef",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  searchText: { fontSize: 16, color: "black", width: "100%", paddingVertical: 5 },
  title: { fontSize: 28, fontWeight: "700", marginTop: 45, marginBottom: 15 },
  locationMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
  },
  locationMessageText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
  },
  searchContainer: {
    flexDirection: "row",
    // borderColor: "#2e4ed2",
    // borderWidth: 2,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    marginBottom: 20,
    gap: 10,
    backgroundColor: "#FFFFFF",
  },
  destinationText: { fontSize: 14, fontWeight: "700" },
  featuresButton: {
    flex: 1,
    backgroundColor: "#ffffff",
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