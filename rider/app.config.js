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

function relyingPartyHost() {
  const raw = process.env.EXPO_PUBLIC_PRIVY_RELYING_PARTY?.trim() ?? "";
  return raw.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
}

/** @param {{ config: import("expo/config").ExpoConfig }} ctx */
module.exports = ({ config }) => {
  const passkeyHost = relyingPartyHost();
  const associatedDomains = passkeyHost ? [`webcredentials:${passkeyHost}`] : [];

  return {
    ...config,
    ios: {
      ...config.ios,
      associatedDomains: [
        ...new Set([...(config.ios?.associatedDomains ?? []), ...associatedDomains]),
      ],
    },
    plugins: [
      ...(config.plugins ?? []),
      [
        "expo-build-properties",
        {
          ios: { deploymentTarget: "15.0" },
        },
      ],
    ],
  };
};
