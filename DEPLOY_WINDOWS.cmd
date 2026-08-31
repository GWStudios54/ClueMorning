@echo off
setlocal
cd /d "%~dp0"
title Clue Morning v2.6.0 Deployment

echo ========================================
echo   Clue Morning v2.6.0 deployment
echo   Six games + SEO + leaderboard deploy
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on PATH.
  goto :fail
)

call npm install
if errorlevel 1 goto :fail

set WRANGLER=node node_modules\wrangler\bin\wrangler.js

echo.
echo Checking Cloudflare login...
%WRANGLER% whoami
if errorlevel 1 (
  echo.
  echo Opening Cloudflare login...
  %WRANGLER% login
  if errorlevel 1 goto :fail
)

echo.
echo Ensuring leaderboard database is connected...
node tools\ensure_d1_binding.mjs
if errorlevel 1 goto :fail

echo.
echo Creating/updating leaderboard tables...
%WRANGLER% d1 execute DB --remote --file=schema.sql
if errorlevel 1 goto :fail

echo.
echo Running tests...
node test.mjs
if errorlevel 1 goto :fail

echo.
echo Deploying site + backend...
%WRANGLER% deploy
if errorlevel 1 goto :fail

echo.
echo ========================================
echo DEPLOYMENT COMPLETE
echo ========================================
echo Test: https://cluemorning.com/api/health
echo Open: https://cluemorning.com/
echo.
echo The health response should show leaderboard: true.
echo.
pause
exit /b 0

:fail
echo.
echo ========================================
echo DEPLOYMENT FAILED - window will stay open
echo ========================================
echo Send the error above if you need help.
echo.
pause
exit /b 1
