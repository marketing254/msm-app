@echo off
rem Stops the MSM rank worker, whether it was started with a window or hidden.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*worker.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo MSM worker stopped.
pause
