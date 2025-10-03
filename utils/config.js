import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// تصدير المسار للاستخدام في أماكن أخرى
export { CONFIG_PATH };

/**
 * قراءة ملف الإعدادات
 */
export function loadConfig() {
    try {
        // إذا كان الملف غير موجود، نقوم بإنشائه
        if (!fs.existsSync(CONFIG_PATH)) {
            console.log('📝 ملف config.json غير موجود، جاري إنشائه...');
            console.log(`📍 المسار: ${CONFIG_PATH}`);
            const defaultConfig = getDefaultConfig();
            
            // إضافة OWNER_PHONE من .env إلى eliteUsers تلقائياً
            if (process.env.OWNER_PHONE) {
                const ownerPhone = process.env.OWNER_PHONE.replace(/\D/g, '');
                if (ownerPhone && !defaultConfig.eliteUsers.includes(ownerPhone)) {
                    defaultConfig.eliteUsers.push(ownerPhone);
                    console.log(`✅ تم إضافة المالك (${ownerPhone}) تلقائياً إلى قائمة النخبة`);
                }
            }
            
            // إضافة الجسر من .env إلى bridges تلقائياً إذا كان موجوداً
            if (process.env.WHATSAPP_GROUP_JID && process.env.TELEGRAM_CHANNEL_ID) {
                defaultConfig.bridges.push({
                    whatsapp: process.env.WHATSAPP_GROUP_JID,
                    telegram: process.env.TELEGRAM_CHANNEL_ID,
                    enabled: true
                });
                console.log(`✅ تم إضافة الجسر (${process.env.WHATSAPP_GROUP_JID} → ${process.env.TELEGRAM_CHANNEL_ID}) تلقائياً`);
            }
            
            // التأكد من وجود المجلد الأب
            const configDir = path.dirname(CONFIG_PATH);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
            console.log('✅ تم إنشاء ملف config.json بنجاح');
            return defaultConfig;
        }
        
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        const config = JSON.parse(data);
        
        // دمج مع الإعدادات الافتراضية للتأكد من وجود جميع الحقول
        const defaultConfig = getDefaultConfig();
        const mergedConfig = { ...defaultConfig, ...config };
        
        // إضافة الحقول المفقودة
        if (!mergedConfig.smartAlerts) mergedConfig.smartAlerts = defaultConfig.smartAlerts;
        if (!mergedConfig.schedules) mergedConfig.schedules = defaultConfig.schedules;
        if (!mergedConfig.admins) mergedConfig.admins = defaultConfig.admins;
        if (!mergedConfig.privateChatResponses) mergedConfig.privateChatResponses = defaultConfig.privateChatResponses;
        
        let needsSave = false;
        
        // إضافة OWNER_PHONE من .env إلى eliteUsers إذا لم يكن موجوداً
        if (process.env.OWNER_PHONE) {
            const ownerPhone = process.env.OWNER_PHONE.replace(/\D/g, '');
            if (ownerPhone && !mergedConfig.eliteUsers.includes(ownerPhone)) {
                mergedConfig.eliteUsers.push(ownerPhone);
                console.log(`✅ تم إضافة المالك (${ownerPhone}) تلقائياً إلى قائمة النخبة`);
                needsSave = true;
            }
        }
        
        // إضافة الجسر من .env إلى bridges إذا لم يكن موجوداً
        if (process.env.WHATSAPP_GROUP_JID && process.env.TELEGRAM_CHANNEL_ID) {
            const existingBridge = mergedConfig.bridges.find(
                b => b.whatsapp === process.env.WHATSAPP_GROUP_JID
            );
            if (!existingBridge) {
                mergedConfig.bridges.push({
                    whatsapp: process.env.WHATSAPP_GROUP_JID,
                    telegram: process.env.TELEGRAM_CHANNEL_ID,
                    enabled: true
                });
                console.log(`✅ تم إضافة الجسر (${process.env.WHATSAPP_GROUP_JID} → ${process.env.TELEGRAM_CHANNEL_ID}) تلقائياً`);
                needsSave = true;
            }
        }
        
        // حفظ التحديثات إذا كانت هناك تغييرات
        if (needsSave) {
            saveConfig(mergedConfig);
        }
        
        return mergedConfig;
    } catch (error) {
        console.error('❌ خطأ في قراءة ملف الإعدادات:', error.message);
        console.error('📍 المسار المتوقع:', CONFIG_PATH);
        const defaultConfig = getDefaultConfig();
        
        // إضافة OWNER_PHONE من .env
        if (process.env.OWNER_PHONE) {
            const ownerPhone = process.env.OWNER_PHONE.replace(/\D/g, '');
            if (ownerPhone && !defaultConfig.eliteUsers.includes(ownerPhone)) {
                defaultConfig.eliteUsers.push(ownerPhone);
                console.log(`✅ تم إضافة المالك (${ownerPhone}) تلقائياً إلى قائمة النخبة`);
            }
        }
        
        // محاولة إنشاء الملف حتى في حالة الخطأ
        try {
            const configDir = path.dirname(CONFIG_PATH);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
                console.log('✅ تم إنشاء المجلد:', configDir);
            }
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
            console.log('✅ تم إنشاء ملف الإعدادات الافتراضي بنجاح');
        } catch (writeError) {
            console.error('❌ فشل إنشاء ملف الإعدادات:', writeError.message);
            console.error('💡 نصيحة: تأكد من صلاحيات الكتابة في المجلد');
        }
        return defaultConfig;
    }
}

