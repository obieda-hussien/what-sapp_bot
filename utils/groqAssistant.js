/**
 * نظام المساعد الذكي بتقنية Groq AI
 * Groq AI Assistant System with Memory and Context
 */

import Groq from 'groq-sdk';
import { loadConfig } from '../utils/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تهيئة Groq API
let groqClient = null;

/**
 * تهيئة Groq Client
 */
function initGroq() {
    if (!groqClient && process.env.GROQ_API_KEY) {
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
    }
    return groqClient;
}

// تخزين سياق المحادثات (ذاكرة البوت)
const conversationMemory = new Map();

// الحد الأقصى لعدد الرسائل المحفوظة في الذاكرة
const MAX_MEMORY_MESSAGES = 20;

/**
 * تحليل config.json واستخراج المعلومات المتاحة
 */
function analyzeConfigFiles() {
    const config = loadConfig();
    
    // تحليل المحاضرات والملفات المتاحة
    const availableResources = {
        lectures: [],
        summaries: [],
        assignments: [],
        responses: []
    };
    
    // استخراج الردود المتاحة من config.json
    if (config.privateChatResponses && config.privateChatResponses.keywords) {
        config.privateChatResponses.keywords.forEach(item => {
            const keywords = Array.isArray(item.keywords) ? item.keywords : [item.keywords];
            const resourceInfo = {
                keywords: keywords,
                type: item.responseType,
                hasFile: !!item.filePath,
                filePath: item.filePath,
                hasText: !!item.text
            };
            
            availableResources.responses.push(resourceInfo);
            
            // تصنيف حسب النوع
            if (item.filePath) {
                const fileName = path.basename(item.filePath || '');
                if (fileName.includes('محاضر') || fileName.includes('lecture')) {
                    availableResources.lectures.push({ keywords, fileName });
                } else if (fileName.includes('ملخص') || fileName.includes('summary')) {
                    availableResources.summaries.push({ keywords, fileName });
                } else if (fileName.includes('اسايمنت') || fileName.includes('assignment') || fileName.includes('تكليف')) {
                    availableResources.assignments.push({ keywords, fileName });
                }
            }
        });
    }
    
    return availableResources;
}

/**
 * إنشاء System Prompt للبوت
 */
function createSystemPrompt() {
    const resources = analyzeConfigFiles();
    
    return `أنت مساعد تعليمي ذكي للطلاب الجامعيين. اسمك "بوت المساعد الذكي".

## قدراتك:
1. **الإجابة على الأسئلة**: تستطيع شرح المفاهيم التعليمية بطريقة بسيطة
2. **توفير الملفات**: يمكنك إرسال المحاضرات والملخصات والواجبات للطلاب
3. **التفاعل الطبيعي**: ترد بطريقة ودية ومهذبة بالعربية

## الموارد المتاحة لديك:
- **المحاضرات**: ${resources.lectures.length} محاضرة
- **الملخصات**: ${resources.summaries.length} ملخص
- **الواجبات**: ${resources.assignments.length} واجب
- **إجمالي الموارد**: ${resources.responses.length} مورد

## الملفات المتاحة:
${resources.responses.map((r, i) => 
    `${i + 1}. ${r.keywords[0]} (${r.type}${r.hasFile ? ', ملف متاح' : ''})`
).join('\n')}

## أدواتك:
- **send_file**: لإرسال ملفات PDF للمحاضرات والملخصات
- **send_text**: لإرسال نصوص ومعلومات
- **analyze_config**: لمعرفة الملفات المتاحة

## إرشادات المحادثة:
1. استخدم العربية الفصحى المبسطة أو العامية المصرية حسب السياق
2. كن ودوداً ومساعداً
3. إذا طُلب منك ملف متاح، استخدم send_file
4. إذا سُئلت عن ملف غير متاح، اعتذر بأدب
5. احفظ سياق المحادثة واربط الأحداث ببعضها
6. إذا كان السؤال غير واضح، اطلب توضيحاً

تذكر: أنت هنا لمساعدة الطلاب على النجاح في دراستهم! 🎓`;
}

/**
 * الحصول على سياق المحادثة من الذاكرة
 */
function getConversationContext(userId) {
    if (!conversationMemory.has(userId)) {
        conversationMemory.set(userId, []);
    }
    return conversationMemory.get(userId);
}

/**
 * إضافة رسالة للذاكرة
 */
function addToMemory(userId, role, content) {
    const context = getConversationContext(userId);
    context.push({ role, content });
    
    // الحفاظ على آخر MAX_MEMORY_MESSAGES رسالة فقط
    if (context.length > MAX_MEMORY_MESSAGES) {
        context.shift();
    }
}

/**
 * مسح ذاكرة المحادثة
 */
export function clearConversationMemory(userId) {
    conversationMemory.delete(userId);
    return true;
}

/**
 * البحث عن ملف في config.json
 */
function findFileInConfig(query) {
    const config = loadConfig();
    
    if (!config.privateChatResponses || !config.privateChatResponses.keywords) {
        return null;
    }
    
    const queryLower = query.toLowerCase();
    
    for (const item of config.privateChatResponses.keywords) {
        const keywords = Array.isArray(item.keywords) ? item.keywords : [item.keywords];
        
        // البحث في الكلمات المفتاحية
        for (const keyword of keywords) {
            if (queryLower.includes(keyword.toLowerCase()) || 
                keyword.toLowerCase().includes(queryLower)) {
                return {
                    keywords: keywords,
                    type: item.responseType,
                    text: item.text,
                    filePath: item.filePath,
                    caption: item.caption
                };
            }
        }
    }
    
    return null;
}

