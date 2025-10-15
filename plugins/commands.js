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
    addKeywordToFilter,
    removeKeywordFromFilter,
    getFilterKeywords,
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
    setPrivateChatStatus,
    setAIStatus,
    isAIEnabled
} from './privateChat.js';

import {
    generateDailyReport,
    generateWeeklyReport,
    generateErrorReport,
    generateFailedTransfersReport,
    generateUserActivityReport
} from './reports.js';

import { readLastLines, cleanOldLogs, logCommand } from '../utils/logger.js';
import { clearConversationMemory, getMemoryStats, isGroqEnabled, listAllMaterials, getAllFilesFromFolder } from '../utils/groqAssistant.js';
import { 
    canUseAutomaticReplies, 
    canUseAI, 
    getAccessControlInfo,
    ACCESS_MODES 
} from '../utils/accessControl.js';
import { saveConfig } from '../utils/config.js';

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
    const trimmedText = text.trim();
    const firstSpaceIndex = trimmedText.indexOf(' ');
    
    if (firstSpaceIndex === -1) {
        // أمر بدون معاملات
        return { command: trimmedText.substring(1), args: [] };
    }
    
    const command = trimmedText.substring(1, firstSpaceIndex); // إزالة النقطة
    const restOfText = trimmedText.substring(firstSpaceIndex + 1);
    
    // تقسيم المعاملات بناءً على النوع
    // بالنسبة لأمر اضافة_رد، نحتاج للحفاظ على المسافات والأسطر الجديدة
    const args = [restOfText.split(/\s+/)[0]]; // النوع (أول كلمة)
    const remainingText = restOfText.substring(args[0].length).trimStart();
    
    if (remainingText) {
        args.push(remainingText); // باقي النص بدون تعديل
    }
    
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
                return await handleAddEliteCommand(args, sock);
            
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
            
            case 'اضافة_كلمة':
            case 'add_keyword':
                return await handleAddKeywordCommand(args);
            
            case 'حذف_كلمة':
            case 'remove_keyword':
                return await handleRemoveKeywordCommand(args);
            
            case 'الكلمات':
            case 'keywords':
                return await handleListKeywordsCommand();
            
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
            
            case 'تفعيل_ai':
            case 'enable_ai':
                return await handleEnableAICommand();
            
            case 'تعطيل_ai':
            case 'disable_ai':
                return await handleDisableAICommand();
            
            case 'حالة_ai':
            case 'ai_status':
                return await handleAIStatusCommandNew();
            
            // أوامر Groq AI
            case 'مسح_ذاكرة':
            case 'clear_memory':
                return await handleClearMemoryCommand(senderPhone);
            
            case 'احصائيات_ai':
            case 'ai_stats':
                return await handleAIStatsCommand();
            
            case 'حالة_ai':
            case 'ai_status':
                return await handleAIStatusCommand();
            
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
            
            // أوامر التحكم في الوصول
            case 'حظر_ردود':
            case 'block_auto':
                return await handleBlockAutoRepliesCommand(args);
            
            case 'الغاء_حظر_ردود':
            case 'unblock_auto':
                return await handleUnblockAutoRepliesCommand(args);
            
            case 'حظر_ai':
            case 'block_ai':
                return await handleBlockAICommand(args);
            
            case 'الغاء_حظر_ai':
            case 'unblock_ai':
                return await handleUnblockAICommand(args);
            
            case 'وضع_ردود':
            case 'auto_mode':
                return await handleSetAutoModeCommand(args);
            
            case 'وضع_ai':
            case 'ai_mode':
                return await handleSetAIModeCommand(args);
            
            case 'حالة_وصول':
            case 'access_status':
                return await handleAccessStatusCommand();
            
            case 'ملفات':
            case 'files':
                return await handleListFilesCommand(args, sock, senderJid);

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
 * أمر عرض الملفات والمجلدات وإرسالها
 */
