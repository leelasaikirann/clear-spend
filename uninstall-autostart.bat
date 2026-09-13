@echo off
title Remove Clear Spend Autostart
cls
echo ==========================================================
echo Clear Spend: Remove Windows Autostart
echo ==========================================================
echo.
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ClearSpendServer.lnk" 2>nul
echo Removed Clear Spend from Windows Startup folder.
echo.
pause
