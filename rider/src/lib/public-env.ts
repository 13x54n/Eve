const LOCAL_API_HOST =
  /localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\./i;

function requirePublicUrl(name: string, appLabel: "rider" | "driver"): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured. For local work set it in ${appLabel}/.env. For store builds set it in ${appLabel}/eas.json (preview/production env) or as an EAS secret.`,
    );
  }

  if (!__DEV__ && (LOCAL_API_HOST.test(value) || value.includes("REPLACE_WITH"))) {
    throw new Error(
      `Production builds require a public ${name}. Replace the placeholder in eas.json or create an EAS secret before building.`,
    );
  }

  return value.replace(/\/$/, "");
}

export function requireApiBaseUrl(appLabel: "rider" | "driver"): string {
  return requirePublicUrl("EXPO_PUBLIC_API_URL", appLabel);
}

export function requireAuthBaseUrl(appLabel: "rider" | "driver"): string {
  return requirePublicUrl("EXPO_PUBLIC_AUTH_URL", appLabel);
}

export function requireWsUrl(appLabel: "rider" | "driver"): string {
  return requirePublicUrl("EXPO_PUBLIC_WS_URL", appLabel);
}
