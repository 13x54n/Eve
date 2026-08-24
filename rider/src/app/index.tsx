import { Redirect } from "expo-router";

export default function Index() {
  const isAuthenticated = false;

  return (
    <Redirect href={isAuthenticated ? "/(tabs)/home" : "/(auth)/welcome"} />
  );
}