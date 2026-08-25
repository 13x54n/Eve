import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { Image } from "expo-image";

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
      <View>
        <ActivityIndicator size="large" />
        <Text>Finding your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* <MapView style={StyleSheet.absoluteFill} initialRegion={region}>
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
      </View> */}
      <Text style={styles.title}>
        Nice to see you, Lex
      </Text>
      <View style={styles.searchContainer}>
        {/* search icon */}
        <Feather name="search" size={24} color="#2e4ed2" />
        <TextInput placeholder="Enter destination" />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 10, }}>
        <View style={styles.featuresButton}>
          <Image source={{ uri: 'https://images.unsplash.com/vector-1768383602208-c45d3af52271?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }} style={{ width: 60, height: 60, marginBottom: 5 }} />
          <Text style={styles.featureText}>Schedule</Text>
          <Text>Book Ahead</Text>
        </View>
        <View style={styles.featuresButton}>
          <Image source={{ uri: 'https://images.unsplash.com/vector-1763972891818-fbae102da51e?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }} style={{ width: 60, height: 60, marginBottom: 5 }} />
          <Text style={styles.featureText}>Courier</Text>
          <Text>Let's get moving!</Text>
        </View>
      </View>


      <Pressable style={styles.quickActionButton}>
        <View style={{ width: 40, height: 40, borderRadius: 3, backgroundColor: "#f0f0f0", alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name="home-map-marker" size={26} color="#2e4ed2" />
        </View>
        <View>
          <Text style={styles.destinationText}>Home</Text>
          <Text>Set home address</Text>
        </View>
      </Pressable>
      <Pressable style={styles.quickActionButton}>
        <View style={{ width: 40, height: 40, borderRadius: 3, backgroundColor: "#f0f0f0", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="bag-remove-sharp" size={24} color="#2e4ed2" />
        </View>
        <View>
          <Text style={styles.destinationText}>Work</Text>
          <Text>Set work address</Text>
        </View>
      </Pressable>
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
  title: { fontSize: 24, fontWeight: "700", marginTop: 35, marginBottom: 15 },
  searchContainer: { flexDirection: "row", borderColor: "#2e4ed2", borderWidth: 2, alignItems: "center", padding: 10, borderRadius: 8, marginBottom: 20, gap: 10 },
  destinationText: { fontSize: 14, fontWeight: "700" },
  featuresButton: { flex: 1, backgroundColor: "#f0f0f0", flexDirection: "column", alignItems: "center", alignSelf: "center",
    padding: 10, borderRadius: 10 ,
   },
  featureText: { fontSize: 14, fontWeight: "700", color: "#2e4ed2" },
  quickActionButton: { 
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20, 
  }
});