/**
 * حفظ ملف الإعدادات
 */
export function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('❌ خطأ في حفظ ملف الإعدادات:', error.message);
        return false;
    }
}

/**
 * حفظ الرقم المسجل في ملف .env
 */
export function savePhoneToEnv(phone, lid = null) {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        
        // قراءة ملف .env الحالي
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }
        
        // التحقق من وجود OWNER_PHONE بالفعل
        const ownerPhoneRegex = /^OWNER_PHONE=.*/m;
        
        if (ownerPhoneRegex.test(envContent)) {
            // استبدال القيمة الحالية
            envContent = envContent.replace(ownerPhoneRegex, `OWNER_PHONE=${phone}`);
            console.log(`✅ تم تحديث OWNER_PHONE في .env إلى: ${phone}`);
        } else {
            // إضافة السطر الجديد
            envContent += `\n# Auto-added by bot on first connection\nOWNER_PHONE=${phone}\n`;
            console.log(`✅ تم إضافة OWNER_PHONE إلى .env: ${phone}`);
        }
        
        // حفظ الملف
        fs.writeFileSync(envPath, envContent, 'utf8');
        return true;
    } catch (error) {
        console.error('❌ خطأ في حفظ الرقم في .env:', error.message);
        return false;
    }
}

/**
 * الإعدادات الافتراضية
 */
function getDefaultConfig() {
    return {
        bridges: [],
        eliteUsers: [],
        filters: {
            enabled: false,
            blacklist: [],
            whitelist: [],
            keywords: [],
            allowedTypes: []
        },
        botStatus: {
            active: true,
            pausedGroups: []
        },
        smartAlerts: {
            enabled: false,
            keywords: []
        },
        schedules: [],
        admins: [],
        privateChatResponses: {
            enabled: false,
            keywords: []
        }
    };
}

/**
 * التحقق من أن المستخدم من النخبة
 */
export function isEliteUser(phoneNumber) {
    const config = loadConfig();
    return config.eliteUsers.includes(phoneNumber);
}

/**
 * إضافة مستخدم للنخبة
 */
export function addEliteUser(phoneNumber) {
    const config = loadConfig();
    if (!config.eliteUsers.includes(phoneNumber)) {
        config.eliteUsers.push(phoneNumber);
        return saveConfig(config);
    }
    return false;
}

/**
 * حذف مستخدم من النخبة
 */
export function removeEliteUser(phoneNumber) {
    const config = loadConfig();
    const index = config.eliteUsers.indexOf(phoneNumber);
    if (index > -1) {
        config.eliteUsers.splice(index, 1);
        return saveConfig(config);
    }
    return false;
}

