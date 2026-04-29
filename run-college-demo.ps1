$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$wifiIp = (
  Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi" -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
  Select-Object -First 1 -ExpandProperty IPAddress
)

if (-not $wifiIp) {
  $wifiIp = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -First 1 -ExpandProperty IPAddress
  )
}

if (-not $wifiIp) {
  $wifiIp = "127.0.0.1"
}

Write-Host "Starting SafeHer in college Wi-Fi mode..." -ForegroundColor Cyan
Write-Host "Detected IP: $wifiIp" -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\admin'; `$env:VITE_WS_URL='ws://$wifiIp:5173/ws/alerts'; npm run dev -- --host 0.0.0.0 --port 5173"
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\mobile'; `$env:EXPO_PUBLIC_API_BASE_URL='http://$wifiIp:8000/api'; npx expo start --tunnel --port 8084 --clear"

Write-Host ""
Write-Host "Open these URLs:" -ForegroundColor Green
Write-Host "Backend API:  http://${wifiIp}:8000/docs" -ForegroundColor Green
Write-Host "Admin page:   http://${wifiIp}:5173" -ForegroundColor Green
Write-Host "Expo (tunnel): shown in Expo terminal/QR" -ForegroundColor Green
Write-Host ""
Write-Host "Demo credentials:" -ForegroundColor Cyan
Write-Host "Admin: admin@safeher.app / admin123" -ForegroundColor Cyan
