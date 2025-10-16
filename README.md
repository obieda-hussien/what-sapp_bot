# 🔥 WhatsApp to Telegram Bridge Bot

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-18.x+-43853d?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Integration-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://telegram.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![AI Powered](https://img.shields.io/badge/AI-Groq%20%26%20Gemini-FF6F00?style=for-the-badge&logo=openai&logoColor=white)](https://groq.com/)

**Your ultimate WhatsApp ↔ Telegram bridge bot with AI superpowers! 🚀**

Bridge your WhatsApp groups to Telegram channels, auto-respond to DMs with AI, and manage everything with simple commands. No cap! 💯

[Features](#-features) • [Quick Start](#-quick-start) • [Commands](#-commands) • [AI Setup](#-ai-setup)

</div>

---

## 🎯 What Does It Do?

This bot is literally **fire** 🔥 - it connects your WhatsApp and Telegram like never before:

### 🌉 Bridge Mode
- **Auto-forwards** everything from WhatsApp groups to Telegram channels
- Supports **ALL** message types: text, images, videos, files, stickers, polls, locations - you name it!
- **Multi-bridge** support - connect multiple WhatsApp groups to different Telegram channels
- **Live sync** - edits and deletes are mirrored in real-time

### 🤖 Smart Auto-Response
- **AI-powered** responses using Groq (llama-3.3-70b) & Google Gemini
- **Keyword matching** - set up custom auto-replies for specific words
- **Send files** automatically - PDFs, images, documents
- **Context-aware** - the AI remembers your conversations
- **Intelligent matching** - fuzzy search for keywords (typos? no problem!)

### 👑 Elite Commands System
- **35+ commands** for full bot control
- **Access control** - decide who can use what
- **Smart alerts** - get notified about important keywords
- **Scheduled tasks** - automate actions at specific times
- **Detailed reports** - daily, weekly, error logs, and more

---

## ✨ Features

### 📤 Message Forwarding
✅ Text messages (with formatting)  
✅ Images & Videos (with captions)  
✅ Audio & Voice messages  
✅ Documents & Files (PDF, DOCX, etc.)  
✅ Stickers & GIFs  
✅ Polls & Surveys  
✅ Contacts  
✅ Locations (static & live)  
✅ Albums (multiple media)  
✅ Message edits & deletions  
✅ Emoji reactions  

### 🧠 AI Features
✅ **Groq AI** - Lightning-fast responses with llama-3.3-70b  
✅ **Google Gemini** - Automatic fallback when Groq is down  
✅ **Conversation memory** - Remembers context  
✅ **File handling** - Can send PDFs, images, folders  
✅ **Web search** - Looks up info on the internet  
✅ **Natural language** - Talks in Egyptian Arabic like a real person  

### 🎛️ Management
✅ **Multi-bridge** - Multiple WhatsApp → Telegram connections  
✅ **Elite users** - Role-based permissions  
✅ **Filters** - Blacklist/whitelist users & keywords  
✅ **Smart alerts** - Keyword notifications  
✅ **Scheduled tasks** - Auto start/stop at specific times  
✅ **Reports** - Daily, weekly, error logs  
✅ **Auto-responses** - Keyword-based replies  
✅ **Access control** - Manage who can use AI & auto-replies  

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18.x or higher
- A WhatsApp account
- A Telegram bot (get one from [@BotFather](https://t.me/botfather))
- A Telegram channel

### Installation

```bash
# Clone the repo
git clone https://github.com/obieda-hussien/what-sapp_bot.git
cd what-sapp_bot

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
nano .env  # or use any text editor

# Start the bot
npm start
```

### 🔐 Environment Setup

Edit the `.env` file with your credentials:

```env
# Telegram Bot Token (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Telegram Channel ID (where messages will be sent)
TELEGRAM_CHANNEL_ID=-1001234567890

# WhatsApp Group JID (leave empty on first run - bot will show available groups)
WHATSAPP_GROUP_JID=

# Owner Phone Number (your phone number - gets elite access)
OWNER_PHONE=201234567890

# Optional: AI API Keys
GROQ_API_KEY=your_groq_api_key  # Get from https://console.groq.com/keys
GEMINI_API_KEY=your_gemini_key  # Get from https://makersuite.google.com/app/apikey
```

### 📱 First Run

1. Run `npm start`
2. Scan the QR code with your WhatsApp (or use pairing code)
3. Bot will display all your WhatsApp groups
4. Copy the Group JID and add it to `.env`
5. Restart the bot
6. Done! 🎉

---

## 🎮 Commands

All commands start with `.` (dot). Only **elite users** can use commands.

### 🔧 Bot Control

| Command | Description | Example |
|---------|-------------|---------|
| `.test` or `.تست` | Test if bot is working | `.test` |
| `.start` or `.تشغيل` | Start the bot | `.start` |
| `.stop` or `.ايقاف` | Stop the bot | `.stop` |
| `.status` or `.الحالة` | Check bot status | `.status` |

### 📢 Bridge Management

| Command | Description | Example |
|---------|-------------|---------|
| `.add_channel` | Add WhatsApp → Telegram bridge | `.add_channel 1234@g.us @channel` |
| `.remove_channel` | Remove a bridge | `.remove_channel 1234@g.us` |
| `.channels` | List all bridges | `.channels` |
| `.pause` | Pause a group temporarily | `.pause 1234@g.us` |
| `.resume` | Resume a paused group | `.resume 1234@g.us` |

### 👑 Elite User Management

| Command | Description | Example |
|---------|-------------|---------|
| `.add_elite` | Add user to elite | `.add_elite 201234567890` |
| `.remove_elite` | Remove user from elite | `.remove_elite 201234567890` |
| `.elites` | List all elite users | `.elites` |

### 🔍 Filters & Blocking

| Command | Description | Example |
|---------|-------------|---------|
| `.block` | Block a user | `.block 201234567890` |
| `.unblock` | Unblock a user | `.unblock 201234567890` |
| `.enable_filter` | Enable message filtering | `.enable_filter` |
| `.disable_filter` | Disable filtering | `.disable_filter` |
| `.add_keyword` | Add keyword filter | `.add_keyword spam` |
| `.remove_keyword` | Remove keyword filter | `.remove_keyword spam` |
| `.keywords` | List filtered keywords | `.keywords` |

### 🔔 Smart Alerts

| Command | Description | Example |
|---------|-------------|---------|
| `.add_alert` | Add smart alert | `.add_alert urgent @admin` |
| `.remove_alert` | Remove an alert | `.remove_alert urgent` |
| `.alerts` | List all alerts | `.alerts` |
| `.enable_alerts` | Enable smart alerts | `.enable_alerts` |
| `.disable_alerts` | Disable smart alerts | `.disable_alerts` |

### ⏰ Scheduled Tasks

| Command | Description | Example |
|---------|-------------|---------|
| `.add_schedule` | Add scheduled task | `.add_schedule "Daily Stop" 23:00 stop` |
| `.remove_schedule` | Remove a schedule | `.remove_schedule "Daily Stop"` |
| `.schedules` | List all schedules | `.schedules` |

### 💬 Auto-Response Management

| Command | Description | Example |
|---------|-------------|---------|
| `.add_response` | Add auto-response | `.add_response text "hi" "Hello there!"` |
| `.remove_response` | Remove auto-response | `.remove_response hi` |
| `.responses` | List all responses | `.responses` |
| `.enable_responses` | Enable auto-responses | `.enable_responses` |
| `.disable_responses` | Disable auto-responses | `.disable_responses` |

### 🤖 AI Management

| Command | Description | Example |
|---------|-------------|---------|
| `.enable_ai` | Enable AI responses | `.enable_ai` |
| `.disable_ai` | Disable AI responses | `.disable_ai` |
| `.ai_status` | Check AI status | `.ai_status` |
| `.ai_stats` | View AI statistics | `.ai_stats` |
| `.clear_memory` | Clear AI conversation memory | `.clear_memory` |
| `.files` | List available materials | `.files` |

### 🔐 Access Control

| Command | Description | Example |
|---------|-------------|---------|
| `.auto_mode` | Set auto-reply access mode | `.auto_mode elite` |
| `.ai_mode` | Set AI access mode | `.ai_mode all` |
| `.block_auto` | Block user from auto-replies | `.block_auto 201234567890` |
| `.unblock_auto` | Unblock user from auto-replies | `.unblock_auto 201234567890` |
| `.block_ai` | Block user from AI | `.block_ai 201234567890` |
| `.unblock_ai` | Unblock user from AI | `.unblock_ai 201234567890` |
| `.access_status` | View access control status | `.access_status` |

### 📊 Reports & Logs

| Command | Description | Example |
|---------|-------------|---------|
| `.daily_report` | Generate daily report | `.daily_report` |
| `.weekly_report` | Generate weekly report | `.weekly_report` |
| `.error_report` | View error logs | `.error_report` |
| `.failed_report` | View failed transfers | `.failed_report` |
| `.activity_report` | User activity report | `.activity_report` |
| `.logs` | View specific logs | `.logs errors` |
| `.clean_logs` | Clean old log files | `.clean_logs` |

### 👨‍💼 Admin Management

| Command | Description | Example |
|---------|-------------|---------|
| `.add_admin` | Add an admin | `.add_admin 201234567890 alerts` |
| `.remove_admin` | Remove an admin | `.remove_admin 201234567890` |
| `.admins` | List all admins | `.admins` |

### ℹ️ Help

| Command | Description | Example |
|---------|-------------|---------|
| `.help` or `.المساعدة` | Show all commands | `.help` |

---

## 🤖 AI Setup

The bot supports **two AI providers** for smart auto-responses:

### 🚀 Groq (Primary)
- **Model**: llama-3.3-70b-versatile
- **Speed**: Lightning fast ⚡
- **Free tier**: Very generous
- **Get key**: https://console.groq.com/keys

### 🧠 Google Gemini (Fallback)
- **Model**: gemini-2.0-flash-exp
- **Fallback**: Auto-activates when Groq fails
- **Free tier**: Available
- **Get key**: https://makersuite.google.com/app/apikey

### Setting Up AI

1. **Get API Keys** (optional but recommended):
   - Groq: Visit https://console.groq.com/keys
   - Gemini: Visit https://makersuite.google.com/app/apikey

2. **Add to `.env`**:
   ```env
   GROQ_API_KEY=gsk_your_actual_key_here
   GEMINI_API_KEY=AIzaYour_actual_key_here
   ```

3. **Restart the bot** - It will validate keys on startup!

### AI Features

The AI can:
- 🗣️ **Chat naturally** in Egyptian Arabic
- 📚 **Send files** - PDFs, images, whole folders
- 🔍 **Search the web** for information
- 🧠 **Remember context** - keeps track of conversations
- 📖 **Read text files** and explain them
- 🌐 **Translate** content from English to Arabic
- 💡 **Smart** - understands typos and context

### How It Works

When someone DMs your WhatsApp:
1. Bot checks for **keyword matches** first (instant, no AI needed)
2. If no match, uses **Groq AI** for intelligent response
3. If Groq fails, falls back to **Gemini AI**
4. If both fail, uses **keyword-only** responses

---

## 📁 Project Structure

```
what-sapp_bot/
├── index.js              # Main bot file
├── package.json          # Dependencies
├── .env                  # Your credentials (DO NOT commit!)
├── config.json           # Bot configuration
├── plugins/
│   ├── commands.js       # Command handler
│   ├── privateChat.js    # Auto-response system
│   ├── alerts.js         # Smart alerts & schedules
│   └── reports.js        # Report generator
├── utils/
│   ├── groqAssistant.js  # AI integration
│   ├── config.js         # Config management
│   ├── logger.js         # Logging system
│   ├── accessControl.js  # Access permissions
│   ├── intelligentMatcher.js  # Smart keyword matching
│   └── media.js          # Media handling
├── Materials/            # Store your files here (PDFs, images, etc.)
└── logs/                 # Log files
```

---

## 🎨 Customization

### Adding Auto-Responses

You can add responses via command or directly in `config.json`:

**Via Command**:
```
.add_response text "hello" "Hi there! How can I help?"
.add_response document "syllabus" "/path/to/syllabus.pdf" "Here's the syllabus"
.add_response image "schedule" "/path/to/schedule.jpg" "Class schedule"
```

**In config.json**:
```json
{
  "privateChatResponses": {
    "enabled": true,
    "intelligentMatching": true,
    "keywords": [
      {
        "keywords": ["hello", "hi", "hey"],
        "responseType": "text",
        "text": "Hi there! How can I help?",
        "filePath": null,
        "caption": null
      }
    ]
  }
}
```

**Response Types**:
- `text` - Text only
- `document` - File only (PDF, Word, etc.)
- `image` - Image only (JPG, PNG, etc.)
- `both` - Text + File

---

## 🐛 Troubleshooting

### Bot not connecting to WhatsApp?
- Make sure you scanned the QR code
- Check your internet connection
- Delete `auth_info_baileys` folder and restart

### Messages not forwarding?
- Verify `WHATSAPP_GROUP_JID` in `.env`
- Check that bot is active: `.status`
- Make sure group isn't paused: `.channels`

### AI not responding?
- Check if API keys are valid: Look for validation messages on startup
- Verify keys at https://console.groq.com or https://makersuite.google.com
- Check AI status: `.ai_status`
- View AI stats: `.ai_stats`

### Commands not working?
- Only **elite users** can use commands
- Check if you're elite: `.elites`
- Add yourself: Set `OWNER_PHONE` in `.env` or use `.add_elite` from another elite user

### Invalid API Key Error?
The bot now validates keys on startup! If you see:
```
❌ Groq API Key: غير صالح
   السبب: المفتاح قصير جداً
```
- Get a new key from https://console.groq.com/keys
- Make sure you copied the entire key
- Remove any extra spaces
- Restart the bot after updating

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit pull requests
- ⭐ Star the repo if you like it!

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Obieda Hussien** ([@obieda-hussien](https://github.com/obieda-hussien))

---

## 🌟 Star History

If this bot helped you, consider giving it a star! ⭐

---

<div align="center">

**Made with ❤️ and lots of ☕**

Built with [Baileys](https://github.com/WhiskeySockets/Baileys) • [Telegraf](https://telegraf.js.org/) • [Groq](https://groq.com/) • [Gemini](https://ai.google.dev/)

</div>
