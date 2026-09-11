import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import {
  searchAddresses,
  geocodeSuggestion,
  reverseGeocode,
  type AddressSuggestion,
} from "@/services/location";
import { EveMap, EveMarker } from "@/components/map/eve-map";
import { FALLBACK_CENTER } from "@/components/map/config";

export type MapLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

type Props = {
  visible: boolean;
  initial: { latitude: number; longitude: number };
  title?: string;
  hint?: string;
  onClose: () => void;
  onConfirm: (location: MapLocation) => void;
};

export function MapLocationPicker({
  visible,
  initial,
  title = "Choose on map",
  hint = "Search or tap the map to place a pin.",
  onClose,
  onConfirm,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [pin, setPin] = useState(initial.latitude ? initial : FALLBACK_CENTER);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!visible) return;
    setPin(initial.latitude ? initial : FALLBACK_CENTER);
    setQuery("");
    setSuggestions([]);
    setLabel("");
  }, [visible, initial.latitude, initial.longitude]);

  function handleQuery(text: string) {
    setQuery(text);
    setSearching(true);
    searchAddresses(text, (results) => {
      setSuggestions(results);
      setSearching(false);
    }, { lat: pin.latitude, lng: pin.longitude });
  }

  async function selectSuggestion(item: AddressSuggestion) {
    const coords = await geocodeSuggestion(item, { lat: pin.latitude, lng: pin.longitude });
    if (!coords) return;
    const next = { latitude: coords.lat, longitude: coords.lng };
    setPin(next);
    setLabel(item.display_name || item.label);
    setQuery(item.label);
    setSuggestions([]);
  }

  async function handleMapPress(coordinate: { latitude: number; longitude: number }) {
    setPin(coordinate);
    setLabel("");
    const name = await reverseGeocode(coordinate.latitude, coordinate.longitude);
    if (name) setLabel(name);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityLabel="Close map picker">
            <Feather name="x" size={22} color="#111827" />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#2E4ED5" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a place"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={handleQuery}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" color="#2E4ED5" /> : null}
        </View>
        {suggestions.length > 0 ? (
          <FlatList
            style={styles.suggestions}
            keyboardShouldPersistTaps="handled"
            data={suggestions}
            keyExtractor={(item, index) => item.id ?? `${item.label}-${index}`}
            renderItem={({ item }) => (
              <Pressable style={styles.suggestion} onPress={() => void selectSuggestion(item)}>
                <Feather name="map-pin" size={16} color="#2E4ED5" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.suggestionSubtitle} numberOfLines={1}>{item.display_name}</Text>
                </View>
              </Pressable>
            )}
          />
        ) : null}
        <EveMap
          style={styles.map}
          camera={{ center: pin, zoom: 14 }}
          onPress={(coordinate) => void handleMapPress(coordinate)}
        >
          <EveMarker id="pin" coordinate={pin} color="#2E4ED5" />
        </EveMap>
        <View style={styles.footer}>
          <Text style={styles.hint}>{hint}</Text>
          <Pressable
            style={styles.confirm}
            onPress={() =>
              onConfirm({
                ...pin,
                label: label || `Pinned location (${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)})`,
              })
            }
          >
            <Text style={styles.confirmText}>Use this location</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8EF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 56,
    backgroundColor: "#FFFFFF",
  },
  title: { color: "#111827", fontSize: 18, fontWeight: "800" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    zIndex: 2,
  },
  searchInput: { flex: 1, color: "#111827", fontSize: 15 },
  suggestions: {
    maxHeight: 180,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    zIndex: 3,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  suggestionTitle: { color: "#111827", fontSize: 14, fontWeight: "700" },
  suggestionSubtitle: { marginTop: 2, color: "#6B7280", fontSize: 12 },
  map: { flex: 1 },
  footer: { padding: 20, backgroundColor: "#FFFFFF" },
  hint: { marginBottom: 14, color: "#6B7280", fontSize: 13 },
  confirm: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#2E4ED5",
  },
  confirmText: { color: "#FFFFFF", fontWeight: "700" },
});
