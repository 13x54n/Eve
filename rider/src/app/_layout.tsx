import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="ride/request" options={{ title: "Request a ride" }} />
      <Stack.Screen name="ride/searching" options={{ headerShown: false }} />
      <Stack.Screen name="ride/tracking" options={{ headerShown: false }} />
      <Stack.Screen name="ride/completed" options={{ headerShown: false }} />
    </Stack>
  );
}