async function handleListFilesCommand(args, sock, senderJid) {
    const folderPath = args.join(' ');

    // إذا لم يتم تقديم مسار، نعرض قائمة الملفات
    if (!folderPath) {
        const materialsData = listAllMaterials();

        if (materialsData.total === 0) {
            return {
                handled: true,
                response: '🗂️ لا توجد أي ملفات في مجلد Materials حالياً.'
            };
        }

        let response = `لدي إجمالي ${materialsData.total} ملف:\n\n`;

        Object.keys(materialsData.categories).forEach(category => {
            const files = materialsData.categories[category];
            response += `📁 ${category}: ${files.length} ملف\n`;
            files.forEach((file, index) => {
                response += `   ${index + 1}. ${file.name}\n`;
            });
            response += '\n';
        });

        response += '💡 لإرسال مجلد كامل، استخدم:\n.ملفات <مسار_المجلد>';

        return {
            handled: true,
            response
        };
    }

    // إذا تم تقديم مسار، نحاول إرسال الملفات
    await sock.sendMessage(senderJid, { text: `⏳ جاري تحضير ملفات مجلد "${folderPath}"...` });

    const folderResult = getAllFilesFromFolder(folderPath);

    if (!folderResult.success || folderResult.files.length === 0) {
        return {
            handled: true,
            response: `❌ لم أتمكن من العثور على المجلد "${folderPath}" أو أنه فارغ.`
        };
    }

    await sock.sendMessage(senderJid, { text: `✅ تم العثور على ${folderResult.count} ملف. سأقوم بإرسالها الآن...` });

    for (const file of folderResult.files) {
        try {
            if (file.fileType === 'image') {
                await sock.sendMessage(senderJid, {
                    image: { url: file.filePath },
                    caption: file.caption || ''
                });
            } else {
                await sock.sendMessage(senderJid, {
                    document: { url: file.filePath },
                    mimetype: 'application/octet-stream',
                    fileName: file.fileName,
                    caption: file.caption || ''
                });
            }
            // تأخير بسيط بين الرسائل
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`❌ فشل إرسال الملف: ${file.fileName}`, error);
            await sock.sendMessage(senderJid, { text: `⚠️ فشل إرسال الملف: ${file.fileName}` });
        }
    }

    return {
        handled: true,
        response: `✅ تم إرسال جميع ملفات مجلد "${folderPath}" بنجاح!`
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
 * البحث عن LID للمستخدم من الجروبات - مع حماية قوية ضد الأخطاء
 */
async function findUserLID(sock, phoneNumber) {
    // التحقق من صحة الاتصال قبل البدء
    if (!sock || !sock.user) {
        console.log('⚠️ الاتصال غير متاح - تخطي البحث عن LID');
        return null;
    }
    
    const maxRetries = 3;
    let retryCount = 0;
    const baseDelay = 1000; // 1 ثانية
    
    while (retryCount < maxRetries) {
        try {
            console.log(`🔎 البحث عن LID للمستخدم ${phoneNumber}... (محاولة ${retryCount + 1}/${maxRetries})`);
            
            // إضافة timeout للعملية لمنع التعليق إلى الأبد
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 15000); // 15 ثانية timeout
            });
            
            const fetchPromise = sock.groupFetchAllParticipating();
            
            // استخدام Promise.race للتأكد من عدم التعليق
            const groups = await Promise.race([fetchPromise, timeoutPromise]);
            
            // البحث عن المستخدم في أعضاء الجروبات
            for (const groupId in groups) {
                const group = groups[groupId];
                
                // التحقق من وجود المشاركين
                if (!group.participants || !Array.isArray(group.participants)) {
                    continue;
                }
                
                for (const participant of group.participants) {
                    const participantId = participant.id;
                    
                    // فحص إذا كان رقم الهاتف يطابق
                    if (participantId && participantId.startsWith(phoneNumber)) {
                        // استخراج LID إذا كان موجوداً
                        if (participantId.includes(':') && participantId.includes('@lid')) {
                            console.log(`✅ تم العثور على LID للمستخدم ${phoneNumber}: ${participantId}`);
                            return participantId;
                        }
                    }
                }
            }
            
            console.log(`ℹ️  لم يتم العثور على LID للمستخدم ${phoneNumber}`);
            return null;
            
        } catch (error) {
            retryCount++;
            console.error(`⚠️ خطأ في البحث عن LID (محاولة ${retryCount}/${maxRetries}):`, error.message);
            
            // إذا كان الخطأ متعلق بالاتصال ولدينا محاولات متبقية
            if (retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount - 1); // exponential backoff
                console.log(`⏳ إعادة المحاولة بعد ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('❌ فشل البحث عن LID بعد كل المحاولات');
                return null;
            }
        }
    }
    
    return null;
}

/**
 * أمر إضافة مستخدم للنخبة
 */
async function handleAddEliteCommand(args, sock) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.اضافة_نخبة <رقم_الهاتف> [LID]\n\nأمثلة:\n.اضافة_نخبة 201234567890\n.اضافة_نخبة 201234567890 225060749086880:22@lid\n.اضافة_نخبة 225060749086880:22@lid'
        };
    }
    
    const addedItems = [];
    let phoneAdded = false;
    let lidAdded = false;
    let phoneNumber = null;
    
    // معالجة جميع المعاملات (يمكن أن يكون رقم، LID، أو كلاهما)
    for (let i = 0; i < args.length; i++) {
        const identifier = args[i].trim();
        
        // إذا كان LID (يحتوي على : و @lid)
        const isLid = identifier.includes(':') && identifier.includes('@lid');
        
        if (isLid) {
            // إضافة LID
            const success = addEliteUser(identifier);
            if (success) {
                addedItems.push(`LID: ${identifier}`);
                lidAdded = true;
            }
        } else {
            // رقم الهاتف - نزيل أي شيء غير الأرقام
            const cleanPhone = identifier.replace(/\D/g, '');
            if (cleanPhone) {
                phoneNumber = cleanPhone; // حفظ رقم الهاتف للبحث عن LID
                const success = addEliteUser(cleanPhone);
                if (success) {
                    addedItems.push(`رقم الهاتف: ${cleanPhone}`);
                    phoneAdded = true;
                }
            }
        }
    }
    
    // إذا تم إضافة رقم هاتف فقط ولم يتم إضافة LID، نحاول جلب LID تلقائياً
    let lidLookupNote = '';
    if (phoneAdded && !lidAdded && phoneNumber && sock) {
        try {
            const userLID = await findUserLID(sock, phoneNumber);
            
            if (userLID) {
                // إضافة LID تلقائياً
                const success = addEliteUser(userLID);
                if (success) {
                    addedItems.push(`LID: ${userLID} (تم جلبه تلقائياً ✨)`);
                    lidAdded = true;
                }
            } else {
                lidLookupNote = '\n\n💡 ملاحظة: لم يتم العثور على LID للمستخدم. إذا كان المستخدم يستخدم LID، يمكنك إضافته يدوياً:\n.اضافة_نخبة ' + phoneNumber + ' <LID>';
            }
        } catch (error) {
            console.error('⚠️ خطأ أثناء البحث عن LID:', error.message);
            lidLookupNote = '\n\n⚠️ تحذير: حدث خطأ أثناء البحث عن LID. تم إضافة رقم الهاتف فقط.\nإذا كان المستخدم يستخدم LID، يمكنك إضافته يدوياً لاحقاً:\n.اضافة_نخبة ' + phoneNumber + ' <LID>';
        }
    }
    
    if (addedItems.length > 0) {
        return {
            handled: true,
            response: `✅ تم إضافة المستخدم للنخبة بنجاح!\n\n📱 تم إضافة:\n${addedItems.map(item => `   • ${item}`).join('\n')}${lidLookupNote}`
        };
    } else {
        return {
            handled: true,
            response: '❌ المستخدم موجود بالفعل في النخبة أو لم يتم تقديم معرفات صحيحة'
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
            response: '❌ الاستخدام الصحيح:\n.حذف_نخبة <رقم_الهاتف> [LID]\n\nأمثلة:\n.حذف_نخبة 201234567890\n.حذف_نخبة 201234567890 225060749086880:22@lid\n.حذف_نخبة 225060749086880:22@lid'
        };
    }
    
    const removedItems = [];
    let phoneRemoved = false;
    let lidRemoved = false;
    
    // معالجة جميع المعاملات (يمكن أن يكون رقم، LID، أو كلاهما)
    for (let i = 0; i < args.length; i++) {
        const identifier = args[i].trim();
        
        // إذا كان LID (يحتوي على : و @lid)
        const isLid = identifier.includes(':') && identifier.includes('@lid');
        
        if (isLid) {
            // حذف LID
            const success = removeEliteUser(identifier);
            if (success) {
                removedItems.push(`LID: ${identifier}`);
                lidRemoved = true;
            }
        } else {
            // رقم الهاتف - نزيل أي شيء غير الأرقام
            const cleanPhone = identifier.replace(/\D/g, '');
            if (cleanPhone) {
                const success = removeEliteUser(cleanPhone);
                if (success) {
                    removedItems.push(`رقم الهاتف: ${cleanPhone}`);
                    phoneRemoved = true;
                }
            }
        }
    }
    
    if (removedItems.length > 0) {
        return {
            handled: true,
            response: `✅ تم حذف المستخدم من النخبة بنجاح!\n\n📱 تم حذف:\n${removedItems.map(item => `   • ${item}`).join('\n')}`
        };
    } else {
        return {
            handled: true,
            response: '❌ المستخدم غير موجود في النخبة أو لم يتم تقديم معرفات صحيحة'
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
 * أمر إضافة كلمة للفلتر
 */
async function handleAddKeywordCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.اضافة_كلمة <الكلمة>\n\nمثال:\n.اضافة_كلمة إعلان'
        };
    }
    
    const keyword = args[0];
    const success = addKeywordToFilter(keyword);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم إضافة الكلمة للفلتر بنجاح!\n\n🔑 الكلمة: ${keyword}\n\nℹ️ سيتم حظر الرسائل التي تحتوي على هذه الكلمة عند تفعيل الفلتر`
        };
    } else {
        return {
            handled: true,
            response: '❌ الكلمة موجودة بالفعل في الفلتر'
        };
    }
}

