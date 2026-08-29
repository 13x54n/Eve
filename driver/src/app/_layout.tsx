import "@/components/map/mapbox-token";
import { Stack } from "expo-router/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { DriverNotificationsProvider } from "@/context/driver-notifications";
import { ThemeProvider } from "@/context/theme-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <DriverNotificationsProvider>
            <RootNavigator />
          </DriverNotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Stack>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="trip/chat" options={{ headerShown: false }} />
        <Stack.Screen name="trip/support" options={{ headerShown: false }} />
        <Stack.Screen name="trip/support/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="ride/request" options={{ headerShown: false }} />
        <Stack.Screen name="ride/searching" options={{ headerShown: false }} />
        <Stack.Screen name="ride/tracking" options={{ headerShown: false }} />
        <Stack.Screen name="ride/completed" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/vehicle" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/documents" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="legal" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
