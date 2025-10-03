import { loadConfig, saveConfig } from '../utils/config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * التحقق من وجود كلمة مفتاحية في الرسالة والحصول على الرد المناسب
 */
export function checkPrivateChatKeyword(messageText) {
    const config = loadConfig();
    
    if (!config.privateChatResponses || !config.privateChatResponses.enabled) {
        return null;
    }
    
    if (!messageText || typeof messageText !== 'string') {
        return null;
    }
    
    const responses = config.privateChatResponses.keywords || [];
    const messageTextLower = messageText.toLowerCase().trim();
    
    // البحث عن أول كلمة مفتاحية مطابقة
    for (const responseConfig of responses) {
        const keywords = Array.isArray(responseConfig.keywords) 
            ? responseConfig.keywords 
            : [responseConfig.keywords];
        
        // التحقق من وجود أي من الكلمات المفتاحية في الرسالة
        const matchedKeyword = keywords.find(keyword => 
            messageTextLower.includes(keyword.toLowerCase())
        );
        
        if (matchedKeyword) {
            return {
                keyword: matchedKeyword,
                responseType: responseConfig.responseType, // 'text', 'image', 'document', 'both'
                text: responseConfig.text || null,
                filePath: responseConfig.filePath || null,
                caption: responseConfig.caption || null
            };
        }
    }
    
    return null;
}

/**
 * إضافة رد آلي للمحادثات الخاصة
 */
export function addPrivateChatResponse(keywords, responseType, text = null, filePath = null, caption = null) {
    const config = loadConfig();
    
    if (!config.privateChatResponses) {
        config.privateChatResponses = {
            enabled: true,
            keywords: []
        };
    }
    
    // تحويل الكلمات المفتاحية إلى مصفوفة
    const keywordsArray = Array.isArray(keywords) ? keywords : [keywords];
    
    config.privateChatResponses.keywords.push({
        keywords: keywordsArray,
        responseType,
        text,
        filePath,
        caption
    });
    
    return saveConfig(config);
}

/**
 * حذف رد آلي للمحادثات الخاصة
 */
export function removePrivateChatResponse(keyword) {
    const config = loadConfig();
    
    if (!config.privateChatResponses || !config.privateChatResponses.keywords) {
        return false;
    }
    
    const originalLength = config.privateChatResponses.keywords.length;
    config.privateChatResponses.keywords = config.privateChatResponses.keywords.filter(
        response => {
            const keywords = Array.isArray(response.keywords) 
                ? response.keywords 
                : [response.keywords];
            return !keywords.some(k => k.toLowerCase() === keyword.toLowerCase());
        }
    );
    
    if (config.privateChatResponses.keywords.length < originalLength) {
        return saveConfig(config);
    }
    
    return false;
}

/**
 * عرض جميع الردود الآلية
 */
export function listPrivateChatResponses() {
    const config = loadConfig();
    
    if (!config.privateChatResponses || !config.privateChatResponses.keywords) {
        return [];
    }
    
    return config.privateChatResponses.keywords;
}

/**
 * تفعيل/تعطيل الردود الآلية
 */
export function setPrivateChatStatus(enabled) {
    const config = loadConfig();
    
    if (!config.privateChatResponses) {
        config.privateChatResponses = {
            enabled,
            keywords: []
        };
    } else {
        config.privateChatResponses.enabled = enabled;
    }
    
    return saveConfig(config);
}
