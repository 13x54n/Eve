import { Redirect, usePathname } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { AuthLoading } from "@/components/auth-loading";

export default function Index() {
  const { loading, isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return <AuthLoading />;
  }

  if (pathname !== "/" && pathname !== "/index") {
    return null;
  }

  return (
    <Redirect href={isAuthenticated ? "/(tabs)/home" : "/(auth)/welcome"} />
  );
}
