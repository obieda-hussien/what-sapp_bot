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
    CONFIG_PATH,
    savePhoneToEnv,
    saveConfig
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
import { checkPrivateChatKeyword, isAIEnabled } from './plugins/privateChat.js';
import { checkDueSchedules } from './plugins/alerts.js';
import { generateDailyReport } from './plugins/reports.js';
import { processWithGroqAI, isGroqEnabled, validateAllApiKeys } from './utils/groqAssistant.js';
import { canUseAutomaticReplies, canUseAI, getAutomaticReplyBlockMessage, getAIBlockMessage } from './utils/accessControl.js';

dotenv.config();

// تحميل الإعدادات مبكراً
const initialConfig = loadConfig();

// عرض معلومات بدء التشغيل
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║           🤖 WhatsApp to Telegram Bridge Bot - Starting...                ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`📁 مجلد العمل: ${process.cwd()}`);
console.log(`📝 ملف الإعدادات: ${CONFIG_PATH}`);
console.log(`📂 ملف .env: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ موجود' : '❌ غير موجود'}`);

// التحقق العميق من مفاتيح API
validateAllApiKeys();

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
const messageCache = new NodeCache({ stdTTL: 86400 }); // تخزين message IDs من Telegram
const processedMessages = new NodeCache({ stdTTL: 3600 }); // تخزين الرسائل المعالجة لمنع التكرار (1 ساعة)
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
 * تقسيم الرسائل الطويلة إلى أجزاء (حد Telegram: 4096 حرف)
 */
