import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.join(__dirname, '..', 'logs');

// إنشاء مجلد اللوجات إذا لم يكن موجوداً
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * تنسيق الوقت
 */
function formatTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * الحصول على اسم ملف اللوج اليومي
 */
function getDailyLogFile(prefix) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(LOGS_DIR, `${prefix}-${date}.log`);
}

/**
 * كتابة سطر في ملف اللوج
 */
function writeLog(filePath, message) {
    try {
        const timestamp = formatTimestamp();
        const logLine = `[${timestamp}] ${message}\n`;
        fs.appendFileSync(filePath, logLine, 'utf8');
    } catch (error) {
        console.error('خطأ في كتابة اللوج:', error.message);
    }
}

/**
 * تسجيل الأخطاء والتحذيرات
 */
export function logError(message, error = null) {
    const logFile = getDailyLogFile('errors');
    const errorDetails = error ? ` - ${error.message}\n${error.stack}` : '';
    writeLog(logFile, `❌ ERROR: ${message}${errorDetails}`);
    console.error(`❌ ${message}`, error || '');
}

export function logWarning(message) {
    const logFile = getDailyLogFile('errors');
    writeLog(logFile, `⚠️  WARNING: ${message}`);
    console.warn(`⚠️  ${message}`);
}

/**
 * تسجيل رسائل الواتساب
 */
export function logWhatsAppMessage(senderName, senderPhone, groupJid, messageType, content = '') {
    const logFile = getDailyLogFile('whatsapp-messages');
    const contentPreview = content.substring(0, 100);
    writeLog(logFile, 
        `📱 WhatsApp | From: ${senderName} (${senderPhone}) | Group: ${groupJid} | Type: ${messageType} | Content: ${contentPreview}`
    );
}

/**
 * تسجيل رسائل التيليجرام
 */
export function logTelegramMessage(channel, messageType, success = true, messageId = null) {
    const logFile = getDailyLogFile('telegram-messages');
    const status = success ? '✅ SUCCESS' : '❌ FAILED';
    const msgIdInfo = messageId ? ` | MessageID: ${messageId}` : '';
    writeLog(logFile, 
        `📢 Telegram | Channel: ${channel} | Type: ${messageType} | Status: ${status}${msgIdInfo}`
    );
}

/**
 * تسجيل الرسائل الفاشلة
 */
export function logFailedTransfer(senderName, senderPhone, messageType, reason, messageContent = '') {
    const logFile = getDailyLogFile('failed-transfers');
    const contentPreview = messageContent.substring(0, 100);
    writeLog(logFile, 
        `🚫 FAILED | From: ${senderName} (${senderPhone}) | Type: ${messageType} | Reason: ${reason} | Content: ${contentPreview}`
    );
}

/**
 * تسجيل الأوامر
 */
export function logCommand(userPhone, command, args, success = true) {
    const logFile = getDailyLogFile('commands');
    const status = success ? '✅' : '❌';
    const argsStr = args.length > 0 ? ` Args: ${args.join(' ')}` : '';
    writeLog(logFile, 
        `${status} COMMAND | User: ${userPhone} | Command: ${command}${argsStr} | Status: ${success ? 'SUCCESS' : 'FAILED'}`
    );
}

/**
 * تسجيل التنبيهات الذكية
 */
export function logSmartAlert(keyword, senderName, channel, message) {
    const logFile = getDailyLogFile('smart-alerts');
    writeLog(logFile, 
        `🔔 ALERT | Keyword: "${keyword}" | From: ${senderName} | Channel: ${channel} | Message: ${message.substring(0, 100)}`
    );
}

/**
 * قراءة آخر سطور من ملف اللوج
 */
export function readLastLines(logType, lines = 50) {
    try {
        const logFile = getDailyLogFile(logType);
        if (!fs.existsSync(logFile)) {
            return 'لا توجد سجلات لهذا اليوم';
        }
        
        const content = fs.readFileSync(logFile, 'utf8');
        const allLines = content.trim().split('\n');
        const lastLines = allLines.slice(-lines);
        return lastLines.join('\n');
    } catch (error) {
        logError('فشل قراءة ملف اللوج', error);
        return 'خطأ في قراءة السجلات';
    }
}

/**
 * حذف لوجات قديمة (أقدم من X أيام)
 */
export function cleanOldLogs(daysToKeep = 30) {
    try {
        const files = fs.readdirSync(LOGS_DIR);
        const now = Date.now();
        const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
        
        let deletedCount = 0;
        files.forEach(file => {
            const filePath = path.join(LOGS_DIR, file);
            const stats = fs.statSync(filePath);
            const age = now - stats.mtimeMs;
            
            if (age > maxAge) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });
        
        return deletedCount;
    } catch (error) {
        logError('فشل حذف اللوجات القديمة', error);
        return 0;
    }
}

/**
 * الحصول على إحصائيات اللوجات
 */
export function getLogStats() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const stats = {
            errors: 0,
            whatsappMessages: 0,
            telegramMessages: 0,
            failedTransfers: 0,
            commands: 0,
            smartAlerts: 0
        };
        
        const logTypes = [
            { prefix: 'errors', key: 'errors' },
            { prefix: 'whatsapp-messages', key: 'whatsappMessages' },
            { prefix: 'telegram-messages', key: 'telegramMessages' },
            { prefix: 'failed-transfers', key: 'failedTransfers' },
            { prefix: 'commands', key: 'commands' },
            { prefix: 'smart-alerts', key: 'smartAlerts' }
        ];
        
        logTypes.forEach(({ prefix, key }) => {
            const logFile = path.join(LOGS_DIR, `${prefix}-${today}.log`);
            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf8');
                stats[key] = content.split('\n').filter(line => line.trim()).length;
            }
        });
        
        return stats;
    } catch (error) {
        logError('فشل الحصول على إحصائيات اللوجات', error);
        return null;
    }
}

/**
 * تسجيل بدء/إيقاف البوت
 */
export function logBotStatus(status, reason = '') {
    const logFile = getDailyLogFile('bot-status');
    const reasonStr = reason ? ` - ${reason}` : '';
    writeLog(logFile, `🤖 BOT ${status.toUpperCase()}${reasonStr}`);
}
