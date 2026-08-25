import { StyleSheet, Text, View } from "react-native";

export default function RidesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your rides</Text>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: "#f7f8ef",
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