import "@/components/map/mapbox-token";
import { Stack } from "expo-router/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PrivyProvider } from "@privy-io/expo";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { DriverNotificationsProvider } from "@/context/driver-notifications";
import { ThemeProvider } from "@/context/theme-context";
import { NetworkProvider } from "@/context/network-context";
import { requirePrivyConfig } from "@/lib/privy";
import { AuthLoading } from "@/components/auth-loading";

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
              <DriverNotificationsProvider>
                <RootNavigator />
              </DriverNotificationsProvider>
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
    return <AuthLoading />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
    >
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trip/[id]" />
        <Stack.Screen name="trip/offer" options={{ gestureEnabled: false }} />
        <Stack.Screen name="trip/chat" />
        <Stack.Screen name="trip/support" />
        <Stack.Screen name="trip/support/[id]" />
        <Stack.Screen name="ride/request" />
        <Stack.Screen name="ride/searching" />
        <Stack.Screen name="ride/tracking" />
        <Stack.Screen name="ride/completed" />
        <Stack.Screen name="onboarding/vehicle" />
        <Stack.Screen name="onboarding/documents" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="legal" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
