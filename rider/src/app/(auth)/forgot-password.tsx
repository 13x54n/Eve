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
import { useState, type ComponentProps } from "react";
import { requestPasswordReset, resetPassword } from "@/services/auth";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sentCode, setSentCode] = useState<string>();
  const [codeRequested, setCodeRequested] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRequestCode() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert("Email required", "Enter the email linked to your account.");
      return;
    }

    try {
      setLoading(true);
      const response = await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setSentCode(response.verificationCode);
      setCodeRequested(true);
      Alert.alert("Code sent", "Enter the verification code to continue.");
    } catch (error: any) {
      Alert.alert(
        "Request failed",
        error.response?.data?.message || "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!/^\d{6}$/.test(code) || password.length < 8) {
      Alert.alert(
        "Invalid details",
        "Enter the 6-digit code and a password of at least 8 characters.",
      );
      return;
    }

    try {
      setLoading(true);
      await resetPassword({ email, code, password });
      Alert.alert("Password reset", "You can now log in with your new password.");
      router.replace("/(auth)/login");
    } catch (error: any) {
      Alert.alert(
        "Reset failed",
        error.response?.data?.message || "The code is invalid or expired.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png" }}
        style={styles.logo}
      />
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>We will send a verification code to your email.</Text>

      <Input icon="mail" placeholder="Email" value={email} onChangeText={setEmail} />

      {!codeRequested ? (
        <Pressable style={styles.button} onPress={handleRequestCode} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Sending..." : "Send code"}</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Verification code</Text>
            {sentCode ? <Text style={styles.code}>{sentCode}</Text> : null}
          </View>
          <Input
            icon="key"
            placeholder="6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Input
            icon="lock"
            placeholder="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Pressable style={styles.button} onPress={handleResetPassword} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Resetting..." : "Reset password"}</Text>
          </Pressable>
        </>
      )}

      <Pressable onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.link}>Back to log in</Text>
      </Pressable>
    </View>
  );
}

function Input(
  props: ComponentProps<typeof TextInput> & { icon: keyof typeof Feather.glyphMap },
) {
  const { icon, style, ...inputProps } = props;

  return (
    <View style={styles.inputContainer}>
      <Feather name={icon} size={20} color="black" />
      <TextInput style={[styles.input, style]} {...inputProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#f7f8ef" },
  logo: { width: 100, height: 100, alignSelf: "center", marginTop: 40 },
  title: { fontSize: 30, fontWeight: "800", color: "#111827", textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: 8, marginBottom: 28, color: "#6B7280" },
  inputContainer: {
    flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderColor: "#D1D5DB", borderRadius: 12, backgroundColor: "white",
    paddingHorizontal: 16, marginBottom: 14, paddingVertical: 6, gap: 8,
  },
  input: { flex: 1 },
  codeBox: { alignItems: "center", backgroundColor: "#e0e7ff", borderRadius: 12, padding: 14, marginBottom: 14 },
  codeLabel: { color: "#3730a3", fontWeight: "600" },
  code: { color: "#1e1b4b", fontSize: 28, fontWeight: "800", letterSpacing: 4, marginTop: 4 },
  button: { padding: 16, marginTop: 8, borderRadius: 12, backgroundColor: "#2e4ed2" },
  buttonText: { color: "white", textAlign: "center", fontWeight: "700" },
  link: { marginTop: 20, textAlign: "center", color: "#2563EB" },
});