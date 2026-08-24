import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function RequestRideScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Request a ride</Text>

      <Text style={styles.label}>Pickup location</Text>
      <TextInput
        style={styles.input}
        placeholder="Current location"
        editable={false}
        value="Current location"
      />

      <Text style={styles.label}>Destination</Text>
      <TextInput style={styles.input} placeholder="Where are you going?" />

      <View style={styles.fareCard}>
        <Text style={styles.fareLabel}>Estimated fare</Text>
        <Text style={styles.fare}>$12.50 – $16.00</Text>
        <Text style={styles.note}>Final fare may vary based on the route.</Text>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => router.replace("/ride/searching")}
      >
        <Text style={styles.buttonText}>Find a driver</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F9FAFB",
  },
  heading: {
    marginBottom: 28,
    fontSize: 28,
    fontWeight: "700",
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    marginBottom: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    backgroundColor: "white",
    fontSize: 16,
  },
  fareCard: {
    marginTop: 8,
    marginBottom: 24,
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#E0F2FE",
  },
  fareLabel: {
    color: "#0369A1",
  },
  fare: {
    marginVertical: 6,
    fontSize: 24,
    fontWeight: "700",
    color: "#0C4A6E",
  },
  note: {
    color: "#075985",
  },
  button: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
});