import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export default function SearchingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#111827" />
      <Text style={styles.title}>Finding a driver</Text>
      <Text style={styles.subtitle}>
        We are looking for an available driver near you.
      </Text>

      <Pressable style={styles.button} onPress={() => router.replace("/(tabs)/home")}>
        <Text style={styles.buttonText}>Cancel request</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
  },
  title: {
    marginTop: 24,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 10,
    textAlign: "center",
    color: "#6B7280",
  },
  button: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
  },
  buttonText: {
    color: "#B91C1C",
    textAlign: "center",
    fontWeight: "700",
  },
});