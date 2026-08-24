import { StyleSheet, Text, View } from "react-native";

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.name}>Rider account</Text>
      <Text style={styles.email}>rider@example.com</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F9FAFB",
  },
  title: {
    marginTop: 24,
    marginBottom: 32,
    fontSize: 28,
    fontWeight: "800",
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
  },
  email: {
    marginTop: 6,
    color: "#6B7280",
  },
});