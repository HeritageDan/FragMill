@echo off
title FraGeo Suite - Local Offline Server
cd /d "%~dp0"

echo =======================================================
echo   FraGeo Suite: Blast-to-Mill & Materials Lab
echo   Starting Local Offline Server...
echo =======================================================
echo.

if not exist dist\index.html (
    echo [INFO] Building production bundle for offline use...
    call npm run build
)

echo [READY] Opening FraGeo Suite in your default browser/app...
start http://localhost:3000

echo [INFO] Server running on http://localhost:3000 (100% offline, local IndexedDB)
echo Press Ctrl+C in this window when you want to stop the server.
echo.
node server.js
pause