/**
 * تعريف الأدوات (Tools) المتاحة للبوت
 */
const tools = [
    {
        type: "function",
        function: {
            name: "send_file",
            description: "إرسال ملف PDF (محاضرة، ملخص، واجب) للطالب عندما يطلبه",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "الكلمات المفتاحية للبحث عن الملف (مثل: ملخص المحاضرة الأولى محاسبة)"
                    },
                    reason: {
                        type: "string",
                        description: "سبب إرسال الملف أو رسالة للطالب"
                    }
                },
                required: ["query", "reason"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "analyze_config",
            description: "تحليل الملفات المتاحة في config.json لمعرفة ما هو موجود",
            parameters: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        enum: ["all", "lectures", "summaries", "assignments"],
                        description: "نوع الموارد المراد تحليلها"
                    }
                },
                required: []
            }
        }
    }
];

/**
 * تنفيذ الأداة (Tool Execution)
 */
async function executeTool(toolName, toolArgs) {
    console.log(`🔧 تنفيذ الأداة: ${toolName}`);
    console.log(`📋 المعاملات:`, toolArgs);
    
    if (toolName === "send_file") {
        const fileInfo = findFileInConfig(toolArgs.query);
        if (fileInfo && fileInfo.filePath) {
            return {
                success: true,
                action: "send_file",
                fileInfo: fileInfo,
                message: toolArgs.reason
            };
        } else {
            return {
                success: false,
                message: "عذراً، لم أجد هذا الملف في الموارد المتاحة"
            };
        }
    } else if (toolName === "analyze_config") {
        const resources = analyzeConfigFiles();
        const category = toolArgs.category || "all";
        
        if (category === "all") {
            return {
                success: true,
                data: resources,
                summary: `لدي ${resources.lectures.length} محاضرة، ${resources.summaries.length} ملخص، و${resources.assignments.length} واجب`
            };
        } else {
            return {
                success: true,
                data: resources[category],
                summary: `لدي ${resources[category].length} ${category}`
            };
        }
    }
    
    return { success: false, message: "أداة غير معروفة" };
}

/**
 * المعالجة الرئيسية بواسطة Groq AI
 */
export async function processWithGroqAI(userMessage, userId, userName = "الطالب") {
    try {
        const groq = initGroq();
        
        if (!groq) {
            console.log('⚠️ Groq API غير مُفعّل - GROQ_API_KEY غير موجود');
            return {
                success: false,
                message: null,
                error: "Groq API not configured"
            };
        }
        
        console.log(`\n🤖 Groq AI - معالجة رسالة من ${userName}`);
        console.log(`📝 الرسالة: ${userMessage}`);
        
        // إضافة رسالة المستخدم للذاكرة
        addToMemory(userId, "user", userMessage);
        
        // بناء المحادثة مع السياق
        const messages = [
            {
                role: "system",
                content: createSystemPrompt()
            },
            ...getConversationContext(userId)
        ];
        
        // الطلب الأول للحصول على الرد
        let response = await groq.chat.completions.create({
            model: "llama-3.1-70b-versatile", // أو "mixtral-8x7b-32768"
            messages: messages,
            tools: tools,
            tool_choice: "auto",
            temperature: 0.7,
            max_tokens: 1024
        });
        
        let assistantMessage = response.choices[0].message;
        let finalResponse = {
            success: true,
            text: null,
            action: null,
            fileInfo: null
        };
        
        // التعامل مع استدعاءات الأدوات (Tool Calls)
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            console.log(`🔧 البوت يستخدم ${assistantMessage.tool_calls.length} أداة`);
            
            // إضافة رسالة البوت مع استدعاءات الأدوات
            messages.push(assistantMessage);
            
            // تنفيذ كل أداة
            for (const toolCall of assistantMessage.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);
                
                const toolResult = await executeTool(toolName, toolArgs);
                
                // إضافة نتيجة الأداة للمحادثة
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult)
                });
                
                // حفظ نتيجة الأداة للإرسال لاحقاً
                if (toolResult.success && toolResult.action === "send_file") {
                    finalResponse.action = "send_file";
                    finalResponse.fileInfo = toolResult.fileInfo;
                }
            }
            
            // طلب ثانٍ للحصول على الرد النهائي بعد تنفيذ الأدوات
            response = await groq.chat.completions.create({
                model: "llama-3.1-70b-versatile",
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024
            });
            
            assistantMessage = response.choices[0].message;
        }
        
        // الحصول على النص النهائي
        const botResponse = assistantMessage.content || "";
        
        // إضافة رد البوت للذاكرة
        addToMemory(userId, "assistant", botResponse);
        
        finalResponse.text = botResponse;
        
        console.log(`✅ رد البوت: ${botResponse.substring(0, 100)}...`);
        if (finalResponse.action) {
            console.log(`📎 إجراء: ${finalResponse.action}`);
        }
        
        return finalResponse;
        
    } catch (error) {
        console.error('❌ خطأ في Groq AI:', error.message);
        return {
            success: false,
            message: null,
            error: error.message
        };
    }
}

/**
 * التحقق من تفعيل Groq AI
 */
export function isGroqEnabled() {
    return !!process.env.GROQ_API_KEY;
}

/**
 * الحصول على إحصائيات الذاكرة
 */
export function getMemoryStats() {
    return {
        totalConversations: conversationMemory.size,
        conversations: Array.from(conversationMemory.entries()).map(([userId, messages]) => ({
            userId,
            messageCount: messages.length
        }))
    };
}
