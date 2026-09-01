import { Image } from "expo-image";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { exchangeAuth0 } from "@/services/auth";
import { useAuth } from "@/context/auth-context";
import { isAuth0Cancelled, useAuth0Authorize } from "@/lib/auth0";

export default function WelcomeScreen() {
  const { setUser } = useAuth();
  const authorizeAndGetIdToken = useAuth0Authorize();
  const [loading, setLoading] = useState<"login" | "signup" | null>(null);

  async function continueWithAuth0(mode: "login" | "signup") {
    if (loading) return;
    try {
      setLoading(mode);
      const idToken = await authorizeAndGetIdToken(mode);
      const session = await exchangeAuth0(idToken);
      setUser(session.user);
      router.replace("/(tabs)/home");
    } catch (error) {
      if (isAuth0Cancelled(error)) return;
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Sign-in failed. Please try again.";
      Alert.alert("Login error", message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png" }} style={{ width: 200, height: 200, marginHorizontal: "auto", marginTop: 40 }} />

      <Text style={styles.subtitle}>
        Connect with fellow riders to earn by helping them get around.
      </Text>

      <Pressable
        style={styles.primaryButton}
        onPress={() => void continueWithAuth0("login")}
        accessibilityRole="button"
        accessibilityLabel="Log in"
        disabled={loading !== null}
      >
        <Text style={styles.primaryButtonText}>
          {loading === "login" ? "Opening sign-in..." : "Log in"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => void continueWithAuth0("signup")}
        accessibilityRole="button"
        accessibilityLabel="Create an account"
        disabled={loading !== null}
      >
        <Text style={styles.secondaryButtonText}>
          {loading === "signup" ? "Opening sign-up..." : "Create an account"}
        </Text>
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
