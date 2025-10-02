import { Telegraf } from 'telegraf';
import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    proto,
    downloadMediaMessage
} from '@whiskeysockets/baileys';
import pino from 'pino';
import dotenv from 'dotenv';
import readline from 'readline';
import NodeCache from 'node-cache';
import { handleCommand, isCommand } from './plugins/commands.js';
import { 
    isBotActive, 
    isGroupPaused, 
    shouldFilterMessage,
    getTelegramChannel,
    loadConfig,
    setBotStatus,
    CONFIG_PATH
} from './utils/config.js';
import { 
    logError, 
    logWarning, 
    logWhatsAppMessage, 
    logTelegramMessage, 
    logFailedTransfer,
    logBotStatus 
} from './utils/logger.js';
import { checkSmartAlerts } from './plugins/alerts.js';
import { checkDueSchedules } from './plugins/alerts.js';
import { generateDailyReport } from './plugins/reports.js';

dotenv.config();

// تحميل الإعدادات مبكراً
const initialConfig = loadConfig();

// عرض معلومات بدء التشغيل
console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║           🤖 WhatsApp to Telegram Bridge Bot - Starting...                ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
console.log(`📁 مجلد العمل: ${process.cwd()}`);
console.log(`📝 ملف الإعدادات: ${CONFIG_PATH}`);
console.log(`📂 ملف .env: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ موجود' : '❌ غير موجود'}`);
console.log(`👥 عدد النخبة: ${initialConfig.eliteUsers.length}`);
if (initialConfig.eliteUsers.length > 0) {
    console.log(`   📱 النخبة: ${initialConfig.eliteUsers.join(', ')}`);
} else {
    console.log(`   ⚠️  تحذير: لا يوجد مستخدمين نخبة! أضف OWNER_PHONE في .env`);
}
console.log('');

// --- إعدادات قابلة للتخصيص ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const WHATSAPP_GROUP_JID = process.env.WHATSAPP_GROUP_JID;
const FORWARD_SENDER_NAME = process.env.FORWARD_SENDER_NAME === 'true';
const FORWARD_REACTIONS = process.env.FORWARD_REACTIONS !== 'false';
const FORWARD_MESSAGE_EDITS = process.env.FORWARD_MESSAGE_EDITS !== 'false';

// --- تهيئة الأدوات ---
const telegramBot = new Telegraf(TELEGRAM_BOT_TOKEN);
const logger = pino({ level: 'info' });
const msgRetryCounterCache = new NodeCache();
const messageCache = new NodeCache({ stdTTL: 86400 });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let sock;

/**
 * بناء النص المرفق بناءً على الإعدادات
 */
function buildCaption(senderName, initialCaption = '', messageType = '💬') {
    let finalCaption = '';
    if (FORWARD_SENDER_NAME) {
        finalCaption += `👤 *من:* ${senderName}\n`;
    }
    if (initialCaption) {
        finalCaption += `${messageType} ${initialCaption}`;
    } else if (FORWARD_SENDER_NAME && messageType !== '💬') {
        finalCaption += `${messageType}`;
    }
    return finalCaption.trim();
}

/**
 * استخراج معلومات الرد (Reply)
 */
function getQuotedInfo(msg) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo || 
                       msg.message?.imageMessage?.contextInfo ||
                       msg.message?.videoMessage?.contextInfo ||
                       msg.message?.documentMessage?.contextInfo;
    
    if (contextInfo?.quotedMessage) {
        const quotedText = contextInfo.quotedMessage.conversation || 
                          contextInfo.quotedMessage.extendedTextMessage?.text || 
                          '[وسائط]';
        return `\n↩️ *رد على:* ${quotedText.substring(0, 50)}${quotedText.length > 50 ? '...' : ''}`;
    }
    return '';
}

/**
 * استخراج المنشن (@Mentions)
 */
function getMentions(msg) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo || 
                       msg.message?.imageMessage?.contextInfo ||
                       msg.message?.videoMessage?.contextInfo;
    
    if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length > 0) {
        const mentions = contextInfo.mentionedJid.map(jid => jid.split('@')[0]).join(', ');
        return `\n👥 *منشن:* ${mentions}`;
    }
    return '';
}

/**
 * المعالج الرئيسي للرسائل الواردة
 */
