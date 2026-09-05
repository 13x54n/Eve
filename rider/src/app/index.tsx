import { Redirect, usePathname } from "expo-router";
import { useAuth } from "@/context/auth-context";
import { AuthLoading } from "@/components/auth-loading";

export default function Index() {
  const { loading, isAuthenticated } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return <AuthLoading />;
  }

  // Index stays mounted under the root stack. Redirecting on every render
  // sends /ride/request back to home — only redirect when this route is showing.
  if (pathname !== "/" && pathname !== "/index") {
    return null;
  }

  return (
    <Redirect href={isAuthenticated ? "/(tabs)/home" : "/(auth)/welcome"} />
  );
}
