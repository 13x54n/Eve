import "@/components/map/mapbox-token";
import { Stack } from "expo-router/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PrivyProvider } from "@privy-io/expo";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { RideSessionProvider } from "@/context/ride-session";
import { ThemeProvider } from "@/context/theme-context";
import { NetworkProvider } from "@/context/network-context";
import { requirePrivyConfig } from "@/lib/privy";

export default function RootLayout() {
  const { appId, clientId } = requirePrivyConfig();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NetworkProvider>
          <PrivyProvider
            appId={appId}
            clientId={clientId}
            config={{
              embedded: {
                ethereum: { createOnLogin: "users-without-wallets" },
                solana: { createOnLogin: "users-without-wallets" },
              },
            }}
          >
            <AuthProvider>
              <RideSessionProvider>
                <RootNavigator />
              </RideSessionProvider>
            </AuthProvider>
          </PrivyProvider>
        </NetworkProvider>
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
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ride/request" />
        <Stack.Screen name="ride/searching" />
        <Stack.Screen name="ride/tracking" />
        <Stack.Screen name="ride/completed" />
        <Stack.Screen name="ride/chat" />
        <Stack.Screen name="ride/support" />
        <Stack.Screen name="ride/support/[id]" />
        <Stack.Screen name="courier/request" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="legal" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="courier/track/[token]" />
      </Stack.Protected>
    </Stack>
  );
}
