@echo off
title Clear Spend SQL Server API
cls
echo ==========================================================
echo Starting Clear Spend Backend (SSMS Integration)
echo ==========================================================
echo Connecting to SQL Server: .\MSSQLSERVER01
echo Database: ClearSpendDB
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\server.ps1" -Port 5000
pause
