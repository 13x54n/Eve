import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/auth-context";
import { RideSessionProvider } from "@/context/ride-session";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RideSessionProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="ride/request" options={{ headerShown: false }} />
            <Stack.Screen name="ride/searching" options={{ headerShown: false }} />
            <Stack.Screen name="ride/tracking" options={{ headerShown: false }} />
            <Stack.Screen name="ride/completed" options={{ headerShown: false }} />
            <Stack.Screen name="ride/chat" options={{ headerShown: false }} />
            <Stack.Screen name="ride/support" options={{ headerShown: false }} />
            <Stack.Screen name="ride/support/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="legal" options={{ headerShown: false }} />
          </Stack>
        </RideSessionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