/**
 * أمر حذف كلمة من الفلتر
 */
async function handleRemoveKeywordCommand(args) {
    if (args.length < 1) {
        return {
            handled: true,
            response: '❌ الاستخدام الصحيح:\n.حذف_كلمة <الكلمة>\n\nمثال:\n.حذف_كلمة إعلان'
        };
    }
    
    const keyword = args[0];
    const success = removeKeywordFromFilter(keyword);
    
    if (success) {
        return {
            handled: true,
            response: `✅ تم حذف الكلمة من الفلتر بنجاح!\n\n🔑 الكلمة: ${keyword}`
        };
    } else {
        return {
            handled: true,
            response: '❌ الكلمة غير موجودة في الفلتر'
        };
    }
}

/**
 * أمر عرض قائمة كلمات الفلتر
 */
async function handleListKeywordsCommand() {
    const keywords = getFilterKeywords();
    
    if (keywords.length === 0) {
        return {
            handled: true,
            response: '📋 لا توجد كلمات في الفلتر حالياً\n\nاستخدم .اضافة_كلمة لإضافة كلمة جديدة'
        };
    }
    
    let message = '📋 الكلمات المفتاحية في الفلتر:\n\n';
    keywords.forEach((keyword, index) => {
        message += `${index + 1}. ${keyword}\n`;
    });
    message += `\n💡 عدد الكلمات: ${keywords.length}`;
    
    return {
        handled: true,
        response: message
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
                  `*📂 إدارة الملفات:*\n` +
                  `• *.ملفات* - عرض جميع الملفات والمجلدات المتاحة.\n` +
                  `• *.ملفات* <مسار المجلد> - إرسال جميع ملفات مجلد معين.\n\n` +
                  `*📢 إدارة الجسور (القنوات):*\n` +
                  `• *.اضافة_قناة* <ID المجموعة> <ID القناة> - لربط مجموعة واتساب بقناة تليجرام.\n` +
                  `• *.حذف_قناة* <ID المجموعة> - لحذف ربط معين.\n` +
                  `• *.القنوات* - عرض جميع الجسور (الروابط) الحالية بين واتساب وتليجرام.\n\n` +
                  `*👑 إدارة مستخدمي النخبة (Admins):*\n` +
                  `• *.اضافة_نخبة* <رقم الهاتف> - إضافة مستخدم ليتمكن من استخدام أوامر البوت.\n` +
                  `• *.حذف_نخبة* <رقم الهاتف> - إزالة مستخدم من قائمة النخبة.\n` +
                  `• *.النخبة* - عرض قائمة بجميع مستخدمي النخبة.\n\n` +
                  `*🔍 إدارة الفلاتر والحظر:*\n` +
                  `• *.حظر* <رقم الهاتف> - حظر مستخدم من نقل رسائله (يضاف للقائمة السوداء).\n` +
                  `  مثال: .حظر 201234567890\n` +
                  `• *.الغاء_حظر* <رقم الهاتف> - إزالة الحظر عن مستخدم محظور.\n` +
                  `  مثال: .الغاء_حظر 201234567890\n` +
                  `• *.تفعيل_فلتر* - تفعيل نظام الفلترة (القائمة السوداء + الكلمات المفتاحية).\n` +
                  `• *.تعطيل_فلتر* - تعطيل نظام الفلترة بالكامل، السماح لجميع الرسائل بالمرور.\n` +
                  `• *.اضافة_كلمة* <كلمة> - إضافة كلمة للفلتر (حظر أي رسالة تحتوي عليها).\n` +
                  `  مثال: .اضافة_كلمة إعلان\n` +
                  `• *.حذف_كلمة* <كلمة> - حذف كلمة من فلتر الكلمات المفتاحية.\n` +
                  `  مثال: .حذف_كلمة إعلان\n` +
                  `• *.الكلمات* - عرض قائمة جميع الكلمات المفتاحية المحظورة.\n\n` +
                  `*🔔 التنبيهات الذكية:*\n` +
                  `• *.اضافة_تنبيه* <كلمة> - إضافة كلمة لتنبيهك عند ذكرها.\n` +
                  `• *.حذف_تنبيه* <كلمة> - حذف كلمة من قائمة التنبيهات.\n` +
                  `• *.التنبيهات* - عرض جميع كلمات التنبيه الحالية.\n` +
                  `• *.تفعيل_تنبيهات* - تفعيل نظام التنبيهات الذكية.\n` +
                  `• *.تعطيل_تنبيهات* - تعطيل نظام التنبيهات الذكية.\n\n` +
                  `*💬 الردود الآلية (محادثات خاصة):*\n` +
                  `• *.اضافة_رد* <نوع> <كلمات> | <محتوى> - إضافة رد آلي للمحادثات الخاصة.\n` +
                  `• *.حذف_رد* <كلمة> - حذف رد آلي بناءً على الكلمة المفتاحية.\n` +
                  `• *.الردود* - عرض جميع الردود الآلية المُعدَّة حالياً.\n` +
                  `• *.تفعيل_ردود* - تفعيل نظام الردود الآلية بالكامل (عادي + AI).\n` +
                  `• *.تعطيل_ردود* - تعطيل نظام الردود الآلية بالكامل (لا ردود نهائياً).\n` +
                  `• *.تفعيل_ai* - تفعيل الذكاء الاصطناعي فقط (الردود العادية تبقى كما هي).\n` +
                  `  استخدم: عند الحاجة لردود ذكية تلقائية على الأسئلة المعقدة.\n` +
                  `• *.تعطيل_ai* - تعطيل AI فقط (الردود العادية تستمر، توفير توكينز).\n` +
                  `  استخدم: عند الرغبة في توفير التوكينز واستخدام الردود الجاهزة فقط.\n` +
                  `• *.حالة_ai* - عرض حالة AI والردود الآلية (مفعل/معطل).\n` +
                  `  يعرض: حالة AI، حالة الردود العادية، وضع النظام الحالي.\n\n` +
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
                  `*🔐 التحكم في الوصول:*\n` +
                  `• *.حظر_ردود* <رقم> - حظر مستخدم من استخدام الردود الآلية.\n` +
                  `  مثال: .حظر_ردود 201234567890\n` +
                  `• *.الغاء_حظر_ردود* <رقم> - إلغاء حظر مستخدم من الردود الآلية.\n` +
                  `• *.حظر_ai* <رقم> - حظر مستخدم من استخدام الذكاء الاصطناعي.\n` +
                  `  مثال: .حظر_ai 201234567890\n` +
                  `• *.الغاء_حظر_ai* <رقم> - إلغاء حظر مستخدم من الذكاء الاصطناعي.\n` +
                  `• *.وضع_ردود* <الوضع> - تغيير وضع الردود الآلية (all/whitelist/blacklist).\n` +
                  `  مثال: .وضع_ردود blacklist\n` +
                  `• *.وضع_ai* <الوضع> - تغيير وضع الذكاء الاصطناعي (all/whitelist/blacklist).\n` +
                  `  مثال: .وضع_ai whitelist\n` +
                  `• *.حالة_وصول* - عرض حالة التحكم في الوصول الحالية.\n\n` +
                  `*🤖 Groq AI (الذكاء الاصطناعي):*\n` +
                  `• *.مسح_ذاكرة* - مسح ذاكرة المحادثة مع البوت (بدء محادثة جديدة).\n` +
                  `  استخدم: عند الحاجة لتغيير الموضوع أو البدء من جديد.\n` +
                  `• *.احصائيات_ai* - عرض إحصائيات استخدام AI (عدد المحادثات النشطة).\n` +
                  `  يعرض: عدد المحادثات، عدد الرسائل لكل مستخدم.\n\n` +
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
    if (args.length < 2) {
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
    const restArgs = args.length > 1 ? args[1] : '';
    
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
    // استخدام trim فقط على الأطراف الخارجية، مع الحفاظ على الأسطر الجديدة داخل النص
    const parts = restArgs.split('|').map((p, index) => {
        // نحتفظ بالمسافات والأسطر الجديدة في منتصف النص
        // نزيل فقط المسافات من البداية والنهاية
        return p.replace(/^\s+|\s+$/g, '');
    });
    
    const type = validTypes[responseType];
    
    // التحقق من عدد الأجزاء حسب النوع
    if (type === 'both' && parts.length < 3) {
        return {
            handled: true,
            response: '❌ للنوع "كامل"، يجب فصل الكلمات المفتاحية عن النص عن مسار الملف بـ |\n\nمثال:\n.اضافة_رد كامل كلمة | النص | /path/to/file.pdf'
        };
    } else if (type !== 'both' && parts.length < 2) {
        return {
            handled: true,
            response: '❌ يجب فصل الكلمات المفتاحية عن المحتوى بـ |'
        };
    }
    
    const keywords = parts[0].split(',').map(k => k.trim());
    
    // تحديد المحتوى حسب النوع
    let text = null;
    let filePath = null;
    
    if (type === 'text') {
        // الحفاظ على الأسطر الجديدة كما هي من الرسالة الأصلية
        text = parts[1];
    } else if (type === 'image' || type === 'document') {
        filePath = parts[1];
    } else if (type === 'both') {
        // في حالة both، نتوقع كلمات مفتاحية | نص | مسار الملف
        // الحفاظ على الأسطر الجديدة كما هي من الرسالة الأصلية
        text = parts[1];
        filePath = parts[2];
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
        response: '🔴 تم تعطيل جميع الردود الآلية (شامل AI)\n\nلن يرد البوت على أي رسالة خاصة'
    };
}

/**
 * أمر تفعيل AI فقط
 */
async function handleEnableAICommand() {
    setAIStatus(true);
    return {
        handled: true,
        response: '🤖 تم تفعيل AI\n\nالبوت سيستخدم الذكاء الاصطناعي للرد على الرسائل'
    };
}

/**
 * أمر تعطيل AI فقط
 */
async function handleDisableAICommand() {
    setAIStatus(false);
    return {
        handled: true,
        response: '⏸️ تم تعطيل AI\n\nالبوت سيستخدم الردود العادية (الكلمات المفتاحية) فقط'
    };
}

/**
 * أمر حالة AI
 */
async function handleAIStatusCommandNew() {
    const aiEnabled = isAIEnabled();
    const config = loadConfig();
    const responsesEnabled = config.privateChatResponses?.enabled || false;
    
    let message = '📊 *حالة نظام الردود*\n\n';
    message += `🤖 الذكاء الاصطناعي (AI): ${aiEnabled ? '🟢 مُفعّل' : '🔴 معطل'}\n`;
    message += `💬 الردود العادية: ${responsesEnabled ? '🟢 مُفعّلة' : '🔴 معطلة'}\n\n`;
    
    if (!responsesEnabled) {
        message += 'ℹ️ جميع الردود معطلة حالياً';
    } else if (aiEnabled) {
        message += '✅ البوت يستخدم AI + الردود العادية';
    } else {
        message += '✅ البوت يستخدم الردود العادية فقط';
    }
    
    return {
        handled: true,
        response: message
    };
}

/**
 * أوامر Groq AI
 */
async function handleClearMemoryCommand(userId) {
    const success = clearConversationMemory(userId);
    
    if (success) {
        return {
            handled: true,
            response: '🧹 تم مسح ذاكرة المحادثة بنجاح!\n\nالبوت الآن سينسى المحادثات السابقة ويبدأ من جديد.'
        };
    } else {
        return {
            handled: true,
            response: 'ℹ️ لا توجد ذاكرة محادثة لمسحها'
        };
    }
}

async function handleAIStatsCommand() {
    const stats = getMemoryStats();
    
    let message = '📊 إحصائيات Groq AI\n\n';
    message += `💬 عدد المحادثات النشطة: ${stats.totalConversations}\n\n`;
    
    if (stats.totalConversations > 0) {
        message += '📝 تفاصيل المحادثات:\n';
        stats.conversations.forEach((conv, index) => {
            message += `${index + 1}. المستخدم: ${conv.userId}\n`;
            message += `   💭 عدد الرسائل: ${conv.messageCount}\n`;
        });
    } else {
        message += 'ℹ️ لا توجد محادثات نشطة حالياً';
    }
    
    return {
        handled: true,
        response: message
    };
}

async function handleAIStatusCommand() {
    const enabled = isGroqEnabled();
    
    let message = '🤖 حالة Groq AI\n\n';
    
    if (enabled) {
        message += '✅ **مُفعّل**\n\n';
        message += '📋 القدرات:\n';
        message += '• فهم المحادثات الطبيعية\n';
        message += '• الاحتفاظ بالسياق والذاكرة\n';
        message += '• إرسال الملفات والمحاضرات\n';
        message += '• ربط الأحداث ببعضها\n';
        message += '• تحليل config.json\n\n';
        message += '💡 الأوامر المتاحة:\n';
        message += '.مسح_ذاكرة - مسح ذاكرة المحادثة\n';
        message += '.احصائيات_ai - عرض الإحصائيات\n';
    } else {
        message += '⚠️ **غير مُفعّل**\n\n';
        message += '📝 لتفعيل Groq AI:\n';
        message += '1. احصل على API Key من: https://console.groq.com\n';
        message += '2. أضف GROQ_API_KEY في ملف .env\n';
        message += '3. أعد تشغيل البوت\n\n';
        message += 'ℹ️ حالياً يعمل البوت بالنظام العادي';
    }
    
    return {
        handled: true,
        response: message
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

/**
 * أمر حظر مستخدم من الردود الآلية
 */
async function handleBlockAutoRepliesCommand(args) {
    if (args.length === 0) {
        return {
            handled: true,
            response: '❌ الاستخدام: .حظر_ردود <رقم_الهاتف>\nمثال: .حظر_ردود 201234567890'
        };
    }
    
    const phone = args[0].trim();
    const config = loadConfig();
    
    if (!config.accessControl) {
        config.accessControl = {
            automaticReplies: { mode: 'all', blockedUsers: [], allowedUsers: [] },
            aiResponses: { mode: 'all', blockedUsers: [], allowedUsers: [] }
        };
    }
    
    if (!config.accessControl.automaticReplies.blockedUsers.includes(phone)) {
        config.accessControl.automaticReplies.blockedUsers.push(phone);
        saveConfig(config);
        
        return {
            handled: true,
            response: `✅ تم حظر ${phone} من استخدام الردود الآلية\n\n💡 لتفعيل وضع القائمة السوداء، استخدم:\n.وضع_ردود blacklist`
        };
    } else {
        return {
            handled: true,
            response: `⚠️ المستخدم ${phone} محظور بالفعل من الردود الآلية`
        };
    }
}

/**
 * أمر إلغاء حظر مستخدم من الردود الآلية
 */
async function handleUnblockAutoRepliesCommand(args) {
    if (args.length === 0) {
        return {
            handled: true,
            response: '❌ الاستخدام: .الغاء_حظر_ردود <رقم_الهاتف>\nمثال: .الغاء_حظر_ردود 201234567890'
        };
    }
    
    const phone = args[0].trim();
    const config = loadConfig();
    
    if (!config.accessControl || !config.accessControl.automaticReplies) {
        return {
            handled: true,
            response: '⚠️ لا يوجد مستخدمين محظورين'
        };
    }
    
    const index = config.accessControl.automaticReplies.blockedUsers.indexOf(phone);
    if (index > -1) {
        config.accessControl.automaticReplies.blockedUsers.splice(index, 1);
        saveConfig(config);
        
        return {
            handled: true,
            response: `✅ تم إلغاء حظر ${phone} من الردود الآلية`
        };
    } else {
        return {
            handled: true,
            response: `⚠️ المستخدم ${phone} غير محظور من الردود الآلية`
        };
    }
}

/**
 * أمر حظر مستخدم من الذكاء الاصطناعي
 */
async function handleBlockAICommand(args) {
    if (args.length === 0) {
        return {
            handled: true,
            response: '❌ الاستخدام: .حظر_ai <رقم_الهاتف>\nمثال: .حظر_ai 201234567890'
        };
    }
    
    const phone = args[0].trim();
    const config = loadConfig();
    
    if (!config.accessControl) {
        config.accessControl = {
            automaticReplies: { mode: 'all', blockedUsers: [], allowedUsers: [] },
            aiResponses: { mode: 'all', blockedUsers: [], allowedUsers: [] }
        };
    }
    
    if (!config.accessControl.aiResponses.blockedUsers.includes(phone)) {
        config.accessControl.aiResponses.blockedUsers.push(phone);
        saveConfig(config);
        
        return {
            handled: true,
            response: `✅ تم حظر ${phone} من استخدام الذكاء الاصطناعي\n\n💡 لتفعيل وضع القائمة السوداء، استخدم:\n.وضع_ai blacklist`
        };
    } else {
        return {
            handled: true,
            response: `⚠️ المستخدم ${phone} محظور بالفعل من الذكاء الاصطناعي`
        };
    }
}

/**
 * أمر إلغاء حظر مستخدم من الذكاء الاصطناعي
 */
async function handleUnblockAICommand(args) {
    if (args.length === 0) {
        return {
            handled: true,
            response: '❌ الاستخدام: .الغاء_حظر_ai <رقم_الهاتف>\nمثال: .الغاء_حظر_ai 201234567890'
        };
    }
    
    const phone = args[0].trim();
    const config = loadConfig();
    
    if (!config.accessControl || !config.accessControl.aiResponses) {
        return {
            handled: true,
            response: '⚠️ لا يوجد مستخدمين محظورين'
        };
    }
    
    const index = config.accessControl.aiResponses.blockedUsers.indexOf(phone);
    if (index > -1) {
        config.accessControl.aiResponses.blockedUsers.splice(index, 1);
        saveConfig(config);
        
        return {
            handled: true,
            response: `✅ تم إلغاء حظر ${phone} من الذكاء الاصطناعي`
        };
    } else {
        return {
            handled: true,
            response: `⚠️ المستخدم ${phone} غير محظور من الذكاء الاصطناعي`
        };
    }
}

/**
 * أمر تغيير وضع الردود الآلية
 */
async function handleSetAutoModeCommand(args) {
    if (args.length === 0) {
        return {
            handled: true,
            response: '❌ الاستخدام: .وضع_ردود <الوضع>\n\nالأوضاع المتاحة:\n• all - الكل (افتراضي)\n• whitelist - قائمة بيضاء (فقط المسموح لهم)\n• blacklist - قائمة سوداء (الكل ما عدا المحظورين)\n\nمثال: .وضع_ردود blacklist'
        };
    }
    
    const mode = args[0].toLowerCase().trim();
    const validModes = ['all', 'whitelist', 'blacklist'];
    
    if (!validModes.includes(mode)) {
        return {
            handled: true,
            response: `❌ وضع غير صحيح: ${mode}\n\nالأوضاع الصحيحة: all, whitelist, blacklist`
        };
    }
    
    const config = loadConfig();
    
    if (!config.accessControl) {
        config.accessControl = {
            automaticReplies: { mode: 'all', blockedUsers: [], allowedUsers: [] },
            aiResponses: { mode: 'all', blockedUsers: [], allowedUsers: [] }
        };
    }
    
    config.accessControl.automaticReplies.mode = mode;
    saveConfig(config);
    
    let modeText = mode === 'all' ? 'الكل يمكنه الوصول' : 
                   mode === 'whitelist' ? 'قائمة بيضاء (فقط المسموح لهم)' : 
                   'قائمة سوداء (الكل ما عدا المحظورين)';
    
    return {
        handled: true,
        response: `✅ تم تغيير وضع الردود الآلية إلى: ${modeText}\n\n💡 لإضافة مستخدمين:\n• للحظر: .حظر_ردود <رقم>\n• للسماح (whitelist): أضف للقائمة البيضاء في config.json`
    };
}

/**
 * أمر تغيير وضع الذكاء الاصطناعي
 */
async function handleSetAIModeCommand(args) {
    if (args.length === 0) {
        return {
            handled: true,
            response: '❌ الاستخدام: .وضع_ai <الوضع>\n\nالأوضاع المتاحة:\n• all - الكل (افتراضي)\n• whitelist - قائمة بيضاء (فقط المسموح لهم)\n• blacklist - قائمة سوداء (الكل ما عدا المحظورين)\n\nمثال: .وضع_ai blacklist'
        };
    }
    
    const mode = args[0].toLowerCase().trim();
    const validModes = ['all', 'whitelist', 'blacklist'];
    
    if (!validModes.includes(mode)) {
        return {
            handled: true,
            response: `❌ وضع غير صحيح: ${mode}\n\nالأوضاع الصحيحة: all, whitelist, blacklist`
        };
    }
    
    const config = loadConfig();
    
    if (!config.accessControl) {
        config.accessControl = {
            automaticReplies: { mode: 'all', blockedUsers: [], allowedUsers: [] },
            aiResponses: { mode: 'all', blockedUsers: [], allowedUsers: [] }
        };
    }
    
    config.accessControl.aiResponses.mode = mode;
    saveConfig(config);
    
    let modeText = mode === 'all' ? 'الكل يمكنه الوصول' : 
                   mode === 'whitelist' ? 'قائمة بيضاء (فقط المسموح لهم)' : 
                   'قائمة سوداء (الكل ما عدا المحظورين)';
    
    return {
        handled: true,
        response: `✅ تم تغيير وضع الذكاء الاصطناعي إلى: ${modeText}\n\n💡 لإضافة مستخدمين:\n• للحظر: .حظر_ai <رقم>\n• للسماح (whitelist): أضف للقائمة البيضاء في config.json`
    };
}

/**
 * أمر عرض حالة التحكم في الوصول
 */
async function handleAccessStatusCommand() {
    const accessInfo = getAccessControlInfo();
    
    let autoModeText = accessInfo.automaticReplies.mode === 'all' ? '🌐 الكل' :
                       accessInfo.automaticReplies.mode === 'whitelist' ? '📋 قائمة بيضاء' :
                       '🚫 قائمة سوداء';
    
    let aiModeText = accessInfo.aiResponses.mode === 'all' ? '🌐 الكل' :
                     accessInfo.aiResponses.mode === 'whitelist' ? '📋 قائمة بيضاء' :
                     '🚫 قائمة سوداء';
    
    let response = '🔐 حالة التحكم في الوصول:\n\n';
    
    response += '📱 الردود الآلية:\n';
    response += `   الوضع: ${autoModeText}\n`;
    response += `   المحظورين: ${accessInfo.automaticReplies.blockedCount}\n`;
    response += `   المسموح لهم: ${accessInfo.automaticReplies.allowedCount}\n\n`;
    
    response += '🤖 الذكاء الاصطناعي:\n';
    response += `   الوضع: ${aiModeText}\n`;
    response += `   المحظورين: ${accessInfo.aiResponses.blockedCount}\n`;
    response += `   المسموح لهم: ${accessInfo.aiResponses.allowedCount}\n\n`;
    
    if (accessInfo.automaticReplies.blockedUsers.length > 0) {
        response += '🚫 المحظورين من الردود الآلية:\n';
        accessInfo.automaticReplies.blockedUsers.forEach((phone, idx) => {
            response += `   ${idx + 1}. ${phone}\n`;
        });
        response += '\n';
    }
    
    if (accessInfo.aiResponses.blockedUsers.length > 0) {
        response += '🚫 المحظورين من الذكاء الاصطناعي:\n';
        accessInfo.aiResponses.blockedUsers.forEach((phone, idx) => {
            response += `   ${idx + 1}. ${phone}\n`;
        });
        response += '\n';
    }
    
    response += '💡 للمزيد من المساعدة، استخدم .المساعدة';
    
    return {
        handled: true,
        response
    };
}
