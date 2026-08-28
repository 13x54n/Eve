import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { getDriverProfile } from "@/services/driver";

export default function TrackingRedirect() {
  useEffect(() => {
    let mounted = true;
    void getDriverProfile()
      .then((driver) => {
        if (!mounted) return;
        if (driver?.activeTrip?.id) {
          router.replace(`/trip/${driver.activeTrip.id}`);
          return;
        }
        router.replace("/(tabs)/home");
      })
      .catch(() => {
        if (mounted) router.replace("/(tabs)/home");
      });
    return () => { mounted = false; };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2E4ED5" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F8EF" },
});
