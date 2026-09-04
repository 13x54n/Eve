# Full Android rebuild script for Eve Rider (Windows PowerShell)
# Use this when:
# - You see "NoClassDefFoundError" or similar native errors
# - After npm install with new/updated native dependencies
# - After changing app.json plugins
# - After changing native config (app.config.js)

$ErrorActionPreference = "Stop"

Write-Host "🔨 Eve Rider - Full Android Rebuild" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will:" -ForegroundColor Yellow
Write-Host "  1. Clean all build artifacts"
Write-Host "  2. Reinstall dependencies"
Write-Host "  3. Clear Metro cache"
Write-Host "  4. Rebuild native Android app"
Write-Host ""

# Confirm
$confirmation = Read-Host "Continue? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "📦 Step 1/5: Cleaning Android build artifacts..." -ForegroundColor Yellow
if (Test-Path "android/build") { Remove-Item -Recurse -Force "android/build" }
if (Test-Path "android/app/build") { Remove-Item -Recurse -Force "android/app/build" }
if (Test-Path "android/.gradle") { Remove-Item -Recurse -Force "android/.gradle" }
Write-Host "✅ Android artifacts cleaned" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Step 2/5: Cleaning node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") { Remove-Item -Recurse -Force "node_modules" }
Write-Host "✅ node_modules removed" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Step 3/5: Installing dependencies..." -ForegroundColor Yellow
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Step 4/5: Clearing Metro cache..." -ForegroundColor Yellow
if (Test-Path ".expo") { Remove-Item -Recurse -Force ".expo" }
$tempPath = [System.IO.Path]::GetTempPath()
Get-ChildItem $tempPath -Filter "metro-*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Get-ChildItem $tempPath -Filter "haste-map-*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Write-Host "✅ Metro cache cleared" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Step 5/5: Building native Android app..." -ForegroundColor Yellow
Write-Host "   This may take 5-10 minutes..." -ForegroundColor Yellow
& npx expo run:android
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "✅ Rebuild complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📲 The app should now be installed and running on your device/emulator" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. For future development, use: npm run android:dev:win"
Write-Host "  2. Only rebuild when you change native dependencies or see native errors"
