import type { CorsOptions } from "cors";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8082",
];

export function allowedOrigins(raw = process.env.CORS_ORIGINS): string[] {
  if (!raw?.trim()) {
    return [...DEFAULT_CORS_ORIGINS];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function corsOptions(): CorsOptions {
  const allowed = new Set(allowedOrigins());

  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  };
}
