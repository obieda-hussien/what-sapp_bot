/**
 * Simple test for privateChat keyword matching
 */

import { checkPrivateChatKeyword } from '../plugins/privateChat.js';
import { loadConfig, saveConfig } from '../utils/config.js';

console.log('🧪 Testing Private Chat Keyword Matching...\n');

// Load current config
const config = loadConfig();

// Save original config
const originalConfig = JSON.parse(JSON.stringify(config));

// Setup test data
config.privateChatResponses = {
    enabled: true,
    keywords: [
        {
            keywords: ["ملخص محاسبة", "ملخص المحاسبة"],
            responseType: "document",
            text: null,
            filePath: "/path/to/accounting_summary.pdf",
            caption: "📚 ملخص مادة المحاسبة"
        },
        {
            keywords: ["المحاضرة الاولي محاسبة", "محاضرة 1 محاسبة"],
            responseType: "document",
            text: null,
            filePath: "/path/to/lecture1_accounting.pdf",
            caption: "📖 المحاضرة الأولى - محاسبة"
        },
        {
            keywords: ["اسايمنت المحاضرة الاولي", "assignment محاضرة 1"],
            responseType: "both",
            text: "✍️ Assignment المحاضرة الأولى:\n\nالسؤال الأول: ...\nالسؤال الثاني: ...",
            filePath: "/path/to/assignment1_image.jpg",
            caption: "📝 صورة الـ Assignment"
        },
        {
            keywords: ["مواعيد المحاضرات", "جدول المحاضرات"],
            responseType: "text",
            text: "📅 جدول المحاضرات:\n\nالأحد: 10 صباحاً - محاسبة\nالاثنين: 2 مساءً - إحصاء\nالأربعاء: 10 صباحاً - اقتصاد",
            filePath: null,
            caption: null
        }
    ]
};

// Save test config
saveConfig(config);

// Test cases
const testCases = [
    {
        message: "عايز ملخص محاسبة",
        expectedKeyword: "ملخص محاسبة",
        expectedType: "document"
    },
    {
        message: "ممكن ملخص محاسبة",
        expectedKeyword: "ملخص محاسبة",
        expectedType: "document"
    },
    {
        message: "عايز المحاضرة الاولي محاسبة",
        expectedKeyword: "المحاضرة الاولي محاسبة",
        expectedType: "document"
    },
    {
        message: "ايه مواعيد المحاضرات؟",
        expectedKeyword: "مواعيد المحاضرات",
        expectedType: "text"
    },
    {
        message: "عايز اسايمنت المحاضرة الاولي",
        expectedKeyword: "اسايمنت المحاضرة الاولي",
        expectedType: "both"
    },
    {
        message: "السلام عليكم",
        expectedKeyword: null,
        expectedType: null
    }
];

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: "${test.message}"`);
    const result = checkPrivateChatKeyword(test.message);
    
    if (test.expectedKeyword === null) {
        if (result === null) {
            console.log('  ✅ PASS - No keyword matched (as expected)\n');
            passed++;
        } else {
            console.log(`  ❌ FAIL - Expected no match but got: ${result.keyword}\n`);
            failed++;
        }
    } else {
        if (result && result.keyword === test.expectedKeyword && result.responseType === test.expectedType) {
            console.log(`  ✅ PASS - Matched keyword: ${result.keyword}, Type: ${result.responseType}\n`);
            passed++;
        } else {
            console.log(`  ❌ FAIL - Expected "${test.expectedKeyword}" (${test.expectedType}), got: ${result ? result.keyword + ' (' + result.responseType + ')' : 'null'}\n`);
            failed++;
        }
    }
});

// Restore original config
saveConfig(originalConfig);

console.log('═══════════════════════════════════');
console.log(`✅ Passed: ${passed}/${testCases.length}`);
console.log(`❌ Failed: ${failed}/${testCases.length}`);
console.log('═══════════════════════════════════');

if (failed === 0) {
    console.log('\n🎉 All tests passed!\n');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed!\n');
    process.exit(1);
}
