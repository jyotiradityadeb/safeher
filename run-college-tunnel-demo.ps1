$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root ".codex-logs"
$ltLog = Join-Path $logDir "lt-live.log"

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

if (Test-Path $ltLog) {
  Remove-Item $ltLog -Force
}

Write-Host "Starting SafeHer tunnel demo mode..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\admin'; npm run dev -- --host 0.0.0.0 --port 5173"
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; npx localtunnel --port 8000 2>&1 | Tee-Object -FilePath '$ltLog'"

$tunnelBase = $null
$attempts = 0
while (-not $tunnelBase -and $attempts -lt 30) {
  Start-Sleep -Seconds 1
  $attempts += 1
  if (Test-Path $ltLog) {
    $line = Get-Content $ltLog | Select-String -Pattern "your url is:\s+(https?://[^\s]+)" | Select-Object -Last 1
    if ($line -and $line.Matches.Count -gt 0) {
      $tunnelBase = $line.Matches[0].Groups[1].Value
    }
  }
}

if (-not $tunnelBase) {
  Write-Host "Could not detect LocalTunnel URL. Check the LocalTunnel terminal and copy URL manually." -ForegroundColor Red
  return
}

$apiBase = "$tunnelBase/api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\mobile'; `$env:EXPO_PUBLIC_API_BASE_URL='$apiBase'; npx expo start --tunnel --port 8084 --clear"

Write-Host ""
Write-Host "Open these URLs:" -ForegroundColor Green
Write-Host "Admin page:      http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "Backend tunnel:  $tunnelBase/docs" -ForegroundColor Green
Write-Host "Mobile API base: $apiBase" -ForegroundColor Green
Write-Host "Expo (tunnel):   shown in Expo terminal/QR" -ForegroundColor Green
Write-Host ""
Write-Host "Demo credentials:" -ForegroundColor Cyan
Write-Host "App:   demo@safeher.app / password123" -ForegroundColor Cyan
Write-Host "Admin: admin@safeher.app / admin123" -ForegroundColor Cyan
