import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Checkbox } from "expo-checkbox";
import { useState } from "react";
import { exchangeAuth0 } from "@/services/auth";
import { useAuth } from "@/context/auth-context";
import { ActionButton } from "@/components/action-button";
import { isAuth0Cancelled, useAuth0Authorize } from "@/lib/auth0";

export default function RegisterScreen() {
  const { setUser } = useAuth();
  const authorizeAndGetIdToken = useAuth0Authorize();
  const [isChecked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!isChecked) {
      Alert.alert("Terms required", "You must agree to the Terms of Use and Privacy Policy.");
      return;
    }

    try {
      setLoading(true);
      const idToken = await authorizeAndGetIdToken("signup");
      const session = await exchangeAuth0(idToken);
      setUser(session.user);
      router.replace("/(tabs)/home");
    } catch (error) {
      if (isAuth0Cancelled(error)) return;
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Registration failed. Please try again.";
      Alert.alert("Registration error", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png" }} style={{ width: 100, height: 100, marginHorizontal: "auto", marginTop: 40 }} />
      <Text style={styles.title}>Create your account</Text>

      <View style={styles.section}>
        <Checkbox style={styles.checkbox} value={isChecked} onValueChange={setChecked} />
        <Text style={styles.paragraph}>
          Agree with{" "}
          <Text
            accessibilityRole="link"
            style={styles.legalLink}
            onPress={() => router.push("/legal/terms" as Href)}
          >
            Terms of Use
          </Text>
          {" and "}
          <Text
            accessibilityRole="link"
            style={styles.legalLink}
            onPress={() => router.push("/legal/privacy" as Href)}
          >
            Privacy Policy
          </Text>
        </Text>
      </View>

      <ActionButton
        style={styles.button}
        textStyle={styles.buttonText}
        label="Continue with Auth0"
        loadingLabel="Opening sign-up..."
        loading={loading}
        onPress={() => void handleRegister()}
      />

      <Pressable onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.link}>Already have an account? Log in</Text>
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
    marginBottom: 28,
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
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
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
  },
  checkbox: {
    marginRight: 10,
  },
  paragraph: {
    flex: 1,
    color: "#111827",
    lineHeight: 20,
  },
  legalLink: {
    color: "#2563EB",
    fontWeight: "600",
  },
});
