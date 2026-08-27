import { Redirect } from "expo-router";
import { useAuth } from "@/context/auth-context";

export default function Index() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Redirect href={isAuthenticated ? "/(tabs)/home" : "/(auth)/welcome"} />
  );
}
