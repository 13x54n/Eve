import Feather from "@expo/vector-icons/Feather";
import { Host, FieldGroup, Switch } from "@expo/ui";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { getSessionUser, updateProfile } from "@/services/auth";
import { useAuth } from "@/context/auth-context";
import { useBrand } from "@/context/theme-context";
import { requestRideNotificationPermission } from "@/services/notifications";

export default function NotificationsScreen() {
  const { user, setUser } = useAuth();
  const brand = useBrand();
  const [enabled, setEnabled] = useState(user?.pushNotificationsEnabled !== false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getSessionUser()
      .then((session) => {
        setUser(session);
        setEnabled(session.pushNotificationsEnabled !== false);
      })
      .catch(() => {});
  }, [setUser]);

  async function togglePush(next: boolean) {
    if (!user) return;
    setEnabled(next);
    if (next) {
      await requestRideNotificationPermission();
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.status !== "granted") {
        Alert.alert("Notifications are off", "Enable alerts for Eve in system settings to receive updates.");
      }
    }
    try {
      setSaving(true);
      const updated = await updateProfile({
        name: user.name,
        email: user.email,
        phone: user.phone,
        pushNotificationsEnabled: next,
      });
      setUser(updated);
    } catch {
      setEnabled(!next);
      Alert.alert("Could not save", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: brand.canvas }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <Feather name="chevron-left" size={24} color={brand.text} />
        </Pressable>
        <Text style={[styles.title, { color: brand.text }]}>Preferences</Text>
        <View style={styles.spacer} />
      </View>
      <Host matchContents>
        <FieldGroup>
          <FieldGroup.Section title="Notifications">
            <Switch
              value={enabled}
              label={saving ? "Saving..." : "Ride and courier alerts"}
              onValueChange={(value) => void togglePush(value)}
            />
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 56, paddingHorizontal: 20, marginBottom: 8 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  title: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "800" },
  spacer: { width: 40 },
});
