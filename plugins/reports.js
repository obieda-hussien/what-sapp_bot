/**
 * نظام التقارير
 * Reports System
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLogStats } from '../utils/logger.js';
import { loadConfig } from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.join(__dirname, '..', 'logs');

/**
 * إنشاء تقرير يومي
 */
export function generateDailyReport(date = null) {
    const reportDate = date || new Date().toISOString().split('T')[0];
    const config = loadConfig();
    const stats = getLogStats();
    
    let report = `📊 *التقرير اليومي*\n`;
    report += `📅 التاريخ: ${reportDate}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // إحصائيات الرسائل
    report += `📱 *رسائل WhatsApp:* ${stats.whatsappMessages}\n`;
    report += `📢 *رسائل Telegram:* ${stats.telegramMessages}\n`;
    report += `🚫 *رسائل فاشلة:* ${stats.failedTransfers}\n`;
    report += `❌ *أخطاء:* ${stats.errors}\n`;
    report += `⚡ *أوامر:* ${stats.commands}\n`;
    report += `🔔 *تنبيهات ذكية:* ${stats.smartAlerts}\n\n`;
    
    // حالة البوت
    report += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `🤖 *حالة البوت:*\n`;
    report += `• الجسور النشطة: ${config.bridges ? config.bridges.filter(b => b.enabled).length : 0}\n`;
    report += `• مستخدمي النخبة: ${config.eliteUsers ? config.eliteUsers.length : 0}\n`;
    report += `• المشرفين: ${config.admins ? config.admins.length : 0}\n`;
    report += `• الفلاتر: ${config.filters && config.filters.enabled ? '🟢 مفعلة' : '🔴 معطلة'}\n`;
    report += `• التنبيهات الذكية: ${config.smartAlerts && config.smartAlerts.enabled ? '🟢 مفعلة' : '🔴 معطلة'}\n\n`;
    
    // معدل النجاح
    const totalMessages = stats.whatsappMessages;
    const successRate = totalMessages > 0 
        ? ((totalMessages - stats.failedTransfers) / totalMessages * 100).toFixed(1)
        : 100;
    report += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `✅ *معدل النجاح:* ${successRate}%\n`;
    
    return report;
}

/**
 * إنشاء تقرير أسبوعي
 */
export function generateWeeklyReport() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    let report = `📊 *التقرير الأسبوعي*\n`;
    report += `📅 من: ${startDate.toISOString().split('T')[0]}\n`;
    report += `📅 إلى: ${endDate.toISOString().split('T')[0]}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // جمع الإحصائيات لآخر 7 أيام
    let totalWhatsApp = 0;
    let totalTelegram = 0;
    let totalFailed = 0;
    let totalErrors = 0;
    let totalCommands = 0;
    let totalAlerts = 0;
    
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayStats = getDayStats(dateStr);
        totalWhatsApp += dayStats.whatsappMessages;
        totalTelegram += dayStats.telegramMessages;
        totalFailed += dayStats.failedTransfers;
        totalErrors += dayStats.errors;
        totalCommands += dayStats.commands;
        totalAlerts += dayStats.smartAlerts;
    }
    
    report += `📱 *إجمالي رسائل WhatsApp:* ${totalWhatsApp}\n`;
    report += `📢 *إجمالي رسائل Telegram:* ${totalTelegram}\n`;
    report += `🚫 *إجمالي الرسائل الفاشلة:* ${totalFailed}\n`;
    report += `❌ *إجمالي الأخطاء:* ${totalErrors}\n`;
    report += `⚡ *إجمالي الأوامر:* ${totalCommands}\n`;
    report += `🔔 *إجمالي التنبيهات:* ${totalAlerts}\n\n`;
    
    // المتوسطات
    report += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📈 *المتوسطات اليومية:*\n`;
    report += `• رسائل WhatsApp: ${(totalWhatsApp / 7).toFixed(0)}\n`;
    report += `• رسائل Telegram: ${(totalTelegram / 7).toFixed(0)}\n`;
    report += `• رسائل فاشلة: ${(totalFailed / 7).toFixed(0)}\n\n`;
    
    // معدل النجاح
    const successRate = totalWhatsApp > 0 
        ? ((totalWhatsApp - totalFailed) / totalWhatsApp * 100).toFixed(1)
        : 100;
    report += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `✅ *معدل النجاح الأسبوعي:* ${successRate}%\n`;
    
    return report;
}

/**
 * الحصول على إحصائيات يوم معين
 */
function getDayStats(date) {
    const stats = {
        whatsappMessages: 0,
        telegramMessages: 0,
        failedTransfers: 0,
        errors: 0,
        commands: 0,
        smartAlerts: 0
    };
    
    try {
        const logTypes = [
            { prefix: 'whatsapp-messages', key: 'whatsappMessages' },
            { prefix: 'telegram-messages', key: 'telegramMessages' },
            { prefix: 'failed-transfers', key: 'failedTransfers' },
            { prefix: 'errors', key: 'errors' },
            { prefix: 'commands', key: 'commands' },
            { prefix: 'smart-alerts', key: 'smartAlerts' }
        ];
        
        logTypes.forEach(({ prefix, key }) => {
            const logFile = path.join(LOGS_DIR, `${prefix}-${date}.log`);
            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf8');
                stats[key] = content.split('\n').filter(line => line.trim()).length;
            }
        });
    } catch (error) {
        console.error('خطأ في قراءة إحصائيات اليوم:', error);
    }
    
    return stats;
}

/**
 * تقرير الأخطاء الأخيرة
 */
export function generateErrorReport(lines = 20) {
    const logFile = path.join(LOGS_DIR, `errors-${new Date().toISOString().split('T')[0]}.log`);
    
    let report = `❌ *تقرير الأخطاء الأخيرة*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    try {
        if (!fs.existsSync(logFile)) {
            report += `✅ لا توجد أخطاء لهذا اليوم`;
            return report;
        }
        
        const content = fs.readFileSync(logFile, 'utf8');
        const allLines = content.trim().split('\n');
        const lastLines = allLines.slice(-lines);
        
        if (lastLines.length === 0) {
            report += `✅ لا توجد أخطاء`;
        } else {
            lastLines.forEach(line => {
                // تقصير السطر إذا كان طويلاً جداً
                const shortLine = line.length > 100 ? line.substring(0, 100) + '...' : line;
                report += `${shortLine}\n`;
            });
        }
    } catch (error) {
        report += `❌ خطأ في قراءة ملف الأخطاء: ${error.message}`;
    }
    
    return report;
}

