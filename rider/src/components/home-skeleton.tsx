import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useBrand } from "@/context/theme-context";

export function HomeSkeleton() {
  const brand = useBrand();

  return (
    <View style={[styles.container, { backgroundColor: brand.canvas }]}>
      <Image
        source={{ uri: "https://ik.imagekit.io/lexy/Eve/logo.png?updatedAt=1787590363742" }}
        style={styles.logo}
      />

      {/* Greeting placeholder */}
      <View style={[styles.placeholder, styles.greetingPlaceholder]} />

      {/* Search bar placeholder */}
      <View style={[styles.placeholder, styles.searchPlaceholder]} />

      {/* Feature buttons placeholder */}
      <View style={styles.featuresRow}>
        <View style={[styles.placeholder, styles.featurePlaceholder]} />
        <View style={[styles.placeholder, styles.featurePlaceholder]} />
      </View>

      {/* Map/Image placeholder */}
      <View style={[styles.placeholder, styles.mapPlaceholder]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    paddingTop: 31,
  },
  logo: {
    width: 66,
    height: 66,
    marginTop: 26,
    marginHorizontal: "auto",
  },
  placeholder: {
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    opacity: 0.6,
  },
  greetingPlaceholder: {
    height: 24,
    width: "60%",
    marginTop: 32,
    marginBottom: 16,
    alignSelf: "center",
  },
  searchPlaceholder: {
    height: 56,
    marginBottom: 20,
    borderRadius: 18,
  },
  featuresRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  featurePlaceholder: {
    flex: 1,
    height: 140,
    borderRadius: 10,
  },
  mapPlaceholder: {
    width: "90%",
    height: 230,
    marginHorizontal: "auto",
    borderRadius: 12,
  },
});
