import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import { useAuth0 } from "react-native-auth0";
import {
  getAccessToken,
  getSessionUser,
  logout as clearStoredSession,
  type AuthResponse,
} from "@/services/auth";
import { AUTH0_CUSTOM_SCHEME } from "@/lib/auth0";
import { setPushNotificationsEnabled } from "@/services/notifications";

type SessionUser = AuthResponse["user"];

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { clearSession, isLoading: auth0Loading } = useAuth0();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await clearSession({}, { customScheme: AUTH0_CUSTOM_SCHEME });
    } catch {
      // Already signed out of Auth0, or the user cancelled the browser.
    }
    await clearStoredSession();
    setUser(null);
    setHasStoredSession(false);
  }, [clearSession]);

  useEffect(() => {
    if (auth0Loading) return;

    let cancelled = false;

    async function restoreSession() {
      const token = await getAccessToken();

      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const sessionUser = await getSessionUser();
        if (cancelled) return;
        setUser(sessionUser);
        setHasStoredSession(true);
      } catch (error) {
        if (cancelled) return;
        if (isUnauthorized(error)) {
          await logout();
        } else {
          setHasStoredSession(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [auth0Loading, logout]);

  useEffect(() => {
    setPushNotificationsEnabled(user?.pushNotificationsEnabled !== false);
  }, [user?.pushNotificationsEnabled]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: loading || auth0Loading,
      isAuthenticated: Boolean(user) || hasStoredSession,
      setUser: (nextUser) => {
        setUser(nextUser);
        setHasStoredSession(Boolean(nextUser));
      },
      logout,
    }),
    [user, loading, auth0Loading, hasStoredSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
