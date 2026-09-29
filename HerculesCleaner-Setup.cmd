@echo off
setlocal EnableExtensions
title SauceApproved Hercules Cleaner Setup

where node >nul 2>nul
if errorlevel 1 (
  echo Hercules Cleaner requires Node.js 22 or newer.
  echo Install Node.js from its official source, then run this setup again.
  exit /b 1
)

for /f "usebackq delims=" %%V in (`node -p "process.versions.node.split('.')[0]"`) do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
  echo Unable to verify the installed Node.js version.
  exit /b 1
)
if %NODE_MAJOR% LSS 22 (
  echo Hercules Cleaner requires Node.js 22 or newer. Found Node.js %NODE_MAJOR%.
  exit /b 1
)

set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=install"

echo.
echo SauceApproved Hercules Cleaner
echo Action: %ACTION%
echo User-scoped setup. Existing Recovery Capsules and local Cleaner state are preserved.
echo.

node "%~dp0hercules-cleaner\windows-installer-cli.mjs" "%ACTION%" --source "%~dp0"
if errorlevel 1 (
  echo.
  echo Hercules Cleaner setup did not complete. No permission boundary was bypassed.
  exit /b 1
)

echo.
echo Hercules Cleaner %ACTION% completed.
exit /b 0
