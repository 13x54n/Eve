import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Feather from '@expo/vector-icons/Feather';

export default function ForgotPasswordScreen() {
  function handleResetPassword() {
    router.replace("/(tabs)/home");
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: 'https://ik.imagekit.io/lexy/Eve/logo.png' }} style={{ width: 100, height: 100, marginHorizontal: 'auto', marginTop: 40 }} />
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>Enter your email to reset your password.</Text>

      <View style={styles.inputContainer}>
        <Feather name="mail" size={20} color="black" />
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Feather name="lock" size={20} color="black" />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
        />
      </View>

      <Pressable style={styles.button} onPress={handleResetPassword}>
        <Text style={styles.buttonText}>Reset Password</Text>
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
    // justifyContent: "center",
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
    backgroundColor: 'white', paddingHorizontal: 16, marginBottom: 14,
    paddingVertical: 6,
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