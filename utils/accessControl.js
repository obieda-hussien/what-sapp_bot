/**
 * نظام التحكم في الوصول - Access Control System
 * يتيح التحكم في من يمكنه استخدام نظام الردود الآلية والذكاء الاصطناعي بشكل منفصل
 */

import { loadConfig } from './config.js';

/**
 * أوضاع التحكم في الوصول
 * all: الكل يمكنه الوصول
 * whitelist: فقط المستخدمين المسموح لهم
 * blacklist: الكل ما عدا المستخدمين المحظورين
 */
const ACCESS_MODES = {
    ALL: 'all',
    WHITELIST: 'whitelist',
    BLACKLIST: 'blacklist'
};

/**
 * التحقق من إمكانية وصول مستخدم للردود الآلية
 * @param {string} userPhone - رقم هاتف المستخدم (بدون @s.whatsapp.net)
 * @returns {boolean} - true إذا كان المستخدم يمكنه الوصول
 */
export function canUseAutomaticReplies(userPhone) {
    const config = loadConfig();
    
    // إذا لم يكن هناك إعدادات للتحكم في الوصول، نسمح للجميع
    if (!config.accessControl || !config.accessControl.automaticReplies) {
        return true;
    }
    
    const accessConfig = config.accessControl.automaticReplies;
    const mode = accessConfig.mode || ACCESS_MODES.ALL;
    const blockedUsers = accessConfig.blockedUsers || [];
    const allowedUsers = accessConfig.allowedUsers || [];
    
    // تنظيف رقم الهاتف (إزالة @s.whatsapp.net إذا كان موجوداً)
    const cleanPhone = userPhone.split('@')[0];
    
    switch (mode) {
        case ACCESS_MODES.ALL:
            // الكل يمكنه الوصول
            return true;
            
        case ACCESS_MODES.WHITELIST:
            // فقط المستخدمين في القائمة البيضاء
            return allowedUsers.includes(cleanPhone);
            
        case ACCESS_MODES.BLACKLIST:
            // الكل ما عدا المحظورين
            return !blockedUsers.includes(cleanPhone);
            
        default:
            // الافتراضي: السماح للجميع
            return true;
    }
}

/**
 * التحقق من إمكانية وصول مستخدم للذكاء الاصطناعي
 * @param {string} userPhone - رقم هاتف المستخدم (بدون @s.whatsapp.net)
 * @returns {boolean} - true إذا كان المستخدم يمكنه الوصول
 */
export function canUseAI(userPhone) {
    const config = loadConfig();
    
    // إذا لم يكن هناك إعدادات للتحكم في الوصول، نسمح للجميع
    if (!config.accessControl || !config.accessControl.aiResponses) {
        return true;
    }
    
    const accessConfig = config.accessControl.aiResponses;
    const mode = accessConfig.mode || ACCESS_MODES.ALL;
    const blockedUsers = accessConfig.blockedUsers || [];
    const allowedUsers = accessConfig.allowedUsers || [];
    
    // تنظيف رقم الهاتف
    const cleanPhone = userPhone.split('@')[0];
    
    switch (mode) {
        case ACCESS_MODES.ALL:
            // الكل يمكنه الوصول
            return true;
            
        case ACCESS_MODES.WHITELIST:
            // فقط المستخدمين في القائمة البيضاء
            return allowedUsers.includes(cleanPhone);
            
        case ACCESS_MODES.BLACKLIST:
            // الكل ما عدا المحظورين
            return !blockedUsers.includes(cleanPhone);
            
        default:
            // الافتراضي: السماح للجميع
            return true;
    }
}

/**
 * الحصول على رسالة الحظر للردود الآلية
 * @returns {string} - رسالة للمستخدم المحظور
 */
export function getAutomaticReplyBlockMessage() {
    return '⚠️ عذراً، لا يمكنك استخدام نظام الردود الآلية حالياً.';
}

/**
 * الحصول على رسالة الحظر للذكاء الاصطناعي
 * @returns {string} - رسالة للمستخدم المحظور
 */
export function getAIBlockMessage() {
    return '⚠️ عذراً، لا يمكنك استخدام نظام الذكاء الاصطناعي حالياً.';
}

/**
 * الحصول على معلومات التحكم في الوصول
 * @returns {object} - معلومات التحكم في الوصول
 */
export function getAccessControlInfo() {
    const config = loadConfig();
    
    if (!config.accessControl) {
        return {
            automaticReplies: { mode: ACCESS_MODES.ALL, blockedCount: 0, allowedCount: 0 },
            aiResponses: { mode: ACCESS_MODES.ALL, blockedCount: 0, allowedCount: 0 }
        };
    }
    
    const autoReplies = config.accessControl.automaticReplies || {};
    const aiResponses = config.accessControl.aiResponses || {};
    
    return {
        automaticReplies: {
            mode: autoReplies.mode || ACCESS_MODES.ALL,
            blockedCount: (autoReplies.blockedUsers || []).length,
            allowedCount: (autoReplies.allowedUsers || []).length,
            blockedUsers: autoReplies.blockedUsers || [],
            allowedUsers: autoReplies.allowedUsers || []
        },
        aiResponses: {
            mode: aiResponses.mode || ACCESS_MODES.ALL,
            blockedCount: (aiResponses.blockedUsers || []).length,
            allowedCount: (aiResponses.allowedUsers || []).length,
            blockedUsers: aiResponses.blockedUsers || [],
            allowedUsers: aiResponses.allowedUsers || []
        }
    };
}

export { ACCESS_MODES };
