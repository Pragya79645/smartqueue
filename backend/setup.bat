@echo off
REM AI Queue Load Balancer - Backend Setup Script
REM This script will set up the backend environment

echo.
echo ============================================
echo   AI Queue Load Balancer - Backend Setup
echo ============================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node --version
echo.

REM Check if MongoDB is installed
where mongod >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] MongoDB is not in PATH
    echo Make sure MongoDB is installed and running
    echo Download from: https://www.mongodb.com/try/download/community
) else (
    echo [OK] MongoDB found
)
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo [SETUP] Creating .env file from template...
    copy .env.example .env >nul
    echo [OK] .env file created. Please edit it with your configuration.
) else (
    echo [OK] .env file already exists
)
echo.

REM Install dependencies
echo [INSTALL] Installing npm dependencies...
echo This may take a few minutes...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo.
echo [OK] Dependencies installed successfully!
echo.

REM Create logs directory if it doesn't exist
if not exist logs (
    echo [SETUP] Creating logs directory...
    mkdir logs
    echo [OK] Logs directory created
)
echo.

echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo Next Steps:
echo   1. Edit .env file with your MongoDB URI
echo   2. Start MongoDB: net start MongoDB
echo   3. Run server: npm run dev
echo.
echo Documentation:
echo   - README.md - Full documentation
echo   - SETUP.md - Quick setup guide
echo   - API_TESTING.http - Test API endpoints
echo.
echo To start the server now, press any key...
pause >nul

echo.
echo [START] Starting development server...
npm run dev
