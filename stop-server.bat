@echo off
title Stop Clear Spend Server
cls
echo ==========================================================
echo Stopping Clear Spend Server
echo ==========================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$conns = Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue; if ($conns) { $conns | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host 'Server on port 5000 stopped.' -ForegroundColor Yellow } else { Write-Host 'No server was running on port 5000.' -ForegroundColor Gray }"
echo.
pause
