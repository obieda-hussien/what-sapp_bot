# 🔄 WhatsApp to Telegram Bridge Bot

بوت ذكي ينقل كل رسائل جروب WhatsApp إلى قناة Telegram تلقائياً!

## ✨ المميزات

- ✅ نقل النصوص
- ✅ نقل الصور (مع أو بدون نص)
- ✅ نقل الفيديوهات
- ✅ نقل الملفات والمستندات
- ✅ نقل الملصقات (Stickers)
- ✅ نقل الرسائل الصوتية
- ✅ عرض اسم المرسل مع كل رسالة

## 📋 المتطلبات

- Node.js 18 أو أحدث
- حساب WhatsApp
- Telegram Bot Token

## 🚀 التثبيت

### 1. تحميل المشروع
```bash
git clone https://github.com/obieda-hussien/whatsapp-telegram-bridge.git
cd whatsapp-telegram-bridge
npm install
```

### 2. إنشاء Telegram Bot
1. افتح [@BotFather](https://t.me/botfather) في Telegram
2. أرسل `/newbot`
3. اختر اسم للبوت
4. احفظ الـ Token

### 3. إعداد القناة
1. أنشئ قناة جديدة في Telegram
2. اجعل البوت أدمن في القناة
3. احفظ username القناة (مثال: @mychannel)

### 4. إعداد ملف .env
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=@your_channel
WHATSAPP_GROUP_JID=سيظهر بعد المسح
SESSION_NAME=whatsapp-telegram-bot
```

### 5. تشغيل البوت
```bash
npm start
```

## 📱 الاستخدام

1. امسح الـ QR Code من واتساب
2. هيظهر لك كل الجروبات المتاحة
3. انسخ الـ JID بتاع الجروب اللي عايزه
4. حطه في `.env` في `WHATSAPP_GROUP_JID`
5. شغل البوت تاني: `npm start`

## 🎯 مثال على المخرجات

```
✅ متصل بـ WhatsApp بنجاح!

📋 الجروبات المتاحة:
- عيلتي: 120363123456789012@g.us
- الشغل: 120363987654321098@g.us

📨 رسالة جديدة من أحمد (201234567890)
✅ تم إرسال النص إلى Telegram
```

## 🛠️ التطوير

```bash
npm run dev  # للتطوير مع auto-reload
```

## ⚠️ ملاحظات مهمة

- لا تشارك ملف `.env` مع أحد
- احتفظ بنسخة من مجلد `auth_info_baileys`
- استخدم البوت وفقاً لشروط WhatsApp و Telegram

## 📝 الترخيص

MIT License - استخدمه زي ما تحب! 🎉

## 👨‍💻 المطور

Created with ❤️ by [obieda-hussien](https://github.com/obieda-hussien)# what-sapp_bot
