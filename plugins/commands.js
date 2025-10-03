/**
 * نظام معالجة الأوامر
 * Command Handler System for Elite Users
 */

import {
    isEliteUser,
    addEliteUser,
    removeEliteUser,
    addBridge,
    removeBridge,
    setBotStatus,
    isBotActive,
    pauseGroup,
    resumeGroup,
    isGroupPaused,
    loadConfig,
    setFilterStatus,
    addToBlacklist,
    removeFromBlacklist,
    getTelegramChannel
} from '../utils/config.js';

import {
    addSmartAlert,
    removeSmartAlert,
    setSmartAlertsStatus,
    getSmartAlerts,
    addSchedule,
    removeSchedule,
    getSchedules,
    addAdmin,
    removeAdmin,
    getAdmins,
    checkAdminPermission
} from './alerts.js';

import {
    addPrivateChatResponse,
    removePrivateChatResponse,
    listPrivateChatResponses,
    setPrivateChatStatus
} from './privateChat.js';

import {
    generateDailyReport,
    generateWeeklyReport,
    generateErrorReport,
    generateFailedTransfersReport,
    generateUserActivityReport
} from './reports.js';

import { readLastLines, cleanOldLogs, logCommand } from '../utils/logger.js';

const COMMAND_PREFIX = '.';

/**
 * التحقق من أن الرسالة أمر
 */
export function isCommand(text) {
    return text && text.trim().startsWith(COMMAND_PREFIX);
}

/**
 * استخراج الأمر والمعاملات
 */
function parseCommand(text) {
    const parts = text.trim().split(/\s+/);
    const command = parts[0].substring(1); // إزالة النقطة
    const args = parts.slice(1);
    return { command, args };
}

/**
 * معالج الأوامر الرئيسي
 */
