import "@/components/map/mapbox-token";
import { Stack } from "expo-router/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/context/auth-context";
import { RideSessionProvider } from "@/context/ride-session";
import { ThemeProvider } from "@/context/theme-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
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
              <Stack.Screen name="courier/request" options={{ headerShown: false }} />
              <Stack.Screen name="courier/track/[token]" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen name="legal" options={{ headerShown: false }} />
            </Stack>
          </RideSessionProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
