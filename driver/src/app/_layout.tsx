import { Stack } from "expo-router";
import { AuthProvider } from "@/context/auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="ride/request" options={{ headerShown: false }} />
        <Stack.Screen name="ride/searching" options={{ headerShown: false }} />
        <Stack.Screen name="ride/tracking" options={{ headerShown: false }} />
        <Stack.Screen name="ride/completed" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/vehicle" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/documents" options={{ headerShown: false }} />
        <Stack.Screen name="legal" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
