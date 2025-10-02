/**
 * نظام التنبيهات الذكية والجدولة
 * Smart Alerts and Scheduling System
 */

import { loadConfig, saveConfig } from '../utils/config.js';
import { logSmartAlert } from '../utils/logger.js';

/**
 * التحقق من وجود كلمة تنبيه في الرسالة
 */
export function checkSmartAlerts(messageText, senderName, channel) {
    const config = loadConfig();
    
    if (!config.smartAlerts || !config.smartAlerts.enabled) {
        return null;
    }
    
    if (!messageText || typeof messageText !== 'string') {
        return null;
    }
    
    const alerts = config.smartAlerts.keywords || [];
    const messageTextLower = messageText.toLowerCase();
    
    for (const alertConfig of alerts) {
        const keyword = alertConfig.keyword.toLowerCase();
        if (messageTextLower.includes(keyword)) {
            logSmartAlert(alertConfig.keyword, senderName, channel, messageText);
            return {
                keyword: alertConfig.keyword,
                channels: alertConfig.notifyChannels || [],
                message: alertConfig.customMessage || `🔔 تنبيه: تم ذكر الكلمة "${alertConfig.keyword}"`
            };
        }
    }
    
    return null;
}

/**
 * إضافة تنبيه ذكي
 */
export function addSmartAlert(keyword, notifyChannels = [], customMessage = null) {
    const config = loadConfig();
    
    if (!config.smartAlerts) {
        config.smartAlerts = {
            enabled: true,
            keywords: []
        };
    }
    
    // التحقق من عدم وجود التنبيه مسبقاً
    const exists = config.smartAlerts.keywords.some(a => a.keyword.toLowerCase() === keyword.toLowerCase());
    if (exists) {
        return false;
    }
    
    config.smartAlerts.keywords.push({
        keyword,
        notifyChannels,
        customMessage
    });
    
    return saveConfig(config);
}

/**
 * حذف تنبيه ذكي
 */
export function removeSmartAlert(keyword) {
    const config = loadConfig();
    
    if (!config.smartAlerts || !config.smartAlerts.keywords) {
        return false;
    }
    
    const originalLength = config.smartAlerts.keywords.length;
    config.smartAlerts.keywords = config.smartAlerts.keywords.filter(
        a => a.keyword.toLowerCase() !== keyword.toLowerCase()
    );
    
    if (config.smartAlerts.keywords.length < originalLength) {
        return saveConfig(config);
    }
    
    return false;
}

/**
 * تفعيل/تعطيل التنبيهات الذكية
 */
export function setSmartAlertsStatus(enabled) {
    const config = loadConfig();
    
    if (!config.smartAlerts) {
        config.smartAlerts = {
            enabled,
            keywords: []
        };
    } else {
        config.smartAlerts.enabled = enabled;
    }
    
    return saveConfig(config);
}

/**
 * الحصول على قائمة التنبيهات
 */
export function getSmartAlerts() {
    const config = loadConfig();
    return config.smartAlerts || { enabled: false, keywords: [] };
}

/**
 * إضافة جدول زمني
 */
export function addSchedule(name, type, time, action) {
    const config = loadConfig();
    
    if (!config.schedules) {
        config.schedules = [];
    }
    
    config.schedules.push({
        name,
        type, // 'daily', 'weekly', 'once'
        time, // 'HH:MM' format
        action, // 'stop', 'start', 'pause_group', 'report'
        enabled: true,
        lastRun: null
    });
    
    return saveConfig(config);
}

/**
 * حذف جدول زمني
 */
export function removeSchedule(name) {
    const config = loadConfig();
    
    if (!config.schedules) {
        return false;
    }
    
    const originalLength = config.schedules.length;
    config.schedules = config.schedules.filter(s => s.name !== name);
    
    if (config.schedules.length < originalLength) {
        return saveConfig(config);
    }
    
    return false;
}

/**
 * التحقق من الجداول الزمنية المستحقة
 */
export function checkDueSchedules() {
    const config = loadConfig();
    
    if (!config.schedules || config.schedules.length === 0) {
        return [];
    }
    
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];
    
    const dueSchedules = [];
    
    for (const schedule of config.schedules) {
        if (!schedule.enabled) continue;
        
        // التحقق من الوقت
        if (schedule.time !== currentTime) continue;
        
        // التحقق من آخر تشغيل
        if (schedule.lastRun === today) continue;
        
        dueSchedules.push(schedule);
        
        // تحديث آخر تشغيل
        schedule.lastRun = today;
    }
    
    if (dueSchedules.length > 0) {
        saveConfig(config);
    }
    
    return dueSchedules;
}

/**
 * الحصول على قائمة الجداول الزمنية
 */
export function getSchedules() {
    const config = loadConfig();
    return config.schedules || [];
}

/**
 * إضافة صلاحيات للمشرف
 */
export function addAdmin(phoneNumber, permissions = ['view', 'manage_filters', 'manage_alerts']) {
    const config = loadConfig();
    
    if (!config.admins) {
        config.admins = [];
    }
    
    // التحقق من عدم وجود المشرف مسبقاً
    const exists = config.admins.some(a => a.phone === phoneNumber);
    if (exists) {
        return false;
    }
    
    config.admins.push({
        phone: phoneNumber,
        permissions,
        addedAt: new Date().toISOString()
    });
    
    return saveConfig(config);
}

/**
 * حذف مشرف
 */
export function removeAdmin(phoneNumber) {
    const config = loadConfig();
    
    if (!config.admins) {
        return false;
    }
    
    const originalLength = config.admins.length;
    config.admins = config.admins.filter(a => a.phone !== phoneNumber);
    
    if (config.admins.length < originalLength) {
        return saveConfig(config);
    }
    
    return false;
}

/**
 * التحقق من صلاحيات المشرف
 */
export function checkAdminPermission(phoneNumber, permission) {
    const config = loadConfig();
    
    if (!config.admins) {
        return false;
    }
    
    const admin = config.admins.find(a => a.phone === phoneNumber);
    if (!admin) {
        return false;
    }
    
    return admin.permissions.includes(permission) || admin.permissions.includes('all');
}

/**
 * الحصول على قائمة المشرفين
 */
export function getAdmins() {
    const config = loadConfig();
    return config.admins || [];
}

/**
 * تحديث صلاحيات مشرف
 */
export function updateAdminPermissions(phoneNumber, permissions) {
    const config = loadConfig();
    
    if (!config.admins) {
        return false;
    }
    
    const admin = config.admins.find(a => a.phone === phoneNumber);
    if (!admin) {
        return false;
    }
    
    admin.permissions = permissions;
    return saveConfig(config);
}
