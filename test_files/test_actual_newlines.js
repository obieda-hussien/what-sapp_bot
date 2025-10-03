/**
 * Test for preserving actual newlines in commands
 */

console.log('🧪 Testing preservation of actual newlines in commands...\n');

// Simulate the new parseCommand function
function parseCommand(text) {
    const trimmedText = text.trim();
    const firstSpaceIndex = trimmedText.indexOf(' ');
    
    if (firstSpaceIndex === -1) {
        return { command: trimmedText.substring(1), args: [] };
    }
    
    const command = trimmedText.substring(1, firstSpaceIndex);
    const restOfText = trimmedText.substring(firstSpaceIndex + 1);
    
    const args = [restOfText.split(/\s+/)[0]];
    const remainingText = restOfText.substring(args[0].length).trimStart();
    
    if (remainingText) {
        args.push(remainingText);
    }
    
    return { command, args };
}

// Simulate the text processing logic
function processAddResponseCommand(commandText) {
    const { command, args } = parseCommand(commandText);
    
    if (args.length < 2) {
        return { error: 'Not enough arguments' };
    }
    
    const responseType = args[0];
    const restArgs = args[1];
    
    const parts = restArgs.split('|').map((p) => {
        return p.replace(/^\s+|\s+$/g, '');
    });
    
    if (parts.length < 2) {
        return { error: 'Need keywords and content' };
    }
    
    const keywords = parts[0].split(',').map(k => k.trim());
    const text = parts[1]; // Preserve newlines as-is
    
    return {
        success: true,
        command,
        responseType,
        keywords,
        text
    };
}

// Test cases with actual newlines (simulating WhatsApp message with line breaks)
const tests = [
    {
        name: 'Test 1: Multi-line text with actual newlines',
        input: `.اضافة_رد نص مواعيد | 📅 المواعيد:

✅ الأحد: 10 ص
✅ الاثنين: 2 م

❌ الجمعة: مغلق`,
        expectedText: `📅 المواعيد:

✅ الأحد: 10 ص
✅ الاثنين: 2 م

❌ الجمعة: مغلق`
    },
    {
        name: 'Test 2: Assignment with actual newlines',
        input: `.اضافة_رد نص اسايمنت | ✍️ Assignment:

📝 حل الأسئلة من 1 إلى 10
📅 آخر موعد: الأحد القادم`,
        expectedText: `✍️ Assignment:

📝 حل الأسئلة من 1 إلى 10
📅 آخر موعد: الأحد القادم`
    },
    {
        name: 'Test 3: List with actual newlines',
        input: `.اضافة_رد نص ترتيب | 🏆 ترتيب الدوري:

1. الأهلي - 45 نقطة
2. الزمالك - 43 نقطة
3. بيراميدز - 38 نقطة`,
        expectedText: `🏆 ترتيب الدوري:

1. الأهلي - 45 نقطة
2. الزمالك - 43 نقطة
3. بيراميدز - 38 نقطة`
    },
    {
        name: 'Test 4: Single line text (backward compatibility)',
        input: '.اضافة_رد نص مرحبا | مرحباً بك! كيف يمكنني مساعدتك؟',
        expectedText: 'مرحباً بك! كيف يمكنني مساعدتك؟'
    }
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
    console.log(`${test.name}`);
    console.log('Input command:');
    console.log('─'.repeat(40));
    console.log(test.input);
    console.log('─'.repeat(40));
    console.log('');
    
    const result = processAddResponseCommand(test.input);
    
    if (result.success && result.text === test.expectedText) {
        console.log('✅ PASS - Newlines preserved correctly');
        console.log('Stored text:');
        console.log('─'.repeat(40));
        console.log(result.text);
        console.log('─'.repeat(40));
        passed++;
    } else if (result.error) {
        console.log('❌ FAIL - Processing error:', result.error);
        failed++;
    } else {
        console.log('❌ FAIL - Text not preserved correctly');
        console.log('Expected:');
        console.log(test.expectedText);
        console.log('\nGot:');
        console.log(result.text);
        failed++;
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
});

console.log(`📊 Results: ${passed}/${tests.length} passed, ${failed}/${tests.length} failed\n`);

if (failed === 0) {
    console.log('🎉 All tests passed!\n');
    console.log('💡 Now users can type multi-line messages in WhatsApp and the newlines will be preserved automatically!\n');
    process.exit(0);
} else {
    console.log('⚠️  Some tests failed!\n');
    process.exit(1);
}
