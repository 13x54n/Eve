import { StyleSheet, Text, View } from "react-native";

export default function RidesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your rides</Text>
      <Text style={styles.empty}>You have no rides yet.</Text>
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
    fontSize: 28,
    fontWeight: "800",
  },
  empty: {
    marginTop: 40,
    textAlign: "center",
    color: "#6B7280",
  },
});