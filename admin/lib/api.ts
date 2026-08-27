const TOKEN_KEY = "eve_admin_token";

function apiBase() {
  const value = process.env.NEXT_PUBLIC_API_URL;

  if (!value) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  return value.replace(/\/$/, "");
}

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function apiErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Something went wrong";
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.message ?? "Request failed",
    );
  }

  return payload as T;
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => escape(row[key])).join(",")),
  ].join("\n");
}

export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
