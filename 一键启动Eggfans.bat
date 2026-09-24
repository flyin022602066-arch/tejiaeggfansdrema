@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"

set "NPM_CMD="
if exist "E:\node\npm.cmd" set "NPM_CMD=E:\node\npm.cmd"
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD (
  for /f "delims=" %%I in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%I"
)
if not defined NPM_CMD (
  echo [ERROR] npm.cmd was not found. Install Node.js first.
  pause
  exit /b 1
)

if not exist "desktop\package.json" (
  echo [ERROR] desktop\package.json was not found. Run this BAT from the project root.
  pause
  exit /b 1
)

if not exist "desktop\node_modules\electron\dist\electron.exe" (
  echo [ERROR] Desktop dependencies are missing. Run npm install in desktop first.
  pause
  exit /b 1
)

if /i "%~1"=="--check" (
  echo [OK] Eggfans startup checks passed.
  exit /b 0
)

echo Starting Eggfans. Please wait...
cd /d "%~dp0desktop"
call "%NPM_CMD%" run dev

if errorlevel 1 (
  echo.
  echo [ERROR] Eggfans failed to start. Keep this window for diagnostics.
  pause
  exit /b 1
)

endlocal
