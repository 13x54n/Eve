"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getToken, setToken } from "@/lib/api";
import type { AdminUser } from "@/lib/permissions";

type AuthContextValue = {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      setLoading(false);
      return;
    }

    api<{ user: AdminUser }>("/auth/me")
      .then((result) => {
        if (result.user.role !== "ADMIN") {
          setToken(null);
          setUser(null);
          return;
        }

        setUser(result.user);
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const result = await api<{
          accessToken: string;
          user: AdminUser;
        }>("/auth/admin/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });

        setToken(result.accessToken);
        setUser(result.user);
      },
      logout() {
        setToken(null);
        setUser(null);
      },
    }),
    [user, loading],
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
