import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapTitle}>Map view</Text>
        <Text style={styles.mapMessage}>
          Live maps are available in the mobile app.
        </Text>
      </View>

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
    backgroundColor: "#E5E7EB",
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  mapTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  mapMessage: {
    marginTop: 8,
    color: "#4B5563",
    textAlign: "center",
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
