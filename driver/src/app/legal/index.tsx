import Feather from "@expo/vector-icons/Feather";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function LegalHubScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Terms & privacy</Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={styles.lead}>Review how Eve Driver works and how we handle your information.</Text>
      <View style={styles.card}>
        <Pressable style={[styles.row, styles.border]} onPress={() => router.push("/legal/terms" as Href)}>
          <View style={styles.icon}>
            <Feather name="file-text" size={18} color="#2E4ED5" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Driver Terms of Use</Text>
            <Text style={styles.detail}>Rules for driving with Eve</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9CA3AF" />
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push("/legal/privacy" as Href)}>
          <View style={styles.icon}>
            <Feather name="shield" size={18} color="#2E4ED5" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Privacy Policy</Text>
            <Text style={styles.detail}>How we collect and use your data</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#9CA3AF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8EF", paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    marginBottom: 20,
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
  lead: { marginBottom: 18, color: "#6B7280", fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 4 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 70, gap: 12, paddingHorizontal: 8 },
  border: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  icon: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
  },
  copy: { flex: 1 },
  title: { color: "#111827", fontSize: 14, fontWeight: "700" },
  detail: { marginTop: 3, color: "#6B7280", fontSize: 12 },
});