export async function handleCommand(msg, sock, telegramBot) {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!isCommand(text)) return null;

    // استخراج معلومات المرسل
    const senderJid = msg.key.remoteJid;
    const senderPhone = msg.key.participant?.split('@')[0] || msg.key.remoteJid?.split('@')[0];
    
    console.log(`\n🔧 أمر مستلم: "${text}"`);
    console.log(`📱 من: ${senderPhone}`);
    
    // التحقق من صلاحيات النخبة
    if (!isEliteUser(senderPhone)) {
        console.log(`⛔ المستخدم ${senderPhone} ليس من النخبة`);
        const config = loadConfig();
        console.log(`📋 قائمة النخبة الحالية: ${config.eliteUsers.length > 0 ? config.eliteUsers.join(', ') : 'فارغة!'}`);
        console.log(`💡 نصيحة: أضف رقمك إلى OWNER_PHONE في ملف .env أو استخدم .اضافة_نخبة من مستخدم نخبة آخر`);
        return {
            handled: true,
            response: '⛔ عذراً، هذا الأمر متاح فقط لمستخدمي النخبة\n\n💡 للحصول على صلاحيات:\n1. أضف رقمك في ملف .env (OWNER_PHONE)\n2. اطلب من مستخدم نخبة آخر إضافتك'
        };
    }

    console.log(`✅ المستخدم ${senderPhone} من النخبة - معالجة الأمر...`);
    const { command, args } = parseCommand(text);
    console.log(`📝 الأمر: ${command}، المعاملات: ${args.join(' ')}`);
    
    try {
        switch (command) {
            case 'تست':
            case 'test':
                return await handleTestCommand(sock, senderJid);
            
            case 'ايقاف':
            case 'stop':
                return await handleStopCommand();
            
            case 'تشغيل':
            case 'start':
                return await handleStartCommand();
            
            case 'الحالة':
            case 'status':
                return await handleStatusCommand();
            
            case 'اضافة_قناة':
            case 'add_channel':
                return await handleAddChannelCommand(args, sock);
            
            case 'حذف_قناة':
            case 'remove_channel':
                return await handleRemoveChannelCommand(args);
            
            case 'القنوات':
            case 'channels':
                return await handleListChannelsCommand();
            
            case 'اضافة_نخبة':
            case 'add_elite':
                return await handleAddEliteCommand(args);
            
            case 'حذف_نخبة':
            case 'remove_elite':
                return await handleRemoveEliteCommand(args);
            
            case 'النخبة':
            case 'elites':
                return await handleListElitesCommand();
            
            case 'ايقاف_مؤقت':
            case 'pause':
                return await handlePauseCommand(senderJid);
            
            case 'استئناف':
            case 'resume':
                return await handleResumeCommand(senderJid);
            
            case 'حظر':
            case 'block':
                return await handleBlockCommand(args);
            
            case 'الغاء_حظر':
            case 'unblock':
                return await handleUnblockCommand(args);
            
            case 'تفعيل_فلتر':
            case 'enable_filter':
                return await handleEnableFilterCommand();
            
            case 'تعطيل_فلتر':
            case 'disable_filter':
                return await handleDisableFilterCommand();
            
            case 'المساعدة':
            case 'help':
                return await handleHelpCommand();
            
            // أوامر التنبيهات الذكية
            case 'اضافة_تنبيه':
            case 'add_alert':
                return await handleAddAlertCommand(args);
            
            case 'حذف_تنبيه':
            case 'remove_alert':
                return await handleRemoveAlertCommand(args);
            
            case 'التنبيهات':
            case 'alerts':
                return await handleListAlertsCommand();
            
            case 'تفعيل_تنبيهات':
            case 'enable_alerts':
                return await handleEnableAlertsCommand();
            
            case 'تعطيل_تنبيهات':
            case 'disable_alerts':
                return await handleDisableAlertsCommand();
            
            // أوامر الردود الآلية للمحادثات الخاصة
            case 'اضافة_رد':
            case 'add_response':
                return await handleAddPrivateResponseCommand(args);
            
            case 'حذف_رد':
            case 'remove_response':
                return await handleRemovePrivateResponseCommand(args);
            
            case 'الردود':
            case 'responses':
                return await handleListPrivateResponsesCommand();
            
            case 'تفعيل_ردود':
            case 'enable_responses':
                return await handleEnablePrivateResponsesCommand();
            
            case 'تعطيل_ردود':
            case 'disable_responses':
                return await handleDisablePrivateResponsesCommand();
            
            // أوامر الجدولة
            case 'اضافة_جدول':
            case 'add_schedule':
                return await handleAddScheduleCommand(args);
            
            case 'حذف_جدول':
            case 'remove_schedule':
                return await handleRemoveScheduleCommand(args);
            
            case 'الجداول':
            case 'schedules':
                return await handleListSchedulesCommand();
            
            // أوامر التقارير
            case 'تقرير_يومي':
            case 'daily_report':
                return await handleDailyReportCommand();
            
            case 'تقرير_اسبوعي':
            case 'weekly_report':
                return await handleWeeklyReportCommand();
            
            case 'تقرير_اخطاء':
            case 'error_report':
                return await handleErrorReportCommand();
            
            case 'تقرير_فاشل':
            case 'failed_report':
                return await handleFailedReportCommand();
            
            case 'تقرير_نشاط':
            case 'activity_report':
                return await handleActivityReportCommand();
            
            // أوامر اللوجات
            case 'لوج':
            case 'logs':
                return await handleLogsCommand(args);
            
            case 'نظافة_لوجات':
            case 'clean_logs':
                return await handleCleanLogsCommand();
            
            // أوامر المشرفين
            case 'اضافة_مشرف':
            case 'add_admin':
                return await handleAddAdminCommand(args);
            
            case 'حذف_مشرف':
            case 'remove_admin':
                return await handleRemoveAdminCommand(args);
            
            case 'المشرفين':
            case 'admins':
                return await handleListAdminsCommand();
            
            default:
                return {
                    handled: true,
                    response: `❓ أمر غير معروف: ${command}\nاستخدم .المساعدة لعرض الأوامر المتاحة`
                };
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة الأمر:', error);
        logCommand(senderPhone, command, args, false);
        return {
            handled: true,
            response: `❌ حدث خطأ أثناء تنفيذ الأمر: ${error.message}`
        };
    }
}

/**
 * أمر الاختبار
 */
async function handleTestCommand(sock, senderJid) {
    const config = loadConfig();
    const status = isBotActive() ? '🟢 نشط' : '🔴 متوقف';
    const bridgesCount = config.bridges.length;
    const elitesCount = config.eliteUsers.length;
    
    return {
        handled: true,
        response: `✅ البوت يعمل بشكل صحيح!\n\n` +
                  `📊 الإحصائيات:\n` +
                  `• الحالة: ${status}\n` +
                  `• عدد الجسور: ${bridgesCount}\n` +
                  `• عدد النخبة: ${elitesCount}\n` +
                  `• الوقت: ${new Date().toLocaleString('ar-EG')}`
    };
}

