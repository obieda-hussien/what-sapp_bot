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
    
    // التحقق من صلاحيات النخبة
    if (!isEliteUser(senderPhone)) {
        return {
            handled: true,
            response: '⛔ عذراً، هذا الأمر متاح فقط لمستخدمي النخبة'
        };
    }

    const { command, args } = parseCommand(text);
    
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
            
            default:
                return {
                    handled: true,
                    response: `❓ أمر غير معروف: ${command}\nاستخدم .المساعدة لعرض الأوامر المتاحة`
                };
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة الأمر:', error);
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
        response: `📚 دليل الأوامر المتاحة:\n\n` +
                  `🔧 إدارة البوت:\n` +
                  `• .تست - اختبار البوت\n` +
                  `• .ايقاف - إيقاف البوت\n` +
                  `• .تشغيل - تشغيل البوت\n` +
                  `• .الحالة - عرض حالة البوت\n` +
                  `• .ايقاف_مؤقت - إيقاف الجروب الحالي\n` +
                  `• .استئناف - استئناف الجروب الحالي\n\n` +
                  `📢 إدارة القنوات:\n` +
                  `• .اضافة_قناة <جروب> <قناة>\n` +
                  `• .حذف_قناة <جروب>\n` +
                  `• .القنوات - عرض كل الجسور\n\n` +
                  `👥 إدارة النخبة:\n` +
                  `• .اضافة_نخبة <رقم>\n` +
                  `• .حذف_نخبة <رقم>\n` +
                  `• .النخبة - عرض النخبة\n\n` +
                  `🔍 الفلاتر:\n` +
                  `• .حظر <رقم> - حظر مستخدم\n` +
                  `• .الغاء_حظر <رقم>\n` +
                  `• .تفعيل_فلتر\n` +
                  `• .تعطيل_فلتر\n\n` +
                  `• .المساعدة - هذه الرسالة`
    };
}
