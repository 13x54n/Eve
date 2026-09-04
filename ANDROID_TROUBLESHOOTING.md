# Android Development Troubleshooting

This guide covers common Android development issues and their solutions for Eve Rider and Driver apps.

## Table of Contents

- [Native Module Errors](#native-module-errors)
- [Metro Bundler Connection Issues](#metro-bundler-connection-issues)
- [When to Rebuild Native Apps](#when-to-rebuild-native-apps)
- [Complete Setup Workflow](#complete-setup-workflow)
- [Common Error Messages](#common-error-messages)

## Native Module Errors

### NoClassDefFoundError / Class Not Found

**Symptoms:**
```
java.lang.NoClassDefFoundError: Failed resolution of: Lcom/facebook/react/viewmanagers/RNSScreenContainerManagerInterface
```
or
```
Error: Exception in HostFunction: [native module error]
```

**Cause:** Your native Android build is out of sync with your JavaScript dependencies. This happens when:
- You've run `npm install` and added/updated native dependencies
- You've changed `app.json` plugins
- You've switched branches that have different native dependencies
- The dev client build is stale

**Solution:** Full native rebuild required.

```bash
# macOS/Linux
npm run android:rebuild

# Windows
npm run android:rebuild:win
```

This script will:
1. Clean Android build artifacts
2. Reinstall dependencies
3. Clear Metro cache
4. Rebuild the native Android app (takes 5-10 minutes)

### Privy "Cannot determine native application ID"

**Symptoms:**
```
Error: Cannot determine native application ID. Please make sure expo-application is installed
```

**Cause:** The Privy SDK needs `expo-application` to be installed AND the native app needs to be rebuilt with it.

**Solution:**
1. Verify `expo-application` is in `package.json` dependencies
2. Run full rebuild: `npm run android:rebuild` (or `:rebuild:win`)
3. The native build will include expo-application's native modules

## Metro Bundler Connection Issues

### ECONNREFUSED (Android Emulator)

**Symptoms:**
```
Failed to connect to /10.0.2.2:8081
Caused by: ECONNREFUSED
```
or
App stuck on "Reloading..." screen

**Cause:** Android emulator cannot reach Metro bundler. The emulator tries to connect to `10.0.2.2:8081` (the host machine from emulator's perspective), but the connection isn't set up.

**Solution:** Use `adb reverse` to forward the port.

**Automatic (Recommended):**
```bash
# macOS/Linux
npm run android:dev

# Windows
npm run android:dev:win
```

**Manual:**
```bash
# 1. Check emulator is running
adb devices

# 2. Set up port forwarding
adb reverse tcp:8081 tcp:8081

# 3. Start Metro
npx expo start --android --port 8081
```

### Why adb reverse is needed

The Android emulator runs in its own network namespace. When your app tries to connect to `localhost:8081`, it's looking for Metro on the emulator itself, not your host machine.

`adb reverse` creates a reverse proxy:
- Emulator port 8081 → Host port 8081
- App can now reach Metro at `localhost:8081`

**Note:** iOS simulator and physical devices don't need this. iOS simulator shares the host's network, and physical devices use your machine's LAN IP.

### Correct Metro Start Command

For Android emulator development:
```bash
npx expo start --android --port 8081
```

The `--android` flag optimizes for Android, and `--port 8081` ensures consistency (default is 8081, but explicit is better).

## When to Rebuild Native Apps

### Always Rebuild When:

1. **After `npm install` with new native dependencies**
   - Added packages with native modules (e.g., `expo-*`, `react-native-*`, `@react-native-*`)
   - Updated existing native dependencies
   - Switched branches with different dependencies

2. **After changing `app.json` or `app.config.js`**
   - Modified `plugins` array
   - Changed `ios.bundleIdentifier` or `android.package`
   - Updated config plugin options

3. **After changing native code** (if you're working on custom native modules)
   - Modified `android/` directory
   - Changed `AndroidManifest.xml` indirectly via plugins

4. **When you see native errors**
   - `NoClassDefFoundError`
   - `Native module cannot be null`
   - `Method not found` errors
   - Crashes during app initialization

### NO Rebuild Needed For:

- JavaScript/TypeScript code changes
- Styling changes
- Component updates
- Most app logic changes
- Environment variable changes (just restart Metro)

## Complete Setup Workflow

### First Time Setup

```bash
# 1. Clone and install
git clone <repo>
cd Eve/rider  # or driver

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Build native app (REQUIRED FIRST TIME)
npx expo run:android
# This builds the dev client (5-10 minutes)

# 5. For subsequent development, use the dev script
npm run android:dev  # (or android:dev:win on Windows)
```

### Daily Development Workflow

**Once the native app is built**, your workflow is:

```bash
# 1. Start Metro with adb reverse
npm run android:dev  # macOS/Linux
# or
npm run android:dev:win  # Windows

# 2. Open the app on your emulator
# (It's already installed from the initial build)

# 3. Make JS/TS changes
# Metro will hot reload automatically

# 4. Only rebuild if you:
#    - Install/update native dependencies
#    - Change app.json plugins
#    - See native errors
```

### After Adding Native Dependencies

```bash
# Install the new package
npm install some-native-package

# Full rebuild required
npm run android:rebuild  # macOS/Linux
# or
npm run android:rebuild:win  # Windows
```

## Common Error Messages

### "Reloading..." Forever

**Cause:** Metro not connected

**Fix:**
1. Ensure Metro is running: `npm run android:dev`
2. Ensure adb reverse is set: `adb reverse tcp:8081 tcp:8081`
3. Check Metro is on port 8081: `curl http://localhost:8081/status`

### "Unable to resolve module"

**Cause:** Metro cache issue or missing dependency

**Fix:**
```bash
# Clear Metro cache
npx expo start --clear

# Or reinstall
rm -rf node_modules
npm install
```

### "The development server returned response error code: 500"

**Cause:** Metro bundler error (syntax error, import issue)

**Fix:**
1. Check Metro terminal for the actual error
2. Fix the JavaScript error
3. Reload the app (R, R in Metro or shake device → Reload)

### "Command failed: ./gradlew"

**Cause:** Gradle build error

**Fix:**
```bash
# Clean Gradle cache
cd android
./gradlew clean
cd ..

# Or use the rebuild script
npm run android:rebuild
```

### "Could not connect to development server"

**Cause:** Metro not running or wrong URL

**Fix:**
1. Ensure Metro is running
2. Check adb reverse: `adb reverse tcp:8081 tcp:8081`
3. If physical device, use LAN IP in .env instead of localhost

### "Installed Build Tools revision X.X.X is corrupted"

**Cause:** Android SDK issue

**Fix:**
1. Open Android Studio
2. Tools → SDK Manager → SDK Tools
3. Uncheck "Android SDK Build-Tools"
4. Apply → Re-check it → Apply
5. Retry build

## Platform Differences

### Android Emulator vs iOS Simulator

| Aspect | Android Emulator | iOS Simulator |
|--------|------------------|---------------|
| Network | Separate (needs adb reverse) | Shared with host |
| Localhost | Requires adb reverse | Works directly |
| LAN IP | Works after adb reverse | Works directly |
| USB Debugging | Required (adb) | Not required |
| Build Time | 5-10 min | 3-5 min |

### Physical Devices

For physical Android or iOS devices:
1. Use your machine's LAN IP in `.env` (not localhost)
2. Device and machine must be on same WiFi
3. No adb reverse needed (direct network connection)

```bash
# Find your LAN IP
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr IPv4

# Use in .env
EXPO_PUBLIC_AUTH_URL=http://192.168.1.100:4001/api
EXPO_PUBLIC_API_URL=http://192.168.1.100:4003/api
EXPO_PUBLIC_WS_URL=http://192.168.1.100:4004
```

## Quick Reference

### Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `npm run android:dev` | Start Metro with adb reverse | Daily development (emulator) |
| `npm run android:dev:win` | Same, Windows | Daily development (Windows) |
| `npm run android:rebuild` | Full rebuild | After native dep changes, on errors |
| `npm run android:rebuild:win` | Same, Windows | After native dep changes (Windows) |
| `npx expo run:android` | Build only | First time, or manual build |
| `npx expo start --clear` | Metro only, clear cache | Clear Metro cache |

### Checklist: Is Rebuild Needed?

- [ ] Changed `package.json` dependencies? → **Rebuild**
- [ ] Changed `app.json` plugins? → **Rebuild**
- [ ] See `NoClassDefFoundError`? → **Rebuild**
- [ ] See native module error? → **Rebuild**
- [ ] Just changed JS/TS code? → **No rebuild, just Metro reload**
- [ ] Just changed `.env`? → **No rebuild, restart Metro**

## Getting Help

If you're still stuck after following this guide:

1. **Check Metro terminal** for detailed error messages
2. **Check `adb logcat`** for native Android logs:
   ```bash
   adb logcat | grep -E "(ReactNative|ExpoModules|Eve)"
   ```
3. **Clean everything and rebuild**:
   ```bash
   npm run android:rebuild
   ```
4. **Check Android Studio** for Gradle/build errors
5. **Verify Android SDK** is properly installed (API 34+)

---

**Last Updated**: 2026-09-04
