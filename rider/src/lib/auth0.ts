import {
  WebAuthError,
  WebAuthErrorCodes,
  useAuth0,
} from "react-native-auth0";

export const AUTH0_CUSTOM_SCHEME = "eve";
export const AUTH0_SCOPE = "openid profile email offline_access";

function auth0Host(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
}

export function requireAuth0Config() {
  const domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN?.trim();
  const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID?.trim();
  if (!domain || !clientId) {
    throw new Error(
      "EXPO_PUBLIC_AUTH0_DOMAIN and EXPO_PUBLIC_AUTH0_CLIENT_ID are not set",
    );
  }
  return { domain: auth0Host(domain), clientId };
}

export function isAuth0Cancelled(error: unknown) {
  return (
    error instanceof WebAuthError &&
    error.type === WebAuthErrorCodes.USER_CANCELLED
  );
}

export function useAuth0Authorize() {
  const { authorize, getCredentials } = useAuth0();

  return async function authorizeAndGetIdToken(mode: "login" | "signup") {
    await authorize(
      {
        scope: AUTH0_SCOPE,
        ...(mode === "signup"
          ? { additionalParameters: { screen_hint: "signup" } }
          : {}),
      },
      { customScheme: AUTH0_CUSTOM_SCHEME },
    );
    const credentials = await getCredentials();
    if (!credentials?.idToken) {
      throw new Error("Auth0 did not return an ID token");
    }
    return credentials.idToken;
  };
}
