/**
 * اختبار شامل لنظام المطابقة الذكية
 */

import { intelligentKeywordMatch, findBestMatch, analyzeMatch, ArabicProcessor } from '../utils/intelligentMatcher.js';

console.log('🧪 اختبار نظام المطابقة الذكية المتقدم\n');
console.log('=' .repeat(60));

// اختبار 1: التطابق الدقيق
console.log('\n📌 اختبار 1: التطابق الدقيق');
console.log('-'.repeat(60));
analyzeMatch('عايز ملخص محاسبة', 'ملخص محاسبة');

// اختبار 2: التطابق مع أخطاء إملائية
console.log('\n📌 اختبار 2: التطابق التقريبي (أخطاء إملائية)');
console.log('-'.repeat(60));
analyzeMatch('عايز ملخص محاسبه', 'ملخص محاسبة'); // ه بدل ة
analyzeMatch('محتاج ملخص المحاسبه', 'ملخص محاسبة');

// اختبار 3: التطابق مع كلمات إضافية
console.log('\n📌 اختبار 3: التطابق مع كلمات إضافية');
console.log('-'.repeat(60));
analyzeMatch('انا عايز ملخص مادة المحاسبة لو سمحت', 'ملخص محاسبة');
analyzeMatch('ممكن ملخص محاسبة', 'ملخص محاسبة');

// اختبار 4: التطابق الجزئي
console.log('\n📌 اختبار 4: التطابق الجزئي');
console.log('-'.repeat(60));
analyzeMatch('عايز محاضرة اولي', 'المحاضرة الاولي محاسبة');
analyzeMatch('محتاج المحاضرة الاولي', 'المحاضرة الاولي محاسبة');

// اختبار 5: عدم التطابق
console.log('\n📌 اختبار 5: عدم التطابق');
console.log('-'.repeat(60));
analyzeMatch('السلام عليكم', 'ملخص محاسبة');
analyzeMatch('شكراً جزيلاً', 'ملخص محاسبة');

// اختبار 6: البحث عن أفضل تطابق من قائمة
console.log('\n📌 اختبار 6: البحث عن أفضل تطابق من قائمة');
console.log('-'.repeat(60));

const keywords = [
    'ملخص محاسبة',
    'المحاضرة الاولي محاسبة',
    'اسايمنت المحاضرة الاولي',
    'جدول المحاضرات',
    'مواعيد الامتحانات'
];

const testMessages = [
    'عايز ملخص محاسبة',
    'محتاج المحاضرة الأولى',
    'فين الاسايمنت',
    'ايه مواعيد المحاضرات',
    'السلام عليكم'
];

testMessages.forEach(message => {
    console.log(`\nالرسالة: "${message}"`);
    const result = findBestMatch(message, keywords);
    if (result) {
        console.log(`✅ تطابق! الكلمة: "${result.keyword}"`);
        console.log(`   الدرجة: ${result.score.toFixed(2)}`);
        console.log(`   الثقة: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   النية: ${result.details.intent}`);
    } else {
        console.log('❌ لا يوجد تطابق');
    }
});

// اختبار 7: معالجة اللغة العربية
console.log('\n📌 اختبار 7: معالجة اللغة العربية المتقدمة');
console.log('-'.repeat(60));

console.log('\nتوسيع الكلمات:');
const word = 'محاضرة';
const expanded = ArabicProcessor.expandWord(word);
console.log(`الكلمة: ${word}`);
console.log(`التوسيعات: ${expanded.join(', ')}`);

console.log('\nالمترادفات:');
const synonymsTests = ['عايز', 'ازاي', 'ملخص', 'اسايمنت'];
synonymsTests.forEach(w => {
    const syns = ArabicProcessor.getSynonyms(w);
    if (syns.length > 0) {
        console.log(`${w}: ${syns.join(', ')}`);
    }
});

// اختبار 8: اكتشاف النية
console.log('\n📌 اختبار 8: اكتشاف نية المستخدم');
console.log('-'.repeat(60));

const intentMessages = [
    'عايز ملخص محاسبة',           // طلب
    'ازاي احصل على المحاضرة؟',     // سؤال
    'السلام عليكم',               // تحية
    'شكراً جزيلاً',                // شكر
    'الملخص مفيد جداً'             // بيان
];

intentMessages.forEach(msg => {
    const result = intelligentKeywordMatch(msg, 'ملخص محاسبة');
    console.log(`"${msg}" → النية: ${result.details.intent}`);
});

// اختبار 9: حساسية النظام للتشكيل
console.log('\n📌 اختبار 9: التعامل مع التشكيل');
console.log('-'.repeat(60));

const diacriticTests = [
    'مُلَخَّص مُحَاسَبَة',
    'مِلْخَص مُحَاسَبَه',
    'ملخص محاسبة'  // بدون تشكيل
];

diacriticTests.forEach(test => {
    const result = intelligentKeywordMatch(test, 'ملخص محاسبة');
    console.log(`"${test}" → درجة: ${result.score.toFixed(2)} - ${result.matched ? '✅' : '❌'}`);
});

// اختبار 10: الأداء والسرعة
console.log('\n📌 اختبار 10: قياس الأداء');
console.log('-'.repeat(60));

const iterations = 1000;
const testMessage = 'عايز ملخص محاسبة من فضلك';
const testKeyword = 'ملخص محاسبة';

console.time('زمن التنفيذ');
for (let i = 0; i < iterations; i++) {
    intelligentKeywordMatch(testMessage, testKeyword);
}
console.timeEnd('زمن التنفيذ');
console.log(`عدد العمليات: ${iterations}`);

// ملخص النتائج
console.log('\n' + '='.repeat(60));
console.log('✅ اكتمل اختبار نظام المطابقة الذكية');
console.log('='.repeat(60));

console.log('\n🎯 المميزات المتاحة:');
console.log('  ✓ التطابق الدقيق والتقريبي');
console.log('  ✓ معالجة الأخطاء الإملائية');
console.log('  ✓ دعم كامل للغة العربية والتشكيل');
console.log('  ✓ نظام تسجيل ذكي');
console.log('  ✓ اكتشاف نية المستخدم');
console.log('  ✓ معالجة المترادفات');
console.log('  ✓ التطابق الجزئي');
console.log('  ✓ حساب القرب والسياق');

console.log('\n💡 النظام الآن أكثر ذكاءً ويفهم المستخدمين بشكل أفضل!');
