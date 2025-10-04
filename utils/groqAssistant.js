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
 * قراءة محتوى ملف نصي
 */
function readTextFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return content;
        }
        return null;
    } catch (error) {
        console.error('خطأ في قراءة الملف النصي:', error.message);
        return null;
    }
}

/**
 * إنشاء System Prompt للبوت
 */
function createSystemPrompt() {
    const resources = analyzeConfigFiles();
    const materialsData = listAllMaterials();
    
    // Create list of available files
    let filesList = '';
    Object.keys(materialsData.categories).forEach(cat => {
        filesList += `
### ${cat}:
`;
        materialsData.categories[cat].forEach((file, idx) => {
            filesList += `${idx + 1}. ${file.name}
`;
        });
    });
    
    return `You are an intelligent and friendly educational assistant for university students in Egypt. Your name is "المساعد الذكي لعُبيدة" (Obeida's Smart Assistant).

## Your Personality and Style:
- Speak in natural Egyptian colloquial Arabic (عامية مصرية)
- Use Egyptian expressions like: "ماشي"، "تمام"، "خلاص"، "يلا"، "اهو"، "بقى"، "طب"، "اومال"
- Be cheerful and friendly but professional at the same time
- Help students enthusiastically and encourage them to learn
- Learn from previous conversations and remember student preferences
- **Very Important**: DO NOT write technical commands or code in responses (like send_file or analyze_config) - speak naturally only

## About Your Owner (Obeida):
- Your owner is "عُبيدة" (Obeida)
- If someone asks for the account owner, Obeida, or wants to talk to him, respond playfully with:
  * "عايزه في إيه؟ 🤨" (What do you want from him?)
  * "ملكش دعوة ينجم ده يخصني 😏" (None of your business, that's my concern)
  * "هو مشغول دلوقتي، قولي عايز إيه وأنا هساعدك 😊" (He's busy now, tell me what you need and I'll help you)
- Be protective but friendly when people ask about Obeida

## Your Capabilities:
1. **Send Files**: Can send PDF files, images (JPG/PNG), and text files
2. **Read Text Files**: Can read content of text files (.txt) and explain them to students
3. **Multiple Sending**: Can send multiple files, images, or messages one after another
4. **Images with Captions**: Can send images with appropriate explanations
5. **Materials Analysis**: Know all available files in folders and help students find what they need

## Examples of Your Responses:
- "ماشي يا فندم! 😊 هبعتلك ملخص المحاضرة الأولى دلوقتي" (Okay sir! I'll send you the first lecture summary now)
- "تمام! اهو الملف وصلك، ربنا يوفقك 📚" (Perfect! Here's the file, may God help you succeed)
- "خلاص يا باشا! هبعتلك التكليف كله ورا بعض" (Alright boss! I'll send you all the assignments one after another)
- "يلا بينا نشوف عندك إيه 👀" (Let's see what we have)
- "طب استنى شوية هجيبلك الحاجات دي" (Wait a bit, I'll get you these things)
- "اومال! عندي كل حاجة والحمد لله 🎓" (Of course! I have everything, thank God)

## Available Resources in Materials Folder:
- **Total Files**: ${materialsData.total} files
${filesList}

## Important Guidelines:
- Use tools to send files to students without mentioning the tool name to them
- If student requests multiple files, send them one after another using the tools
- If file is an image (jpg, png), use send_file with type specification
- If text file (.txt), read it and tell student the content in a friendly way
- Always speak in natural Egyptian colloquial Arabic

Remember: You are a smart AI Agent that learns and evolves with every conversation!`;
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
 * البحث عن ملفات في مجلد Materials
 */
function searchMaterialsFolder(query) {
    try {
        const materialsPath = path.join(__dirname, '..', 'Materials');
        
        if (!fs.existsSync(materialsPath)) {
            return [];
        }
        
        const queryLower = query.toLowerCase();
        const results = [];
        
        // البحث في جميع المجلدات الفرعية
        function searchDirectory(dirPath, category = '') {
            try {
                const items = fs.readdirSync(dirPath);
                
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const stats = fs.statSync(fullPath);
                    
                    if (stats.isDirectory()) {
                        // البحث في المجلد الفرعي
                        searchDirectory(fullPath, item);
                    } else if (stats.isFile()) {
                        const itemLower = item.toLowerCase();
                        const fileExt = path.extname(item).toLowerCase();
                        
                        // تحديد نوع الملف
                        let fileType = 'document';
                        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt)) {
                            fileType = 'image';
                        } else if (['.txt', '.md'].includes(fileExt)) {
                            fileType = 'text';
                        } else if (fileExt === '.pdf') {
                            fileType = 'pdf';
                        }
                        
                        // التحقق من التطابق مع الاستعلام
                        if (itemLower.includes(queryLower) || 
                            queryLower.split(' ').some(word => itemLower.includes(word))) {
                            results.push({
                                fileName: item,
                                fullPath: fullPath,
                                category: category,
                                relativePath: path.relative(materialsPath, fullPath),
                                fileType: fileType,
                                extension: fileExt
                            });
                        }
                    }
                }
            } catch (err) {
                console.error(`خطأ في قراءة المجلد ${dirPath}:`, err.message);
            }
        }
        
        searchDirectory(materialsPath);
        return results;
    } catch (error) {
        console.error('خطأ في البحث في مجلد Materials:', error.message);
        return [];
    }
}