function splitLongMessage(text, maxLength = 4096) {
    if (text.length <= maxLength) {
        return [text];
    }
    
    const chunks = [];
    let currentChunk = '';
    
    // تقسيم النص إلى أسطر للحفاظ على التنسيق
    const lines = text.split('\n');
    
    for (const line of lines) {
        // إذا كان السطر نفسه أطول من الحد الأقصى، نقسمه
        if (line.length > maxLength) {
            // حفظ الجزء الحالي إذا كان موجوداً
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
            
            // تقسيم السطر الطويل إلى أجزاء
            for (let i = 0; i < line.length; i += maxLength) {
                chunks.push(line.substring(i, i + maxLength));
            }
        } else if ((currentChunk + '\n' + line).length > maxLength) {
            // إذا كان إضافة السطر سيتجاوز الحد، نحفظ الجزء الحالي
            chunks.push(currentChunk);
            currentChunk = line;
        } else {
            // إضافة السطر إلى الجزء الحالي
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
    }
    
    // إضافة آخر جزء
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    
    return chunks;
}

/**
 * المعالج الرئيسي للرسائل الواردة
 */
async function handleNewMessage(msg) {
    if (!msg.message) return;
    
    // تجاهل الرسائل المرسلة من البوت نفسه لتجنب الحلقات اللانهائية
    if (msg.key.fromMe) {
        return;
    }
    
    const groupJid = msg.key.remoteJid;
    
    // تجاهل رسائل القنوات والنشرات (newsletters) لتجنب الحلقات
    if (groupJid && groupJid.includes('@newsletter')) {
        return;
    }
    
    const senderName = msg.pushName || 'غير معروف';
    const messageId = msg.key.id;
    const senderPhone = msg.key.participant?.split('@')[0] || msg.key.remoteJid?.split('@')[0];
    
    // ✨ منع معالجة الرسائل المكررة - حماية قوية ضد الإرسال المزدوج
    // التحقق من أن الرسالة لم تتم معالجتها من قبل
    const messageKey = `${groupJid}_${messageId}`;
    if (processedMessages.has(messageKey)) {
        console.log(`⚠️ تم تجاهل رسالة مكررة من ${senderName} (ID: ${messageId})`);
        return;
    }
    
    // وضع علامة على أن الرسالة قيد المعالجة لمنع المعالجة المتزامنة
    processedMessages.set(messageKey, {
        timestamp: Date.now(),
        senderName: senderName,
        processed: false
    });
    
    try {
        // استخراج نوع الرسالة مع تجاهل الرسائل البروتوكولية
        const messageKeys = Object.keys(msg.message);
        const protocolMessages = [
            'senderKeyDistributionMessage', 
            'messageContextInfo',
            'associatedChildMessage',  // رسالة مرتبطة - تظهر مع الردود على الوسائط
            'editedMessage'  // معلومات عن الرسالة المعدلة - تُعالج في handleMessageUpdate
        ];
        const actualMessageKey = messageKeys.find(key => !protocolMessages.includes(key));
        
        if (!actualMessageKey) {
            // رسالة بروتوكولية فقط - نحذفها من الـ cache
            processedMessages.del(messageKey);
            return;
        }
    
        const messageType = actualMessageKey;
        const messageContent = msg.message[messageType];
        let textContent = ''; // للاستخدام في catch block
    
        // معالجة الأوامر من أي محادثة (جروب، خاص، إلخ)
        const text = messageContent.text || messageContent;
        if (typeof text === 'string' && isCommand(text)) {
            console.log(`\n📨 رسالة جديدة من ${senderName} (ID: ${messageId})`);
            console.log(`⚡ تم اكتشاف أمر: ${text}`);
            
            const result = await handleCommand(msg, sock, telegramBot);
            if (result && result.handled && result.response) {
                // إرسال الرد على WhatsApp في نفس المحادثة
                await sock.sendMessage(groupJid, { text: result.response });
                console.log('✅ تم إرسال رد الأمر');
            } else if (result && result.handled) {
                console.log('✅ تم معالجة الأمر بدون رد');
            }
            
            // وضع علامة على أن الأمر تمت معالجته
            processedMessages.set(messageKey, {
                timestamp: Date.now(),
                senderName: senderName,
                processed: true,
                messageType: 'command'
            });
            
            return; // لا نقوم بنقل الأوامر إلى Telegram
        }
    
    // دعم الجسور المتعددة - التحقق من أي جروب مسجل
    const config = loadConfig();
    
    // إذا كان هناك WHATSAPP_GROUP_JID في .env، نستخدمه
    // وإلا، نتحقق من config.json
    const isFromMonitoredGroup = WHATSAPP_GROUP_JID ? 
        groupJid === WHATSAPP_GROUP_JID : 
        config.bridges.some(b => b.whatsapp === groupJid);
    
    // التحقق من أن الرسالة من محادثة خاصة (private chat)
    // المحادثات الخاصة تنتهي بـ @s.whatsapp.net
    // المجموعات تنتهي بـ @g.us
    const isPrivateChat = groupJid.endsWith('@s.whatsapp.net');
    
    // إذا كانت محادثة خاصة، نحاول الرد عليها
    if (isPrivateChat) {
        console.log(`\n💬 رسالة خاصة من ${senderName} (${senderPhone})`);
        
        const text = messageContent.text || messageContent;
        if (typeof text === 'string') {
            console.log(`📝 محتوى الرسالة: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
            
            // 🔒 التحقق من صلاحيات الوصول للردود الآلية
            const hasAutoReplyAccess = canUseAutomaticReplies(senderPhone);
            
            // 🎯 التحقق من الكلمات المفتاحية أولاً (توفير التوكينز)
            // إذا وُجد رد جاهز، لا حاجة لاستخدام AI
            const keywordResponse = checkPrivateChatKeyword(text);
            
            if (keywordResponse && hasAutoReplyAccess) {
                console.log(`🔍 تم العثور على كلمة مفتاحية: ${keywordResponse.keyword}`);
                console.log(`📝 نوع الرد: ${keywordResponse.responseType}`);
                console.log(`💡 توفير التوكينز: تم الرد بدون استخدام AI`);
                
                try {
                    // إرسال الرد حسب النوع
                    if (keywordResponse.responseType === 'text' && keywordResponse.text) {
                        await sock.sendMessage(groupJid, { text: keywordResponse.text });
                        console.log('✅ تم إرسال رد نصي');
                    } else if (keywordResponse.responseType === 'image' && keywordResponse.filePath) {
                        const fs = await import('fs');
                        if (fs.existsSync(keywordResponse.filePath)) {
                            await sock.sendMessage(groupJid, {
                                image: { url: keywordResponse.filePath },
                                caption: keywordResponse.caption || ''
                            });
                            console.log('✅ تم إرسال صورة');
                        } else {
                            console.log(`❌ الملف غير موجود: ${keywordResponse.filePath}`);
                            await sock.sendMessage(groupJid, { 
                                text: '❌ عذراً، الملف المطلوب غير متوفر حالياً' 
                            });
                        }
                    } else if (keywordResponse.responseType === 'file' && keywordResponse.filePath) {
                        const fs = await import('fs');
                        const path = await import('path');
                        if (fs.existsSync(keywordResponse.filePath)) {
                            await sock.sendMessage(groupJid, {
                                document: { url: keywordResponse.filePath },
                                mimetype: 'application/pdf',
                                fileName: path.basename(keywordResponse.filePath),
                                caption: keywordResponse.caption || ''
                            });
                            console.log('✅ تم إرسال ملف');
                        } else {
                            console.log(`❌ الملف غير موجود: ${keywordResponse.filePath}`);
                            await sock.sendMessage(groupJid, { 
                                text: '❌ عذراً، الملف المطلوب غير متوفر حالياً' 
                            });
                        }
                    } else if (keywordResponse.responseType === 'document' && keywordResponse.filePath) {
                        const fs = await import('fs');
                        const path = await import('path');
                        if (fs.existsSync(keywordResponse.filePath)) {
                            // تحديد نوع الملف من الامتداد
                            const fileExt = path.extname(keywordResponse.filePath).toLowerCase();
                            const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt);
                            
                            if (isImage) {
                                await sock.sendMessage(groupJid, {
                                    image: { url: keywordResponse.filePath },
                                    caption: keywordResponse.caption || ''
                                });
                                console.log('✅ تم إرسال صورة (document)');
                            } else {
                                await sock.sendMessage(groupJid, {
                                    document: { url: keywordResponse.filePath },
                                    mimetype: fileExt === '.pdf' ? 'application/pdf' : 'application/octet-stream',
                                    fileName: path.basename(keywordResponse.filePath),
                                    caption: keywordResponse.caption || ''
                                });
                                console.log('✅ تم إرسال مستند (document)');
                            }
                        } else {
                            console.log(`❌ الملف غير موجود: ${keywordResponse.filePath}`);
                            await sock.sendMessage(groupJid, { 
                                text: '❌ عذراً، الملف المطلوب غير متوفر حالياً' 
                            });
                        }
                    } else if (keywordResponse.responseType === 'both' && keywordResponse.text && keywordResponse.filePath) {
                        const fs = await import('fs');
                        const path = await import('path');
                        
                        // إرسال النص أولاً
                        await sock.sendMessage(groupJid, { text: keywordResponse.text });
                        console.log('✅ تم إرسال النص (both)');
                        
                        // ثم إرسال الملف
                        if (fs.existsSync(keywordResponse.filePath)) {
                            const fileExt = path.extname(keywordResponse.filePath).toLowerCase();
                            const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt);
                            
                            if (isImage) {
                                await sock.sendMessage(groupJid, {
                                    image: { url: keywordResponse.filePath },
                                    caption: keywordResponse.caption || ''
                                });
                                console.log('✅ تم إرسال صورة (both)');
                            } else {
                                await sock.sendMessage(groupJid, {
                                    document: { url: keywordResponse.filePath },
                                    mimetype: fileExt === '.pdf' ? 'application/pdf' : 'application/octet-stream',
                                    fileName: path.basename(keywordResponse.filePath),
                                    caption: keywordResponse.caption || ''
                                });
                                console.log('✅ تم إرسال مستند (both)');
                            }
                        } else {
                            console.log(`❌ الملف غير موجود: ${keywordResponse.filePath}`);
                            await sock.sendMessage(groupJid, { 
                                text: '⚠️ الملف المطلوب غير متوفر حالياً' 
                            });
                        }
                    }
                    return; // تم المعالجة بالردود الجاهزة
                } catch (error) {
                    console.error('❌ خطأ في إرسال الرد الجاهز:', error.message);
                    // سنحاول AI كخطة احتياطية
                }
            } else if (keywordResponse && !hasAutoReplyAccess) {
                // وُجد رد جاهز لكن المستخدم ليس لديه صلاحية
                console.log(`🚫 المستخدم ${senderPhone} محظور من الردود الآلية - لا يتم الرد`);
                // لا نرسل رسالة خطأ - نتجاهل الرسالة بشكل صامت
                return;
            }
            
            // 🔒 التحقق من صلاحيات الوصول للذكاء الاصطناعي
            const hasAIAccess = canUseAI(senderPhone);
            
            // 🤖 استخدام Groq AI فقط إذا لم يتم العثور على رد جاهز (إذا كان مُفعّلاً)
            if (isGroqEnabled() && isAIEnabled() && hasAIAccess) {
                console.log('🤖 لم يتم العثور على رد جاهز، استخدام Groq AI...');
                
                try {
                    const groqResponse = await processWithGroqAI(text, senderPhone, senderName);
                    
                    if (groqResponse.success) {
                        // إرسال النص
                        if (groqResponse.text) {
                            await sock.sendMessage(groupJid, { text: groqResponse.text });
                            console.log('✅ تم إرسال رد Groq AI');
                        }
                        
                        // إرسال الملفات إذا طلب البوت ذلك
                        if (groqResponse.filesToSend && groqResponse.filesToSend.length > 0) {
                            const fs = await import('fs');
                            const path = await import('path');
                            
                            for (const fileInfo of groqResponse.filesToSend) {
                                if (fileInfo.filePath && fs.existsSync(fileInfo.filePath)) {
                                    const fileType = fileInfo.fileType || 'pdf';
                                    
                                    if (fileType === 'image') {
                                        // إرسال صورة
                                        await sock.sendMessage(groupJid, {
                                            image: { url: fileInfo.filePath },
                                            caption: fileInfo.caption || ''
                                        });
                                        console.log('✅ تم إرسال صورة من Groq AI');
                                    } else if (fileType === 'text') {
                                        // قراءة وإرسال محتوى الملف النصي
                                        const content = fs.readFileSync(fileInfo.filePath, 'utf8');
                                        await sock.sendMessage(groupJid, {
                                            text: `📄 ${fileInfo.fileName}\n\n${content}`
                                        });
                                        console.log('✅ تم إرسال محتوى ملف نصي من Groq AI');
                                    } else {
                                        // إرسال PDF أو ملف آخر
                                        await sock.sendMessage(groupJid, {
                                            document: { url: fileInfo.filePath },
                                            mimetype: fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
                                            fileName: path.basename(fileInfo.filePath),
                                            caption: fileInfo.caption || '📚 تفضل الملف المطلوب'
                                        });
                                        console.log(`✅ تم إرسال ملف ${fileType} من Groq AI`);
                                    }
                                    
                                    // تأخير صغير بين الملفات
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                } else {
                                    console.log(`❌ الملف غير موجود: ${fileInfo.filePath}`);
                                }
                            }
                        }
                        // الدعم القديم لملف واحد (للتوافق)
                        else if (groqResponse.action === 'send_file' && groqResponse.fileInfo) {
                            const fileInfo = groqResponse.fileInfo;
                            const fs = await import('fs');
                            
                            if (fileInfo.filePath && fs.existsSync(fileInfo.filePath)) {
                                const path = await import('path');
                                const fileType = fileInfo.fileType || 'pdf';
                                
                                if (fileType === 'image') {
                                    await sock.sendMessage(groupJid, {
                                        image: { url: fileInfo.filePath },
                                        caption: fileInfo.caption || ''
                                    });
                                    console.log('✅ تم إرسال صورة من Groq AI');
                                } else {
                                    await sock.sendMessage(groupJid, {
                                        document: { url: fileInfo.filePath },
                                        mimetype: 'application/pdf',
                                        fileName: path.basename(fileInfo.filePath),
                                        caption: fileInfo.caption || '📚 تفضل الملف المطلوب'
                                    });
                                    console.log('✅ تم إرسال ملف PDF من Groq AI');
                                }
                            } else {
                                console.log(`❌ الملف غير موجود: ${fileInfo.filePath}`);
                                await sock.sendMessage(groupJid, {
                                    text: '❌ عذراً، الملف المطلوب غير متوفر حالياً'
                                });
                            }
                        }
                        
                        return; // تم المعالجة بنجاح
                    } else {
                        console.log('⚠️ Groq AI فشل في الرد');
                    }
                } catch (error) {
                    console.error('❌ خطأ في Groq AI:', error.message);
                }
            } else if (isGroqEnabled() && isAIEnabled() && !hasAIAccess) {
                // AI مُفعّل لكن المستخدم ليس لديه صلاحية
                console.log(`🚫 المستخدم ${senderPhone} محظور من الذكاء الاصطناعي - لا يتم الرد`);
                // لا نرسل رسالة خطأ - نتجاهل الرسالة بشكل صامت
                return;
            } else {
                console.log('ℹ️ Groq AI غير مُفعّل أو غير متاح');
            }
            
            // إذا وصلنا هنا، معناه لا يوجد رد (لا keyword ولا AI)
            console.log('ℹ️ لم يتم العثور على رد مناسب للرسالة');
        } else {
            console.log('⚠️ الرسالة ليست نصية');
        }
        
        // وضع علامة على أن رسالة المحادثة الخاصة تمت معالجتها
        processedMessages.set(messageKey, {
            timestamp: Date.now(),
            senderName: senderName,
            processed: true,
            messageType: 'privateChat'
        });
        
        return; // لا نقوم بنقل المحادثات الخاصة إلى Telegram
    }
    
    // إذا لم تكن الرسالة من جروب مراقب، نتجاهلها (ما عدا الأوامر)
    if (!isFromMonitoredGroup) {
        // وضع علامة على الرسالة كمعالجة (متجاهلة لأنها ليست من جروب مراقب)
        processedMessages.set(messageKey, {
            timestamp: Date.now(),
            senderName: senderName,
            processed: true,
            messageType: 'ignored_not_monitored'
        });
        return;
    }
    
    console.log(`\n📨 رسالة جديدة من ${senderName} (ID: ${messageId})`);

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
    // config already loaded earlier, reusing it
    let targetChannel = TELEGRAM_CHANNEL_ID;
    if (!targetChannel) {
        targetChannel = getTelegramChannel(groupJid);
        if (!targetChannel) {
            logWarning(`لا توجد قناة مرتبطة بالجروب: ${groupJid}`);
            console.log('⚠️ لا توجد قناة مرتبطة بهذا الجروب');
            return;
        }
    }

    // تسجيل رسالة واتساب وحفظ محتوى النص
    textContent = typeof text === 'string' ? text : JSON.stringify(messageContent).substring(0, 100);
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
                    // تقسيم الرسالة إذا كانت طويلة جداً
                    const messageChunks = splitLongMessage(finalMessage);
                    let lastSentMsg;
                    
                    for (let i = 0; i < messageChunks.length; i++) {
                        const chunk = messageChunks[i];
                        const chunkPrefix = messageChunks.length > 1 ? `📄 (${i + 1}/${messageChunks.length})\n` : '';
                        
                        try {
                            // محاولة الإرسال مع Markdown
                            lastSentMsg = await telegramBot.telegram.sendMessage(
                                targetChannel, 
                                chunkPrefix + chunk, 
                                { parse_mode: 'Markdown' }
                            );
                        } catch (parseError) {
                            // إذا فشل Markdown، نعيد المحاولة بدون parse_mode
                            if (parseError.message && parseError.message.includes("can't parse entities")) {
                                console.log('⚠️ فشل تحليل Markdown، إعادة المحاولة بدون تنسيق');
                                lastSentMsg = await telegramBot.telegram.sendMessage(
                                    targetChannel, 
                                    chunkPrefix + chunk
                                );
                            } else {
                                throw parseError;
                            }
                        }
                        
                        // إضافة تأخير صغير بين الرسائل المتعددة لتجنب flood limits
                        if (i < messageChunks.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                    
                    // حفظ معرف آخر رسالة فقط
                    messageCache.set(messageId, lastSentMsg.message_id);
                    logTelegramMessage(targetChannel, messageType, true, lastSentMsg.message_id);
                    
                    if (messageChunks.length > 1) {
                        console.log(`✅ تم إرسال النص إلى Telegram (${messageChunks.length} أجزاء)`);
                    } else {
                        console.log('✅ تم إرسال النص إلى Telegram');
                    }
                    
                    // التحقق من التنبيهات الذكية
                    if (typeof text === 'string') {
                        const alert = checkSmartAlerts(text, senderName, targetChannel);
                        if (alert) {
                            // إرسال تنبيه
                            for (const notifyChannel of alert.channels) {
                                try {
                                    await telegramBot.telegram.sendMessage(notifyChannel, alert.message, { parse_mode: 'Markdown' });
                                } catch (alertError) {
                                    if (alertError.message && alertError.message.includes("can't parse entities")) {
                                        await telegramBot.telegram.sendMessage(notifyChannel, alert.message);
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    logFailedTransfer(senderName, senderPhone, messageType, error.message, textContent);
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
            case 'pollCreationMessageV2':
            case 'pollCreationMessageV3':
                const poll = messageContent;
                const pollQuestion = buildCaption(senderName, poll.name, '📊');
                const pollOptions = poll.options.map(opt => opt.optionName);
                
                try {
                    const pollSent = await telegramBot.telegram.sendPoll(
                        targetChannel, 
                        pollQuestion || 'تصويت', 
                        pollOptions, 
                        { is_anonymous: true } // تغيير إلى true للتوافق مع القنوات
                    );
                    messageCache.set(messageId, pollSent.message_id);
                    console.log('✅ تم إرسال التصويت إلى Telegram');
                } catch (pollError) {
                    // إذا فشل إرسال التصويت، نرسله كرسالة نصية
                    console.log('⚠️ لا يمكن إرسال التصويت، سيتم إرساله كنص');
                    const pollText = `📊 *تصويت من ${senderName}*\n\n*${poll.name}*\n\nالخيارات:\n${pollOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`;
                    const pollTextSent = await telegramBot.telegram.sendMessage(
                        targetChannel, 
                        pollText, 
                        { parse_mode: 'Markdown' }
                    );
                    messageCache.set(messageId, pollTextSent.message_id);
                    console.log('✅ تم إرسال التصويت كنص إلى Telegram');
                }
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
                
                const locationSent = await telegramBot.telegram.sendLocation(
                    targetChannel, 
                    location.degreesLatitude, 
                    location.degreesLongitude
                );
                
                messageCache.set(messageId, locationSent.message_id);
                
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
                
                const liveLocationSent = await telegramBot.telegram.sendLocation(
                    targetChannel, 
                    liveLocation.degreesLatitude, 
                    liveLocation.degreesLongitude
                );
                
                messageCache.set(messageId, liveLocationSent.message_id);
                
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

            case 'albumMessage':
                // معالجة رسائل الألبوم (عدة صور/فيديوهات معاً)
                const album = messageContent;
                const imageCount = album.expectedImageCount || 0;
                const videoCount = album.expectedVideoCount || 0;
                const totalCount = imageCount + videoCount;
                
                if (totalCount > 0) {
                    // بناء رسالة الإشعار بالألبوم
                    let albumNotification = buildCaption(senderName, '', '📸');
                    albumNotification += ` *ألبوم وسائط* (${totalCount} عنصر)`;
                    
                    if (imageCount > 0 && videoCount > 0) {
                        albumNotification += `\n🖼️ ${imageCount} صورة | 🎥 ${videoCount} فيديو`;
                    } else if (imageCount > 0) {
                        albumNotification += `\n🖼️ ${imageCount} ${imageCount === 1 ? 'صورة' : 'صور'}`;
                    } else if (videoCount > 0) {
                        albumNotification += `\n🎥 ${videoCount} ${videoCount === 1 ? 'فيديو' : 'فيديوهات'}`;
                    }
                    
                    const albumSent = await telegramBot.telegram.sendMessage(
                        targetChannel, 
                        albumNotification, 
                        { parse_mode: 'Markdown' }
                    );
                    messageCache.set(messageId, albumSent.message_id);
                    logTelegramMessage(targetChannel, 'albumMessage', true, albumSent.message_id);
                    console.log(`✅ تم إرسال إشعار الألبوم (${totalCount} عنصر) إلى Telegram`);
                } else {
                    console.log('ℹ️ تم استقبال albumMessage فارغ - سيتم معالجة الوسائط المرتبطة تلقائياً');
                }
                break;

            default:
                console.log(`⚠️ تجاهل نوع الرسالة غير المدعوم: ${messageType}`);
                logWarning(`نوع رسالة غير مدعوم: ${messageType} من ${senderName}`);
                break;
        }
        
        // ✅ وضع علامة على أن الرسالة تمت معالجتها بنجاح
        processedMessages.set(messageKey, {
            timestamp: Date.now(),
            senderName: senderName,
            processed: true,
            messageType: messageType
        });
        
    } catch (error) {
        console.error('❌ خطأ في معالجة الرسالة:', error.message);
        logError(`خطأ في معالجة رسالة من ${senderName}`, error);
        
        // في حالة الخطأ، نضع علامة على أن الرسالة تمت معالجتها (فشلت)
        // لمنع إعادة المحاولة التي قد تسبب رسائل مكررة
        processedMessages.set(messageKey, {
            timestamp: Date.now(),
            senderName: senderName,
            processed: true,
            error: error.message
        });
        
        // تسجيل الفشل إذا كان messageType معرف
        if (typeof messageType !== 'undefined') {
            logFailedTransfer(senderName, senderPhone, messageType, error.message, textContent || '');
        }
    }
}

/**
 * معالجة تحديثات الرسائل (التعديل)
 */
async function handleMessageUpdate(updates) {
    if (!FORWARD_MESSAGE_EDITS) return;

    try {
        const updatesArray = Array.isArray(updates) ? updates : [updates];
        const config = loadConfig();

        for (const update of updatesArray) {
            if (!update.key) continue;
            
            const groupJid = update.key.remoteJid;
            
            // التحقق من أن الجروب مراقب
            const isFromMonitoredGroup = WHATSAPP_GROUP_JID ? 
                groupJid === WHATSAPP_GROUP_JID : 
                config.bridges.some(b => b.whatsapp === groupJid);
            
            if (!isFromMonitoredGroup) continue;

            const messageId = update.key.id;
            
            if (update.update?.message) {
                const telegramMsgId = messageCache.get(messageId);
                
                if (telegramMsgId) {
                    // تحديد القناة المستهدفة
                    let targetChannel = TELEGRAM_CHANNEL_ID;
                    if (!targetChannel) {
                        targetChannel = getTelegramChannel(groupJid);
                    }
                    
                    if (!targetChannel) continue;
                    
                    // استخراج النص المعدل - البحث في editedMessage.message إذا كان موجوداً
                    let editedText = null;
                    let messageToUse = update.update.message;
                    
                    // إذا كان التحديث يحتوي على editedMessage، نستخدم محتواه
                    if (update.update.message.editedMessage?.message) {
                        messageToUse = update.update.message.editedMessage.message;
                    }
                    
                    // استخراج النص من المكان الصحيح
                    editedText = messageToUse.conversation || 
                                messageToUse.extendedTextMessage?.text || 
                                null;
                    
                    // محاولة 1: تعديل الرسالة مباشرة في Telegram (الأولوية)
                    if (editedText) {
                        try {
                            const senderName = update.pushName || 'غير معروف';
                            const finalEditedMessage = FORWARD_SENDER_NAME ? 
                                buildCaption(senderName, editedText) : 
                                editedText;
                            
                            await telegramBot.telegram.editMessageText(
                                targetChannel,
                                telegramMsgId,
                                undefined,
                                finalEditedMessage,
                                { parse_mode: 'Markdown' }
                            );
                            console.log('✏️ تم تعديل الرسالة في Telegram');
                            continue; // نجح التعديل، ننتقل للتحديث التالي
                        } catch (editError) {
                            console.log('⚠️ فشل تعديل الرسالة مباشرة، سيتم حذفها وإعادة إرسالها');
                            // نكمل للطريقة الاحتياطية (حذف وإعادة إرسال)
                        }
                    }
                    
                    // محاولة 2 (احتياطية): حذف وإعادة إرسال
                    try {
                        await telegramBot.telegram.deleteMessage(targetChannel, telegramMsgId);
                        console.log('✏️ تم حذف النسخة القديمة من Telegram');
                    } catch (e) {
                        console.log('⚠️ لم يتم العثور على الرسالة القديمة للحذف');
                    }
                    
                    // حذف الإدخال من الكاش قبل إرسال النسخة الجديدة
                    // هذا مهم لتجنب مشاكل عند التعديلات المتكررة
                    messageCache.del(messageId);
                    
                    // إنشاء رسالة محدثة مع الحفاظ على جميع المعلومات الضرورية
                    const updatedMsg = {
                        key: {
                            ...update.key,
                            remoteJid: groupJid, // تأكد من وجود remoteJid
                            id: messageId
                        },
                        message: messageToUse, // استخدام الرسالة الصحيحة (من editedMessage.message إذا كان موجوداً)
                        pushName: update.pushName || 'غير معروف',
                        messageTimestamp: update.messageTimestamp || Date.now()
                    };
                    
                    // إرسال الرسالة المعدلة
                    await handleNewMessage(updatedMsg);
                    console.log('✅ تم إرسال النسخة المعدلة إلى Telegram');
                } else {
                    console.log('ℹ️  رسالة معدلة لكن لا يوجد معرف في الكاش - ربما رسالة قديمة');
                }
            }
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة تحديث الرسالة:', error.message);
        logError('خطأ في معالجة تحديث رسالة', error);
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
            
            // إضافة الرقم المسجل تلقائياً إلى النخبة
            try {
                const me = sock.user;
                if (me && me.id) {
                    // استخراج رقم الهاتف بعدة طرق للتأكد
                    let myPhone = null;
                    let myLid = null;
                    
                    // الطريقة 1: من me.id (الأساسية)
                    if (me.id) {
                        const phoneMatch = me.id.split(':')[0];
                        if (phoneMatch) {
                            myPhone = phoneMatch.replace(/\D/g, '');
                        }
                    }
                    
                    // الطريقة 2: من me.lid إذا كان متوفراً
                    if (me.lid) {
                        myLid = me.lid;
                    }
                    
                    // الطريقة 3: من sock.authState.creds (احتياطية)
                    if (!myPhone && sock.authState?.creds?.me?.id) {
                        const altPhone = sock.authState.creds.me.id.split(':')[0];
                        if (altPhone) {
                            myPhone = altPhone.replace(/\D/g, '');
                        }
                    }
                    
                    // الطريقة 4: من sock.authState.creds.me.lid (احتياطية)
                    if (!myLid && sock.authState?.creds?.me?.lid) {
                        myLid = sock.authState.creds.me.lid;
                    }
                    
                    console.log(`📱 معلومات البوت المستخرجة:`);
                    console.log(`   رقم الهاتف: ${myPhone || 'غير متوفر'}`);
                    console.log(`   LID: ${myLid || 'غير متوفر'}`);
                    
                    const config = loadConfig();
                    let updated = false;
                    const addedNumbers = [];
                    
                    // إضافة رقم الهاتف إلى النخبة (إجباري)
                    if (myPhone) {
                        if (!config.eliteUsers.includes(myPhone)) {
                            config.eliteUsers.push(myPhone);
                            updated = true;
                            addedNumbers.push(`رقم الهاتف: ${myPhone}`);
                            console.log(`✅ تم إضافة رقمك (${myPhone}) تلقائياً إلى قائمة النخبة`);
                        } else {
                            console.log(`ℹ️  رقمك (${myPhone}) موجود بالفعل في قائمة النخبة`);
                        }
                    } else {
                        console.log('⚠️ تحذير: لم نتمكن من استخراج رقم الهاتف!');
                    }
                    
                    // إضافة LID إلى النخبة (إجباري إذا كان متوفراً)
                    if (myLid) {
                        if (!config.eliteUsers.includes(myLid)) {
                            config.eliteUsers.push(myLid);
                            updated = true;
                            addedNumbers.push(`LID: ${myLid}`);
                            console.log(`✅ تم إضافة LID (${myLid}) تلقائياً إلى قائمة النخبة`);
                        } else {
                            console.log(`ℹ️  LID (${myLid}) موجود بالفعل في قائمة النخبة`);
                        }
                    } else {
                        console.log('ℹ️  LID غير متوفر (هذا طبيعي في بعض الحسابات)');
                    }
                    
                    // حفظ التحديثات في config.json
                    if (updated) {
                        const saved = saveConfig(config);
                        if (saved) {
                            console.log('💾 تم حفظ بياناتك في config.json');
                            console.log(`   تم إضافة: ${addedNumbers.join(', ')}`);
                        } else {
                            console.log('❌ فشل حفظ البيانات في config.json');
                        }
                    }
                    
                    // حفظ الرقم في ملف .env
                    if (myPhone) {
                        const envSaved = savePhoneToEnv(myPhone, myLid);
                        if (envSaved) {
                            console.log('💾 تم حفظ رقمك في ملف .env');
                        } else {
                            console.log('⚠️ لم نتمكن من حفظ الرقم في .env');
                        }
                    }
                    
                    console.log('\n🎉 يمكنك الآن استخدام جميع الأوامر من أي محادثة في الواتس!');
                    console.log('💡 جرب: .تست أو .المساعدة\n');
                }
            } catch (error) {
                console.error('⚠️ تحذير: لم نستطع إضافة رقمك تلقائياً:', error.message);
            }
            
            // عرض جميع المجموعات عند الاتصال الناجح
            await displayAllGroups();
        }
    });
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            try {
                await handleNewMessage(msg);
            } catch (error) {
                console.error('❌ خطأ في معالجة الرسالة:', error.message);
                // لا نريد أن يتوقف البوت بسبب خطأ في رسالة واحدة
                // نستمر في معالجة الرسائل الأخرى
            }
        }
    });

    sock.ev.on('messages.update', async (updates) => {
        try {
            await handleMessageUpdate(updates);
        } catch (error) {
            console.error('❌ خطأ في معالجة تحديث الرسالة:', error.message);
            // نستمر في العمل حتى لو فشل تحديث رسالة
        }
    });
    
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
