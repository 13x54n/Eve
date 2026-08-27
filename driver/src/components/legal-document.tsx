import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { LegalDocument } from "@/legal/content";

export function LegalDocumentView({ document }: { document: LegalDocument }) {
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {document.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated {document.lastUpdated}</Text>
        <Text style={styles.intro}>{document.intro}</Text>
        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.paragraph}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8EF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#F7F8EF",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  headerSpacer: { width: 40 },
  body: { padding: 20, paddingBottom: 48 },
  updated: { marginBottom: 12, color: "#6B7280", fontSize: 12, fontWeight: "600" },
  intro: { marginBottom: 22, color: "#374151", fontSize: 15, lineHeight: 22 },
  section: { marginBottom: 20 },
  heading: { marginBottom: 8, color: "#111827", fontSize: 16, fontWeight: "700" },
  paragraph: { color: "#374151", fontSize: 15, lineHeight: 22 },
});