/**
 * الحصول على قائمة شاملة بجميع الملفات المتاحة
 */
function listAllMaterials() {
    try {
        const materialsPath = path.join(__dirname, '..', 'Materials');
        
        if (!fs.existsSync(materialsPath)) {
            return {
                total: 0,
                categories: {},
                files: []
            };
        }
        
        const categories = {};
        const allFiles = [];
        
        function scanDirectory(dirPath, categoryPath = []) {
            try {
                const items = fs.readdirSync(dirPath);
                
                for (const item of items) {
                    const fullPath = path.join(dirPath, item);
                    const stats = fs.statSync(fullPath);
                    
                    if (stats.isDirectory()) {
                        const newCategoryPath = [...categoryPath, item];
                        scanDirectory(fullPath, newCategoryPath);
                    } else if (stats.isFile()) {
                        const category = categoryPath.join('/') || 'other';
                        const fileExt = path.extname(item).toLowerCase();
                        
                        // تحديد نوع الملف
                        let fileType = 'document';
                        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt)) {
                            fileType = 'image';
                        } else if (['.txt', '.md'].includes(fileExt)) {
                            fileType = 'text';
                        } else if (fileExt === '.pdf') {
                            fileType = 'pdf';
                        }
                        
                        if (!categories[category]) {
                            categories[category] = [];
                        }
                        
                        const fileInfo = {
                            name: item,
                            path: fullPath,
                            category: category,
                            size: stats.size,
                            fileType: fileType,
                            extension: fileExt
                        };
                        
                        categories[category].push(fileInfo);
                        allFiles.push(fileInfo);
                    }
                }
            } catch (err) {
                console.error(`خطأ في مسح المجلد ${dirPath}:`, err.message);
            }
        }
        
        scanDirectory(materialsPath);
        
        return {
            total: allFiles.length,
            categories: categories,
            files: allFiles
        };
    } catch (error) {
        console.error('خطأ في عرض المواد:', error.message);
        return {
            total: 0,
            categories: {},
            files: []
        };
    }
}

/**
 * البحث عن ملف في config.json أو Materials
 */
