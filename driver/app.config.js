const fs = require("fs");
const path = require("path");

function applyDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

applyDotEnv();

/** @param {{ config: import("expo/config").ExpoConfig }} ctx */
module.exports = ({ config }) => {
  const domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN?.trim();
  if (!domain) {
    throw new Error(
      "EXPO_PUBLIC_AUTH0_DOMAIN is required for the Auth0 native plugin. Set it in driver/.env.",
    );
  }

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ["react-native-auth0", { domain, customScheme: "evedriver" }],
    ],
  };
};
