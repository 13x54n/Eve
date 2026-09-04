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
import { setPushNotificationsEnabled } from "@/services/notifications";
import { OfflineStorage } from "@/lib/offline-storage";
import { useNetwork } from "@/context/network-context";
import { actionQueue } from "@/lib/action-queue";
import { registerTripMutationHandlers } from "@/services/trip-mutations";

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
  return (
    axios.isAxiosError(error) &&
    (error.response?.status === 401 || error.response?.status === 404)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { clearCredentials, isLoading: auth0Loading } = useAuth0();
  const { isOnline } = useNetwork();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    // Do not await Auth0 webAuth.clearSession. Custom Tabs / ASWebAuthenticationSession
    // often never return from /v2/logout, which freezes Sign out on "Signing out...".
    // Local credentials + Eve token are enough; the next authorize() uses prompt=login.
    void clearCredentials().catch(() => {});
    await Promise.allSettled([
      clearStoredSession(),
      OfflineStorage.clear(),
      actionQueue.clear(),
    ]);
    setUser(null);
    setHasStoredSession(false);
  }, [clearCredentials]);

  useEffect(() => {
    if (auth0Loading) return;

    let cancelled = false;

    async function restoreSession() {
      const token = await getAccessToken();

      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      const cachedUser = await OfflineStorage.get<SessionUser>("USER_PROFILE");
      if (cachedUser && !cancelled) {
        setUser(cachedUser);
        setHasStoredSession(true);
      }

      if (!isOnline && cachedUser) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const sessionUser = await getSessionUser();
        if (cancelled) return;
        setUser(sessionUser);
        setHasStoredSession(true);
        await OfflineStorage.set("USER_PROFILE", sessionUser);
      } catch (error) {
        if (cancelled) return;
        if (isUnauthorized(error)) {
          await logout();
        } else {
          if (cachedUser) {
            setUser(cachedUser);
          }
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
  }, [auth0Loading, logout, isOnline]);

  useEffect(() => {
    void actionQueue.initialize();
    registerTripMutationHandlers();
  }, []);

  useEffect(() => {
    if (isOnline) {
      void actionQueue.process(true);
    }
  }, [isOnline]);

  useEffect(() => {
    setPushNotificationsEnabled(user?.pushNotificationsEnabled !== false);
  }, [user?.pushNotificationsEnabled]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: loading || auth0Loading,
      isAuthenticated: Boolean(user) || hasStoredSession,
      setUser: async (nextUser) => {
        setUser(nextUser);
        setHasStoredSession(Boolean(nextUser));
        if (nextUser) {
          await OfflineStorage.set("USER_PROFILE", nextUser);
        }
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
