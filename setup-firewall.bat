@echo off
:: This file must be run as Administrator (right-click → Run as administrator)
echo Opening firewall ports for DocuSign App...

netsh advfirewall firewall delete rule name="DocuSign Frontend" >nul 2>&1
netsh advfirewall firewall delete rule name="DocuSign Backend"  >nul 2>&1

netsh advfirewall firewall add rule name="DocuSign Frontend" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="DocuSign Backend"  dir=in action=allow protocol=TCP localport=3001

echo.
echo Done! Ports 5173 and 3001 are now open.
echo Mobile devices on the same WiFi can now access the app.
echo.
pause
