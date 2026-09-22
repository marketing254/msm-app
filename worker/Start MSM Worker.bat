@echo off
rem Starts the MSM rank worker. Double-click this file on the office PC and leave the window open.
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing... this takes a minute.
  call npm install
  call npx playwright install chromium
)
if not exist .env (
  echo Missing worker\.env. Copy .env.example to .env and fill in MSM_APP_URL and WORKER_TOKEN.
  pause
  exit /b 1
)
echo MSM worker starting. Keep this window open while reports are running. Press Ctrl+C to stop.
node worker.mjs
pause
