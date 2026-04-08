$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting SafeHer prototype services..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\admin'; npm run dev -- --host 0.0.0.0 --port 5173"
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\mobile'; npx expo start --android --port 8084 --clear"

Write-Host "Backend: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Admin:   http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "Expo:    exp://127.0.0.1:8084" -ForegroundColor Green
