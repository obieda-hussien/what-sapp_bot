/**
 * نظام المطابقة الذكية للكلمات المفتاحية
 * Intelligent Keyword Matching System
 * 
 * يوفر خوارزميات متقدمة لمطابقة الكلمات مع دعم:
 * - التطابق التقريبي (Fuzzy Matching)
 * - دعم اللغة العربية الكامل
 * - نظام التسجيل والترتيب
 * - فهم السياق
 */

/**
 * تطبيع النص العربي - إزالة التشكيل والحروف المتشابهة
 */
export function normalizeArabicText(text) {
    if (!text) return '';
    
    return text
        .toLowerCase()
        // إزالة التشكيل
        .replace(/[\u064B-\u065F]/g, '') // حركات التشكيل
        .replace(/[\u0670]/g, '')         // ألف خنجرية
        // توحيد الهمزات
        .replace(/[أإآ]/g, 'ا')
        .replace(/[ى]/g, 'ي')
        .replace(/[ة]/g, 'ه')
        // إزالة المسافات الزائدة
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * حساب مسافة Levenshtein (المسافة بين نصين)
 * تستخدم لقياس التشابه بين الكلمات
 */
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    // تهيئة المصفوفة
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // حساب المسافة
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,     // حذف
                matrix[i][j - 1] + 1,     // إضافة
                matrix[i - 1][j - 1] + cost // استبدال
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * حساب نسبة التشابه بين نصين (0-100)
 */
export function calculateSimilarity(str1, str2) {
    const normalized1 = normalizeArabicText(str1);
    const normalized2 = normalizeArabicText(str2);
    
    if (normalized1 === normalized2) return 100;
    if (normalized1.length === 0 || normalized2.length === 0) return 0;
    
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = ((maxLength - distance) / maxLength) * 100;
    
    return Math.round(similarity);
}

/**
 * التحقق من احتواء النص على الكلمة (مع التطبيع)
 */
function containsWord(text, word) {
    const normalizedText = normalizeArabicText(text);
    const normalizedWord = normalizeArabicText(word);
    
    return normalizedText.includes(normalizedWord);
}

/**
 * تقسيم النص إلى كلمات مع الاحتفاظ بالعبارات
 */
function tokenize(text) {
    return normalizeArabicText(text)
        .split(/\s+/)
        .filter(word => word.length > 0);
}

/**
 * حساب التطابق الجزئي بين كلمات
 */
function calculatePartialMatch(messageWords, keywordWords) {
    let matchCount = 0;
    let totalScore = 0;
    
    for (const keywordWord of keywordWords) {
        let bestScore = 0;
        
        for (const messageWord of messageWords) {
            const similarity = calculateSimilarity(messageWord, keywordWord);
            if (similarity > bestScore) {
                bestScore = similarity;
            }
        }
        
        if (bestScore >= 70) { // عتبة التشابه 70%
            matchCount++;
            totalScore += bestScore;
        }
    }
    
    // نسبة الكلمات المتطابقة
    const matchRatio = matchCount / keywordWords.length;
    const avgScore = matchCount > 0 ? totalScore / matchCount : 0;
    
    return {
        matchCount,
        matchRatio,
        avgScore,
        overallScore: (matchRatio * 60) + (avgScore * 0.4) // 60% وزن للنسبة، 40% للدقة
    };
}

/**
 * حساب درجة القرب بين الكلمات (هل الكلمات قريبة من بعضها؟)
 */
function calculateProximityScore(messageText, keyword) {
    const normalizedMessage = normalizeArabicText(messageText);
    const normalizedKeyword = normalizeArabicText(keyword);
    
    // البحث عن موقع الكلمة المفتاحية
    const index = normalizedMessage.indexOf(normalizedKeyword);
    
    if (index === -1) return 0;
    
    // إذا كانت الكلمة في البداية، نقطة أعلى
    const positionScore = (1 - (index / normalizedMessage.length)) * 100;
    
    return positionScore;
}

/**
 * تحليل المشاعر من النص (Sentiment Analysis)
 */
export function detectSentiment(messageText) {
    const text = normalizeArabicText(messageText);
    
    const sentiments = {
        positive: ['جميل', 'رائع', 'ممتاز', 'شكرا', 'تمام', 'حلو', 'كويس', 'زين', 'احسنت', 'بارك', 'جزاك'],
        negative: ['سيء', 'مش كويس', 'مو زين', 'غلط', 'خطا', 'مش تمام', 'مش حلو', 'احا', 'تعبان'],
        neutral: ['عادي', 'ماشي', 'ok', 'اوكي']
    };
    
    for (const [sentiment, keywords] of Object.entries(sentiments)) {
        if (keywords.some(kw => text.includes(kw))) {
            return sentiment;
        }
    }
    
    return 'neutral';
}

/**
 * تحليل السياق من النص (Context Analysis)
 */
export function analyzeContext(messageText) {
    const text = normalizeArabicText(messageText);
    
    const contexts = {
        education: ['محاضرة', 'درس', 'دراسة', 'امتحان', 'اختبار', 'واجب', 'اسايمنت', 'ملخص', 'شرح', 'مادة', 'كتاب'],
        time: ['صباح', 'مساء', 'ليل', 'نهار', 'الان', 'بكرة', 'امس', 'اليوم', 'غدا'],
        location: ['فين', 'اين', 'وين', 'هنا', 'هناك', 'مكان'],
        help: ['ساعدني', 'عاوز مساعدة', 'محتاج مساعدة', 'ممكن تساعدني', 'ساعد'],
        social: ['كيف حالك', 'ايه اخبارك', 'شلونك', 'عامل ايه', 'انت منين', 'اسمك ايه']
    };
    
    const detectedContexts = [];
    for (const [context, keywords] of Object.entries(contexts)) {
        if (keywords.some(kw => text.includes(kw))) {
            detectedContexts.push(context);
        }
    }
    
    return detectedContexts.length > 0 ? detectedContexts : ['general'];
}

/**
 * تحليل النية من النص (Intent Recognition)
 */
export function detectIntent(messageText) {
    const text = normalizeArabicText(messageText);
    
    const intents = {
        question: ['ايه', 'ازاي', 'فين', 'امتي', 'ليه', 'كيف', 'متى', 'اين', 'لماذا', 'هل', 'ممكن', 'ينفع', 'شنو', 'منو', 'وش'],
        request: ['عايز', 'محتاج', 'ابغي', 'اريد', 'ممكن', 'لو سمحت', 'من فضلك', 'بدي', 'ابي'],
        greeting: ['السلام', 'صباح', 'مساء', 'مرحبا', 'اهلا', 'هاي', 'هلو', 'سلام', 'هلا', 'تحية'],
        farewell: ['باي', 'مع السلامة', 'الى اللقاء', 'وداعا', 'بالسلامة', 'تصبح على خير'],
        gratitude: ['شكرا', 'مشكور', 'ممنون', 'تسلم', 'يعطيك', 'جزاك الله', 'بارك الله'],
        apology: ['اسف', 'معذرة', 'عفوا', 'سامحني', 'آسف', 'اعتذر'],
        confirmation: ['نعم', 'اه', 'ايوه', 'صح', 'اكيد', 'طبعا', 'yes', 'يب'],
        negation: ['لا', 'لاء', 'مش', 'ما', 'no', 'كلا']
    };
    
    for (const [intent, keywords] of Object.entries(intents)) {
        if (keywords.some(kw => text.includes(kw))) {
            return intent;
        }
    }
    
    return 'statement';
}

/**
 * خوارزمية المطابقة الذكية الرئيسية
 */
export function intelligentKeywordMatch(messageText, keyword, options = {}) {
    const {
        fuzzyThreshold = 70,      // عتبة التطابق التقريبي
        exactMatchBonus = 50,      // نقاط إضافية للتطابق الدقيق
        proximityWeight = 0.2,     // وزن القرب
        partialMatchWeight = 0.5,  // وزن التطابق الجزئي
        exactWeight = 0.3          // وزن التطابق الدقيق
    } = options;
    
    let totalScore = 0;
    const details = {
        exactMatch: false,
        fuzzyMatch: false,
        partialMatch: false,
        similarity: 0,
        proximity: 0,
        intent: null,
        sentiment: null,
        context: []
    };
    
    // 1. التطابق الدقيق (بعد التطبيع)
    if (containsWord(messageText, keyword)) {
        details.exactMatch = true;
        totalScore += exactMatchBonus;
    }
    
    // 2. حساب التشابه العام
    const similarity = calculateSimilarity(messageText, keyword);
    details.similarity = similarity;
    
    if (similarity >= fuzzyThreshold) {
        details.fuzzyMatch = true;
        totalScore += similarity * exactWeight;
    }
    
    // 3. التطابق الجزئي (كلمة بكلمة)
    const messageWords = tokenize(messageText);
    const keywordWords = tokenize(keyword);
    
    const partialResult = calculatePartialMatch(messageWords, keywordWords);
    details.partialMatchScore = partialResult.overallScore;
    
    if (partialResult.matchRatio >= 0.5) { // نصف الكلمات على الأقل متطابقة
        details.partialMatch = true;
        totalScore += partialResult.overallScore * partialMatchWeight;
    }
    
    // 4. حساب القرب
    const proximity = calculateProximityScore(messageText, keyword);
    details.proximity = proximity;
    totalScore += proximity * proximityWeight;
    
    // 5. تحليل النية والمشاعر والسياق
    details.intent = detectIntent(messageText);
    details.sentiment = detectSentiment(messageText);
    details.context = analyzeContext(messageText);
    
    // منح نقاط إضافية للمطابقة الذكية عند التطابق مع النية والسياق
    if (details.intent === 'greeting' || details.intent === 'gratitude') {
        totalScore += 10; // نقاط إضافية للتحيات والشكر
    }
    
    // تطبيع النتيجة النهائية (0-100)
    const finalScore = Math.min(100, Math.max(0, totalScore));
    
    return {
        score: finalScore,
        matched: finalScore >= 50, // عتبة القبول
        details
    };
}

/**
 * البحث عن أفضل تطابق من قائمة كلمات مفتاحية
 */
export function findBestMatch(messageText, keywords, options = {}) {
    if (!messageText || !keywords || keywords.length === 0) {
        return null;
    }
    
    const results = keywords.map(keyword => {
        const matchResult = intelligentKeywordMatch(messageText, keyword, options);
        return {
            keyword,
            ...matchResult
        };
    });
    
    // ترتيب حسب الدرجة
    results.sort((a, b) => b.score - a.score);
    
    // إرجاع أفضل نتيجة إذا كانت مقبولة
    const best = results[0];
    if (best && best.matched) {
        return {
            keyword: best.keyword,
            score: best.score,
            confidence: best.score / 100, // 0-1
            details: best.details,
            allResults: results // جميع النتائج للتحليل
        };
    }
    
    return null;
}

/**
 * دالة مساعدة للاختبار والتحليل
 */
export function analyzeMatch(messageText, keyword) {
    const result = intelligentKeywordMatch(messageText, keyword);
    
    console.log('=== تحليل المطابقة الذكية ===');
    console.log(`الرسالة: ${messageText}`);
    console.log(`الكلمة المفتاحية: ${keyword}`);
    console.log(`النتيجة النهائية: ${result.score.toFixed(2)}`);
    console.log(`متطابق؟ ${result.matched ? '✅ نعم' : '❌ لا'}`);
    console.log('\n📊 التفاصيل:');
    console.log(`  ✓ تطابق دقيق: ${result.details.exactMatch ? '✅' : '❌'}`);
    console.log(`  ✓ تطابق تقريبي: ${result.details.fuzzyMatch ? '✅' : '❌'}`);
    console.log(`  ✓ تطابق جزئي: ${result.details.partialMatch ? '✅' : '❌'}`);
    console.log(`  ✓ نسبة التشابه: ${result.details.similarity}%`);
    console.log(`  ✓ درجة القرب: ${result.details.proximity.toFixed(2)}`);
    console.log(`\n🧠 التحليل الذكي:`);
    console.log(`  ✓ النية: ${result.details.intent}`);
    console.log(`  ✓ المشاعر: ${result.details.sentiment}`);
    console.log(`  ✓ السياق: ${result.details.context.join(', ')}`);
    
    return result;
}

/**
 * معالجة متقدمة للغة العربية
 */
export const ArabicProcessor = {
    /**
     * توسيع الكلمة لتشمل صيغ مختلفة
     */
    expandWord(word) {
        const expansions = [word];
        const normalized = normalizeArabicText(word);
        
        if (normalized !== word) {
            expansions.push(normalized);
        }
        
        // إضافة صيغ شائعة
        const withAl = 'ال' + word;
        const withoutAl = word.startsWith('ال') ? word.substring(2) : null;
        
        if (withAl !== word) expansions.push(withAl);
        if (withoutAl) expansions.push(withoutAl);
        
        return [...new Set(expansions)]; // إزالة التكرار
    },
    
    /**
     * اكتشاف الكلمات المترادفة (يمكن توسيعها)
     */
    getSynonyms(word) {
        const synonyms = {
            // كلمات الطلب
            'عايز': ['محتاج', 'ابغي', 'اريد', 'بدي', 'ابي'],
            'ازاي': ['كيف', 'بأي طريقة', 'وش الطريقة'],
            'فين': ['اين', 'وين', 'وش مكان'],
            'ايه': ['ما', 'ماذا', 'شنو', 'وش'],
            // كلمات تعليمية
            'محاضره': ['درس', 'حصة', 'لكتشر', 'lecture', 'كلاس'],
            'ملخص': ['تلخيص', 'مراجعة', 'summary', 'خلاصة'],
            'اسايمنت': ['واجب', 'تمرين', 'assignment', 'تكليف', 'homework'],
            // كلمات التحية
            'السلام عليكم': ['سلام', 'السلام', 'مرحبا', 'اهلا', 'هلا'],
            'صباح الخير': ['صباحو', 'صباح النور', 'good morning', 'صباح'],
            'مساء الخير': ['مساءو', 'مساء النور', 'good evening', 'مساء'],
            // كلمات الشكر
            'شكرا': ['مشكور', 'ثانكس', 'thanks', 'thank you', 'ممنون', 'تسلم'],
            // كلمات الوداع
            'مع السلامه': ['باي', 'bye', 'وداعا', 'الى اللقاء', 'بالسلامة'],
            // كلمات الاستفسار
            'كيف حالك': ['ايه اخبارك', 'شلونك', 'عامل ايه', 'how are you', 'كيفك'],
            'ممكن': ['لو سمحت', 'من فضلك', 'please', 'ياريت']
        };
        
        const normalized = normalizeArabicText(word);
        return synonyms[normalized] || [];
    }
};

export default {
    intelligentKeywordMatch,
    findBestMatch,
    analyzeMatch,
    normalizeArabicText,
    calculateSimilarity,
    detectIntent,
    detectSentiment,
    analyzeContext,
    ArabicProcessor
};
