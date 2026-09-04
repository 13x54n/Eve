#!/bin/bash

# Full Android rebuild script for Eve Driver
# Use this when:
# - You see "NoClassDefFoundError" or similar native errors
# - After npm install with new/updated native dependencies
# - After changing app.json plugins
# - After changing native config (app.config.js)

set -e

echo "🔨 Eve Driver - Full Android Rebuild"
echo ""
echo "This will:"
echo "  1. Clean all build artifacts"
echo "  2. Reinstall dependencies"
echo "  3. Clear Metro cache"
echo "  4. Rebuild native Android app"
echo ""

# Confirm
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "📦 Step 1/5: Cleaning Android build artifacts..."
rm -rf android/build
rm -rf android/app/build
rm -rf android/.gradle
echo "✅ Android artifacts cleaned"
echo ""

echo "📦 Step 2/5: Cleaning node_modules..."
rm -rf node_modules
echo "✅ node_modules removed"
echo ""

echo "📦 Step 3/5: Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

echo "📦 Step 4/5: Clearing Metro cache..."
rm -rf .expo
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true
echo "✅ Metro cache cleared"
echo ""

echo "📦 Step 5/5: Building native Android app..."
echo "   This may take 5-10 minutes..."
npx expo run:android
echo ""

echo "✅ Rebuild complete!"
echo ""
echo "📲 The app should now be installed and running on your device/emulator"
echo ""
echo "Next steps:"
echo "  1. For future development, use: npm run android:dev (or android:dev:win on Windows)"
echo "  2. Only rebuild when you change native dependencies or see native errors"
