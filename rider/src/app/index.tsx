import { Redirect } from "expo-router";

export default function Index() {
  const AUTH_ENABLED = true;

  return (
    <Redirect href={AUTH_ENABLED ? "/(auth)/welcome" : "/(tabs)/home"} />
  );
}