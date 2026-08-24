import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function TrackingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text>Live driver map will appear here</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.status}>Your driver is arriving</Text>
        <Text style={styles.driver}>Alex Johnson</Text>
        <Text style={styles.vehicle}>Toyota Corolla · ABC 123</Text>

        <Pressable
          style={styles.button}
          onPress={() => router.replace("/ride/completed")}
        >
          <Text style={styles.buttonText}>Complete demo ride</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  card: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "white",
  },
  status: {
    fontSize: 20,
    fontWeight: "800",
  },
  driver: {
    marginTop: 18,
    fontSize: 17,
    fontWeight: "700",
  },
  vehicle: {
    marginTop: 6,
    color: "#6B7280",
  },
  button: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700",
  },
});