const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const BIOMETRIC_GATE =
  /if LAContext\(\)\.biometricType == \.none \{\s*throw BiometricException\(\)\s*\}/;

const DEVICE_AUTH_GATE = `if !LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) {
      throw BiometricException()
    }`;

function passkeysModulePath(projectRoot) {
  return path.join(
    projectRoot,
    "node_modules/react-native-passkeys/ios/ReactNativePasskeysModule.swift",
  );
}

function patchPasskeysModule(projectRoot) {
  const file = passkeysModulePath(projectRoot);
  if (!fs.existsSync(file)) return;
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(".canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)")) {
    return;
  }
  if (!BIOMETRIC_GATE.test(source)) {
    throw new Error(
      "react-native-passkeys isAvailable() biometric gate not found; update with-passkey-passcode-fallback.js",
    );
  }
  fs.writeFileSync(file, source.replace(BIOMETRIC_GATE, DEVICE_AUTH_GATE));
}

/** Allow Face ID, Touch ID, or device passcode for react-native-passkeys create/get. */
function withPasskeyPasscodeFallback(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      patchPasskeysModule(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);
}

module.exports = withPasskeyPasscodeFallback;
module.exports.patchPasskeysModule = patchPasskeysModule;
