@echo off
title Clear Spend Server and Database Sync
cls
echo ==========================================================
echo Clear Spend: Local Server and SSMS Integration
echo ==========================================================
echo Target SQL Servers : .\MSSQLSERVER01 and .\MSSQLSERVER02
echo Database Name      : ClearSpendDB
echo Dashboard Port     : http://localhost:5000/
echo.
echo Opening Clear Spend in your default web browser...
start http://localhost:5000/
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\server.ps1" -Port 5000
pause
