@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo === Ordely launcher ===

REM 1) Is the Docker engine up?
docker info >nul 2>&1
if %errorlevel%==0 goto :engine_ready

echo Docker engine not running. Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

echo Waiting for the Docker engine (up to 3 minutes)...
set /a tries=0
:wait_engine
%SystemRoot%\System32\timeout.exe /t 5 /nobreak >nul
docker info >nul 2>&1
if %errorlevel%==0 goto :engine_ready
set /a tries+=1
if !tries! lss 36 goto :wait_engine
echo Docker did not become ready within 3 minutes. Start it manually, then rerun this script.
pause
exit /b 1

:engine_ready
echo Docker engine is ready.

REM 2) Bring the stack up
echo Starting Ordely containers...
docker compose up -d
if errorlevel 1 (
    echo docker compose up failed.
    pause
    exit /b 1
)

REM 3) Wait for the backend health endpoint
echo Waiting for the backend on http://localhost:3001/api/health ...
set /a tries=0
:wait_backend
%SystemRoot%\System32\timeout.exe /t 3 /nobreak >nul
curl -s -f -o NUL -m 5 http://localhost:3001/api/health
if %errorlevel%==0 goto :ready
set /a tries+=1
if !tries! lss 40 goto :wait_backend
echo Backend did not answer in time. Check: docker compose logs backend
pause
exit /b 1

:ready
echo.
echo Ordely is running:
echo   Frontend : http://localhost:3200        (login: /login, sign-up: /register)
echo   Backend  : http://localhost:3001/api/health
echo   Mailpit  : http://localhost:8025        (dev email inbox)
echo   MinIO    : http://localhost:9101
echo   Postgres : localhost:5433
echo.
start "" http://localhost:3200
echo To stop the stack later: docker compose stop   (data is kept)
pause
endlocal
