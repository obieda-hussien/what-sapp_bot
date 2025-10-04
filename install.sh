#!/bin/bash

# ════════════════════════════════════════════════════════════════
# 🤖 WhatsApp Bot - Installation Script
# ════════════════════════════════════════════════════════════════
# Version: 1.0.0
# Author: obieda-hussien
# Description: Automated installation script for WhatsApp-Telegram Bot
# ════════════════════════════════════════════════════════════════

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
echo "════════════════════════════════════════════════════════════════"
echo "          🤖 WhatsApp-Telegram Bridge Bot"
echo "               Automated Installation"
echo "════════════════════════════════════════════════════════════════"
echo -e "${NC}"

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${CYAN}▶ $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_warning "Running as root is not recommended. Consider using a normal user."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 1: Check Node.js
print_step "Step 1/7: Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        print_success "Node.js $(node -v) is installed"
    else
        print_error "Node.js version 18+ is required. Current: $(node -v)"
        print_info "Please upgrade Node.js from: https://nodejs.org/"
        exit 1
    fi
else
    print_error "Node.js is not installed"
    print_info "Installing Node.js..."
    
    # Detect OS and install Node.js
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # For Ubuntu/Debian
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        # For Termux
        elif command -v pkg &> /dev/null; then
            pkg install -y nodejs
        else
            print_error "Unable to install Node.js automatically"
            print_info "Please install Node.js manually from: https://nodejs.org/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install node@18
        else
            print_error "Homebrew not found. Please install Node.js manually"
            exit 1
        fi
    else
        print_error "Unsupported OS. Please install Node.js manually"
        exit 1
    fi
    
    print_success "Node.js installed successfully"
fi

# Step 2: Check npm
print_step "Step 2/7: Checking npm installation..."
if command -v npm &> /dev/null; then
    print_success "npm $(npm -v) is installed"
else
    print_error "npm is not installed"
    exit 1
fi

# Step 3: Install dependencies
print_step "Step 3/7: Installing dependencies..."
if [ -f "package.json" ]; then
    npm install
    print_success "Dependencies installed successfully"
else
    print_error "package.json not found. Are you in the correct directory?"
    exit 1
fi

# Step 4: Create .env file
print_step "Step 4/7: Setting up configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Created .env file from .env.example"
    else
        print_error ".env.example not found"
        exit 1
    fi
else
    print_warning ".env file already exists. Skipping..."
fi

# Step 5: Configure Telegram
print_step "Step 5/7: Telegram Bot Configuration"
echo ""
print_info "You need to create a Telegram Bot first:"
echo "  1. Open Telegram and search for @BotFather"
echo "  2. Send /newbot command"
echo "  3. Follow the instructions to create your bot"
echo "  4. Copy the Bot Token"
echo ""

read -p "Do you have a Telegram Bot Token? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your Telegram Bot Token: " TELEGRAM_BOT_TOKEN
    read -p "Enter your Telegram Channel ID (e.g., @channel or -1001234567890): " TELEGRAM_CHANNEL_ID
    
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN|" .env
        sed -i '' "s|TELEGRAM_CHANNEL_ID=.*|TELEGRAM_CHANNEL_ID=$TELEGRAM_CHANNEL_ID|" .env
    else
        sed -i "s|TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN|" .env
        sed -i "s|TELEGRAM_CHANNEL_ID=.*|TELEGRAM_CHANNEL_ID=$TELEGRAM_CHANNEL_ID|" .env
    fi
    
    print_success "Telegram configuration saved"
else
    print_warning "Telegram Bot Token not provided. You'll need to configure it manually in .env"
fi

# Step 6: Configure Owner Phone
print_step "Step 6/7: Owner Configuration"
echo ""
read -p "Enter your phone number (format: 201234567890): " OWNER_PHONE

if [ ! -z "$OWNER_PHONE" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|OWNER_PHONE=.*|OWNER_PHONE=$OWNER_PHONE|" .env
    else
        sed -i "s|OWNER_PHONE=.*|OWNER_PHONE=$OWNER_PHONE|" .env
    fi
    print_success "Owner phone number saved"
else
    print_warning "Owner phone not provided. You'll need to configure it manually in .env"
fi

# Step 7: Create config.json if not exists
print_step "Step 7/7: Finalizing setup..."
if [ ! -f "config.json" ]; then
    if [ -f "config.json.example" ]; then
        cp config.json.example config.json
        print_success "Created config.json from config.json.example"
    else
        # Create default config.json
        cat > config.json << 'EOF'
{
  "bridges": [],
  "eliteUsers": [],
  "filters": {
    "enabled": false,
    "blacklist": [],
    "whitelist": [],
    "keywords": [],
    "allowedTypes": []
  },
  "botStatus": {
    "active": true,
    "pausedGroups": []
  },
  "smartAlerts": {
    "enabled": false,
    "keywords": []
  },
  "schedules": [],
  "admins": [],
  "privateChatResponses": {
    "enabled": true,
    "intelligentMatching": true,
    "aiEnabled": true,
    "keywords": []
  }
}
EOF
        print_success "Created default config.json"
    fi
else
    print_warning "config.json already exists. Skipping..."
fi

# Create Materials folder
if [ ! -d "Materials" ]; then
    mkdir -p Materials
    print_success "Created Materials folder"
fi

# Create logs folder
if [ ! -d "logs" ]; then
    mkdir -p logs
    print_success "Created logs folder"
fi

# Final Summary
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}          ✅ Installation Completed Successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""

print_info "Next Steps:"
echo ""
echo "  1. Review and update .env file with your credentials:"
echo "     nano .env"
echo ""
echo "  2. Start the bot:"
echo "     npm start"
echo ""
echo "  3. Scan the QR code with WhatsApp or enter pairing code"
echo ""
echo "  4. The bot will display all your WhatsApp groups"
echo ""
echo "  5. Copy the Group JID and add it to .env file"
echo ""
echo "  6. Restart the bot and enjoy!"
echo ""
print_warning "Important: Never share your .env file or auth_info_baileys folder!"
echo ""
echo -e "${CYAN}For more information, check README.md${NC}"
echo -e "${CYAN}Report issues: https://github.com/obieda-hussien/what-sapp_bot/issues${NC}"
echo ""
