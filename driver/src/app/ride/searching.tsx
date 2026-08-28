import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import { getDriverProfile } from "@/services/driver";

export default function SearchingScreen() {
  useEffect(() => {
    let mounted = true;
    void getDriverProfile()
      .then((driver) => {
        if (!mounted) return;
        if (driver?.activeTrip?.id) {
          router.replace(`/trip/${driver.activeTrip.id}`);
        }
      })
      .catch(() => { /* stay on this screen */ });
    return () => { mounted = false; };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>DRIVER HOME</Text>
      <Text style={styles.title}>Incoming trips show on Home</Text>
      <Text style={styles.subtitle}>
        Go online on the map to receive rider requests and send an offer. This screen is not a live search.
      </Text>
      <Pressable style={styles.button} onPress={() => router.replace("/(tabs)/home")}>
        <Text style={styles.buttonText}>Go to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F7F8EF" },
  eyebrow: { color: "#6B7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { marginTop: 8, color: "#111827", fontSize: 26, fontWeight: "800" },
  subtitle: { marginTop: 10, color: "#6B7280", fontSize: 15, lineHeight: 22 },
  button: { marginTop: 28, alignItems: "center", padding: 16, borderRadius: 12, backgroundColor: "#2E4ED5" },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
});
