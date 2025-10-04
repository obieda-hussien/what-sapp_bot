@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ════════════════════════════════════════════════════════════════
:: 🤖 WhatsApp Bot - Installation Script (Windows)
:: ════════════════════════════════════════════════════════════════
:: Version: 1.0.0
:: Author: obieda-hussien
:: Description: Automated installation script for WhatsApp-Telegram Bot
:: ════════════════════════════════════════════════════════════════

title WhatsApp-Telegram Bot Installer

echo.
echo ════════════════════════════════════════════════════════════════
echo           🤖 WhatsApp-Telegram Bridge Bot
echo                Automated Installation
echo ════════════════════════════════════════════════════════════════
echo.

:: Step 1: Check Node.js
echo [Step 1/7] Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    echo ℹ️  Please download and install Node.js from: https://nodejs.org/
    echo    Recommended: Download the LTS version
    pause
    exit /b 1
)

:: Check Node.js version
for /f "tokens=1 delims=v" %%i in ('node -v') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION:~1%") do set NODE_MAJOR=%%i

if %NODE_MAJOR% lss 18 (
    echo ❌ Node.js version 18+ is required. Current version: v%NODE_VERSION%
    echo ℹ️  Please upgrade Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js is installed (version: %NODE_VERSION%)

:: Step 2: Check npm
echo [Step 2/7] Checking npm installation...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed
    pause
    exit /b 1
)

for /f %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✅ npm is installed (version: %NPM_VERSION%)

:: Step 3: Install dependencies
echo [Step 3/7] Installing dependencies...
if not exist "package.json" (
    echo ❌ package.json not found. Are you in the correct directory?
    pause
    exit /b 1
)

call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed successfully

:: Step 4: Create .env file
echo [Step 4/7] Setting up configuration...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo ✅ Created .env file from .env.example
    ) else (
        echo ❌ .env.example not found
        pause
        exit /b 1
    )
) else (
    echo ⚠️  .env file already exists. Skipping...
)

:: Step 5: Configure Telegram
echo [Step 5/7] Telegram Bot Configuration
echo.
echo ℹ️  You need to create a Telegram Bot first:
echo    1. Open Telegram and search for @BotFather
echo    2. Send /newbot command
echo    3. Follow the instructions to create your bot
echo    4. Copy the Bot Token
echo.

set /p CONFIGURE_TG="Do you have a Telegram Bot Token? (y/N): "
if /i "%CONFIGURE_TG%"=="y" (
    set /p TELEGRAM_BOT_TOKEN="Enter your Telegram Bot Token: "
    set /p TELEGRAM_CHANNEL_ID="Enter your Telegram Channel ID (e.g., @channel or -1001234567890): "
    
    :: Update .env file
    powershell -Command "(gc .env) -replace 'TELEGRAM_BOT_TOKEN=.*', 'TELEGRAM_BOT_TOKEN=!TELEGRAM_BOT_TOKEN!' | Out-File -encoding ASCII .env"
    powershell -Command "(gc .env) -replace 'TELEGRAM_CHANNEL_ID=.*', 'TELEGRAM_CHANNEL_ID=!TELEGRAM_CHANNEL_ID!' | Out-File -encoding ASCII .env"
    
    echo ✅ Telegram configuration saved
) else (
    echo ⚠️  Telegram Bot Token not provided. You'll need to configure it manually in .env
)

:: Step 6: Configure Owner Phone
echo [Step 6/7] Owner Configuration
echo.
set /p OWNER_PHONE="Enter your phone number (format: 201234567890): "

if not "!OWNER_PHONE!"=="" (
    powershell -Command "(gc .env) -replace 'OWNER_PHONE=.*', 'OWNER_PHONE=!OWNER_PHONE!' | Out-File -encoding ASCII .env"
    echo ✅ Owner phone number saved
) else (
    echo ⚠️  Owner phone not provided. You'll need to configure it manually in .env
)

:: Step 7: Create config.json if not exists
echo [Step 7/7] Finalizing setup...
if not exist "config.json" (
    if exist "config.json.example" (
        copy "config.json.example" "config.json" >nul
        echo ✅ Created config.json from config.json.example
    ) else (
        :: Create default config.json
        (
            echo {
            echo   "bridges": [],
            echo   "eliteUsers": [],
            echo   "filters": {
            echo     "enabled": false,
            echo     "blacklist": [],
            echo     "whitelist": [],
            echo     "keywords": [],
            echo     "allowedTypes": []
            echo   },
            echo   "botStatus": {
            echo     "active": true,
            echo     "pausedGroups": []
            echo   },
            echo   "smartAlerts": {
            echo     "enabled": false,
            echo     "keywords": []
            echo   },
            echo   "schedules": [],
            echo   "admins": [],
            echo   "privateChatResponses": {
            echo     "enabled": true,
            echo     "intelligentMatching": true,
            echo     "aiEnabled": true,
            echo     "keywords": []
            echo   }
            echo }
        ) > config.json
        echo ✅ Created default config.json
    )
) else (
    echo ⚠️  config.json already exists. Skipping...
)

:: Create Materials folder
if not exist "Materials" (
    mkdir Materials
    echo ✅ Created Materials folder
)

:: Create logs folder
if not exist "logs" (
    mkdir logs
    echo ✅ Created logs folder
)

:: Final Summary
echo.
echo ════════════════════════════════════════════════════════════════
echo           ✅ Installation Completed Successfully!
echo ════════════════════════════════════════════════════════════════
echo.

echo ℹ️  Next Steps:
echo.
echo   1. Review and update .env file with your credentials:
echo      notepad .env
echo.
echo   2. Start the bot:
echo      npm start
echo.
echo   3. Scan the QR code with WhatsApp or enter pairing code
echo.
echo   4. The bot will display all your WhatsApp groups
echo.
echo   5. Copy the Group JID and add it to .env file
echo.
echo   6. Restart the bot and enjoy!
echo.
echo ⚠️  Important: Never share your .env file or auth_info_baileys folder!
echo.
echo ℹ️  For more information, check README.md
echo ℹ️  Report issues: https://github.com/obieda-hussien/what-sapp_bot/issues
echo.

pause
