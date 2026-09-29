@echo off
setlocal
powershell.exe -NoProfile -File "%~dp0Launch-HerculesCleaner.ps1" %*
exit /b %ERRORLEVEL%
