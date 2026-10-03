@echo off
title Building ORION for Windows (.exe ^& .msi)
echo ====================================================
echo  ORION - Packaging Windows Production Installer (.exe)
echo ====================================================
echo.

echo [1/3] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error during npm install.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Building frontend assets...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error during frontend build.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Compiling native Windows binary and NSIS Installer...
call npx tauri build --bundles nsis,msi
if %ERRORLEVEL% NEQ 0 (
    echo Error during Tauri packaging.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ====================================================
echo  BUILD SUCCESSFUL!
echo ====================================================
echo  Your Windows standalone installers are ready:
echo  1. Setup Installer (.exe): src-tauri\target\release\bundle\nsis\ORION_1.0.0_x64-setup.exe
echo  2. Enterprise MSI (.msi):   src-tauri\target\release\bundle\msi\ORION_1.0.0_x64_en-US.msi
echo ====================================================
pause
