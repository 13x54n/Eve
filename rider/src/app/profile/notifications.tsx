import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { getSessionUser, updateProfile } from "@/services/auth";
import { useAuth } from "@/context/auth-context";
import { Brand } from "@/constants/theme";
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
      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>{saving ? "Saving..." : "Ride and courier alerts"}</Text>
            <Text style={styles.rowDetail}>Push updates for trips and deliveries</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={(value) => void togglePush(value)}
            trackColor={{ false: Brand.border, true: Brand.accent }}
            thumbColor={Brand.surface}
            accessibilityLabel="Ride and courier alerts"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 56, marginBottom: 8 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  title: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "800" },
  spacer: { width: 40 },
  sectionTitle: {
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 12,
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  card: { backgroundColor: Brand.surface, borderRadius: 14, paddingHorizontal: 4 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 70, gap: 12, paddingHorizontal: 12 },
  copy: { flex: 1 },
  rowTitle: { color: Brand.text, fontSize: 16, fontWeight: "700" },
  rowDetail: { marginTop: 3, color: Brand.textSecondary, fontSize: 13 },
});
