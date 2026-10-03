@echo off
setlocal
powershell.exe -NoProfile -File "%~dp0Install-HerculesCleaner.ps1" -BundleRoot "%~dp0"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" pause
exit /b %EXITCODE%
