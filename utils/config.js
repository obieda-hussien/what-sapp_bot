import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

/**
 * قراءة ملف الإعدادات
 */
export function loadConfig() {
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ خطأ في قراءة ملف الإعدادات:', error.message);
        return getDefaultConfig();
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
