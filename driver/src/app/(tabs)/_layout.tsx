import { View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Brand } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }} collapsable={false}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Brand.accent,
          tabBarInactiveTintColor: Brand.muted,
          tabBarStyle: { backgroundColor: Brand.surface },
          sceneStyle: { flex: 1, backgroundColor: Brand.canvas },
        }}
      >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}
