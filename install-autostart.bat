@echo off
title Install Clear Spend Autostart
cls
echo ==========================================================
echo Clear Spend: Configure Windows Autostart
echo ==========================================================
echo.
echo Configuring Clear Spend to start silently on Windows boot...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $startupPath = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs\Startup', 'ClearSpendServer.lnk'); $s = $ws.CreateShortcut($startupPath); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%~dp0run-background.vbs\"'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 7; $s.Save(); Write-Host 'Autostart installed successfully!' -ForegroundColor Green; Write-Host 'Shortcut created at: ' $startupPath -ForegroundColor Gray"
echo.
echo Clear Spend will now automatically launch in the background
echo whenever you log into Windows, keeping SSMS synced at all times.
echo.
pause
