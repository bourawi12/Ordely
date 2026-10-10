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

REM 2) Install dependencies from the lockfiles.
if exist "%~dp0backend\node_modules\.bin\nest.cmd" if exist "%~dp0backend\node_modules\.bin\prisma.cmd" goto :backend_deps_ready
echo Installing backend dependencies...
pushd "%~dp0backend"
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo Backend dependency installation failed.
    popd
    pause
    exit /b 1
)
popd
:backend_deps_ready
echo Backend dependencies are ready. Run npm install manually after changing its package files.

if exist "%~dp0frontend\node_modules\.bin\next.cmd" goto :frontend_deps_ready
echo Installing frontend dependencies...
pushd "%~dp0frontend"
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo Frontend dependency installation failed.
    popd
    pause
    exit /b 1
)
popd
:frontend_deps_ready
echo Frontend dependencies are ready. Run npm install manually after changing its package files.

REM 3) Start supporting services and wait until they are ready.
echo Starting Ordely infrastructure...
docker compose up -d --wait db minio mailpit
if errorlevel 1 (
    echo Could not start Docker infrastructure.
    pause
    exit /b 1
)

REM 4) Apply pending database migrations before starting the backend.
echo Applying database migrations...
pushd "%~dp0backend"
call npm run prisma:deploy
if errorlevel 1 (
    echo Database migrations failed. The app servers were not started.
    popd
    pause
    exit /b 1
)
popd

REM 5) Seed demo merchants only when the database has no boutiques.
echo Seeding demo merchants if the database is empty...
pushd "%~dp0backend"
call npm run db:seed:demo:if-empty
if errorlevel 1 (
    echo Demo data seeding failed. The app servers were not started.
    popd
    pause
    exit /b 1
)
popd

REM 6) Run the app processes on Windows.
curl -s -f -o NUL -m 2 http://localhost:3001/api/health
if errorlevel 1 goto :start_backend
echo Backend is already running; reusing it.
goto :backend_started
:start_backend
start "Ordely Backend" /D "%~dp0backend" cmd /k "npm run start:dev"
:backend_started
curl -s -f -o NUL -m 2 http://localhost:3200
if errorlevel 1 goto :start_frontend
echo Frontend is already running; reusing it.
goto :frontend_started
:start_frontend
start "Ordely Frontend" /D "%~dp0frontend" cmd /k "npm run dev"
:frontend_started

REM 7) Wait for the backend health endpoint
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
