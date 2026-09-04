import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PrivyAuthForm } from "@/components/privy-auth-form";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Image source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png" }} style={{ width: 100, height: 100, marginHorizontal: "auto", marginTop: 40 }} />
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Log in with SMS or a passkey.</Text>

      <PrivyAuthForm
        mode="login"
        onAuthenticated={() => router.replace("/(tabs)/home")}
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
    marginBottom: 16,
    color: "#6B7280",
  },
  link: {
    marginTop: 20,
    textAlign: "center",
    color: "#2563EB",
  },
});
