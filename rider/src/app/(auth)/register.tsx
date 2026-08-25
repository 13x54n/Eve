import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { Checkbox } from "expo-checkbox";
import { useState } from "react";
import Feather from "@expo/vector-icons/build/Feather";
import { register } from "@/services/auth";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isChecked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!normalizedName || !normalizedEmail || !trimmedPassword) {
      Alert.alert("Missing fields", "Please fill in username, email, and password.");
      return;
    }
    if (trimmedPassword.length < 8) {
      Alert.alert("Password too short", "Password must be at least 8 characters.");
      return;
    }
    if (!isChecked) {
      Alert.alert("Terms required", "You must agree to the Terms and Conditions.");
      return;
    }

    try {
      setLoading(true);
      
      await register({
        name: normalizedName,
        email: normalizedEmail,
        password: trimmedPassword,
      });

      router.replace("/(tabs)/home");
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        e.response?.data?.error ||
        "Registration failed. Please try again.";
      Alert.alert("Registration error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: 'https://ik.imagekit.io/lexy/Eve/logo.png' }} style={{ width: 100, height: 100, marginHorizontal: 'auto', marginTop: 40 }} />
      <Text style={styles.title}>Create your account</Text>

      <View style={styles.inputContainer}>
        <Feather name="user" size={20} color="black" />
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={name}
          onChangeText={setName}
          returnKeyType="next"
        />
      </View>

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
          returnKeyType="done"
          onSubmitEditing={handleRegister}
        />
      </View>

      <View style={styles.section}>
        <Checkbox style={styles.checkbox} value={isChecked} onValueChange={setChecked} />
        <Text style={styles.paragraph}>Agree with</Text>
        <Pressable accessibilityRole="link">
          <Text style={[styles.paragraph, { color: "#2563EB" }]}> Terms and Conditions</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating account..." : "Create account"}
        </Text>
      </Pressable>

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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    backgroundColor: "white",
    paddingHorizontal: 16,
    marginBottom: 14,
    paddingVertical: 6,
    gap: 8,
  },
  input: {
    width: "100%",
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
    color: "#111827",
  },
});