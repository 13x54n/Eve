import { Host, FieldGroup, ListItem } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getSessionUser } from "@/services/auth";
import { useAuth } from "@/context/auth-context";
import { Brand, Spacing } from "@/constants/theme";
import { useBrand } from "@/context/theme-context";
import { lightImpact } from "@/lib/haptics";
import { ActionButton } from "@/components/action-button";

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
          <SymbolView name="pencil" tintColor={Brand.accent} size={17} />
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
      <Host matchContents>
        <FieldGroup>
          <FieldGroup.Section title="Preferences">
            <ListItem
              supportingText="Name, email, phone"
              leading={<SymbolView name="person.fill" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push("/profile/edit" as Href)}
            >
              Personal information
            </ListItem>
            <ListItem
              supportingText="Password"
              leading={<SymbolView name="lock.fill" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push("/profile/security" as Href)}
            >
              Security
            </ListItem>
            <ListItem
              supportingText="Alerts and appearance"
              leading={<SymbolView name="bell.fill" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push("/profile/notifications" as Href)}
            >
              Notifications & appearance
            </ListItem>
            <ListItem
              supportingText="FAQs and contact us"
              leading={<SymbolView name="questionmark.circle" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push("/ride/support")}
            >
              Help and support
            </ListItem>
          </FieldGroup.Section>
          <FieldGroup.Section title="More">
            <ListItem
              supportingText="Terms of Use and Privacy Policy"
              leading={<SymbolView name="doc.text" tintColor={Brand.accent} size={18} />}
              onPress={() => router.push("/legal" as Href)}
            >
              Terms & privacy
            </ListItem>
            <ListItem
              supportingText="Version 1.0.0"
              leading={<SymbolView name="info.circle" tintColor={Brand.accent} size={18} />}
              onPress={() => Alert.alert("About Eve", "Your everyday ride, made simpler.")}
            >
              About Eve
            </ListItem>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
      </View>
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
  logoutButton: { alignItems: "center", justifyContent: "center", marginBottom: 12, padding: 15, borderRadius: 12, backgroundColor: Brand.danger },
  logoutText: { color: Brand.surface, fontWeight: "700" },
});
