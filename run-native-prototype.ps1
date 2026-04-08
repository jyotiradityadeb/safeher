$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$adb = "C:\Users\jyoti\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$apkPath = Join-Path $root "mobile\android\app\build\outputs\apk\release\app-release.apk"

Write-Host "Starting SafeHer native prototype..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\admin'; npm run dev -- --host 0.0.0.0 --port 5173"
Start-Sleep -Seconds 2

if (-not (Test-Path $adb)) {
  throw "adb not found at $adb"
}

if (-not (Test-Path $apkPath)) {
  Write-Host "Release APK not found. Building it now..." -ForegroundColor Yellow
  Start-Process powershell -Wait -ArgumentList "-NoExit", "-Command", "`$env:JAVA_HOME='$javaHome'; `$env:Path='$javaHome\bin;' + `$env:Path; cd '$root\mobile\android'; .\gradlew.bat assembleRelease"
}

& $adb devices
& $adb install -r $apkPath | Out-Host
& $adb shell monkey -p com.safeher.app -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host "Backend: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Admin:   http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "APK:     $apkPath" -ForegroundColor Green
Write-Host "Demo user: demo@safeher.app / password123" -ForegroundColor Green
Write-Host "Admin:     admin@safeher.app / admin123" -ForegroundColor Green
