const LOCAL_API_HOST =
  /localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\./i;

export function requireApiBaseUrl(appLabel: "rider" | "driver"): string {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!value) {
    throw new Error(
      `EXPO_PUBLIC_API_URL is not configured. For local work set it in ${appLabel}/.env. For store builds set it in ${appLabel}/eas.json (preview/production env) or as an EAS secret.`,
    );
  }

  if (!__DEV__ && (LOCAL_API_HOST.test(value) || value.includes("REPLACE_WITH"))) {
    throw new Error(
      "Production builds require a public EXPO_PUBLIC_API_URL. Replace the placeholder in eas.json or create an EAS secret before building.",
    );
  }

  return value;
}
