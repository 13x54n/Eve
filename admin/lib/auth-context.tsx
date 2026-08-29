"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  ApiError,
  clearTokens,
  getRefreshToken,
  getToken,
  setAfterTokenRefresh,
  setSessionTokens,
} from "@/lib/api";
import type { AdminUser } from "@/lib/permissions";
import {
  connectAdminSocket,
  disconnectAdminSocket,
  reconnectAdminSocket,
} from "@/lib/socket";

type AuthContextValue = {
  user: AdminUser | null;
  loading: boolean;
  hasSession: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function hasStoredTokens() {
  return Boolean(getToken() || getRefreshToken());
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setAfterTokenRefresh(() => {
      reconnectAdminSocket();
    });
    return () => setAfterTokenRefresh(null);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await api("/auth/admin/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Local sign-out still proceeds if the revoke call fails.
      }
    }

    disconnectAdminSocket();
    clearTokens();
    setUser(null);
    setHasSession(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!hasStoredTokens()) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const result = await api<{ user: AdminUser }>("/auth/me");
        if (cancelled) return;

        if (result.user.role !== "ADMIN") {
          await logout();
          return;
        }

        setUser(result.user);
        setHasSession(true);
        connectAdminSocket();
      } catch (error) {
        if (cancelled) return;

        const unauthenticated =
          error instanceof ApiError &&
          error.status === 401 &&
          !getRefreshToken();

        if (unauthenticated) {
          disconnectAdminSocket();
          clearTokens();
          setUser(null);
          setHasSession(false);
        } else if (hasStoredTokens()) {
          setHasSession(true);
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
      hasSession,
      async login(email, password) {
        const result = await api<{
          accessToken: string;
          refreshToken: string;
          user: AdminUser;
        }>("/auth/admin/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        setSessionTokens(result.accessToken, result.refreshToken);
        setUser(result.user);
        setHasSession(true);
        reconnectAdminSocket();
      },
      logout,
    }),
    [user, loading, hasSession, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
