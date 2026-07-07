@echo off
title Rotordyn.ai Local Dev Server Launcher
echo ========================================================
echo   Starting Rotordyn.ai Vibration Analysis Workspace
echo ========================================================
echo.

set "NODE_PATH=C:\Users\shaik\Downloads\Rotordyn.ai\v2\runtimes\node-v22.12.0-win-x64"
set "PYTHON_PATH=D:\python.exe"

echo 1. Launching FastAPI Backend (Port 8000)...
start "FastAPI Backend" cmd /k "set PYTHONPATH=.;backend&& %PYTHON_PATH% backend/main.py"

echo 2. Launching Vite React Frontend (Port 5000)...
cd frontend
start "Vite React Frontend" cmd /k "set PATH=%NODE_PATH%;%PATH%&& npm run dev"

echo.
echo Launch sequence complete!
echo Backend is running on http://localhost:8000
echo Frontend is running on http://localhost:5000
echo.
echo Automatically opening Chrome...
ping 127.0.0.1 -n 3 >nul
start chrome.exe http://localhost:5000
exit