/**
 * أمر إيقاف البوت
 */
async function handleStopCommand() {
    setBotStatus(false);
    return {
        handled: true,
        response: '🛑 تم إيقاف البوت مؤقتاً\nلن يتم نقل أي رسائل حتى إعادة التشغيل'
    };
}

/**
 * أمر تشغيل البوت
 */
async function handleStartCommand() {
    setBotStatus(true);
    return {
        handled: true,
        response: '✅ تم تشغيل البوت\nسيتم نقل الرسائل بشكل طبيعي'
    };
}

/**
 * أمر عرض الحالة
 */
async function handleStatusCommand() {
    const config = loadConfig();
    const status = config.botStatus.active ? '🟢 نشط' : '🔴 متوقف';
    const pausedCount = config.botStatus.pausedGroups.length;
    
    let response = `📊 حالة البوت:\n\n`;
    response += `• الحالة العامة: ${status}\n`;
    response += `• عدد الجسور: ${config.bridges.length}\n`;
    response += `• الجسور النشطة: ${config.bridges.filter(b => b.enabled).length}\n`;
    response += `• الجروبات المتوقفة: ${pausedCount}\n`;
    response += `• مستخدمي النخبة: ${config.eliteUsers.length}\n`;
    response += `• الفلاتر: ${config.filters.enabled ? '🟢 مفعلة' : '🔴 معطلة'}`;
    
    return {
        handled: true,
        response
    };
}

/**
 * أمر إضافة قناة
 */
async function handleAddChannelCommand(args, sock) {
    if (args.length < 2) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.اضافة_قناة <JID_الجروب> <معرف_القناة>\n\nمثال:\n.اضافة_قناة 120363123@g.us @mychannel'
        };
    }
    
    const whatsappJid = args[0];
    const telegramChannel = args[1];
    
    const success = addBridge(whatsappJid, telegramChannel);
    if (success) {
        return {
            handled: true,
            response: `✅ تم إضافة الجسر بنجاح!\n\n` +
                      `📱 WhatsApp: ${whatsappJid}\n` +
                      `📢 Telegram: ${telegramChannel}\n\n` +
                      `سيتم نقل رسائل هذا الجروب إلى القناة المحددة`
        };
    } else {
        return {
            handled: true,
            response: '❌ الجسر موجود بالفعل أو حدث خطأ'
        };
    }
}

/**
 * أمر حذف قناة
 */
async function handleRemoveChannelCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.حذف_قناة <JID_الجروب>\n\nمثال:\n.حذف_قناة 120363123@g.us'
        };
    }
    
    const whatsappJid = args[0];
    const success = removeBridge(whatsappJid);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم حذف الجسر بنجاح!\n\n📱 WhatsApp: ${whatsappJid}`
        };
    } else {
        return {
            handled: true,
            response: '❌ الجسر غير موجود'
        };
    }
}

/**
 * أمر عرض القنوات
 */
async function handleListChannelsCommand() {
    const config = loadConfig();
    
    if (config.bridges.length === 0) {
        return {
            handled: true,
            response: '📋 لا توجد جسور مفعلة حالياً\n\nاستخدم .اضافة_قناة لإضافة جسر جديد'
        };
    }
    
    let response = '📋 الجسور المفعلة:\n\n';
    config.bridges.forEach((bridge, index) => {
        const status = bridge.enabled ? '🟢' : '🔴';
        response += `${index + 1}. ${status}\n`;
        response += `   📱 WhatsApp: ${bridge.whatsapp}\n`;
        response += `   📢 Telegram: ${bridge.telegram}\n\n`;
    });
    
    return {
        handled: true,
        response
    };
}

/**
 * أمر إضافة مستخدم للنخبة
 */
async function handleAddEliteCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.اضافة_نخبة <رقم_الهاتف>\n\nمثال:\n.اضافة_نخبة 201234567890'
        };
    }
    
    const phoneNumber = args[0].replace(/\D/g, ''); // إزالة أي شيء غير الأرقام
    const success = addEliteUser(phoneNumber);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم إضافة المستخدم للنخبة بنجاح!\n\n📱 الرقم: ${phoneNumber}`
        };
    } else {
        return {
            handled: true,
            response: '❌ المستخدم موجود بالفعل في النخبة'
        };
    }
}

