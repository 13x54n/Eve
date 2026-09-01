import Feather from "@expo/vector-icons/Feather";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getSessionUser } from "@/services/auth";
import { useAuth } from "@/context/auth-context";
import { Brand, Spacing } from "@/constants/theme";
import { useBrand } from "@/context/theme-context";
import { lightImpact } from "@/lib/haptics";
import { ActionButton } from "@/components/action-button";

type MenuRow = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  detail?: string;
  onPress: () => void;
};

function SettingsSection({ title, rows }: { title: string; rows: MenuRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Pressable
            key={row.title}
            accessibilityRole="button"
            accessibilityLabel={row.title}
            style={[styles.row, index < rows.length - 1 ? styles.rowBorder : null]}
            onPress={row.onPress}
          >
            <View style={styles.icon}>
              <Feather name={row.icon} size={18} color={Brand.accent} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              {row.detail ? <Text style={styles.rowDetail}>{row.detail}</Text> : null}
            </View>
            <Feather name="chevron-right" size={18} color={Brand.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const brand = useBrand();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void getSessionUser().then((user) => {
        if (!mounted) return;
        setName(user.name);
        setEmail(user.email);
        setPhone(user.phone ?? "");
        setMemberSince(new Date(user.createdAt).getFullYear().toString());
      }).catch(() => { /* keep empty state on failure */ });
      return () => { mounted = false; };
    }, []),
  );

  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";

  const handleLogOut = () => {
    if (signingOut) return;
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              setSigningOut(true);
              await logout();
              lightImpact();
              router.replace("/(auth)/welcome");
            } catch {
              setSigningOut(false);
              Alert.alert("Could not log out", "Please try again.");
            }
          })();
        },
      },
    ]);
  };

  const preferenceRows: MenuRow[] = [
    {
      icon: "user",
      title: "Personal information",
      detail: "Name, email, phone",
      onPress: () => router.push("/profile/edit" as Href),
    },
    {
      icon: "lock",
      title: "Security",
      detail: "Auth0 sign-in",
      onPress: () => router.push("/profile/security" as Href),
    },
    {
      icon: "bell",
      title: "Notifications & appearance",
      detail: "Alerts and appearance",
      onPress: () => router.push("/profile/notifications" as Href),
    },
    {
      icon: "help-circle",
      title: "Help and support",
      detail: "FAQs and contact us",
      onPress: () => router.push("/ride/support"),
    },
  ];

  const moreRows: MenuRow[] = [
    {
      icon: "file-text",
      title: "Terms & privacy",
      detail: "Terms of Use and Privacy Policy",
      onPress: () => router.push("/legal" as Href),
    },
    {
      icon: "info",
      title: "About Eve",
      detail: "Version 1.0.0",
      onPress: () => Alert.alert("About Eve", "Your everyday ride, made simpler."),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: brand.canvas }]} edges={["top"]}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
        <View style={styles.identity}>
          <Text style={styles.name}>{name || "Loading..."}</Text>
          <Text style={styles.email}>{email}</Text>
          {phone ? <Text style={styles.email}>{phone}</Text> : null}
          <Text style={styles.member}>{memberSince ? `Member since ${memberSince}` : ""}</Text>
        </View>
        <Pressable style={styles.editButton} accessibilityLabel="Edit profile" onPress={() => router.push("/profile/edit" as Href)}>
          <Feather name="edit-2" size={16} color={Brand.accent} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Preferences" rows={preferenceRows} />
        <SettingsSection title="More" rows={moreRows} />
      </ScrollView>
      <View style={{ paddingBottom: insets.bottom + (Platform.OS === "ios" ? 64 : 12) }}>
        <ActionButton
          style={styles.logoutButton}
          textStyle={styles.logoutText}
          label="Log out"
          loadingLabel="Logging out..."
          loading={signingOut}
          onPress={handleLogOut}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four, backgroundColor: Brand.canvas },
  title: {
    marginBottom: Spacing.four,
    paddingTop: Platform.OS === "android" ? Spacing.three : Spacing.two,
    color: Brand.text,
    fontSize: 30,
    fontWeight: "800",
  },
  profileCard: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.four },
  avatar: { alignItems: "center", justifyContent: "center", width: 58, height: 58, borderRadius: 29, backgroundColor: Brand.surface },
  avatarText: { color: Brand.text, fontSize: 22, fontWeight: "800" },
  identity: { flex: 1, marginLeft: 14 },
  name: { color: Brand.text, fontSize: 18, fontWeight: "800" },
  email: { marginTop: 3, color: Brand.textSecondary, fontSize: 13 },
  member: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, color: Brand.textSecondary, backgroundColor: Brand.border, fontSize: 10, fontWeight: "600" },
  editButton: { alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 17, backgroundColor: Brand.surface },
  list: { flex: 1 },
  listContent: { paddingBottom: Spacing.three },
  section: { marginBottom: Spacing.three },
  sectionTitle: {
    marginBottom: 8,
    marginLeft: 4,
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  card: { backgroundColor: Brand.surface, borderRadius: 14, paddingHorizontal: 4 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 70, gap: 12, paddingHorizontal: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Brand.border },
  icon: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
  },
  copy: { flex: 1 },
  rowTitle: { color: Brand.text, fontSize: 16, fontWeight: "700" },
  rowDetail: { marginTop: 3, color: Brand.textSecondary, fontSize: 13 },
  logoutButton: { alignItems: "center", justifyContent: "center", marginBottom: 12, padding: 15, borderRadius: 12, backgroundColor: Brand.danger },
  logoutText: { color: Brand.surface, fontWeight: "700" },
});
