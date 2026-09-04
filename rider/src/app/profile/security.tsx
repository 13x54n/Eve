import { useState } from "react";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLinkWithPasskey } from "@privy-io/expo/passkey";
import { useBrand } from "@/context/theme-context";
import { requireRelyingParty } from "@/lib/privy";
import { ActionButton } from "@/components/action-button";

export default function SecurityScreen() {
  const brand = useBrand();
  const styles = makeStyles(brand);
  const { linkWithPasskey } = useLinkWithPasskey();
  const [loading, setLoading] = useState(false);

  async function addPasskey() {
    try {
      setLoading(true);
      await linkWithPasskey({ relyingParty: requireRelyingParty() });
      Alert.alert("Passkey added", "You can use this passkey the next time you sign in.");
    } catch (error) {
      Alert.alert(
        "Could not add passkey",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <Feather name="chevron-left" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.title}>Security</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Sign-in uses SMS codes and passkeys via Privy. Add a passkey on this device for faster login.
        </Text>
        <ActionButton
          label="Add passkey"
          loadingLabel="Waiting for passkey..."
          loading={loading}
          onPress={() => void addPasskey()}
        />
      </ScrollView>
    </View>
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
  });
}
