"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useApi<T>(path: string | null, options?: { intervalMs?: number }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(path));
  const intervalMs = options?.intervalMs;

  const reload = useCallback(async () => {
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
  }, [path]);

  useEffect(() => {
    let cancelled = false;

    if (!path) {
      Promise.resolve().then(() => {
        if (!cancelled) {
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

    if (!intervalMs) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(() => {
      api<T>(path)
        .then((result) => {
          if (!cancelled) {
            setData(result);
            setError("");
          }
        })
        .catch((caught) => {
          if (!cancelled) {
            setError(caught instanceof Error ? caught.message : "Request failed");
          }
        });
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [path, intervalMs]);

  return { data, error, loading, reload, setData };
}
