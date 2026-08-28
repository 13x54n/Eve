import Feather from "@expo/vector-icons/Feather";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getSessionUser } from "@/services/auth";
import { useAuth } from "@/context/auth-context";
import { Image } from "expo-image";

const items = [
  ["map-pin", "Saved places", "Home, Work and more"],
  ["bell", "Notifications", "Ride updates and offers"],
  ["help-circle", "Help and support", "FAQs and contact us"],
] as const;

export default function ProfileScreen() {
  const { logout } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");

  useEffect(() => {
    let mounted = true;
    void getSessionUser().then((user) => {
      if (!mounted) return;
      setName(user.name);
      setEmail(user.email);
      setMemberSince(new Date(user.createdAt).getFullYear().toString());
    }).catch(() => { /* keep empty state on failure */ });
    return () => { mounted = false; };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Text style={styles.title}>Profile</Text></View>
      <View style={styles.profileCard}>

          <Image
            source={{ uri: 'https://images.unsplash.com/vector-1755257875851-08e44758a35b?q=80&w=1480&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D' }}
            style={styles.avatar}
          />

        <View style={styles.identity}><Text style={styles.name}>{name || "Loading..."}</Text><Text style={styles.email}>{email}</Text><Text style={styles.member}>{memberSince ? `Member since ${memberSince}` : ""}</Text></View>
        <Pressable style={styles.editButton} accessibilityLabel="Edit profile" onPress={() => Alert.alert("Edit profile", "Profile editing will be available soon.")}><Feather name="edit-2" size={17} color="#2E4ED5" /></Pressable>
      </View>
      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.menuCard}>{items.map((item, index) => <Pressable key={item[1]} style={[styles.menuItem, index < items.length - 1 && styles.menuBorder]} onPress={() => item[1] === "Help and support" ? router.push("/ride/support") : Alert.alert(item[1], item[2])}><View style={styles.menuIcon}><Feather name={item[0]} size={18} color="#2E4ED5" /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>{item[1]}</Text><Text style={styles.menuDetail}>{item[2]}</Text></View><Feather name="chevron-right" size={18} color="#9CA3AF" /></Pressable>)}</View>
      <Text style={styles.sectionTitle}>More</Text>
      <View style={styles.menuCard}>
        <Pressable style={[styles.menuItem, styles.menuBorder]} onPress={() => router.push("/legal" as Href)}>
          <View style={styles.menuIcon}><Feather name="file-text" size={18} color="#2E4ED5" /></View>
          <View style={styles.menuCopy}><Text style={styles.menuTitle}>Terms & privacy</Text><Text style={styles.menuDetail}>Terms of Use and Privacy Policy</Text></View>
          <Feather name="chevron-right" size={18} color="#9CA3AF" />
        </Pressable>
        <Pressable style={styles.menuItem} onPress={() => Alert.alert("About Eve", "Your everyday ride, made simpler.")}>
          <View style={styles.menuIcon}><Feather name="info" size={18} color="#2E4ED5" /></View>
          <View style={styles.menuCopy}><Text style={styles.menuTitle}>About Eve</Text><Text style={styles.menuDetail}>Version 1.0.0</Text></View>
          <Feather name="chevron-right" size={18} color="#9CA3AF" />
        </Pressable>
      </View>
      <Pressable style={styles.logoutButton} onPress={() => { void logout().then(() => router.replace("/(auth)/welcome")); }}><Feather name="log-out" size={18} color="#ffffff" /><Text style={styles.logoutText}>Log out</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 56, backgroundColor: "#F7F8EF" },
  header: { marginBottom: 22 },
  eyebrow: { color: "#6B7280", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  title: { marginTop: 4, color: "#111827", fontSize: 30, fontWeight: "800" },
  profileCard: { flexDirection: "row", alignItems: "center", marginBottom: 30,  },
  avatar: { alignItems: "center", justifyContent: "center", width: 58, height: 58, borderRadius: 29, backgroundColor: "#FDE68A" },
  avatarText: { color: "#111827", fontSize: 22, fontWeight: "800" },
  identity: { flex: 1, marginLeft: 14 },
  name: { color: "#111827", fontSize: 18, fontWeight: "800" },
  email: { marginTop: 3, color: "#6B7280", fontSize: 13 },
  member: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, color: "#6B7280", backgroundColor: "#E5E7EB", fontSize: 10, fontWeight: "600" },
  editButton: { alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 17, backgroundColor: "#FFFFFF" },
  sectionTitle: { marginBottom: 10, color: "#374151", fontSize: 14, fontWeight: "700" },
  menuCard: { marginBottom: 26,  },
  menuItem: { flexDirection: "row", alignItems: "center", minHeight: 70, gap: 12 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  menuIcon: { alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 10, backgroundColor: "#EEF2FF" },
  menuCopy: { flex: 1 },
  menuTitle: { color: "#111827", fontSize: 14, fontWeight: "700" },
  menuDetail: { marginTop: 3, color: "#6B7280", fontSize: 12 },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: "auto", marginBottom: 12, padding: 15, borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, backgroundColor: "red" },
  logoutText: { color: "#ffff", fontWeight: "700" },
});
