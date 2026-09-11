import { ActivityIndicator, StyleSheet, View } from "react-native";

export function AuthLoading() {
  return (
    <View style={styles.screen} accessibilityLabel="Loading">
      <ActivityIndicator color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#2e4ed2",
    alignItems: "center",
    justifyContent: "center",
  },
});
