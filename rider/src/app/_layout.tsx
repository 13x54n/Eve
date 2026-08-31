import "@/components/map/mapbox-token";
import { Stack } from "expo-router/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Auth0Provider } from "react-native-auth0";
import { AuthProvider } from "@/context/auth-context";
import { RideSessionProvider } from "@/context/ride-session";
import { ThemeProvider } from "@/context/theme-context";
import { requireAuth0Config } from "@/lib/auth0";

export default function RootLayout() {
  const { domain, clientId } = requireAuth0Config();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Auth0Provider domain={domain} clientId={clientId}>
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
        </Auth0Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
