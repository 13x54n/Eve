import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { changePassword } from "@/services/auth";
import { ActionButton } from "@/components/action-button";
import { useBrand } from "@/context/theme-context";

export default function SecurityScreen() {
  const brand = useBrand();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const styles = makeStyles(brand);

  async function save() {
    if (newPassword.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords do not match", "Re-enter your new password.");
      return;
    }
    try {
      setLoading(true);
      await changePassword({ currentPassword, newPassword });
      Alert.alert("Password updated", "Use your new password next time you sign in.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      Alert.alert("Could not update password", message ?? "Check your current password and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <Feather name="chevron-left" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.title}>Security</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>Change your password. You'll stay signed in on this device.</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Current password"
          placeholderTextColor={brand.muted}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password"
          placeholderTextColor={brand.muted}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          placeholderTextColor={brand.muted}
          secureTextEntry
        />
        <ActionButton
          style={styles.button}
          textStyle={styles.buttonText}
          label="Update password"
          loadingLabel="Updating..."
          loading={loading}
          onPress={() => void save()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(brand: ReturnType<typeof useBrand>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: brand.canvas },
    header: { flexDirection: "row", alignItems: "center", paddingTop: 56, paddingHorizontal: 20, marginBottom: 8 },
    back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
    title: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "800", color: brand.text },
    spacer: { width: 40 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    lead: { marginBottom: 18, color: brand.textSecondary, fontSize: 14, lineHeight: 20 },
    input: {
      marginBottom: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: brand.surface,
      color: brand.text,
      fontSize: 15,
    },
    button: { marginTop: 8, borderRadius: 12, backgroundColor: brand.accent },
    buttonText: { color: "#FFFFFF", fontWeight: "700" },
  });
}
