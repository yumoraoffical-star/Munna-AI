@echo off
title Munna AI - Deploy to Vercel
color 0E
cls

echo ================================================================
echo           👑 MUNNA AI - ONE-CLICK VERCEL DEPLOYER 👑
echo ================================================================
echo.

:: Check for Git
git --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Git install nahi hai ya PATH me nahi mila!
    echo Kripya pehle Git install karein: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

:: Show current Git branch and status
for /f "tokens=*" %%b in ('git branch --show-current 2^>nul') do set BRANCH=%%b
if "%BRANCH%"=="" set BRANCH=main

echo [INFO] Active Branch: %BRANCH%
echo [INFO] Live Website:  https://munnaai.youmika.site
echo.

:: Prompt for commit message with default
set /p MSG="Custom commit message likhein (ya Enter dabayein auto-update ke liye): "
if "%MSG%"=="" (
    for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set CDATE=%%a-%%b-%%c
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set CTIME=%%a:%%b
    set MSG=update: Munna AI auto-deploy %CDATE% %CTIME%
)

echo.
echo [1/3] Staging changes (git add .)...
git add .

echo [2/3] Committing: "%MSG%"...
git commit -m "%MSG%"

echo [3/3] Pushing to GitHub (%BRANCH%)...
git push origin %BRANCH%

if %ERRORLEVEL% EQU 0 (
    color 0A
    echo.
    echo ================================================================
    echo    ✅ SHAANDAAR! Code safalta-purvak GitHub par push ho gaya!
    echo    🚀 Vercel ab automatically live update deploy kar raha hai!
    echo ================================================================
    echo.
    echo Live URL: https://munnaai.youmika.site
    echo.
) else (
    color 0C
    echo.
    echo ================================================================
    echo    ⚠️ PUSH ERROR: Code push nahi ho paya.
    echo    Kripya internet connection ya git permissions check karein.
    echo ================================================================
    echo.
)

pause