/**
 * إضافة جسر جديد (WhatsApp → Telegram)
 */
export function addBridge(whatsappJid, telegramChannelId) {
    const config = loadConfig();
    const exists = config.bridges.some(b => b.whatsapp === whatsappJid);
    if (!exists) {
        config.bridges.push({
            whatsapp: whatsappJid,
            telegram: telegramChannelId,
            enabled: true
        });
        return saveConfig(config);
    }
    return false;
}

/**
 * حذف جسر
 */
export function removeBridge(whatsappJid) {
    const config = loadConfig();
    config.bridges = config.bridges.filter(b => b.whatsapp !== whatsappJid);
    return saveConfig(config);
}

/**
 * الحصول على قناة Telegram لجروب WhatsApp معين
 */
export function getTelegramChannel(whatsappJid) {
    const config = loadConfig();
    const bridge = config.bridges.find(b => b.whatsapp === whatsappJid && b.enabled);
    return bridge ? bridge.telegram : null;
}

/**
 * التحقق من أن البوت نشط
 */
export function isBotActive() {
    const config = loadConfig();
    return config.botStatus.active;
}

/**
 * تفعيل/تعطيل البوت
 */
export function setBotStatus(active) {
    const config = loadConfig();
    config.botStatus.active = active;
    return saveConfig(config);
}

/**
 * إيقاف جروب معين مؤقتاً
 */
export function pauseGroup(whatsappJid) {
    const config = loadConfig();
    if (!config.botStatus.pausedGroups.includes(whatsappJid)) {
        config.botStatus.pausedGroups.push(whatsappJid);
        return saveConfig(config);
    }
    return false;
}

/**
 * تشغيل جروب تم إيقافه
 */
export function resumeGroup(whatsappJid) {
    const config = loadConfig();
    config.botStatus.pausedGroups = config.botStatus.pausedGroups.filter(jid => jid !== whatsappJid);
    return saveConfig(config);
}

/**
 * التحقق من أن الجروب متوقف
 */
export function isGroupPaused(whatsappJid) {
    const config = loadConfig();
    return config.botStatus.pausedGroups.includes(whatsappJid);
}

/**
 * تطبيق الفلاتر على رسالة
 */
export function shouldFilterMessage(senderPhone, messageText, messageType) {
    const config = loadConfig();
    if (!config.filters.enabled) return false;

    // Blacklist check
    if (config.filters.blacklist.length > 0 && config.filters.blacklist.includes(senderPhone)) {
        return true;
    }

    // Whitelist check (if whitelist exists, only allow whitelisted users)
    if (config.filters.whitelist.length > 0 && !config.filters.whitelist.includes(senderPhone)) {
        return true;
    }

    // Keyword filter
    if (config.filters.keywords.length > 0 && messageText) {
        const hasKeyword = config.filters.keywords.some(keyword => 
            messageText.toLowerCase().includes(keyword.toLowerCase())
        );
        if (hasKeyword) return true;
    }

    // Message type filter
    if (config.filters.allowedTypes.length > 0 && !config.filters.allowedTypes.includes(messageType)) {
        return true;
    }

    return false;
}

/**
 * تفعيل/تعطيل الفلاتر
 */
export function setFilterStatus(enabled) {
    const config = loadConfig();
    config.filters.enabled = enabled;
    return saveConfig(config);
}

/**
 * إضافة رقم للقائمة السوداء
 */
export function addToBlacklist(phoneNumber) {
    const config = loadConfig();
    if (!config.filters.blacklist.includes(phoneNumber)) {
        config.filters.blacklist.push(phoneNumber);
        return saveConfig(config);
    }
    return false;
}

/**
 * حذف رقم من القائمة السوداء
 */
export function removeFromBlacklist(phoneNumber) {
    const config = loadConfig();
    config.filters.blacklist = config.filters.blacklist.filter(num => num !== phoneNumber);
    return saveConfig(config);
}