/**
 * تقرير الرسائل الفاشلة
 */
export function generateFailedTransfersReport(lines = 20) {
    const logFile = path.join(LOGS_DIR, `failed-transfers-${new Date().toISOString().split('T')[0]}.log`);
    
    let report = `🚫 *تقرير الرسائل الفاشلة*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    try {
        if (!fs.existsSync(logFile)) {
            report += `✅ لا توجد رسائل فاشلة لهذا اليوم`;
            return report;
        }
        
        const content = fs.readFileSync(logFile, 'utf8');
        const allLines = content.trim().split('\n');
        const lastLines = allLines.slice(-lines);
        
        if (lastLines.length === 0) {
            report += `✅ لا توجد رسائل فاشلة`;
        } else {
            lastLines.forEach(line => {
                const shortLine = line.length > 100 ? line.substring(0, 100) + '...' : line;
                report += `${shortLine}\n`;
            });
        }
    } catch (error) {
        report += `❌ خطأ في قراءة ملف الرسائل الفاشلة: ${error.message}`;
    }
    
    return report;
}

/**
 * تقرير نشاط المستخدمين
 */
export function generateUserActivityReport() {
    const logFile = path.join(LOGS_DIR, `whatsapp-messages-${new Date().toISOString().split('T')[0]}.log`);
    
    let report = `👥 *تقرير نشاط المستخدمين*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    try {
        if (!fs.existsSync(logFile)) {
            report += `لا توجد بيانات لهذا اليوم`;
            return report;
        }
        
        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.trim().split('\n');
        
        // إحصاء الرسائل لكل مستخدم
        const userCounts = {};
        lines.forEach(line => {
            const match = line.match(/From: (.+?) \(/);
            if (match) {
                const user = match[1];
                userCounts[user] = (userCounts[user] || 0) + 1;
            }
        });
        
        // ترتيب المستخدمين حسب عدد الرسائل
        const sortedUsers = Object.entries(userCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);
        
        if (sortedUsers.length === 0) {
            report += `لا توجد رسائل`;
        } else {
            report += `🏆 *أكثر 10 مستخدمين نشاطاً:*\n\n`;
            sortedUsers.forEach(([user, count], index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
                report += `${medal} ${user}: ${count} رسالة\n`;
            });
        }
    } catch (error) {
        report += `❌ خطأ في إنشاء التقرير: ${error.message}`;
    }
    
    return report;
}
