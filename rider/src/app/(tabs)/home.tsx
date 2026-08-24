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
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLoading(false);
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

      setLoading(false);
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
      {region ? (
        <MapView style={StyleSheet.absoluteFillObject} initialRegion={region}>
          <Marker
            coordinate={{
              latitude: region.latitude,
              longitude: region.longitude,
            }}
            title="You are here"
          />
        </MapView>
      ) : (
        <View style={styles.center}>
          <Text>Location permission is required to display the map.</Text>
        </View>
      )}

      <View style={styles.searchCard}>
        <Text style={styles.title}>Where would you like to go?</Text>

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