/**
 * أمر حذف مستخدم من النخبة
 */
async function handleRemoveEliteCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.حذف_نخبة <رقم_الهاتف>\n\nمثال:\n.حذف_نخبة 201234567890'
        };
    }
    
    const phoneNumber = args[0].replace(/\D/g, '');
    const success = removeEliteUser(phoneNumber);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم حذف المستخدم من النخبة بنجاح!\n\n📱 الرقم: ${phoneNumber}`
        };
    } else {
        return {
            handled: true,
            response: '❌ المستخدم غير موجود في النخبة'
        };
    }
}

/**
 * أمر عرض النخبة
 */
async function handleListElitesCommand() {
    const config = loadConfig();
    
    if (config.eliteUsers.length === 0) {
        return {
            handled: true,
            response: '📋 لا يوجد مستخدمين نخبة حالياً\n\nاستخدم .اضافة_نخبة لإضافة مستخدم'
        };
    }
    
    let response = '📋 مستخدمو النخبة:\n\n';
    config.eliteUsers.forEach((phone, index) => {
        response += `${index + 1}. 📱 ${phone}\n`;
    });
    
    return {
        handled: true,
        response
    };
}

/**
 * أمر إيقاف الجروب مؤقتاً
 */
async function handlePauseCommand(groupJid) {
    const success = pauseGroup(groupJid);
    
    if (success) {
        return {
            handled: true,
            response: '⏸️ تم إيقاف هذا الجروب مؤقتاً\nلن يتم نقل رسائله حتى الاستئناف'
        };
    } else {
        return {
            handled: true,
            response: '❌ الجروب متوقف بالفعل'
        };
    }
}

/**
 * أمر استئناف الجروب
 */
async function handleResumeCommand(groupJid) {
    const success = resumeGroup(groupJid);
    
    if (success) {
        return {
            handled: true,
            response: '▶️ تم استئناف نقل رسائل هذا الجروب'
        };
    } else {
        return {
            handled: true,
            response: '❌ الجروب ليس متوقفاً'
        };
    }
}

/**
 * أمر حظر مستخدم
 */
async function handleBlockCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.حظر <رقم_الهاتف>\n\nمثال:\n.حظر 201234567890'
        };
    }
    
    const phoneNumber = args[0].replace(/\D/g, '');
    const success = addToBlacklist(phoneNumber);
    
    if (success) {
        return {
            handled: true,
            response: `🚫 تم حظر المستخدم بنجاح!\n\nلن يتم نقل رسائله\n📱 الرقم: ${phoneNumber}`
        };
    } else {
        return {
            handled: true,
            response: '❌ المستخدم محظور بالفعل'
        };
    }
}

/**
 * أمر إلغاء حظر مستخدم
 */
async function handleUnblockCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.الغاء_حظر <رقم_الهاتف>\n\nمثال:\n.الغاء_حظر 201234567890'
        };
    }
    
    const phoneNumber = args[0].replace(/\D/g, '');
    const success = removeFromBlacklist(phoneNumber);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم إلغاء حظر المستخدم بنجاح!\n\n📱 الرقم: ${phoneNumber}`
        };
    } else {
        return {
            handled: true,
            response: '❌ المستخدم غير محظور'
        };
    }
}

/**
 * أمر تفعيل الفلاتر
 */
async function handleEnableFilterCommand() {
    setFilterStatus(true);
    return {
        handled: true,
        response: '✅ تم تفعيل نظام الفلاتر\n\nسيتم تطبيق القوائم السوداء والفلاتر المحددة'
    };
}

/**
 * أمر تعطيل الفلاتر
 */
async function handleDisableFilterCommand() {
    setFilterStatus(false);
    return {
        handled: true,
        response: '🔓 تم تعطيل نظام الفلاتر\n\nسيتم نقل جميع الرسائل بدون فلترة'
    };
}

/**
 * أمر المساعدة
 */
