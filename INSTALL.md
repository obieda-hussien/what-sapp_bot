# 🚀 دليل التنصيب السريع - WhatsApp Bot

<div dir="rtl">

## 📋 المحتويات
- [التنصيب التلقائي](#-التنصيب-التلقائي)
- [التنصيب اليدوي](#-التنصيب-اليدوي)
- [التنصيب على Termux](#-التنصيب-على-termux)
- [التنصيب على VPS](#-التنصيب-على-vps)
- [إنشاء بوت فرعي](#-إنشاء-بوت-فرعي)

> 💡 **تبحث عن خيارات استضافة مجانية؟** راجع [AI_MODELS_HOSTING_GUIDE.md](AI_MODELS_HOSTING_GUIDE.md) للحصول على دليل شامل عن نماذج الذكاء الاصطناعي المجانية وخيارات الاستضافة (Oracle Cloud، VPS، Raspberry Pi، وأكثر)

---

## 🎯 التنصيب التلقائي

أسرع طريقة لتنصيب البوت هي استخدام سكريبت التنصيب الآلي:

### على Linux / macOS / Termux

```bash
# 1. استنساخ المشروع
git clone https://github.com/obieda-hussien/what-sapp_bot.git
cd what-sapp_bot

# 2. منح صلاحيات التنفيذ
chmod +x install.sh

# 3. تشغيل سكريبت التنصيب
./install.sh
```

### على Windows

```batch
# 1. استنساخ المشروع
git clone https://github.com/obieda-hussien/what-sapp_bot.git
cd what-sapp_bot

# 2. تشغيل سكريبت التنصيب
install.bat
```

**ملاحظة:** سكريبت التنصيب سيقوم بـ:
- ✅ فحص تنصيب Node.js (وتنصيبه إذا لزم الأمر)
- ✅ تنصيب المكتبات المطلوبة
- ✅ إنشاء ملف الإعدادات (.env)
- ✅ طلب بيانات Telegram Bot
- ✅ إعداد البنية الأساسية للمشروع

---

## 🔧 التنصيب اليدوي

إذا فضّلت التنصيب اليدوي:

### 1️⃣ المتطلبات الأساسية

تأكد من تنصيب:
- **Node.js** الإصدار 18 أو أحدث ([تحميل](https://nodejs.org/))
- **npm** يأتي مع Node.js
- **Git** ([تحميل](https://git-scm.com/))

للتحقق من التنصيب:
```bash
node -v    # يجب أن يظهر v18.0.0 أو أحدث
npm -v     # يجب أن يظهر رقم الإصدار
git --version
```

### 2️⃣ استنساخ المشروع

```bash
git clone https://github.com/obieda-hussien/what-sapp_bot.git
cd what-sapp_bot
```

### 3️⃣ تنصيب المكتبات

```bash
npm install
```

سيتم تنصيب:
- `@whiskeysockets/baileys` - للاتصال بـ WhatsApp
- `telegraf` - للاتصال بـ Telegram
- `dotenv` - لإدارة المتغيرات
- `pino` - للسجلات
- `node-cache` - للتخزين المؤقت
- `groq-sdk` - للذكاء الاصطناعي (اختياري)

### 4️⃣ إعداد ملف البيئة

```bash
# نسخ ملف المثال
cp .env.example .env

# تعديل الملف
nano .env   # أو استخدم أي محرر نصوص
```

### 5️⃣ إنشاء Telegram Bot

1. افتح Telegram وابحث عن [@BotFather](https://t.me/botfather)
2. أرسل الأمر `/newbot`
3. اختر اسم للبوت (مثال: My WhatsApp Bot)
4. اختر username للبوت (يجب أن ينتهي بـ bot)
5. احفظ الـ **Token** الذي سيظهر

### 6️⃣ إنشاء قناة Telegram

1. أنشئ قناة جديدة في Telegram
2. اجعلها خاصة (للحماية)
3. أضف البوت كـ **مشرف** في القناة
4. أعطه صلاحية **نشر الرسائل**
5. احفظ **معرف القناة**

للحصول على معرف القناة:
- أرسل رسالة في القناة
- Forward الرسالة إلى [@userinfobot](https://t.me/userinfobot)
- سيظهر لك الـ Channel ID

### 7️⃣ تحديث ملف .env

افتح `.env` وضع البيانات:

```env
# Telegram
TELEGRAM_BOT_TOKEN=7123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
TELEGRAM_CHANNEL_ID=-1001234567890

# WhatsApp (اتركه فارغاً الآن)
WHATSAPP_GROUP_JID=

# رقمك
OWNER_PHONE=201234567890

# إعدادات اختيارية
FORWARD_SENDER_NAME=true
FORWARD_REACTIONS=true
FORWARD_MESSAGE_EDITS=true
```

### 8️⃣ تشغيل البوت

```bash
npm start
```

### 9️⃣ الاتصال بـ WhatsApp

**الطريقة 1: QR Code**
- سيظهر QR Code في الـ Terminal
- افتح WhatsApp → الإعدادات → الأجهزة المتصلة
- امسح الـ QR Code

**الطريقة 2: Pairing Code**
- أدخل رقم هاتفك (مثال: 201234567890)
- سيظهر كود من 8 أرقام
- افتح WhatsApp → الأجهزة المتصلة → ربط جهاز
- أدخل الكود

### 🔟 اختيار الجروب

بعد الاتصال، سيعرض البوت قائمة بجميع جروباتك:

```
📋 الجروبات المتاحة:

1. 📱 العائلة
   🆔 ID: 120363123456789012@g.us
   👥 الأعضاء: 15
```

انسخ الـ **JID** وضعه في `.env`:

```env
WHATSAPP_GROUP_JID=120363123456789012@g.us
```

### 1️⃣1️⃣ إعادة التشغيل

```bash
# إيقاف البوت: Ctrl + C
# إعادة التشغيل:
npm start
```

🎉 **تم! البوت يعمل الآن**

---

## 📱 التنصيب على Termux

Termux هو تطبيق Android لتشغيل Linux على الهاتف.

### 1️⃣ تنصيب Termux

- حمّل Termux من [F-Droid](https://f-droid.org/en/packages/com.termux/)
- **لا تحمّله من Google Play** (نسخة قديمة)

### 2️⃣ تحديث Termux

```bash
pkg update && pkg upgrade
```

### 3️⃣ تنصيب المتطلبات

```bash
# Git
pkg install git

# Node.js
pkg install nodejs

# Python (اختياري)
pkg install python
```

### 4️⃣ منح صلاحيات التخزين

```bash
termux-setup-storage
```
اضغط **السماح** عند الطلب

### 5️⃣ استنساخ المشروع

```bash
cd ~/storage/shared
git clone https://github.com/obieda-hussien/what-sapp_bot.git
cd what-sapp_bot
```

### 6️⃣ التنصيب التلقائي

```bash
chmod +x install.sh
./install.sh
```

أو يدوياً:

```bash
npm install
cp .env.example .env
nano .env  # عدّل البيانات
npm start
```

### 💡 نصائح Termux

- **منع النوم**: 
  ```bash
  termux-wake-lock
  ```

- **تشغيل في الخلفية**: استخدم `tmux` أو `screen`
  ```bash
  pkg install tmux
  tmux new -s bot
  npm start
  # للخروج: Ctrl+B ثم D
  # للعودة: tmux attach -t bot
  ```

- **Auto-Start**: استخدم Termux:Boot
  ```bash
  pkg install termux-services
  sv-enable whatapp-bot
  ```

---

## ☁️ التنصيب على VPS

### Amazon EC2 / DigitalOcean / Vultr

#### 1️⃣ الاتصال بـ VPS

```bash
ssh user@your-server-ip
```

#### 2️⃣ تنصيب Node.js

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

#### 3️⃣ استنساخ المشروع

```bash
cd ~
git clone https://github.com/obieda-hussien/what-sapp_bot.git
cd what-sapp_bot
```

#### 4️⃣ التنصيب

```bash
chmod +x install.sh
./install.sh
```

#### 5️⃣ تشغيل كـ Service

إنشاء ملف systemd service:

```bash
sudo nano /etc/systemd/system/whatsapp-bot.service
```

أضف:

```ini
[Unit]
Description=WhatsApp-Telegram Bridge Bot
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/what-sapp_bot
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=whatsapp-bot

[Install]
WantedBy=multi-user.target
```

فعّل وشغّل:

```bash
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-bot
sudo systemctl start whatsapp-bot
```

فحص الحالة:

```bash
sudo systemctl status whatsapp-bot
```

عرض السجلات:

```bash
sudo journalctl -u whatsapp-bot -f
```

#### 6️⃣ استخدام PM2 (بديل)

```bash
# تنصيب PM2
sudo npm install -g pm2

# تشغيل البوت
pm2 start index.js --name "whatsapp-bot"

# Auto-start عند الإقلاع
pm2 startup
pm2 save

# أوامر مفيدة
pm2 status           # حالة البوت
pm2 logs            # عرض السجلات
pm2 restart all     # إعادة تشغيل
pm2 stop all        # إيقاف
```

---

## 🔄 إنشاء بوت فرعي

إذا أردت أن تسمح لأشخاص آخرين بإنشاء نسخة من البوت:

### للمطوّر (أنت)

#### 1️⃣ إعداد Repository

تأكد من وجود هذه الملفات في repo:

```
✅ install.sh          - سكريبت تنصيب Linux
✅ install.bat         - سكريبت تنصيب Windows
✅ .env.example        - مثال ملف البيئة
✅ config.json.example - مثال الإعدادات
✅ README.md           - الدليل الكامل
✅ INSTALL.md          - دليل التنصيب (هذا الملف)
```

#### 2️⃣ إضافة License

أضف ملف `LICENSE`:

```text
MIT License

Copyright (c) 2025 YOUR_NAME

يُسمح بحرية استخدام وتعديل وتوزيع هذا البرنامج
مع الاحتفاظ بإشعار حقوق النشر هذا.
```

#### 3️⃣ توثيق واضح

في `README.md`, أضف:

```markdown
## 🔄 Fork This Project

Want to create your own instance of this bot?

1. Click **Fork** button at the top right
2. Clone your forked repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/what-sapp_bot.git
   ```
3. Follow the installation guide in [INSTALL.md](INSTALL.md)
```

### للمستخدم (من يريد نسخة)

#### 1️⃣ Fork المشروع

- اذهب إلى: https://github.com/obieda-hussien/what-sapp_bot
- اضغط **Fork** في أعلى اليمين
- سيتم إنشاء نسخة في حسابك

#### 2️⃣ Clone النسخة الخاصة بك

```bash
git clone https://github.com/YOUR_USERNAME/what-sapp_bot.git
cd what-sapp_bot
```

#### 3️⃣ التنصيب

**Linux/Mac/Termux:**
```bash
chmod +x install.sh
./install.sh
```

**Windows:**
```batch
install.bat
```

#### 4️⃣ التخصيص

عدّل ملف `.env` بمعلوماتك:
- Bot Token الخاص بك
- Channel ID الخاص بك
- رقم هاتفك

#### 5️⃣ التشغيل

```bash
npm start
```

### 🎯 مثال كامل للتنصيب السريع

```bash
# 1. Fork المشروع على GitHub
# 2. ثم:

git clone https://github.com/YOUR_USERNAME/what-sapp_bot.git
cd what-sapp_bot
./install.sh
# اتبع التعليمات
npm start
```

---

## 📊 مقارنة طرق التنصيب

| الطريقة | السهولة | السرعة | التحكم | التوصية |
|---------|---------|--------|--------|----------|
| **التلقائي** (install.sh) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | المبتدئين |
| **اليدوي** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | المتقدمين |
| **Termux** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | الهواتف |
| **VPS** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | الإنتاج |

---

## ❓ الأسئلة الشائعة

**س: هل يمكن تشغيل أكثر من بوت على نفس السيرفر؟**

ج: نعم! كل بوت في مجلد منفصل:

```bash
git clone https://github.com/obieda-hussien/what-sapp_bot.git bot1
git clone https://github.com/obieda-hussien/what-sapp_bot.git bot2

cd bot1
./install.sh
npm start

# في terminal آخر
cd bot2
./install.sh
npm start
```

**س: كيف أحدّث البوت؟**

ج:
```bash
git pull origin main
npm install
npm start
```

**س: هل يمكن نشر البوت على Heroku؟**

ج: نعم ممكن، لكن غير موصى به لأن:
- Heroku يعيد التشغيل كل 24 ساعة
- سيتم حذف ملفات الجلسة
- ستحتاج لمسح QR كل مرة

**س: ما هي أفضل طريقة للاستضافة؟**

ج:
1. **VPS** (الأفضل) - DigitalOcean, Vultr, Linode
2. **Termux** (للتجربة) - على الهاتف
3. **حاسوبك الشخصي** (للتطوير)

---

## 🆘 الدعم

إذا واجهت مشكلة:

1. 📖 راجع [README.md](README.md)
2. 🔍 ابحث في [Issues](https://github.com/obieda-hussien/what-sapp_bot/issues)
3. 🐛 افتح [Issue جديد](https://github.com/obieda-hussien/what-sapp_bot/issues/new)
4. 💬 شارك في [Discussions](https://github.com/obieda-hussien/what-sapp_bot/discussions)

---

## 🎉 تم التنصيب!

الآن البوت جاهز للاستخدام. استمتع! 🚀

</div>
