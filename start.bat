@echo off
set PORT=3001
echo Stopping any process on port %PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do taskkill /f /pid %%a >nul 2>&1
echo Starting dev server on port %PORT%...
start chrome --new-window http://localhost:%PORT%
npm run dev -- --port %PORT%