async function handleHelpCommand() {
    return {
        handled: true,
        response: `📚 *دليل الأوامر المتاحة* 📚\n\n` +
                  `*🔧 إدارة البوت العامة:*\n` +
                  `• *.تست* - فحص حالة البوت وعرض إحصائيات سريعة.\n` +
                  `• *.ايقاف* - إيقاف البوت عن العمل بشكل كامل.\n` +
                  `• *.تشغيل* - إعادة تشغيل البوت بعد إيقافه.\n` +
                  `• *.الحالة* - عرض تقرير مفصل عن حالة البوت والجسور.\n` +
                  `• *.ايقاف_مؤقت* - إيقاف نقل الرسائل من المجموعة الحالية فقط.\n` +
                  `• *.استئناف* - استئناف نقل الرسائل من المجموعة الحالية.\n\n` +
                  `*📢 إدارة الجسور (القنوات):*\n` +
                  `• *.اضافة_قناة* <ID المجموعة> <ID القناة> - لربط مجموعة واتساب بقناة تليجرام.\n` +
                  `• *.حذف_قناة* <ID المجموعة> - لحذف ربط معين.\n` +
                  `• *.القنوات* - عرض جميع الجسور (الروابط) الحالية بين واتساب وتليجرام.\n\n` +
                  `*👑 إدارة مستخدمي النخبة (Admins):*\n` +
                  `• *.اضافة_نخبة* <رقم الهاتف> - إضافة مستخدم ليتمكن من استخدام أوامر البوت.\n` +
                  `• *.حذف_نخبة* <رقم الهاتف> - إزالة مستخدم من قائمة النخبة.\n` +
                  `• *.النخبة* - عرض قائمة بجميع مستخدمي النخبة.\n\n` +
                  `*🔍 إدارة الفلاتر والحظر:*\n` +
                  `• *.حظر* <رقم الهاتف> - حظر مستخدم من نقل رسائله.\n` +
                  `• *.الغاء_حظر* <رقم الهاتف> - إزالة الحظر عن مستخدم.\n` +
                  `• *.تفعيل_فلتر* - تفعيل نظام الفلترة والقائمة السوداء.\n` +
                  `• *.تعطيل_فلتر* - تعطيل نظام الفلترة، والسماح لجميع الرسائل بالمرور.\n\n` +
                  `*🔔 التنبيهات الذكية:*\n` +
                  `• *.اضافة_تنبيه* <كلمة> - إضافة كلمة لتنبيهك عند ذكرها.\n` +
                  `• *.حذف_تنبيه* <كلمة> - حذف كلمة من قائمة التنبيهات.\n` +
                  `• *.التنبيهات* - عرض جميع كلمات التنبيه الحالية.\n` +
                  `• *.تفعيل_تنبيهات* - تفعيل نظام التنبيهات الذكية.\n` +
                  `• *.تعطيل_تنبيهات* - تعطيل نظام التنبيهات الذكية.\n\n` +
                  `*💬 الردود الآلية (محادثات خاصة):*\n` +
                  `• *.اضافة_رد* <نوع> <كلمات> | <محتوى> - إضافة رد آلي للمحادثات الخاصة.\n` +
                  `• *.حذف_رد* <كلمة> - حذف رد آلي.\n` +
                  `• *.الردود* - عرض جميع الردود الآلية.\n` +
                  `• *.تفعيل_ردود* - تفعيل الردود الآلية.\n` +
                  `• *.تعطيل_ردود* - تعطيل الردود الآلية.\n\n` +
                  `*⏰ المهام المجدولة:*\n` +
                  `• *.اضافة_جدول* - إضافة مهمة مجدولة (مثل تقرير يومي).\n` +
                  `• *.حذف_جدول* - حذف مهمة مجدولة.\n` +
                  `• *.الجداول* - عرض جميع المهام المجدولة.\n\n` +
                  `*📊 التقارير:*\n` +
                  `• *.تقرير_يومي* - إنشاء تقرير عن نشاط البوت اليومي.\n` +
                  `• *.تقرير_اسبوعي* - إنشاء تقرير عن نشاط البوت الأسبوعي.\n` +
                  `• *.تقرير_اخطاء* - عرض آخر الأخطاء التي حدثت.\n` +
                  `• *.تقرير_فاشل* - عرض تقرير بالرسائل التي فشل نقلها.\n` +
                  `• *.تقرير_نشاط* - تقرير عن نشاط المستخدمين.\n\n` +
                  `*📝 السجلات (Logs):*\n` +
                  `• *.لوج* <نوع> - عرض آخر أسطر من سجلات معينة.\n` +
                  `• *.نظافة_لوجات* - حذف ملفات السجلات القديمة لتوفير مساحة.\n\n` +
                  `*👔 إدارة المشرفين:*\n` +
                  `• *.اضافة_مشرف* <رقم> - إضافة مشرف بصلاحيات محددة.\n` +
                  `• *.حذف_مشرف* <رقم> - إزالة مشرف.\n` +
                  `• *.المشرفين* - عرض قائمة المشرفين وصلاحياتهم.\n\n` +
                  `*❓ المساعدة:*\n` +
                  `• *.المساعدة* - لعرض هذه الرسالة.`
    };
}

