#!/bin/bash

# Android development setup script for Eve Driver
# Sets up adb reverse for Metro bundler and starts Expo

set -e

echo "🔧 Eve Driver - Android Development Setup"
echo ""

# Check if adb is available
if ! command -v adb &> /dev/null; then
    echo "❌ Error: adb not found"
    echo "   Please install Android SDK Platform-Tools"
    echo "   https://developer.android.com/studio/releases/platform-tools"
    exit 1
fi

# Check for running emulator or device
echo "📱 Checking for Android devices..."
DEVICES=$(adb devices | grep -v "List" | grep "device$" | wc -l)

if [ "$DEVICES" -eq 0 ]; then
    echo "❌ No Android devices found"
    echo "   Please start an Android emulator or connect a device"
    echo ""
    echo "   To start an emulator:"
    echo "   - Open Android Studio → AVD Manager → Start emulator"
    echo "   - Or run: emulator -avd <your_avd_name>"
    exit 1
fi

echo "✅ Found Android device(s)"
echo ""

# Set up adb reverse for Metro (port 8081)
echo "🔌 Setting up adb reverse for Metro bundler..."
adb reverse tcp:8081 tcp:8081

# Also set up reverse for backend services if they're needed
# Uncomment these if your app directly connects to backend from the device
# adb reverse tcp:4001 tcp:4001  # Auth service
# adb reverse tcp:4003 tcp:4003  # Ride service
# adb reverse tcp:4004 tcp:4004  # WebSocket/Notify service

echo "✅ adb reverse configured:"
echo "   Device port 8081 → Host port 8081 (Metro bundler)"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "   Copying from .env.example..."
    cp .env.example .env
    echo "   Please edit .env with your configuration"
    echo ""
fi

# Start Metro bundler
echo "🚀 Starting Metro bundler..."
echo "   Metro will be available at http://localhost:8081"
echo "   Your Android device will connect via adb reverse"
echo ""
echo "📲 To install/launch the dev client:"
echo "   - First time: npx expo run:android"
echo "   - Subsequent: Open 'Eve Driver' app on your device"
echo ""

# Start expo with Android flag
npx expo start --android
