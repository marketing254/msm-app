@echo off
rem Starts the MSM rank worker. Double-click this file on the office PC and leave the window open.
rem "Start MSM Worker (hidden).vbs" runs this same file with no window; output then goes to worker.log.
title MSM Worker
cd /d "%~dp0"
if "%1"=="hidden" goto hidden
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
exit /b

:hidden
if not exist node_modules (
  call npm install >> worker.log 2>&1
  call npx playwright install chromium >> worker.log 2>&1
)
if not exist .env (
  echo Missing worker\.env. Copy .env.example to .env and fill in MSM_APP_URL and WORKER_TOKEN. >> worker.log
  exit /b 1
)
node worker.mjs >> worker.log 2>&1
