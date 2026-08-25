import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { login } from "@/services/auth";
import * as React from "react";

export default function LoginScreen() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!normalizedEmail || !trimmedPassword) {
      Alert.alert("Missing fields", "Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      await login({ email: normalizedEmail, password: trimmedPassword });
      router.replace("/(tabs)/home");
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        e.response?.data?.error ||
        "Login failed. Please try again.";
      Alert.alert("Login error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: 'https://ik.imagekit.io/lexy/Eve/logo.png' }} style={{ width: 100, height: 100, marginHorizontal: 'auto', marginTop: 40 }} />
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Log in to request your next ride.</Text>

      <View style={styles.inputContainer}>
        <Feather name="mail" size={20} color="black" />
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />
      </View>

      <View style={styles.inputContainer}>
        <Feather name="lock" size={20} color="black" />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />
      </View>

      <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
        <Text style={{ textAlign: "center", color: "#eb2525", marginBottom: 10 }}>Forgot password? Click here.</Text>
      </Pressable>

      <Pressable style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Logging in..." : "Log in"}</Text>
      </Pressable>

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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    backgroundColor: 'white',
    paddingHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 10,
    gap: 8,
  },
  input: {
    width: '100%',
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