// ==================== أوامر التنبيهات الذكية ====================

async function handleAddAlertCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.اضافة_تنبيه <كلمة_التنبيه>\n\nمثال:\n.اضافة_تنبيه عاجل'
        };
    }
    
    const keyword = args.join(' ');
    const success = addSmartAlert(keyword);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم إضافة التنبيه الذكي بنجاح!\n\n🔔 الكلمة: "${keyword}"\n\nسيتم تنبيهك عند ذكر هذه الكلمة في الرسائل`
        };
    } else {
        return {
            handled: true,
            response: '❌ التنبيه موجود بالفعل'
        };
    }
}

async function handleRemoveAlertCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.حذف_تنبيه <كلمة_التنبيه>\n\nمثال:\n.حذف_تنبيه عاجل'
        };
    }
    
    const keyword = args.join(' ');
    const success = removeSmartAlert(keyword);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم حذف التنبيه بنجاح!\n\n🔔 الكلمة: "${keyword}"`
        };
    } else {
        return {
            handled: true,
            response: '❌ التنبيه غير موجود'
        };
    }
}

async function handleListAlertsCommand() {
    const alerts = getSmartAlerts();
    
    if (!alerts.keywords || alerts.keywords.length === 0) {
        return {
            handled: true,
            response: '📋 لا توجد تنبيهات ذكية حالياً\n\nاستخدم .اضافة_تنبيه لإضافة تنبيه'
        };
    }
    
    let response = '📋 التنبيهات الذكية:\n\n';
    const status = alerts.enabled ? '🟢 مفعلة' : '🔴 معطلة';
    response += `الحالة: ${status}\n\n`;
    
    alerts.keywords.forEach((alert, index) => {
        response += `${index + 1}. 🔔 "${alert.keyword}"\n`;
    });
    
    return {
        handled: true,
        response
    };
}

async function handleEnableAlertsCommand() {
    setSmartAlertsStatus(true);
    return {
        handled: true,
        response: '✅ تم تفعيل التنبيهات الذكية\n\nسيتم إرسال تنبيهات عند ذكر الكلمات المحددة'
    };
}

async function handleDisableAlertsCommand() {
    setSmartAlertsStatus(false);
    return {
        handled: true,
        response: '🔓 تم تعطيل التنبيهات الذكية\n\nلن يتم إرسال تنبيهات'
    };
}

// ==================== أوامر الردود الآلية للمحادثات الخاصة ====================

