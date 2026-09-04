# Android development setup script for Eve Rider (Windows PowerShell)
# Sets up adb reverse for Metro bundler and starts Expo

$ErrorActionPreference = "Stop"

Write-Host "🔧 Eve Rider - Android Development Setup" -ForegroundColor Cyan
Write-Host ""

# Check if adb is available
$adbPath = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbPath) {
    Write-Host "❌ Error: adb not found" -ForegroundColor Red
    Write-Host "   Please install Android SDK Platform-Tools"
    Write-Host "   https://developer.android.com/studio/releases/platform-tools"
    Write-Host ""
    Write-Host "   Or add Android SDK platform-tools to your PATH:"
    Write-Host "   C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools"
    exit 1
}

# Check for running emulator or device
Write-Host "📱 Checking for Android devices..." -ForegroundColor Yellow
$devicesOutput = & adb devices 2>&1
$deviceLines = $devicesOutput -split "`n" | Select-String "device$"

if ($deviceLines.Count -eq 0) {
    Write-Host "❌ No Android devices found" -ForegroundColor Red
    Write-Host "   Please start an Android emulator or connect a device"
    Write-Host ""
    Write-Host "   To start an emulator:"
    Write-Host "   - Open Android Studio → AVD Manager → Start emulator"
    Write-Host "   - Or run: emulator -avd <your_avd_name>"
    Write-Host ""
    Write-Host "   To list available emulators:"
    Write-Host "   emulator -list-avds"
    exit 1
}

Write-Host "✅ Found Android device(s)" -ForegroundColor Green
Write-Host ""

# Set up adb reverse for Metro (port 8081)
Write-Host "🔌 Setting up adb reverse for Metro bundler..." -ForegroundColor Yellow
& adb reverse tcp:8081 tcp:8081

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set up adb reverse" -ForegroundColor Red
    Write-Host "   Make sure the emulator/device is properly connected"
    exit 1
}

# Also set up reverse for backend services if they're needed
# Uncomment these if your app directly connects to backend from the device
# & adb reverse tcp:4001 tcp:4001  # Auth service
# & adb reverse tcp:4003 tcp:4003  # Ride service
# & adb reverse tcp:4004 tcp:4004  # WebSocket/Notify service

Write-Host "✅ adb reverse configured:" -ForegroundColor Green
Write-Host "   Device port 8081 → Host port 8081 (Metro bundler)"
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found" -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Write-Host "   Copying from .env.example..."
        Copy-Item ".env.example" ".env"
        Write-Host "   Please edit .env with your configuration"
    } else {
        Write-Host "   Please create a .env file based on .env.example"
    }
    Write-Host ""
}

# Start Metro bundler
Write-Host "🚀 Starting Metro bundler..." -ForegroundColor Cyan
Write-Host "   Metro will be available at http://localhost:8081"
Write-Host "   Your Android device will connect via adb reverse"
Write-Host ""
Write-Host "📲 To install/launch the dev client:" -ForegroundColor Yellow
Write-Host "   - First time: npx expo run:android"
Write-Host "   - Subsequent: Open 'Eve Rider' app on your device"
Write-Host ""

# Start expo with Android flag
& npx expo start --android
