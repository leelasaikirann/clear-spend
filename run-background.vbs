' ==========================================================
' Clear Spend: Silent Background Runner
' Runs the backend server silently with zero visible windows
' ==========================================================

Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & strDir & "\backend\server.ps1"" -Port 5000", 0, False
