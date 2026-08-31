import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBrand } from "@/context/theme-context";

export default function SecurityScreen() {
  const brand = useBrand();
  const styles = makeStyles(brand);

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
          Sign-in is managed by Auth0. Use “Forgot password” on the Auth0 login screen to reset your password.
        </Text>
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
