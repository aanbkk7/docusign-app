@echo off
echo ========================================
echo    DocuSign App - Starting...
echo ========================================
echo.

:: Open firewall ports so mobile devices on the same WiFi can connect
echo [0/3] Opening firewall ports for mobile access...
netsh advfirewall firewall delete rule name="DocuSign Frontend" >nul 2>&1
netsh advfirewall firewall delete rule name="DocuSign Backend" >nul 2>&1
netsh advfirewall firewall add rule name="DocuSign Frontend" dir=in action=allow protocol=TCP localport=5173 >nul 2>&1
netsh advfirewall firewall add rule name="DocuSign Backend"  dir=in action=allow protocol=TCP localport=3001 >nul 2>&1
echo    Done - ports 5173 and 3001 are open.
echo.

:: Start backend
echo [1/3] Starting backend (port 3001)...
start "DocuSign - Backend" cmd /k "cd /d "%~dp0backend" && npm install && npm run dev"

:: Wait for backend to initialize
timeout /t 4 /nobreak >nul

:: Start frontend
echo [2/3] Starting frontend (port 5173)...
start "DocuSign - Frontend" cmd /k "cd /d "%~dp0frontend" && npm install && npm run dev"

:: Wait then open browser
echo [3/3] Opening browser...
timeout /t 6 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================
echo  App running at http://localhost:5173
echo  Mobile: use the IP shown in the app
echo ========================================
echo.
echo Press any key to close this window...
pause >nul
