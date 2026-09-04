import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

/** Android tab scenes collapse to height 0 unless the root is a non-collapsable flex box. */
export function TabScreen({
  children,
  style,
  edges = ["top"],
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: readonly Edge[];
}) {
  return (
    <View style={{ flex: 1, height: "100%", width: "100%" }} collapsable={false}>
      <SafeAreaView style={[{ flex: 1 }, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}
