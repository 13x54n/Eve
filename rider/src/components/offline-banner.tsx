import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, View } from "react-native";
import { useNetwork } from "@/context/network-context";
import { useEffect, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export function OfflineBanner() {
  const { isOnline, isConnected } = useNetwork();
  const [visible, setVisible] = useState(!isOnline);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!isOnline) {
      setVisible(true);
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withTiming(-100, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 }, () => {
        setVisible(false);
      });
    }
  }, [isOnline, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible && isOnline) {
    return null;
  }

  return (
    <Animated.View style={[styles.banner, animatedStyle]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Feather name="wifi-off" size={16} color="#DC2626" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {!isConnected ? "No Connection" : "No Internet"}
          </Text>
          <Text style={styles.subtitle}>
            {!isConnected
              ? "Check your network settings"
              : "Some features may be limited"}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FEE2E2",
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#991B1B",
  },
  subtitle: {
    fontSize: 12,
    color: "#B91C1C",
    marginTop: 2,
  },
});
