/**
 * Debug harness for AsyncStorage iOS compile failure (session 70c177).
 * Writes NDJSON to the session log, then runs expo run:ios.
 */
const fs = require("fs");
const { execSync, spawnSync } = require("child_process");

const LOG = "/Users/lex-work/Eve/.cursor/debug-70c177.log";
const sessionId = "70c177";
const runId = process.env.DEBUG_RUN_ID || "repro";

function log(hypothesisId, location, message, data) {
  // #region agent log
  fs.appendFileSync(
    LOG,
    JSON.stringify({
      sessionId,
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + "\n",
  );
  // #endregion
}

const pkg = require("../package.json");
const installed = require("../node_modules/@react-native-async-storage/async-storage/package.json");
let expoCheck = "";
try {
  expoCheck = execSync(
    "npx expo install @react-native-async-storage/async-storage --check",
    { encoding: "utf8", cwd: __dirname + "/.." },
  );
} catch (e) {
  expoCheck = `${e.stdout || ""}${e.stderr || ""}`;
}

const storageRegistryPath =
  "node_modules/@react-native-async-storage/async-storage/apple/storage/StorageRegistry.swift";
const hasStorageRegistry = fs.existsSync(storageRegistryPath);
const xcconfigPath =
  "ios/Pods/Target Support Files/AsyncStorage/AsyncStorage.debug.xcconfig";
const xcconfig = fs.existsSync(xcconfigPath)
  ? fs.readFileSync(xcconfigPath, "utf8")
  : "";
const headerSearch =
  (xcconfig.match(/^HEADER_SEARCH_PATHS = (.*)$/m) || [])[1] || "";
const xcodeVersion = execSync("xcodebuild -version", { encoding: "utf8" }).trim();
const appConfig = fs.readFileSync("app.config.js", "utf8");

log("A", "debug-asyncstorage-ios.js", "version vs Expo expected", {
  installedVersion: installed.version,
  packageJsonRange: pkg.dependencies["@react-native-async-storage/async-storage"],
  isExpoExpected220: installed.version === "2.2.0",
  expoCheckHasOutdated:
    /expected version:\s*2\.2\.0/.test(expoCheck) &&
    installed.version !== "2.2.0",
});

log("F", "debug-asyncstorage-ios.js", "3.x Swift StorageRegistry presence", {
  hasStorageRegistry,
  usesLegacyObjCPath: fs.existsSync(
    "node_modules/@react-native-async-storage/async-storage/ios/RNCAsyncStorage.mm",
  ),
});

const reactCodegenXc =
  "ios/Pods/Target Support Files/ReactCodegen/ReactCodegen.debug.xcconfig";
const reactCodegenHeaders = fs.existsSync(reactCodegenXc)
  ? fs.readFileSync(reactCodegenXc, "utf8")
  : "";
const reactCodegenHeaderSearch =
  (reactCodegenHeaders.match(/^HEADER_SEARCH_PATHS = (.*)$/m) || [])[1] || "";

log("D", "debug-asyncstorage-ios.js", "RNCore header plugin scope", {
  pluginWired: appConfig.includes("with-rncore-header-search"),
  asyncStorageHasReactXcframework: headerSearch.includes(
    "React.xcframework/Headers",
  ),
  reactCodegenHasReactXcframework: reactCodegenHeaderSearch.includes(
    "React.xcframework/Headers",
  ),
});

log("E", "debug-asyncstorage-ios.js", "Xcode version", {
  xcodeVersion,
  isXcode26Plus: /Xcode 2[6-9]/.test(xcodeVersion),
});

const device = process.argv[2] || "12 mini";
console.log(`Running: npx expo run:ios --device "${device}"`);
const result = spawnSync(
  "npx",
  ["expo", "run:ios", "--device", device],
  { cwd: __dirname + "/..", encoding: "utf8", env: process.env },
);

const combined = `${result.stdout || ""}\n${result.stderr || ""}`;
const foundationError = combined.includes("without importing module 'Foundation'");
const nsobjectError = combined.includes("cannot find type 'NSObject'");
const buildFailed = result.status !== 0;

log("BUILD", "debug-asyncstorage-ios.js", "expo run:ios result", {
  exitCode: result.status,
  buildFailed,
  foundationError,
  nsobjectError,
  errorSnippet: combined
    .split("\n")
    .filter(
      (l) =>
        /error:|Foundation|NSObject|StorageRegistry|AsyncStorage|BUILD SUCCEEDED|BUILD FAILED/i.test(
          l,
        ),
    )
    .slice(0, 40),
});

process.exit(result.status ?? 1);