async function handleAddPrivateResponseCommand(args) {
    if (args.length < 3) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n' +
                      '.اضافة_رد <نوع> <كلمات_مفتاحية> | <محتوى>\n\n' +
                      'أنواع الردود:\n' +
                      '• نص - رد نصي فقط\n' +
                      '• صورة - رد بصورة\n' +
                      '• ملف - رد بملف PDF\n' +
                      '• كامل - رد بنص وملف\n\n' +
                      'مثال:\n' +
                      '.اضافة_رد نص ملخص محاسبة,ملخص المحاسبة | هذا هو ملخص مادة المحاسبة'
        };
    }
    
    const responseType = args[0];
    const restArgs = args.slice(1).join(' ');
    
    // التحقق من نوع الرد
    const validTypes = {
        'نص': 'text',
        'صورة': 'image',
        'ملف': 'document',
        'كامل': 'both',
        'text': 'text',
        'image': 'image',
        'document': 'document',
        'both': 'both'
    };
    
    if (!validTypes[responseType]) {
        return {
            handled: true,
            response: '❌ نوع غير صحيح. الأنواع المتاحة: نص، صورة، ملف، كامل'
        };
    }
    
    // تقسيم الكلمات المفتاحية والمحتوى
    const parts = restArgs.split('|').map(p => p.trim());
    if (parts.length < 2) {
        return {
            handled: true,
            response: '❌ يجب فصل الكلمات المفتاحية عن المحتوى بـ |'
        };
    }
    
    const keywords = parts[0].split(',').map(k => k.trim());
    const content = parts[1];
    
    const type = validTypes[responseType];
    
    // تحديد المحتوى حسب النوع
    let text = null;
    let filePath = null;
    
    if (type === 'text') {
        text = content;
    } else if (type === 'image' || type === 'document') {
        filePath = content;
    } else if (type === 'both') {
        // في حالة both، نتوقع نص ثم | ثم مسار الملف
        const bothParts = content.split('|').map(p => p.trim());
        if (bothParts.length >= 2) {
            text = bothParts[0];
            filePath = bothParts[1];
        } else {
            return {
                handled: true,
                response: '❌ للنوع "كامل"، يجب فصل النص عن مسار الملف بـ |\n\nمثال:\n.اضافة_رد كامل كلمة | النص | /path/to/file.pdf'
            };
        }
    }
    
    const success = addPrivateChatResponse(keywords, type, text, filePath);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم إضافة الرد الآلي بنجاح!\n\n🔑 الكلمات المفتاحية: ${keywords.join(', ')}\n📝 النوع: ${responseType}`
        };
    } else {
        return {
            handled: true,
            response: '❌ فشل إضافة الرد الآلي'
        };
    }
}

async function handleRemovePrivateResponseCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.حذف_رد <كلمة_مفتاحية>\n\nمثال:\n.حذف_رد ملخص محاسبة'
        };
    }
    
    const keyword = args.join(' ');
    const success = removePrivateChatResponse(keyword);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم حذف الرد الآلي الخاص بـ "${keyword}"`
        };
    } else {
        return {
            handled: true,
            response: '❌ لم يتم العثور على رد آلي بهذه الكلمة المفتاحية'
        };
    }
}

async function handleListPrivateResponsesCommand() {
    const responses = listPrivateChatResponses();
    
    if (responses.length === 0) {
        return {
            handled: true,
            response: '📋 لا يوجد ردود آلية مضافة حالياً\n\nاستخدم .اضافة_رد لإضافة رد جديد'
        };
    }
    
    let message = '📋 الردود الآلية للمحادثات الخاصة:\n\n';
    
    responses.forEach((resp, index) => {
        const keywords = Array.isArray(resp.keywords) ? resp.keywords : [resp.keywords];
        message += `${index + 1}. 🔑 ${keywords.join(', ')}\n`;
        message += `   📝 النوع: ${resp.responseType}\n`;
        if (resp.text) {
            message += `   💬 النص: ${resp.text.substring(0, 50)}${resp.text.length > 50 ? '...' : ''}\n`;
        }
        if (resp.filePath) {
            message += `   📁 الملف: ${resp.filePath}\n`;
        }
        message += '\n';
    });
    
    return {
        handled: true,
        response: message
    };
}

async function handleEnablePrivateResponsesCommand() {
    setPrivateChatStatus(true);
    return {
        handled: true,
        response: '✅ تم تفعيل الردود الآلية للمحادثات الخاصة\n\nسيتم الرد على الرسائل التي تحتوي على الكلمات المفتاحية'
    };
}

async function handleDisablePrivateResponsesCommand() {
    setPrivateChatStatus(false);
    return {
        handled: true,
        response: '🔓 تم تعطيل الردود الآلية للمحادثات الخاصة\n\nلن يتم الرد على الرسائل الخاصة'
    };
}

// ==================== أوامر الجدولة ====================