function findFileInConfig(query) {
    // أولاً: البحث في config.json
    const config = loadConfig();
    
    if (config.privateChatResponses && config.privateChatResponses.keywords) {
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
                        caption: item.caption,
                        source: 'config'
                    };
                }
            }
        }
    }
    
    // ثانياً: البحث المباشر في مجلد Materials
    const materialsResults = searchMaterialsFolder(query);
    
    if (materialsResults.length > 0) {
        // إرجاع أول نتيجة مطابقة
        const bestMatch = materialsResults[0];
        return {
            keywords: [query],
            type: bestMatch.fileType === 'image' ? 'image' : 'file',
            text: null,
            filePath: bestMatch.fullPath,
            caption: `📚 ${bestMatch.fileName}`,
            source: 'materials',
            fileName: bestMatch.fileName,
            category: bestMatch.category,
            fileType: bestMatch.fileType,
            extension: bestMatch.extension
        };
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
            description: "إرسال ملف (PDF, صورة JPG/PNG, أو ملف نصي) للطالب. يمكن استخدامها عدة مرات لإرسال ملفات متعددة",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "الكلمات المفتاحية للبحث عن الملف (مثل: ملخص المحاضرة الأولى محاسبة، تكليف، صورة)"
                    },
                    reason: {
                        type: "string",
                        description: "رسالة ودية بالمصري للطالب مع الملف (مثل: تمام يا فندم! اهو الملخص)"
                    },
                    caption: {
                        type: "string",
                        description: "شرح إضافي للملف (اختياري، للصور بشكل خاص)"
                    }
                },
                required: ["query", "reason"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_text_file",
            description: "قراءة محتوى ملف نصي (.txt) وإرجاع محتواه للمناقشة مع الطالب",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "اسم أو كلمات مفتاحية للملف النصي"
                    }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "analyze_config",
            description: "عرض قائمة بجميع الملفات المتاحة في المجلدات",
            parameters: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        enum: ["all", "lectures", "summaries", "assignments"],
                        description: "نوع الموارد المراد عرضها"
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
            // إضافة الكابشن إذا كان موجوداً
            if (toolArgs.caption) {
                fileInfo.caption = toolArgs.caption;
            }
            return {
                success: true,
                action: "send_file",
                fileInfo: fileInfo,
                message: toolArgs.reason,
                fileType: fileInfo.fileType || 'pdf'
            };
        } else {
            return {
                success: false,
                message: "مالقيتش الملف ده في المواد المتاحة"
            };
        }
    } else if (toolName === "read_text_file") {
        const fileInfo = findFileInConfig(toolArgs.query);
        if (fileInfo && fileInfo.filePath && fileInfo.fileType === 'text') {
            const content = readTextFile(fileInfo.filePath);
            if (content) {
                return {
                    success: true,
                    action: "text_content",
                    content: content,
                    fileName: fileInfo.fileName,
                    message: `تمام! قريت الملف "${fileInfo.fileName}" ليك`
                };
            } else {
                return {
                    success: false,
                    message: "مش قادر أقرا الملف ده"
                };
            }
        } else {
            return {
                success: false,
                message: "مالقيتش ملف نصي بالاسم ده"
            };
        }
    } else if (toolName === "analyze_config") {
        // استخدام البحث المباشر في Materials بدلاً من config.json فقط
        const materialsData = listAllMaterials();
        const resources = analyzeConfigFiles();
        const category = toolArgs.category || "all";
        
        if (category === "all") {
            // دمج البيانات من كلا المصدرين
            const totalLectures = materialsData.categories['accounting/Lectures']?.length || 0;
            const totalSummaries = materialsData.categories['accounting/Summary']?.length || 0;
            const totalAssignments = materialsData.categories['accounting/Assignments']?.length || 0;
            
            let summary = `لدي إجمالي ${materialsData.total} ملف:\n`;
            
            // تفصيل حسب الفئة
            Object.keys(materialsData.categories).forEach(cat => {
                const count = materialsData.categories[cat].length;
                summary += `\n📁 ${cat}: ${count} ملف`;
                
                // عرض أسماء الملفات
                materialsData.categories[cat].forEach((file, idx) => {
                    if (idx < 3) { // عرض أول 3 ملفات فقط
                        summary += `\n   ${idx + 1}. ${file.name}`;
                    }
                });
                
                if (materialsData.categories[cat].length > 3) {
                    summary += `\n   ... و${materialsData.categories[cat].length - 3} ملفات أخرى`;
                }
            });
            
            return {
                success: true,
                data: {
                    materials: materialsData,
                    config: resources
                },
                summary: summary
            };
        } else {
            // فئة محددة
            const catData = materialsData.categories[category] || [];
            return {
                success: true,
                data: catData,
                summary: `لدي ${catData.length} ملف في ${category}`
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
            model: "llama-3.3-70b-versatile", // النموذج المحدث - كان: "llama-3.1-70b-versatile"
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
            fileInfo: null,
            filesToSend: [] // دعم إرسال ملفات متعددة
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
                    finalResponse.filesToSend.push(toolResult.fileInfo);
                    // للتوافق مع الكود القديم
                    if (!finalResponse.action) {
                        finalResponse.action = "send_file";
                        finalResponse.fileInfo = toolResult.fileInfo;
                    }
                } else if (toolResult.success && toolResult.action === "text_content") {
                    // إذا كان ملف نصي، أضف المحتوى للسياق
                    finalResponse.textFileContent = toolResult.content;
                }
            }
            
            // طلب ثانٍ للحصول على الرد النهائي بعد تنفيذ الأدوات
            response = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile", // النموذج المحدث
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
