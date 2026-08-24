import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function CompletedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.title}>Ride completed</Text>
      <Text style={styles.subtitle}>Thanks for riding with us.</Text>

      <Pressable style={styles.button} onPress={() => router.replace("/(tabs)/home")}>
        <Text style={styles.buttonText}>Back to home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
  },
  icon: {
    width: 72,
    height: 72,
    marginBottom: 24,
    borderRadius: 36,
    backgroundColor: "#DCFCE7",
    color: "#15803D",
    textAlign: "center",
    lineHeight: 72,
    fontSize: 40,
    fontWeight: "800",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 10,
    color: "#6B7280",
  },
  button: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
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