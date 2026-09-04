import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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
import { useAuth } from "@/context/auth-context";
import { getSessionUser, updateProfile } from "@/services/auth";
import { ActionButton } from "@/components/action-button";

export default function EditProfileScreen() {
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getSessionUser()
      .then((user) => {
        setName(user.name);
        setEmail(user.email ?? "");
        setPhone(user.phone ?? "");
      })
      .catch(() => {});
  }, []);

  async function save() {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    if (!normalizedName) {
      Alert.alert("Missing fields", "Name is required.");
      return;
    }
    if (normalizedPhone && (normalizedPhone.length < 7 || normalizedPhone.length > 25)) {
      Alert.alert("Invalid phone", "Enter a phone number between 7 and 25 characters.");
      return;
    }

    try {
      setLoading(true);
      const user = await updateProfile({
        name: normalizedName,
        email: normalizedEmail || null,
        phone: normalizedPhone || null,
      });
      setUser(user);
      Alert.alert("Profile saved", "Your contact details are up to date.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Could not save profile",
        error.response?.data?.message ?? "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Keep your name, email, and phone current so drivers can reach you during a trip.
        </Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Name"
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
        />
        <ActionButton
          style={styles.button}
          textStyle={styles.buttonText}
          label="Save profile"
          loadingLabel="Saving..."
          loading={loading}
          onPress={() => void save()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8EF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  headerSpacer: { width: 40 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  lead: { marginBottom: 18, color: "#6B7280", fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  button: { backgroundColor: "#2E4ED5", padding: 16, borderRadius: 12, marginTop: 8 },
  disabled: { opacity: 0.6 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "700" },
});
