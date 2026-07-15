@echo off
echo ========================================
echo  DocuSign App + ngrok (internet access)
echo ========================================
echo.
echo This mode allows ANYONE to sign, not just people on your WiFi.
echo.

:: Start backend
echo [1/3] Starting backend...
start "DocuSign - Backend" cmd /k "cd /d "%~dp0backend" && npm install && npm run dev"
timeout /t 4 /nobreak >nul

:: Start frontend
echo [2/3] Starting frontend...
start "DocuSign - Frontend" cmd /k "cd /d "%~dp0frontend" && npm install && npm run dev"
timeout /t 4 /nobreak >nul

:: Start ngrok tunnel
echo [3/3] Starting ngrok tunnel...
echo    The public URL will appear in the ngrok window below.
echo    Copy that URL and paste it in the app settings.
echo.
start "DocuSign - Tunnel (ngrok)" cmd /k "npx ngrok http 5173"

echo.
echo ========================================
echo  IMPORTANT: Copy the https://xxx.ngrok-free.app
echo  URL from the ngrok window and use it
echo  as the base URL when sending documents.
echo ========================================
echo.
start http://localhost:5173
pause
