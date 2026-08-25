import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

export default function HomeScreen() {
  const [region, setRegion] = useState<Region>(fallbackRegion);
  const [loading, setLoading] = useState(true);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Finding your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={region}>
        <Marker
          coordinate={{
            latitude: region.latitude,
            longitude: region.longitude,
          }}
          title={locationMessage ? "Default map area" : "You are here"}
        />
      </MapView>

      <View style={styles.searchCard}>
        <Text style={styles.title}>Where would you like to go?</Text>
        {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}

        <Pressable
          style={styles.destinationButton}
          onPress={() => router.push("/ride/request")}
        >
          <Text style={styles.destinationText}>Enter destination</Text>
        </Pressable>
      </View>
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
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  searchCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    padding: 20,
    borderRadius: 18,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    marginBottom: 14,
    fontSize: 18,
    fontWeight: "700",
  },
  locationMessage: {
    marginBottom: 12,
    color: "#6B7280",
  },
  destinationButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  destinationText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
  },
});