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
import {
  getAccessToken,
  getSessionUser,
  logout as clearStoredSession,
  type AuthResponse,
} from "@/services/auth";

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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearStoredSession();
    setUser(null);
    setHasStoredSession(false);
  }, []);

  useEffect(() => {
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
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user) || hasStoredSession,
      setUser: (nextUser) => {
        setUser(nextUser);
        setHasStoredSession(Boolean(nextUser));
      },
      logout,
    }),
    [user, loading, hasStoredSession, logout],
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
