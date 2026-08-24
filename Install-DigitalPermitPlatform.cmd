@echo off
setlocal
cd /d "%~dp0"
title Digital Permit Platform Installer
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup\Install-DigitalPermitPlatform.ps1" %*
set "DPP_EXIT=%ERRORLEVEL%"
echo.
if not "%DPP_EXIT%"=="0" echo Installation did not complete. Review the message above or contact your platform support team.
echo Press any key to close this window.
pause >nul
exit /b %DPP_EXIT%
