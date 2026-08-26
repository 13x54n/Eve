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
    let cancelled = false;

    if (!path) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");

    api<T>(path)
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Request failed");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, error, loading, reload, setData };
}
