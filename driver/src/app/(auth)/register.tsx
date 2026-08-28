import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import {
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  TouchableWithoutFeedback,
} from "react-native";
import { Checkbox } from "expo-checkbox";
import { useState } from "react";
import Feather from "@expo/vector-icons/build/Feather";
import { register } from "@/services/auth";
import { useAuth } from "@/context/auth-context";

export default function RegisterScreen() {
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("New York");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("2022");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<"BIKE" | "CAR">("CAR");
  const [isChecked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (
      !normalizedName ||
      !normalizedEmail ||
      !trimmedPassword ||
      !city.trim() ||
      !vehicleMake.trim() ||
      !vehicleModel.trim() ||
      !vehicleColor.trim() ||
      !vehiclePlateNumber.trim()
    ) {
      Alert.alert("Missing fields", "Please complete your account and vehicle details.");
      return;
    }
    if (trimmedPassword.length < 8) {
      Alert.alert("Password too short", "Password must be at least 8 characters.");
      return;
    }
    if (!isChecked) {
      Alert.alert("Terms required", "You must agree to the Terms of Use and Privacy Policy.");
      return;
    }

    try {
      setLoading(true);
      
      const session = await register({
        name: normalizedName,
        email: normalizedEmail,
        password: trimmedPassword,
        city: city.trim(),
        vehicleMake: vehicleMake.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear: Number(vehicleYear),
        vehicleColor: vehicleColor.trim(),
        vehiclePlateNumber: vehiclePlateNumber.trim(),
        vehicleType,
        vehicleCapacity: vehicleType === "BIKE" ? 1 : 4,
      });
      setUser(session.user);

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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      keyboardVerticalOffset={16}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
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

      <Text style={styles.sectionTitle}>Vehicle details</Text>
      <View style={styles.typeRow}>
        {(["CAR", "BIKE"] as const).map((type) => (
          <Pressable
            key={type}
            style={[styles.typeButton, vehicleType === type && styles.typeButtonActive]}
            onPress={() => setVehicleType(type)}
          >
            <Text style={[styles.typeText, vehicleType === type && styles.typeTextActive]}>
              {type === "CAR" ? "Car" : "Bike"}
            </Text>
          </Pressable>
        ))}
      </View>

      {[
        ["City", city, setCity],
        ["Make", vehicleMake, setVehicleMake],
        ["Model", vehicleModel, setVehicleModel],
        ["Year", vehicleYear, setVehicleYear],
        ["Color", vehicleColor, setVehicleColor],
        ["License plate", vehiclePlateNumber, setVehiclePlateNumber],
      ].map(([placeholder, value, setter]) => (
        <View style={styles.inputContainer} key={placeholder as string}>
          <TextInput
            style={styles.input}
            placeholder={placeholder as string}
            value={value as string}
            onChangeText={setter as (value: string) => void}
            keyboardType={placeholder === "Year" ? "number-pad" : "default"}
            autoCapitalize={placeholder === "License plate" ? "characters" : "words"}
          />
        </View>
      ))}

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
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f8ef",
  },
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#f7f8ef",
  },
  title: {
    marginBottom: 28,
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  typeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "white",
  },
  typeButtonActive: {
    borderColor: "#2e4ed2",
    backgroundColor: "#EEF2FF",
  },
  typeText: {
    textAlign: "center",
    color: "#374151",
    fontWeight: "600",
  },
  typeTextActive: {
    color: "#2e4ed2",
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
    paddingVertical: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
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