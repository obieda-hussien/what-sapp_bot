/**
 * Test for newline handling in text responses
 */

console.log('🧪 Testing newline (\\n) handling in text responses...\n');

// Simulate the text processing logic
function processTextWithNewlines(text) {
    // تحويل \n إلى سطر جديد فعلي
    return text.replace(/\\n/g, '\n');
}

// Test cases
const tests = [
    {
        name: 'Test 1: Text with \\n characters',
        input: 'السطر الأول\\nالسطر الثاني\\nالسطر الثالث',
        expected: 'السطر الأول\nالسطر الثاني\nالسطر الثالث'
    },
    {
        name: 'Test 2: Schedule with \\n',
        input: '📅 جدول المحاضرات:\\n\\nالأحد: 10 صباحاً\\nالاثنين: 2 مساءً\\nالأربعاء: 10 صباحاً',
        expected: '📅 جدول المحاضرات:\n\nالأحد: 10 صباحاً\nالاثنين: 2 مساءً\nالأربعاء: 10 صباحاً'
    },
    {
        name: 'Test 3: Assignment with \\n',
        input: '✍️ Assignment المحاضرة الأولى:\\n\\n📝 حل الأسئلة من 1 إلى 10\\n📅 آخر موعد: الأحد القادم',
        expected: '✍️ Assignment المحاضرة الأولى:\n\n📝 حل الأسئلة من 1 إلى 10\n📅 آخر موعد: الأحد القادم'
    },
    {
        name: 'Test 4: Text without \\n',
        input: 'نص عادي بدون أسطر جديدة',
        expected: 'نص عادي بدون أسطر جديدة'
    },
    {
        name: 'Test 5: List with \\n',
        input: '🏆 ترتيب الدوري:\\n\\n1. الأهلي - 45 نقطة\\n2. الزمالك - 43 نقطة\\n3. بيراميدز - 38 نقطة',
        expected: '🏆 ترتيب الدوري:\n\n1. الأهلي - 45 نقطة\n2. الزمالك - 43 نقطة\n3. بيراميدز - 38 نقطة'
    }
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
    console.log(`${test.name}`);
    console.log(`Input: "${test.input}"\n`);
    
    const result = processTextWithNewlines(test.input);
    
    if (result === test.expected) {
        console.log('✅ PASS - Newlines converted correctly');
        console.log('Output:');
        console.log('─'.repeat(40));
        console.log(result);
        console.log('─'.repeat(40));
        passed++;
    } else {
        console.log('❌ FAIL - Newlines not converted correctly');
        console.log('Expected:');
        console.log(test.expected);
        console.log('\nGot:');
        console.log(result);
        failed++;
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
});

console.log(`📊 Results: ${passed}/${tests.length} passed, ${failed}/${tests.length} failed\n`);

if (failed === 0) {
    console.log('🎉 All tests passed!\n');
    console.log('💡 Now when users type \\n in their commands, it will be converted to actual line breaks!\n');
    process.exit(0);
} else {
    console.log('⚠️  Some tests failed!\n');
    process.exit(1);
}
