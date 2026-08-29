import { router } from "expo-router";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { EveMap, EveMarker } from "@/components/map/eve-map";
import { FALLBACK_CENTER } from "@/components/map/config";

export default function HomeScreen() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [pickup, setPickup] = useState("Current location");
  const [dropoff, setDropoff] = useState("");
  const [dropoffFocused, setDropoffFocused] = useState(false);
  const [center, setCenter] = useState(FALLBACK_CENTER);

  useEffect(() => {
    void Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
      if (status !== "granted") return;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCenter({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    }).catch(() => { /* keep fallback */ });
  }, []);

  return (
    <View style={styles.container}>
      <EveMap style={styles.map} camera={{ center, zoom: 13 }} interactive={false}>
        <EveMarker id="you" coordinate={center} color="#2E4ED5" />
      </EveMap>

      <View style={styles.topBar}>
        <View>
          <Text style={styles.eyebrow}>READY WHEN YOU ARE</Text>
          <Text style={styles.title}>Where to, Lex?</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>L</Text></View>
      </View>

      <View style={styles.searchCard}>
        <Pressable
          style={styles.destinationButton}
          onPress={() => setDrawerVisible(true)}
        >
          <Feather name="search" size={20} color="#2E4ED5" />
          <Text style={styles.destinationText}>Enter destination</Text>
        </Pressable>
        <View style={styles.serviceRow}>
          <Pressable
            style={styles.serviceItem}
            onPress={() =>
              router.push({
                pathname: "/ride/request",
                params: { pickup: "Current location", forOthers: "1" },
              })
            }
          >
            <Feather name="users" size={17} color="#2E4ED5" />
            <Text style={styles.serviceTitle}>For others</Text>
            <Text style={styles.serviceHint}>Book a ride</Text>
          </Pressable>
          <Pressable style={styles.serviceItem} onPress={() => router.push("/courier/request")}>
            <Feather name="package" size={17} color="#2E4ED5" />
            <Text style={styles.serviceTitle}>Courier</Text>
            <Text style={styles.serviceHint}>Send a package</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={drawerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawerVisible(false)}
      >
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerVisible(false)} />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Plan your ride</Text>
              <Pressable onPress={() => setDrawerVisible(false)} accessibilityLabel="Close">
                <Feather name="x" size={22} color="#111827" />
              </Pressable>
            </View>
            <Text style={styles.drawerLabel}>Pick-up location</Text>
            <TextInput
              style={styles.locationInput}
              value={pickup}
              onChangeText={setPickup}
              placeholder="Where should we pick you up?"
            />
            <Text style={styles.drawerLabel}>Drop-off location</Text>
            <TextInput
              style={styles.locationInput}
              value={dropoff}
              onChangeText={setDropoff}
              placeholder="Where are you going?"
              autoFocus
              onFocus={() => setDropoffFocused(true)}
            />
            {dropoffFocused ? (
              <View style={styles.suggestionsCard}>
                <Text style={styles.suggestionsTitle}>
                  {dropoff ? "Suggested destinations" : "Popular destinations"}
                </Text>
                {destinationSuggestions
                  .filter((suggestion) =>
                    `${suggestion.title} ${suggestion.subtitle}`
                      .toLowerCase()
                      .includes(dropoff.toLowerCase()),
                  )
                  .map((suggestion) => (
                    <Pressable
                      key={suggestion.title}
                      style={styles.suggestionRow}
                      onPress={() => {
                        setDropoff(suggestion.title);
                        setDropoffFocused(false);
                      }}
                    >
                      <View style={styles.suggestionIcon}>
                        <Feather name="map-pin" size={17} color="#2e4ed2" />
                      </View>
                      <View style={styles.suggestionCopy}>
                        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                        <Text style={styles.suggestionSubtitle}>{suggestion.subtitle}</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color="#9CA3AF" />
                    </Pressable>
                  ))}
              </View>
            ) : null}
            <Pressable
              style={[styles.continueButton, !dropoff.trim() && styles.disabledButton]}
              disabled={!dropoff.trim()}
              onPress={() => {
                setDrawerVisible(false);
                router.push({ pathname: "/ride/request", params: { pickup, dropoff } });
              }}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  map: {
    flex: 1,
  },
  topBar: { position: "absolute", top: 28, left: 20, right: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "#6B7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { color: "#111827", fontSize: 28, fontWeight: "800", marginTop: 4 },
  avatar: { alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 21, backgroundColor: "#111827" },
  avatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  searchCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  destinationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  destinationText: {
    color: "#6B7280",
    fontSize: 16,
  },
  serviceRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  serviceItem: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F8FAFC" },
  serviceTitle: { marginTop: 8, color: "#111827", fontWeight: "700" },
  serviceHint: { marginTop: 3, color: "#6B7280", fontSize: 12 },
  drawerOverlay: { flex: 1, justifyContent: "flex-end" },
  drawerBackdrop: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: "rgba(17, 24, 39, 0.42)",
  },
  drawer: { padding: 24, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "#FFFFFF" },
  drawerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  drawerTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  drawerLabel: { marginBottom: 8, fontSize: 13, fontWeight: "600", color: "#374151" },
  locationInput: { minHeight: 52, marginBottom: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, backgroundColor: "#F9FAFB", fontSize: 15 },
  continueButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8, padding: 16, borderRadius: 10, backgroundColor: "#2e4ed2" },
  disabledButton: { opacity: 0.45 },
  continueButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  suggestionsCard: {
    marginTop: -8,
    marginBottom: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
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
  legacyTitle: {
    color: "#111827",
  },
});

const destinationSuggestions = [
  { title: "Union Station", subtitle: "65 Front St W, Toronto" },
  { title: "Toronto Pearson International Airport", subtitle: "6301 Silver Dart Dr, Mississauga" },
  { title: "Kensington Market", subtitle: "West Toronto, Toronto" },
  { title: "Yorkdale Shopping Centre", subtitle: "3401 Dufferin St, Toronto" },
  { title: "CN Tower", subtitle: "301 Front St W, Toronto" },
];
