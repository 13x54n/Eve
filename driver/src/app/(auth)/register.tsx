import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Checkbox } from "expo-checkbox";
import { useState } from "react";
import { PrivyAuthForm } from "@/components/privy-auth-form";

export default function RegisterScreen() {
  const [isChecked, setChecked] = useState(false);

  return (
    <View style={styles.container}>
      <Image source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png" }} style={{ width: 100, height: 100, marginHorizontal: "auto", marginTop: 40 }} />
      <Text style={styles.title}>Create your driver account</Text>
      <Text style={styles.subtitle}>
        After you sign up, add your vehicle and documents in onboarding.
      </Text>

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

      <PrivyAuthForm
        mode="signup"
        disabled={!isChecked}
        onAuthenticated={() => {
          if (!isChecked) {
            Alert.alert("Terms required", "You must agree to the Terms of Use and Privacy Policy.");
            return;
          }
          router.replace("/(tabs)/home");
        }}
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
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 8,
    color: "#6B7280",
    lineHeight: 20,
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
