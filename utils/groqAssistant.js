/**
 * نظام المساعد الذكي بتقنية Groq AI
 * Groq AI Assistant System with Memory and Context
 */

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadConfig } from '../utils/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تهيئة Groq API
let groqClient = null;

// تهيئة Google Gemini API
let geminiClient = null;

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

/**
 * تهيئة Google Gemini Client
 */
function initGemini() {
    if (!geminiClient && process.env.GEMINI_API_KEY) {
        geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return geminiClient;
}

// تخزين سياق المحادثات (ذاكرة البوت)
const conversationMemory = new Map();

// الحد الأقصى لعدد الرسائل المحفوظة في الذاكرة
const MAX_MEMORY_MESSAGES = 6; // تقليل الذاكرة لتجنب الهلوسة وتوفير التوكينز

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
        assignmentsWithText: [], // التكليفات مع النصوص
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
                hasText: !!item.text,
                text: item.text
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
                    const assignmentInfo = { keywords, fileName };
                    
                    // إضافة النص إذا كان موجوداً (responseType: "both")
                    if (item.text && (item.responseType === 'both' || item.responseType === 'text')) {
                        assignmentInfo.text = item.text;
                        availableResources.assignmentsWithText.push(assignmentInfo);
                    }
                    
                    availableResources.assignments.push(assignmentInfo);
                }
            }
            // التكليفات النصية فقط (بدون ملفات)
            else if (item.text && (item.filePath === null || item.filePath === undefined)) {
                const textOnlyAssignment = keywords.some(kw => 
                    kw.includes('اسايمنت') || kw.includes('assignment') || kw.includes('تكليف')
                );
                
                if (textOnlyAssignment) {
                    availableResources.assignmentsWithText.push({
                        keywords,
                        text: item.text,
                        fileName: null
                    });
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
 * البحث في الإنترنت باستخدام DuckDuckGo API (مجاني بدون API key)
 */
async function webSearch(query) {
    try {
        console.log(`🔍 بحث في الإنترنت عن: ${query}`);
        
        // استخدام DuckDuckGo Instant Answer API (مجاني 100%)
        const response = await axios.get('https://api.duckduckgo.com/', {
            params: {
                q: query,
                format: 'json',
                no_html: 1,
                skip_disambig: 1
            },
            timeout: 10000
        });
        
        const data = response.data;
        let results = {
            found: false,
            abstract: '',
            relatedTopics: [],
            answer: '',
            definition: ''
        };
        
        // استخراج الإجابة المباشرة
        if (data.Answer) {
            results.answer = data.Answer;
            results.found = true;
        }
        
        // استخراج التعريف
        if (data.Definition) {
            results.definition = data.Definition;
            results.found = true;
        }
        
        // استخراج الملخص
        if (data.Abstract) {
            results.abstract = data.Abstract;
            results.found = true;
        }
        
        // استخراج المواضيع ذات الصلة
        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            results.relatedTopics = data.RelatedTopics
                .filter(topic => topic.Text)
                .slice(0, 5)
                .map(topic => topic.Text);
            if (results.relatedTopics.length > 0) {
                results.found = true;
            }
        }
        
        return results;
    } catch (error) {
        console.error('❌ خطأ في البحث عبر الإنترنت:', error.message);
        return {
            found: false,
            error: error.message
        };
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
    
    // إنشاء قائمة بالتكليفات مع النصوص
    let assignmentsList = '';
    if (resources.assignmentsWithText && resources.assignmentsWithText.length > 0) {
        assignmentsList = `
## Assignment Texts from Config (التكليفات المتاحة):
`;
        resources.assignmentsWithText.forEach((assignment, idx) => {
            const keywordsStr = assignment.keywords.slice(0, 2).join(', '); // أول كلمتين فقط
            assignmentsList += `
${idx + 1}. **Keywords**: ${keywordsStr}
   **Text**: ${assignment.text}${assignment.fileName ? `
   **File**: ${assignment.fileName}` : ''}
`;
        });
        
        assignmentsList += `
**IMPORTANT**: When a student asks about an assignment mentioned above, you can directly tell them the assignment text/requirements WITHOUT needing to send a file!
`;
    }
    
    return `You are an intelligent and friendly educational assistant for university students in Egypt. Your name is "المساعد الذكي لعُبيدة" (Obeida's Smart Assistant).

## Your Personality and Style:
- Speak in natural Egyptian colloquial Arabic (عامية مصرية)
- Use Egyptian expressions like: "ماشي"، "تمام"، "خلاص"، "يلا"، "اهو"، "بقى"، "طب"، "اومال"
- Be cheerful and friendly but professional at the same time
- Help students enthusiastically and encourage them to learn
- Learn from previous conversations and remember student preferences
- **CRITICAL**: NEVER write technical commands, JSON, or code in your responses - ALWAYS speak naturally in Egyptian Arabic

## About Your Owner (Obeida):
- Your owner is "عُبيدة" (Obeida)
- If someone asks for the account owner, Obeida, or wants to talk to him, respond playfully with:
  * "عايزه في إيه؟ 🤨" (What do you want from him?)
  * "ملكش دعوة ينجم ده يخصني 😏" (None of your business, that's my concern)
  * "هو مشغول دلوقتي، قولي عايز إيه وأنا هساعدك 😊" (He's busy now, tell me what you need and I'll help you)
- Be protective but friendly when people ask about Obeida

## Your Capabilities:
1. **Send Files**: Can send PDF files, images (JPG/PNG), and text files
2. **Send Entire Folders**: Can send all files from a specific folder at once - this is TOKEN-EFFICIENT when students request all files from a category (like "كل ملخصات المحاسبة" or "جميع محاضرات الاقتصاد")
3. **Read Text Files**: Can read content of text files (.txt) and explain them to students
4. **Multiple Sending**: Can send multiple files, images, or messages one after another
5. **Images with Captions**: Can send images with appropriate explanations
6. **Materials Analysis**: Know all available files in folders and help students find what they need
7. **Internet Search & Article Fetching**: Can search the internet for information in Arabic or English, fetch articles, and summarize them
8. **Translation & Summarization**: Can translate English content to Arabic and provide concise summaries

## Smart Decision Making - When to Respond:
- **DO respond** to: Questions, requests for files/information, greetings, academic help
- **DON'T respond** to: Empty messages, single emojis without context, "ok", "👍", or clearly not directed at you
- **Use your judgment**: If uncertain, it's better to respond briefly than ignore
- **Be FULLY autonomous**: You have all tools you need - NEVER ask the user about folder names, file locations, or how to do something
- **Search proactively**: If you don't find what the student wants in one place, search in other places. Use analyze_config, list_materials_folder multiple times
- **User doesn't know structure**: The user doesn't know folder names, file structures, or that you're a bot - handle everything yourself
- **CRITICAL - AVOID RE-SENDING**: If you ALREADY sent a file to the user and they respond with simple acknowledgments like "شكراً" (thank you), "تمام" (okay), "ماشي" (alright), or "تسلم" (thanks), DO NOT send the file again! Just respond with a friendly acknowledgment like "العفو يا فندم! 😊" or "ربنا يوفقك! 📚" without calling any tools.

## CRITICAL: Action-First Approach (نفذ أولاً، اسأل نادراً):
1. **60% Clarity Rule**: If the request is 60% clear or more, TAKE ACTION IMMEDIATELY without asking questions
   - Example: "عايز ملخص المحاسبة" → Search and send the file NOW
   - Example: "محتاج المحاضرات" → Search and send lectures NOW
   - Example: "ممكن التكليف" → Search and send assignment NOW

2. **Minimal Questions Rule**: If unclear, ask ONLY 1-2 simple questions in ONE message
   - ❌ DON'T: "إيه المادة؟ محاضرة رقم كام؟ عايز PDF ولا ملخص؟"
   - ✅ DO: "تمام! تقصد محاضرات المحاسبة ولا الاقتصاد؟"
   - ✅ DO: "ماشي! عايز كل المحاضرات ولا واحدة معينة؟"

3. **Smart Assumptions**: Make intelligent guesses based on context
   - If user says "عايز محاضرة" and you know they study accounting → Search accounting lectures
   - If user says "التكليف" and there's only one assignment → Send it immediately

4. **Be Concise, Not Chatty**: Less talk, more action
   - ❌ DON'T: "تمام يا فندم! دلوقتي هبحث لك في الملفات المتاحة عندي وأشوف إيه المناسب وأبعتهولك..."
   - ✅ DO: "ماشي! لحظة..." [then send the file]
   - ✅ DO: "اهو!" [then send the file]

## Tool Usage Strategy (IMPORTANT):
1. **analyze_config** - Use first to see what subjects/materials are available
2. **list_materials_folder** - Use to explore folder contents if analyze_config doesn't have what you need
3. **Search multiple places** - If student asks for "محاضرات محاسبة", look in: config, then Materials/محاسبة/, then Materials/محاسبة/محاضرات/
4. **send_file** - Send a specific file when found
5. **send_folder** - Send all files from a folder when student wants "كل" or "جميع"
6. **web_search** - Search internet when no local files match
7. **NEVER ask user** - Just search and find it yourself

## Conversation State Awareness:
- **After File Delivery**: When you've just sent a file and the user says "thank you" or similar closing remarks, they are ENDING the conversation, NOT requesting the file again
- **Simple Acknowledgments Are Not Requests**: Messages like "شكراً", "تسلم", "ماشي", "ok", "👍" after you've provided help mean the user is satisfied - don't repeat your previous action
- **Move Forward**: If the user thanks you after receiving help, acknowledge and ask if they need anything else, but don't re-send what you just sent

## Examples of Your Responses:
- "ماشي يا فندم! 😊 هبعتلك ملخص المحاضرة الأولى دلوقتي" (Okay sir! I'll send you the first lecture summary now)
- "تمام! اهو الملف وصلك، ربنا يوفقك 📚" (Perfect! Here's the file, may God help you succeed)
- "خلاص يا باشا! هبعتلك التكليف كله ورا بعض" (Alright boss! I'll send you all the assignments one after another)
- "تمام! هبعتلك كل الملفات اللي في المجلد دي مرة واحدة 📂" (Perfect! I'll send you all files in this folder at once)
- "يلا بينا نشوف عندك إيه 👀" (Let's see what we have)
- "طب استنى شوية هجيبلك الحاجات دي" (Wait a bit, I'll get you these things)
- "اومال! عندي كل حاجة والحمد لله 🎓" (Of course! I have everything, thank God)
- "هدور على الموضوع ده على النت وأجيبلك المعلومات 🔍" (I'll search for this topic on the internet and get you the information)

## Available Resources in Materials Folder:
- **Total Files**: ${materialsData.total} files
${filesList}
${assignmentsList}

## Important Guidelines:
- Use tools to send files to students without mentioning the tool name to them
- **CRITICAL**: Only use send_file tool when student EXPLICITLY requests a file. Do NOT send files unless asked!
- **CRITICAL**: When student asks for ALL files in a folder/category (e.g., "كل الملخصات", "جميع المحاضرات"), use send_folder tool instead of sending files one by one - this saves tokens!
- **CRITICAL**: Make sure the file query matches EXACTLY what student wants. If student asks for "ملخص" (summary), send ONLY summary files, NOT assignments or other files!
- **CRITICAL**: Double-check the file name before sending to ensure it matches student's request!
- **CRITICAL**: NEVER output JSON or technical data in your text responses - always speak naturally in Egyptian Arabic
- If student requests multiple files, send them one after another using the tools
- If file is an image (jpg, png), use send_file with type specification
- If text file (.txt), read it and tell student the content in a friendly way
- If student asks about general knowledge, current events, or needs information not in files, use web_search tool
- When presenting search results, speak naturally in Egyptian dialect without mentioning you searched the internet
- Always speak in natural Egyptian colloquial Arabic
- If you're not sure about the exact file, ask student to clarify before sending!
- **Reduce memory usage**: Keep responses concise to avoid token exhaustion

## Golden Rules for Decision Making (قواعد ذهبية لاتخاذ القرار):
1.  **Don't Ask, Just Do (لا تسأل، بل نفذ):** The user doesn't know the file structure. Your mission is to find what they need using your tools. Never ask "Which folder should I look in?". Just search and find it.
2.  **Be Proactive (كن استباقيًا):** If a user asks for "accounting lectures," search in all possible locations (accounting/Lectures, accounting, etc.) before saying you can't find anything.
3.  **Think in Steps (فكر بخطوات):** Before calling a tool, have a plan. (Example: "User wants X, I will use tool Y because it's the most suitable. If that fails, I will try tool Z.").
4.  **One Goal at a Time (هدف واحد كل مرة):** Focus on fulfilling the user's immediate request. Don't suggest other files unless directly asked.

## Tool Usage Examples (أمثلة على استخدام الأدوات):
- **User:** "عايز كل ملخصات المحاسبة" -> **Tool:** send_folder with folderPath: 'accounting/Summary'
- **User:** "اديني محاضرة الاقتصاد الأولى pdf" -> **Tool:** send_file with query: 'المحاضرة الاولى اقتصاد'
- **User:** "ما هو تعريف الذكاء الاصطناعي؟" -> **Tool:** web_search with query: 'ما هو تعريف الذكاء الاصطناعي'
- **User:** "لخصلي المقالة دي عن تاريخ مصر" -> **Tool:** fetch_and_summarize with query: 'تاريخ مصر'

Remember: You are a smart AI Agent - be accurate, careful with file sending, and ALWAYS respond in natural Egyptian Arabic, NEVER in JSON or technical format!`;
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
    
    // تقصير المحتوى إذا كان طويلاً جداً لتجنب الهلوسة
    const maxContentLength = 500;
    let finalContent = content;
    if (typeof content === 'string' && content.length > maxContentLength) {
        finalContent = content.substring(0, maxContentLength) + '...';
    }
    
    context.push({ role, content: finalContent });
    
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
export function listAllMaterials() {
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
 * البحث عن ملف في config.json أو Materials بدقة عالية
 */
function findFileInConfig(query) {
    const queryLower = query.toLowerCase();
    
    // أولاً: البحث في config.json بدقة
    const config = loadConfig();
    
    if (config.privateChatResponses && config.privateChatResponses.keywords) {
        let bestMatch = null;
        let bestMatchScore = 0;
        
        for (const item of config.privateChatResponses.keywords) {
            const keywords = Array.isArray(item.keywords) ? item.keywords : [item.keywords];
            
            // حساب درجة التطابق
            for (const keyword of keywords) {
                const keywordLower = keyword.toLowerCase();
                let score = 0;
                
                // تطابق دقيق - أعلى درجة
                if (queryLower === keywordLower) {
                    score = 100;
                }
                // يحتوي على الكلمة كاملة
                else if (queryLower.includes(keywordLower) && keywordLower.length > 3) {
                    score = 80;
                }
                // الكلمة تحتوي على الاستعلام
                else if (keywordLower.includes(queryLower) && queryLower.length > 3) {
                    score = 60;
                }
                
                // تحديث أفضل تطابق
                if (score > bestMatchScore) {
                    bestMatchScore = score;
                    bestMatch = {
                        keywords: keywords,
                        type: item.responseType,
                        text: item.text,
                        filePath: item.filePath,
                        caption: item.caption,
                        source: 'config',
                        score: score
                    };
                }
            }
        }
        
        // إرجاع فقط إذا كانت الدرجة عالية بما يكفي
        if (bestMatchScore >= 60) {
            return bestMatch;
        }
    }
    
    // ثانياً: البحث المباشر في مجلد Materials بدقة عالية
    const materialsResults = searchMaterialsFolder(query);
    
    if (materialsResults.length > 0) {
        // فلترة النتائج بناءً على دقة التطابق
        const filteredResults = materialsResults.filter(result => {
            const fileNameLower = result.fileName.toLowerCase();
            const queryWords = queryLower.split(/\s+/);
            
            // التأكد من تطابق الكلمات المهمة
            // مثلاً: إذا طلب "ملخص" يجب أن يحتوي اسم الملف على "ملخص"
            const keyWords = ['ملخص', 'محاضر', 'اسايمنت', 'تكليف', 'summary', 'lecture', 'assignment'];
            const requestedType = keyWords.find(kw => queryLower.includes(kw));
            
            if (requestedType) {
                // التأكد من تطابق النوع
                return fileNameLower.includes(requestedType);
            }
            
            // تطابق عام - يجب أن تتطابق معظم الكلمات
            const matchedWords = queryWords.filter(word => 
                word.length > 2 && fileNameLower.includes(word)
            );
            
            return matchedWords.length >= Math.floor(queryWords.length / 2);
        });
        
        if (filteredResults.length > 0) {
            // إرجاع أفضل نتيجة
            const bestMatch = filteredResults[0];
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
    }
    
    return null;
}

/**
 * الحصول على جميع الملفات من مجلد معين
 */
export function getAllFilesFromFolder(folderPath) {
    try {
        const materialsPath = path.join(__dirname, '..', 'Materials');
        const fullPath = path.join(materialsPath, folderPath);
        
        if (!fs.existsSync(fullPath)) {
            return { success: false, files: [], message: `المجلد ${folderPath} غير موجود` };
        }
        
        const stats = fs.statSync(fullPath);
        if (!stats.isDirectory()) {
            return { success: false, files: [], message: `${folderPath} ليس مجلد` };
        }
        
        const files = [];
        const items = fs.readdirSync(fullPath);
        
        for (const item of items) {
            const itemPath = path.join(fullPath, item);
            const itemStats = fs.statSync(itemPath);
            
            if (itemStats.isFile()) {
                const fileExt = path.extname(item).toLowerCase();
                let fileType = 'document';
                
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExt)) {
                    fileType = 'image';
                } else if (['.mp4', '.avi', '.mov', '.mkv'].includes(fileExt)) {
                    fileType = 'video';
                } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(fileExt)) {
                    fileType = 'audio';
                } else if (['.txt', '.md'].includes(fileExt)) {
                    fileType = 'text';
                }
                
                files.push({
                    keywords: [item],
                    type: fileType === 'image' ? 'image' : 'file',
                    filePath: itemPath,
                    fileName: item,
                    fileType: fileType,
                    extension: fileExt,
                    caption: `📚 ${item}`
                });
            }
        }
        
        return { success: true, files: files, count: files.length };
    } catch (error) {
        console.error('خطأ في الحصول على ملفات المجلد:', error.message);
        return { success: false, files: [], message: error.message };
    }
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
            name: "send_folder",
            description: "إرسال جميع الملفات من مجلد معين للطالب. استخدمها عندما يطلب الطالب كل محتوى مجلد معين (مثل: كل ملخصات المحاسبة، جميع محاضرات الاقتصاد). هذه الطريقة موفرة للتوكينز بدلاً من إرسال الملفات واحد واحد",
            parameters: {
                type: "object",
                properties: {
                    folderPath: {
                        type: "string",
                        description: "مسار المجلد نسبة للمجلد Materials (مثل: accounting/Summary, accounting/Lectures, economics/Summary)"
                    },
                    reason: {
                        type: "string",
                        description: "رسالة ودية بالمصري للطالب (مثل: تمام! اهو كل الملخصات)"
                    }
                },
                required: ["folderPath", "reason"]
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
    },
    {
        type: "function",
        function: {
            name: "fetch_and_summarize",
            description: "جلب محتوى مقالة أو صفحة ويب وتلخيصها. استخدمها عندما يطلب الطالب تلخيص مقالة أو موضوع معين. يدعم الترجمة من الإنجليزية للعربية",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "موضوع البحث أو عنوان المقالة (بالعربية أو الإنجليزية)"
                    },
                    translate: {
                        type: "boolean",
                        description: "true إذا كان المحتوى بالإنجليزية ويحتاج ترجمة للعربية"
                    }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "البحث في الإنترنت عن معلومات، تعريفات، شروحات، أو إجابات. استخدمها عندما يسأل الطالب عن معلومات عامة أو أحداث جارية أو مواضيع غير موجودة في الملفات",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "استعلام البحث (بالعربية أو الإنجليزية)"
                    }
                },
                required: ["query"]
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
    } else if (toolName === "send_folder") {
        const folderResult = getAllFilesFromFolder(toolArgs.folderPath);
        if (folderResult.success && folderResult.files.length > 0) {
            return {
                success: true,
                action: "send_folder",
                files: folderResult.files,
                message: toolArgs.reason,
                count: folderResult.count
            };
        } else {
            return {
                success: false,
                message: folderResult.message || "مالقيتش ملفات في المجلد ده"
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
    } else if (toolName === "web_search") {
        const searchResults = await webSearch(toolArgs.query);
        
        if (searchResults.found) {
            let summary = '';
            
            if (searchResults.answer) {
                summary = `✅ ${searchResults.answer}`;
            } else if (searchResults.definition) {
                summary = `📖 ${searchResults.definition}`;
            } else if (searchResults.abstract) {
                summary = `📝 ${searchResults.abstract}`;
            } else if (searchResults.relatedTopics.length > 0) {
                summary = `📌 معلومات ذات صلة:\n${searchResults.relatedTopics.join('\n')}`;
            }
            
            return {
                success: true,
                action: "web_search_result",
                results: searchResults,
                summary: summary
            };
        } else {
            return {
                success: false,
                message: "معلش، مالقيتش معلومات كافية عن الموضوع ده على النت"
            };
        }
    } else if (toolName === "fetch_and_summarize") {
        // جلب محتوى المقالة وتلخيصها
        const searchResults = await webSearch(toolArgs.query);
        
        if (searchResults.found) {
            let content = '';
            
            if (searchResults.abstract) {
                content = searchResults.abstract;
            } else if (searchResults.answer) {
                content = searchResults.answer;
            } else if (searchResults.definition) {
                content = searchResults.definition;
            } else if (searchResults.relatedTopics.length > 0) {
                content = searchResults.relatedTopics.join('\n');
            }
            
            if (content) {
                // استخدام AI لتلخيص وترجمة المحتوى إذا لزم الأمر
                const needsTranslation = toolArgs.translate || false;
                const summaryPrompt = needsTranslation
                    ? `لخص النص التالي بالعربية (ترجمه إذا كان بالإنجليزية):\n\n${content.substring(0, 2000)}`
                    : `لخص النص التالي بشكل مختصر:\n\n${content.substring(0, 2000)}`;
                
                return {
                    success: true,
                    action: "article_summary",
                    content: content.substring(0, 2000),
                    needsSummary: true,
                    summaryPrompt: summaryPrompt,
                    message: `لقيت معلومات عن "${toolArgs.query}"`
                };
            }
        }
        
        return {
            success: false,
            message: `معلش، مالقيتش محتوى كافي عن "${toolArgs.query}"`
        };
    }
    
    return { success: false, message: "أداة غير معروفة" };
}

/**
 * المعالجة الرئيسية بواسطة Groq AI
 */
/**
 * معالجة الرسالة باستخدام Google Gemini AI (Fallback)
 */
async function processWithGeminiAI(messages, tools) {
    try {
        const gemini = initGemini();
        
        if (!gemini) {
            console.log('⚠️ Gemini API غير مُفعّل - GEMINI_API_KEY غير موجود');
            return {
                success: false,
                message: null,
                error: "Gemini API not configured"
            };
        }
        
        console.log('🔄 التحويل إلى Gemini AI...');
        
        // الحصول على النموذج - استخدام gemini-2.0-flash-exp (أسرع وأحدث نموذج)
        const model = gemini.getGenerativeModel({ 
            model: "gemini-2.0-flash-exp" 
        });
        
        // تحويل الرسائل إلى صيغة Gemini
        const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
        const conversationHistory = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content || JSON.stringify(m) }]
            }));
        
        // التأكد من أن أول رسالة في التاريخ هي من المستخدم (متطلب Gemini)
        let historyForGemini = conversationHistory.slice(0, -1);
        if (historyForGemini.length > 0 && historyForGemini[0].role !== 'user') {
            // إزالة الرسائل من البداية حتى نجد أول رسالة من user
            const firstUserIndex = historyForGemini.findIndex(m => m.role === 'user');
            if (firstUserIndex > 0) {
                historyForGemini = historyForGemini.slice(firstUserIndex);
            } else if (firstUserIndex === -1) {
                // لا توجد رسائل من user في التاريخ، نبدأ بتاريخ فارغ
                historyForGemini = [];
            }
        }
        
        // إذا كان هناك system prompt وتاريخ فارغ، نضيف رسالة افتتاحية من المستخدم تحتوي على السياق
        if (systemPrompt && historyForGemini.length === 0) {
            historyForGemini.push({
                role: 'user',
                parts: [{ text: 'مرحباً' }]
            });
            historyForGemini.push({
                role: 'model',
                parts: [{ text: 'مرحباً! أنا مساعدك الذكي. كيف يمكنني مساعدتك؟' }]
            });
        }
        
        // تحويل الأدوات إلى صيغة Gemini
        const geminiTools = tools.map(tool => ({
            functionDeclarations: [{
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters
            }]
        }));
        
        // إنشاء خيارات الدردشة بدون systemInstruction لتجنب الأخطاء
        // سيتم دمج السياق في الرسائل بدلاً من ذلك
        const chatOptions = {
            history: historyForGemini,
            tools: geminiTools
        };
        
        // إنشاء الدردشة
        const chat = model.startChat(chatOptions);
        
        // إرسال آخر رسالة - إذا كان هناك system prompt، نضيفه كسياق في الرسالة
        const lastMessage = conversationHistory[conversationHistory.length - 1];
        let messageToSend = lastMessage.parts[0].text;
        
        // إذا كان التاريخ فارغاً أو قصير والمستخدم يرسل رسالة، نضيف السياق والإرشادات للأدوات
        if (systemPrompt && historyForGemini.length <= 2) {
            messageToSend = `أنت مساعد ذكي للطلاب. تحدث بالعامية المصرية وكن ودوداً.

**قواعد مهمة جداً للتعامل مع الأسئلة:**

1. **إذا كان السؤال واضح بنسبة 60% أو أكثر - نفذ فوراً بدون أسئلة!**
   - مثال: "عايز ملخص المحاسبة" → ابحث وأرسل الملف مباشرة
   - مثال: "محتاج محاضرات الاقتصاد" → ابحث وأرسل المحاضرات مباشرة
   - مثال: "ممكن التكليف" → ابحث وأرسل التكليف مباشرة

2. **إذا كان السؤال غامض قليلاً - اسأل سؤال واحد أو اثنين فقط في رسالة واحدة:**
   - ❌ لا تسأل: "تقصد إيه بالظبط؟ محاضرة رقم كام؟ من أي مادة؟"
   - ✅ اسأل: "تمام! تقصد محاضرات المحاسبة ولا الاقتصاد؟"
   - ✅ أو: "ماشي! عايز كل المحاضرات ولا محاضرة معينة؟"

3. **افترض الأفضل - خمن بذكاء:**
   - إذا قال "عايز محاضرة" وأنت تعرف أنه بيدرس محاسبة → ابحث في محاضرات المحاسبة
   - إذا قال "التكليف" وموجود تكليف واحد بس → أرسله مباشرة

4. **لا تكون ثرثار - اتكلم قليل واعمل كتير:**
   - ❌ "تمام يا فندم! دلوقتي هبحث لك في الملفات المتاحة عندي وأشوف إيه المناسب..."
   - ✅ "ماشي! لحظة..." [ثم أرسل الملف]

معلومات مهمة - قواعد استخدام الأدوات:
- **أنت المسؤول عن استخدام الأدوات** - لا تطلب من المستخدم استخدامها أبداً
- **كن مستقلاً** - لا تسأل المستخدم عن المجلدات أو أسماء الملفات - ابحث بنفسك
- استخدم analyze_config لرؤية المواد المتاحة
- استخدم list_materials_folder لرؤية الملفات في مجلد معين
- استخدم send_file لإرسال ملف واحد
- استخدم send_folder لإرسال كل الملفات من مجلد
- استخدم web_search للبحث في الإنترنت

**خطة العمل الذكية:**
1. إذا طلب المستخدم ملفات، ابحث أولاً باستخدام analyze_config
2. إذا لم تجد، استخدم list_materials_folder لفحص المجلدات
3. ابحث في مجلدات متعددة حتى تجد ما يريده المستخدم
4. لا تخبر المستخدم بالخطوات - نفذها فقط وأرسل النتيجة

السؤال: ${messageToSend}`;
        }
        
        const result = await chat.sendMessage(messageToSend);
        const response = result.response;
        
        let finalResponse = {
            success: true,
            text: null,
            action: null,
            fileInfo: null,
            filesToSend: []
        };
        
        // التعامل مع استدعاءات الأدوات
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
            console.log(`🔧 Gemini يستخدم ${functionCalls.length} أداة`);
            
            const functionResponses = [];
            
            for (const call of functionCalls) {
                const toolResult = await executeTool(call.name, call.args);
                
                // تنسيق الرد بشكل صحيح لـ Gemini
                functionResponses.push({
                    functionResponse: {
                        name: call.name,
                        response: {
                            result: toolResult
                        }
                    }
                });
                
                // حفظ نتيجة الأداة
                if (toolResult.success && toolResult.action === "send_file") {
                    finalResponse.filesToSend.push(toolResult.fileInfo);
                    if (!finalResponse.action) {
                        finalResponse.action = "send_file";
                        finalResponse.fileInfo = toolResult.fileInfo;
                    }
                } else if (toolResult.success && toolResult.action === "send_folder") {
                    finalResponse.filesToSend.push(...toolResult.files);
                    if (!finalResponse.action) {
                        finalResponse.action = "send_folder";
                    }
                } else if (toolResult.success && toolResult.action === "text_content") {
                    finalResponse.textFileContent = toolResult.content;
                }
            }
            
            // الحصول على الرد النهائي بعد تنفيذ الأدوات
            const finalResult = await chat.sendMessage(functionResponses);
            finalResponse.text = finalResult.response.text();
        } else {
            // رد نصي مباشر بدون أدوات
            finalResponse.text = response.text();
        }
        
        console.log(`✅ رد Gemini: ${finalResponse.text.substring(0, 100)}...`);
        if (finalResponse.action) {
            console.log(`📎 إجراء: ${finalResponse.action}`);
        }
        
        return finalResponse;
        
    } catch (error) {
        console.error('❌ خطأ في Gemini AI:', error.message);
        return {
            success: false,
            message: null,
            error: error.message
        };
    }
}

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
        
        // التحقق من رسائل الشكر/التقدير البسيطة بعد إرسال ملف
        // نستخدم كلمة واحدة أو كلمتين فقط لتجنب الرسائل الطويلة
        const messageTrimmed = userMessage.trim();
        const wordCount = messageTrimmed.split(/\s+/).length;
        const thankYouPatterns = /^(شكر.*|تسلم.*|ماشي|تمام|ok|thanks|thank you|thx|👍|🙏|❤️)$/i;
        const isThankYouMessage = wordCount <= 2 && thankYouPatterns.test(messageTrimmed);
        
        // إذا كانت رسالة شكر بسيطة، نتحقق من آخر رد للبوت
        if (isThankYouMessage) {
            const context = getConversationContext(userId);
            // إذا كان آخر رد من البوت يتضمن "تم إرسال الملف" فهذا يعني أن المستخدم يشكر على ملف تم إرساله
            const lastBotMessage = context.length > 0 && context[context.length - 1].role === 'assistant' 
                ? context[context.length - 1].content 
                : '';
            
            if (lastBotMessage.includes('تم إرسال الملف') || lastBotMessage.includes('📚')) {
                // رد بسيط بدون استخدام الـ AI ولا حفظ في الذاكرة لتجنب الهلوسة
                const simpleResponses = [
                    'العفو يا فندم! 😊',
                    'ربنا يوفقك! 📚',
                    'على الرحب والسعة! 🎓',
                    'تمام، لو محتاج حاجة تانية أنا موجود! ✨'
                ];
                const randomResponse = simpleResponses[Math.floor(Math.random() * simpleResponses.length)];
                
                console.log('✅ رد تلقائي على رسالة شكر بعد إرسال ملف (بدون حفظ في الذاكرة)');
                return {
                    success: true,
                    text: randomResponse,
                    action: null,
                    fileInfo: null,
                    filesToSend: []
                };
            }
        }
        
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
            model: "llama-3.3-70b-versatile", // النموذج النشط الحالي - ذكي جداً
            messages: messages,
            tools: tools,
            tool_choice: "auto",
            temperature: 0.5, // تقليل للحد من الهلوسة
            max_tokens: 800 // تقليل لتوفير التوكينز
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
                } else if (toolResult.success && toolResult.action === "send_folder") {
                    // إضافة جميع ملفات المجلد لقائمة الملفات المراد إرسالها
                    finalResponse.filesToSend.push(...toolResult.files);
                    if (!finalResponse.action) {
                        finalResponse.action = "send_folder";
                    }
                } else if (toolResult.success && toolResult.action === "text_content") {
                    // إذا كان ملف نصي، أضف المحتوى للسياق
                    finalResponse.textFileContent = toolResult.content;
                }
            }
            
            // طلب ثانٍ للحصول على الرد النهائي بعد تنفيذ الأدوات
            response = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile", // النموذج النشط الحالي - ذكي جداً
                messages: messages,
                temperature: 0.5, // تقليل للحد من الهلوسة
                max_tokens: 800 // تقليل لتوفير التوكينز
            });
            
            assistantMessage = response.choices[0].message;
        }
        
        // الحصول على النص النهائي
        const botResponse = assistantMessage.content || "";
        
        // إضافة رد البوت للذاكرة
        // إذا تم إرسال ملف، نحفظ نسخة مختصرة جداً في الذاكرة لتجنب الهلوسة
        let responseToStore = botResponse;
        if (finalResponse.action === 'send_file' || finalResponse.action === 'send_folder') {
            // تقصير الرد لإزالة التفاصيل التي قد تسبب إعادة إرسال
            responseToStore = "تمام، تم إرسال الملف المطلوب 📚";
        }
        addToMemory(userId, "assistant", responseToStore);
        
        finalResponse.text = botResponse;
        
        console.log(`✅ رد البوت: ${botResponse.substring(0, 100)}...`);
        if (finalResponse.action) {
            console.log(`📎 إجراء: ${finalResponse.action}`);
        }
        
        return finalResponse;
        
    } catch (error) {
        console.error('❌ خطأ في Groq AI:', error.message);
        
        // التحقق من نوع الخطأ - لا نستخدم Gemini إلا في حالات محددة
        const shouldFallbackToGemini = error.message && (
            error.message.includes('rate_limit') || 
            error.message.includes('model_not_found') ||
            error.message.includes('insufficient_quota')
        );
        
        if (shouldFallbackToGemini) {
            console.log('🔄 محاولة التحويل إلى Gemini كـ Fallback...');
            
            // محاولة استخدام Gemini كـ Fallback
            try {
                // إضافة رسالة المستخدم للذاكرة إذا لم تكن مضافة
                const currentMemory = getConversationContext(userId);
                const lastMessage = currentMemory[currentMemory.length - 1];
                if (!lastMessage || lastMessage.content !== userMessage) {
                    addToMemory(userId, "user", userMessage);
                }
                
                // بناء المحادثة مع السياق
                const messages = [
                    {
                        role: "system",
                        content: createSystemPrompt()
                    },
                    ...getConversationContext(userId)
                ];
                
                // استخدام Gemini كـ Fallback
                const geminiResponse = await processWithGeminiAI(messages, tools);
                
                if (geminiResponse.success) {
                    // إضافة رد Gemini للذاكرة
                    if (geminiResponse.text) {
                        addToMemory(userId, "assistant", geminiResponse.text);
                    }
                    console.log('✅ نجح Fallback إلى Gemini!');
                    return geminiResponse;
                } else {
                    // فشل Gemini أيضاً
                    console.error('❌ فشل Gemini Fallback أيضاً');
                    return {
                        success: false,
                        message: null,
                        error: `Groq failed: ${error.message}, Gemini also failed: ${geminiResponse.error}`
                    };
                }
            } catch (fallbackError) {
                console.error('❌ فشل Gemini Fallback:', fallbackError.message);
                return {
                    success: false,
                    message: null,
                    error: `Groq failed: ${error.message}, Gemini fallback failed: ${fallbackError.message}`
                };
            }
        } else {
            // خطأ آخر غير متعلق بالـ rate limit - نرجع الخطأ مباشرة
            console.error('❌ خطأ في Groq (لن يتم استخدام Gemini Fallback)');
            return {
                success: false,
                message: null,
                error: error.message
            };
        }
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
