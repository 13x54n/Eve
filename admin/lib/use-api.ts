"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(path));

  async function reload() {
    if (!path) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      setData(await api<T>(path));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { data, error, loading, reload, setData };
}