async function handleNewMessage(msg) {
    // دعم الجسور المتعددة - التحقق من أي جروب مسجل
    const config = loadConfig();
    const groupJid = msg.key.remoteJid;
    
    // إذا كان هناك WHATSAPP_GROUP_JID في .env، نستخدمه
    // وإلا، نتحقق من config.json
    const isFromMonitoredGroup = WHATSAPP_GROUP_JID ? 
        groupJid === WHATSAPP_GROUP_JID : 
        config.bridges.some(b => b.whatsapp === groupJid);
    
    if (!msg.message || !isFromMonitoredGroup) return;

    const senderName = msg.pushName || 'غير معروف';
    const messageId = msg.key.id;
    const senderPhone = msg.key.participant?.split('@')[0] || msg.key.remoteJid?.split('@')[0];
    
    console.log(`\n📨 رسالة جديدة من ${senderName} (ID: ${messageId})`);

    try {
        // استخراج نوع الرسالة مع تجاهل الرسائل البروتوكولية
        const messageKeys = Object.keys(msg.message);
        const protocolMessages = ['senderKeyDistributionMessage', 'messageContextInfo'];
        const actualMessageKey = messageKeys.find(key => !protocolMessages.includes(key));
        
        if (!actualMessageKey) {
            console.log('⚠️ رسالة بروتوكولية فقط - تم التجاهل');
            return;
        }
        
        const messageType = actualMessageKey;
        const messageContent = msg.message[messageType];

        // معالجة الأوامر للمستخدمين من النخبة
        const text = messageContent.text || messageContent;
        if (typeof text === 'string' && isCommand(text)) {
            console.log(`\n⚡ تم اكتشاف أمر: ${text}`);
            const result = await handleCommand(msg, sock, telegramBot);
            if (result && result.handled && result.response) {
                // إرسال الرد على WhatsApp
                await sock.sendMessage(groupJid, { text: result.response });
                console.log('✅ تم إرسال رد الأمر');
            } else if (result && result.handled) {
                console.log('✅ تم معالجة الأمر بدون رد');
            } else {
                console.log('⚠️ الأمر لم يتم معالجته');
            }
            return; // لا نقوم بنقل الأوامر إلى Telegram
        }

        // التحقق من حالة البوت
        if (!isBotActive()) {
            console.log('⏸️ البوت متوقف - تم تجاهل الرسالة');
            return;
        }

        // التحقق من حالة الجروب
        if (isGroupPaused(groupJid)) {
            console.log('⏸️ الجروب متوقف مؤقتاً - تم تجاهل الرسالة');
            return;
        }

        // تطبيق الفلاتر
        if (shouldFilterMessage(senderPhone, text, messageType)) {
            console.log('🔍 تم فلترة الرسالة');
            return;
        }

        // تحديد القناة المستهدفة
        let targetChannel = TELEGRAM_CHANNEL_ID;
        if (!targetChannel) {
            targetChannel = getTelegramChannel(groupJid);
            if (!targetChannel) {
                logWarning(`لا توجد قناة مرتبطة بالجروب: ${groupJid}`);
                console.log('⚠️ لا توجد قناة مرتبطة بهذا الجروب');
                return;
            }
        }

        // تسجيل رسالة واتساب
        const textContent = typeof text === 'string' ? text : JSON.stringify(messageContent).substring(0, 100);
        logWhatsAppMessage(senderName, senderPhone, groupJid, messageType, textContent);

        // استخراج معلومات إضافية
        const replyInfo = getQuotedInfo(msg);
        const mentionInfo = getMentions(msg);

        switch (messageType) {
            case 'conversation':
            case 'extendedTextMessage':
                const finalMessage = FORWARD_SENDER_NAME ? 
                    buildCaption(senderName, text) + replyInfo + mentionInfo : 
                    text + replyInfo + mentionInfo;
                
                try {
                    const sentMsg = await telegramBot.telegram.sendMessage(
                        targetChannel, 
                        finalMessage, 
                        { parse_mode: 'Markdown' }
                    );
                    messageCache.set(messageId, sentMsg.message_id);
                    logTelegramMessage(targetChannel, messageType, true, sentMsg.message_id);
                    console.log('✅ تم إرسال النص إلى Telegram');
                    
                    // التحقق من التنبيهات الذكية
                    if (typeof text === 'string') {
                        const alert = checkSmartAlerts(text, senderName, targetChannel);
                        if (alert) {
                            // إرسال تنبيه
                            for (const notifyChannel of alert.channels) {
                                await telegramBot.telegram.sendMessage(notifyChannel, alert.message, { parse_mode: 'Markdown' });
                            }
                        }
                    }
                } catch (error) {
                    logFailedTransfer(senderName, senderPhone, messageType, error.message, text);
                    logTelegramMessage(targetChannel, messageType, false);
                    logError('فشل إرسال رسالة نصية', error);
                    throw error;
                }
                break;

            case 'imageMessage':
            case 'videoMessage':
                const isVideo = messageType === 'videoMessage';
                const stream = await downloadMediaMessage(msg, 'buffer', {}, { 
                    logger, 
                    reuploadRequest: sock.updateMediaMessage 
                });
                const captionText = buildCaption(senderName, messageContent.caption, isVideo ? '🎥' : '📸') 
                    + replyInfo + mentionInfo;
                
                const mediaSent = isVideo ? 
                    await telegramBot.telegram.sendVideo(targetChannel, { source: stream }, { 
                        caption: captionText || undefined, 
                        parse_mode: 'Markdown' 
                    }) :
                    await telegramBot.telegram.sendPhoto(targetChannel, { source: stream }, { 
                        caption: captionText || undefined, 
                        parse_mode: 'Markdown' 
                    });
                
                messageCache.set(messageId, mediaSent.message_id);
                console.log(`✅ تم إرسال ${isVideo ? 'الفيديو' : 'الصورة'} إلى Telegram`);
                break;

            case 'documentMessage':
                const docStream = await downloadMediaMessage(msg, 'buffer', {}, { 
                    logger, 
                    reuploadRequest: sock.updateMediaMessage 
                });
                const docCaption = buildCaption(senderName, messageContent.caption, `📄 ${messageContent.fileName || 'ملف'}`) 
                    + replyInfo + mentionInfo;
                
                const docSent = await telegramBot.telegram.sendDocument(
                    targetChannel, 
                    { source: docStream, filename: messageContent.fileName || 'document' }, 
                    { caption: docCaption || undefined, parse_mode: 'Markdown' }
                );
                messageCache.set(messageId, docSent.message_id);
                console.log('✅ تم إرسال المستند إلى Telegram');
                break;
            
            case 'audioMessage':
                const audioStream = await downloadMediaMessage(msg, 'buffer', {}, { 
                    logger, 
                    reuploadRequest: sock.updateMediaMessage 
                });
                const audioCaption = buildCaption(senderName, '', '🎵 رسالة صوتية') + replyInfo;
                
                const audioSent = await telegramBot.telegram.sendAudio(
                    targetChannel, 
                    { source: audioStream }, 
                    { caption: audioCaption || undefined, parse_mode: 'Markdown' }
                );
                messageCache.set(messageId, audioSent.message_id);
                console.log('✅ تم إرسال الصوت إلى Telegram');
                break;

            case 'stickerMessage':
                const stickerStream = await downloadMediaMessage(msg, 'buffer', {}, { 
                    logger, 
                    reuploadRequest: sock.updateMediaMessage 
                });
                const stickerSent = await telegramBot.telegram.sendSticker(targetChannel, { source: stickerStream });
                messageCache.set(messageId, stickerSent.message_id);
                console.log('✅ تم إرسال الملصق إلى Telegram');
                break;

            case 'pollCreationMessage':
                const poll = messageContent;
                const pollQuestion = buildCaption(senderName, poll.name, '📊');
                const pollOptions = poll.options.map(opt => opt.optionName);
                
                const pollSent = await telegramBot.telegram.sendPoll(
                    targetChannel, 
                    pollQuestion || 'تصويت', 
                    pollOptions, 
                    { is_anonymous: false }
                );
                messageCache.set(messageId, pollSent.message_id);
                console.log('✅ تم إرسال التصويت إلى Telegram');
                break;

            case 'contactMessage':
                const contact = messageContent;
                const contactText = buildCaption(
                    senderName, 
                    `📇 *جهة اتصال:* ${contact.displayName || contact.vcard?.match(/FN:(.*)/)?.[1] || 'غير معروف'}\n` +
                    `📱 ${contact.vcard?.match(/TEL.*?:(.*)/)?.[1] || 'لا يوجد رقم'}`
                );
                
                const contactSent = await telegramBot.telegram.sendMessage(
                    targetChannel, 
                    contactText, 
                    { parse_mode: 'Markdown' }
                );
                messageCache.set(messageId, contactSent.message_id);
                console.log('✅ تم إرسال جهة الاتصال إلى Telegram');
                break;

            case 'locationMessage':
                const location = messageContent;
                const locationText = buildCaption(
                    senderName, 
                    location.name ? `📍 *الموقع:* ${location.name}` : '📍 *موقع جغرافي*'
                );
                
                await telegramBot.telegram.sendLocation(
                    targetChannel, 
                    location.degreesLatitude, 
                    location.degreesLongitude
                );
                
                if (locationText) {
                    await telegramBot.telegram.sendMessage(
                        targetChannel, 
                        locationText, 
                        { parse_mode: 'Markdown' }
                    );
                }
                console.log('✅ تم إرسال الموقع إلى Telegram');
                break;

            case 'liveLocationMessage':
                const liveLocation = messageContent;
                const liveLocationText = buildCaption(
                    senderName, 
                    `📍 *موقع مباشر (Live Location)*\n⏱️ المدة: ${liveLocation.seconds || 'غير محددة'} ثانية`
                );
                
                await telegramBot.telegram.sendLocation(
                    targetChannel, 
                    liveLocation.degreesLatitude, 
                    liveLocation.degreesLongitude
                );
                
                await telegramBot.telegram.sendMessage(
                    targetChannel, 
                    liveLocationText, 
                    { parse_mode: 'Markdown' }
                );
                console.log('✅ تم إرسال الموقع المباشر إلى Telegram');
                break;

            case 'reactionMessage':
                if (FORWARD_REACTIONS) {
                    const reaction = messageContent;
                    const emoji = reaction.text || '❤️';
                    const reactionText = buildCaption(senderName, `تفاعل بـ ${emoji}`);
                    await telegramBot.telegram.sendMessage(
                        targetChannel, 
                        reactionText, 
                        { parse_mode: 'Markdown' }
                    );
                    console.log('✅ تم إرسال التفاعل إلى Telegram');
                }
                break;

            case 'protocolMessage':
                // معالجة رسائل الحذف
                if (FORWARD_MESSAGE_EDITS && messageContent.type === proto.Message.ProtocolMessage.Type.REVOKE) {
                    const deletedMsgId = messageContent.key?.id;
                    const telegramMsgId = messageCache.get(deletedMsgId);
                    
                    if (telegramMsgId) {
                        try {
                            await telegramBot.telegram.deleteMessage(targetChannel, telegramMsgId);
                            console.log('🗑️ تم حذف الرسالة من Telegram');
                        } catch (e) {
                            await telegramBot.telegram.sendMessage(
                                targetChannel, 
                                '🗑️ *تم حذف رسالة من الواتساب*', 
                                { parse_mode: 'Markdown' }
                            );
                        }
                        messageCache.del(deletedMsgId);
                    }
                }
                break;

            default:
                console.log(`⚠️ تجاهل نوع الرسالة غير المدعوم: ${messageType}`);
                logWarning(`نوع رسالة غير مدعوم: ${messageType} من ${senderName}`);
                break;
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة الرسالة:', error.message);
        logError(`خطأ في معالجة رسالة من ${senderName}`, error);
        logFailedTransfer(senderName, senderPhone, messageType, error.message, textContent);
    }
}

/**
 * معالجة تحديثات الرسائل (التعديل)
 */
async function handleMessageUpdate(updates) {
    if (!FORWARD_MESSAGE_EDITS) return;

    try {
        const updatesArray = Array.isArray(updates) ? updates : [updates];

        for (const update of updatesArray) {
            if (!update.key || update.key.remoteJid !== WHATSAPP_GROUP_JID) continue;

            const messageId = update.key.id;
            
            if (update.update?.message) {
                const telegramMsgId = messageCache.get(messageId);
                
                if (telegramMsgId) {
                    try {
                        await telegramBot.telegram.deleteMessage(targetChannel, telegramMsgId);
                        console.log('✏️ تم حذف النسخة القديمة من Telegram');
                    } catch (e) {
                        console.log('⚠️ لم يتم العثور على الرسالة القديمة للحذف');
                    }
                    
                    const updatedMsg = {
                        key: update.key,
                        message: update.update.message,
                        pushName: update.pushName || 'غير معروف'
                    };
                    
                    await handleNewMessage(updatedMsg);
                    console.log('✅ تم إرسال النسخة المعدلة');
                }
            }
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة تحديث الرسالة:', error.message);
    }
}

/**
 * عرض جميع المجموعات مع الـ ID الخاص بكل واحدة
 */
async function displayAllGroups() {
    try {
        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║          📋 جاري جلب المجموعات...             ║');
        console.log('╚════════════════════════════════════════════════╝\n');

        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups);

        if (groupList.length === 0) {
            console.log('⚠️  لا توجد مجموعات متاحة.\n');
            return;
        }

        console.log(`✅ تم العثور على ${groupList.length} مجموعة:\n`);
        console.log('═'.repeat(80));

        groupList.forEach((group, index) => {
            console.log(`\n${index + 1}. 📱 *${group.subject}*`);
            console.log(`   🆔 ID: ${group.id}`);
            console.log(`   👥 الأعضاء: ${group.participants?.length || 0}`);
            console.log(`   👤 المنشئ: ${group.owner || 'غير معروف'}`);
            console.log('─'.repeat(80));
        });

        console.log('\n💡 لاستخدام مجموعة معينة، انسخ الـ ID وضعه في ملف .env');
        console.log('   مثال: WHATSAPP_GROUP_JID=120363423024619812@g.us\n');

    } catch (error) {
        console.error('❌ خطأ في جلب المجموعات:', error.message);
    }
}

/**
 * الاتصال بواتساب
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📦 Using Baileys version v${version.join('.')}, isLatest: ${isLatest}`);

    sock = makeWASocket({
        version,
        logger,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) console.log('📱 QR Code متاح، امسحه للاتصال.');
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ الاتصال انقطع:', lastDisconnect?.error?.message, ', إعادة الاتصال:', shouldReconnect);
            if (shouldReconnect) setTimeout(connectToWhatsApp, 5000);
            else console.log('❌ تم تسجيل الخروج.');
        } else if (connection === 'open') {
            console.log('\n╔════════════════════════════════════════════════╗');
            console.log('║     ✅ تم الاتصال بواتساب بنجاح!              ║');
            console.log('╚════════════════════════════════════════════════╝\n');
            
            // عرض جميع المجموعات عند الاتصال الناجح
            await displayAllGroups();
        }
    });
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            await handleNewMessage(msg);
        }
    });

    sock.ev.on('messages.update', handleMessageUpdate);
    
    if (!sock.authState.creds.registered) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const phoneNumber = await question('📱 أدخل رقم الواتساب (مثال: 20123...): ');
        if (phoneNumber) {
            try {
                const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
                console.log(`\n🔑 كود الربط الخاص بك هو: ${code}\n`);
            } catch (error) {
                console.error('❌ فشل في طلب كود الربط:', error.message);
            }
        }
    }

    return sock;
}

// --- تشغيل البوت ---
telegramBot.launch()
    .then(() => {
        console.log('🤖 Telegram Bot شغال!');
        logBotStatus('started', 'Telegram bot launched successfully');
    })
    .catch(err => {
        console.error('❌ فشل تشغيل Telegram Bot:', err);
        logError('فشل تشغيل Telegram Bot', err);
    });

connectToWhatsApp()
    .then(() => {
        logBotStatus('started', 'WhatsApp connection established');
    })
    .catch(err => {
        console.error('❌ فشل الاتصال الأولي بـ WhatsApp:', err);
        logError('فشل الاتصال الأولي بـ WhatsApp', err);
    });

// فحص الجداول الزمنية كل دقيقة
setInterval(async () => {
    try {
        const dueSchedules = checkDueSchedules();
        for (const schedule of dueSchedules) {
            console.log(`⏰ تنفيذ جدول زمني: ${schedule.name}`);
            
            switch (schedule.action) {
                case 'stop':
                    setBotStatus(false);
                    logBotStatus('stopped', 'Scheduled stop');
                    break;
                case 'start':
                    setBotStatus(true);
                    logBotStatus('started', 'Scheduled start');
                    break;
                case 'report':
                    // إرسال تقرير يومي
                    const report = generateDailyReport();
                    if (TELEGRAM_CHANNEL_ID) {
                        await telegramBot.telegram.sendMessage(TELEGRAM_CHANNEL_ID, report, { parse_mode: 'Markdown' });
                    }
                    break;
            }
        }
    } catch (error) {
        logError('خطأ في فحص الجداول الزمنية', error);
    }
}, 60000); // كل دقيقة

process.on('SIGINT', () => {
    console.log('\n⏹️ إيقاف البوت...');
    sock?.end(undefined);
    telegramBot.stop('SIGINT');
    rl.close();
    process.exit(0);
});

process.once('SIGTERM', () => {
    sock?.end(undefined);
    telegramBot.stop('SIGTERM');
    rl.close();
    process.exit(0);
});