async function handleAddScheduleCommand(args) {
    if (args.length < 3) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.اضافة_جدول <اسم> <وقت HH:MM> <إجراء>\n\nمثال:\n.اضافة_جدول تقرير_صباحي 08:00 report'
        };
    }
    
    const name = args[0];
    const time = args[1];
    const action = args[2];
    
    const success = addSchedule(name, 'daily', time, action);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم إضافة الجدول الزمني بنجاح!\n\n📅 الاسم: ${name}\n⏰ الوقت: ${time}\n⚡ الإجراء: ${action}`
        };
    } else {
        return {
            handled: true,
            response: '❌ فشل إضافة الجدول'
        };
    }
}

async function handleRemoveScheduleCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.حذف_جدول <اسم>\n\nمثال:\n.حذف_جدول تقرير_صباحي'
        };
    }
    
    const name = args[0];
    const success = removeSchedule(name);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم حذف الجدول الزمني: ${name}`
        };
    } else {
        return {
            handled: true,
            response: '❌ الجدول غير موجود'
        };
    }
}

async function handleListSchedulesCommand() {
    const schedules = getSchedules();
    
    if (schedules.length === 0) {
        return {
            handled: true,
            response: '📋 لا توجد جداول زمنية\n\nاستخدم .اضافة_جدول لإضافة جدول'
        };
    }
    
    let response = '📋 الجداول الزمنية:\n\n';
    schedules.forEach((schedule, index) => {
        const status = schedule.enabled ? '🟢' : '🔴';
        response += `${index + 1}. ${status} ${schedule.name}\n`;
        response += `   ⏰ ${schedule.time} | ${schedule.action}\n\n`;
    });
    
    return {
        handled: true,
        response
    };
}

// ==================== أوامر التقارير ====================

async function handleDailyReportCommand() {
    const report = generateDailyReport();
    return {
        handled: true,
        response: report
    };
}

async function handleWeeklyReportCommand() {
    const report = generateWeeklyReport();
    return {
        handled: true,
        response: report
    };
}

async function handleErrorReportCommand() {
    const report = generateErrorReport(15);
    return {
        handled: true,
        response: report
    };
}

async function handleFailedReportCommand() {
    const report = generateFailedTransfersReport(15);
    return {
        handled: true,
        response: report
    };
}

async function handleActivityReportCommand() {
    const report = generateUserActivityReport();
    return {
        handled: true,
        response: report
    };
}

// ==================== أوامر اللوجات ====================

async function handleLogsCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.لوج <نوع>\n\nالأنواع المتاحة:\n• errors\n• whatsapp-messages\n• telegram-messages\n• failed-transfers\n• commands'
        };
    }
    
    const logType = args[0];
    const lines = readLastLines(logType, 20);
    
    return {
        handled: true,
        response: `📝 آخر 20 سطر من ${logType}:\n\n${lines}`
    };
}

async function handleCleanLogsCommand() {
    const deletedCount = cleanOldLogs(30);
    return {
        handled: true,
        response: `🧹 تم حذف ${deletedCount} ملف لوج قديم\n\n(أقدم من 30 يوم)`
    };
}

// ==================== أوامر المشرفين ====================

async function handleAddAdminCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.اضافة_مشرف <رقم>\n\nمثال:\n.اضافة_مشرف 201234567890'
        };
    }
    
    const phoneNumber = args[0].replace(/\D/g, '');
    const success = addAdmin(phoneNumber);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم إضافة المشرف بنجاح!\n\n👔 الرقم: ${phoneNumber}`
        };
    } else {
        return {
            handled: true,
            response: '❌ المشرف موجود بالفعل'
        };
    }
}

async function handleRemoveAdminCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.حذف_مشرف <رقم>\n\nمثال:\n.حذف_مشرف 201234567890'
        };
    }
    
    const phoneNumber = args[0].replace(/\D/g, '');
    const success = removeAdmin(phoneNumber);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم حذف المشرف بنجاح!\n\n👔 الرقم: ${phoneNumber}`
        };
    } else {
        return {
            handled: true,
            response: '❌ المشرف غير موجود'
        };
    }
}

async function handleListAdminsCommand() {
    const admins = getAdmins();
    
    if (admins.length === 0) {
        return {
            handled: true,
            response: '📋 لا يوجد مشرفين حالياً\n\nاستخدم .اضافة_مشرف لإضافة مشرف'
        };
    }
    
    let response = '📋 المشرفين:\n\n';
    admins.forEach((admin, index) => {
        response += `${index + 1}. 👔 ${admin.phone}\n`;
        response += `   الصلاحيات: ${admin.permissions.join(', ')}\n\n`;
    });
    
    return {
        handled: true,
        response
    };
}
