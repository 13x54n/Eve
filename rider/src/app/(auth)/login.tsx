import { Image } from "expo-image";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { exchangeAuth0 } from "@/services/auth";
import { useAuth } from "@/context/auth-context";
import { ActionButton } from "@/components/action-button";
import { isAuth0Cancelled, useAuth0Authorize } from "@/lib/auth0";

export default function LoginScreen() {
  const { setUser } = useAuth();
  const authorizeAndGetIdToken = useAuth0Authorize();
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    try {
      setLoading(true);
      const idToken = await authorizeAndGetIdToken("login");
      const session = await exchangeAuth0(idToken);
      setUser(session.user);
      router.replace("/(tabs)/home");
    } catch (error) {
      if (isAuth0Cancelled(error)) return;
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Login failed. Please try again.";
      Alert.alert("Login error", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png" }} style={{ width: 100, height: 100, marginHorizontal: "auto", marginTop: 40 }} />
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Log in to request your next ride.</Text>

      <ActionButton
        style={styles.button}
        textStyle={styles.buttonText}
        label="Continue with Auth0"
        loadingLabel="Opening sign-in..."
        loading={loading}
        onPress={() => void handleLogin()}
      />

      <Pressable onPress={() => router.push("/(auth)/register")}>
        <Text style={styles.link}>Don't have an account? Register</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f7f8ef",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
    color: "#6B7280",
  },
  button: {
    padding: 16,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#2e4ed2",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700",
  },
  link: {
    marginTop: 20,
    textAlign: "center",
    color: "#2563EB",
  },
});
