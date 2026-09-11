import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <Image source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png" }} style={{ width: 200, height: 200, marginHorizontal: "auto", marginTop: 40 }} />

      <Text style={styles.subtitle}>
        Connect with fellow riders to earn by helping them get around.
      </Text>

      <Pressable
        style={styles.primaryButton}
        onPress={() => router.push("/(auth)/login")}
        accessibilityRole="button"
        accessibilityLabel="Log in"
      >
        <Text style={styles.primaryButtonText}>Log in</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.push("/(auth)/register")}
        accessibilityRole="button"
        accessibilityLabel="Create an account"
      >
        <Text style={styles.secondaryButtonText}>Create an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f7f8ef",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 40,
    fontSize: 16,
    lineHeight: 24,
    color: "#6B7280",
  },
  primaryButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#2e4ed2",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    padding: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#111827",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
});
