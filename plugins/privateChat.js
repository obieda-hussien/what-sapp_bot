import { loadConfig, saveConfig } from '../utils/config.js';
import { findBestMatch, intelligentKeywordMatch } from '../utils/intelligentMatcher.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * التحقق من وجود كلمة مفتاحية في الرسالة والحصول على الرد المناسب
 * يستخدم الآن نظام المطابقة الذكية المتقدم
 */
export function checkPrivateChatKeyword(messageText, useIntelligentMatching = true) {
    const config = loadConfig();
    
    if (!config.privateChatResponses || !config.privateChatResponses.enabled) {
        return null;
    }
    
    if (!messageText || typeof messageText !== 'string') {
        return null;
    }
    
    const responses = config.privateChatResponses.keywords || [];
    
    // التحقق من إعدادات المطابقة الذكية
    const useIntelligent = config.privateChatResponses.intelligentMatching !== false && useIntelligentMatching;
    
    if (useIntelligent) {
        // استخدام المطابقة الذكية
        const keywordMap = new Map();
        
        for (const responseConfig of responses) {
            const keywords = Array.isArray(responseConfig.keywords) 
                ? responseConfig.keywords 
                : [responseConfig.keywords];
            
            for (const keyword of keywords) {
                keywordMap.set(keyword, responseConfig);
            }
        }
        
        const allKeywords = Array.from(keywordMap.keys());
        const matchResult = findBestMatch(messageText, allKeywords, {
            fuzzyThreshold: 70,
            exactMatchBonus: 50,
            proximityWeight: 0.2,
            partialMatchWeight: 0.5,
            exactWeight: 0.3
        });
        
        if (matchResult) {
            const responseConfig = keywordMap.get(matchResult.keyword);
            
            console.log(`🎯 نظام المطابقة الذكية:`);
            console.log(`   الكلمة المطابقة: ${matchResult.keyword}`);
            console.log(`   درجة الثقة: ${(matchResult.confidence * 100).toFixed(1)}%`);
            console.log(`   النية المكتشفة: ${matchResult.details.intent}`);
            
            return {
                keyword: matchResult.keyword,
                responseType: responseConfig.responseType,
                text: responseConfig.text || null,
                filePath: responseConfig.filePath || null,
                caption: responseConfig.caption || null,
                matchScore: matchResult.score,
                confidence: matchResult.confidence,
                details: matchResult.details
            };
        }
    } else {
        // استخدام المطابقة البسيطة (التقليدية)
        const messageTextLower = messageText.toLowerCase().trim();
        
        for (const responseConfig of responses) {
            const keywords = Array.isArray(responseConfig.keywords) 
                ? responseConfig.keywords 
                : [responseConfig.keywords];
            
            const matchedKeyword = keywords.find(keyword => 
                messageTextLower.includes(keyword.toLowerCase())
            );
            
            if (matchedKeyword) {
                console.log(`🔍 مطابقة بسيطة: ${matchedKeyword}`);
                return {
                    keyword: matchedKeyword,
                    responseType: responseConfig.responseType,
                    text: responseConfig.text || null,
                    filePath: responseConfig.filePath || null,
                    caption: responseConfig.caption || null
                };
            }
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
