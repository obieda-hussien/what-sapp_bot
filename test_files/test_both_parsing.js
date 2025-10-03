/**
 * Direct unit test for the "both" type fix
 */

console.log('🧪 Testing "كامل" (both) response type fix (direct)...\n');

// Simulate the parsing logic directly
function testBothTypeParsing(command) {
    // Extract args from command
    const parts = command.trim().split(/\s+/);
    const args = parts.slice(1); // Remove command prefix
    
    const responseType = args[0];
    const restArgs = args.slice(1).join(' ');
    
    // التحقق من نوع الرد
    const validTypes = {
        'نص': 'text',
        'صورة': 'image',
        'ملف': 'document',
        'كامل': 'both',
        'text': 'text',
        'image': 'image',
        'document': 'document',
        'both': 'both'
    };
    
    const type = validTypes[responseType];
    
    // تقسيم الكلمات المفتاحية والمحتوى
    const splitParts = restArgs.split('|').map(p => p.trim());
    
    // التحقق من عدد الأجزاء حسب النوع
    if (type === 'both' && splitParts.length < 3) {
        return {
            success: false,
            error: '❌ للنوع "كامل"، يجب فصل الكلمات المفتاحية عن النص عن مسار الملف بـ |'
        };
    } else if (type !== 'both' && splitParts.length < 2) {
        return {
            success: false,
            error: '❌ يجب فصل الكلمات المفتاحية عن المحتوى بـ |'
        };
    }
    
    const keywords = splitParts[0].split(',').map(k => k.trim());
    
    // تحديد المحتوى حسب النوع
    let text = null;
    let filePath = null;
    
    if (type === 'text') {
        text = splitParts[1];
    } else if (type === 'image' || type === 'document') {
        filePath = splitParts[1];
    } else if (type === 'both') {
        text = splitParts[1];
        filePath = splitParts[2];
    }
    
    return {
        success: true,
        type,
        keywords,
        text,
        filePath
    };
}

// Test cases
const tests = [
    {
        name: 'Test 1: Correct usage (3 parts)',
        command: '.اضافة_رد كامل اسايمنت | ✍️ Assignment المحاضرة الأولى | /path/to/assignment.jpg',
        shouldPass: true,
        expectedKeywords: ['اسايمنت'],
        expectedText: '✍️ Assignment المحاضرة الأولى',
        expectedFilePath: '/path/to/assignment.jpg'
    },
    {
        name: 'Test 2: Incorrect usage (only 2 parts)',
        command: '.اضافة_رد كامل اسايمنت | /path/to/assignment.jpg',
        shouldPass: false
    },
    {
        name: 'Test 3: Multiple keywords',
        command: '.اضافة_رد كامل اسايمنت,assignment,واجب | 📝 تفاصيل الواجب | /path/to/file.pdf',
        shouldPass: true,
        expectedKeywords: ['اسايمنت', 'assignment', 'واجب'],
        expectedText: '📝 تفاصيل الواجب',
        expectedFilePath: '/path/to/file.pdf'
    },
    {
        name: 'Test 4: Text type (2 parts)',
        command: '.اضافة_رد نص مواعيد | 📅 الجدول',
        shouldPass: true,
        expectedKeywords: ['مواعيد'],
        expectedText: '📅 الجدول',
        expectedFilePath: null
    }
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
    console.log(`${test.name}`);
    console.log(`Command: ${test.command}\n`);
    
    const result = testBothTypeParsing(test.command);
    
    if (test.shouldPass) {
        if (result.success) {
            // Check if values match expected
            const keywordsMatch = JSON.stringify(result.keywords) === JSON.stringify(test.expectedKeywords);
            const textMatch = result.text === test.expectedText;
            const filePathMatch = result.filePath === test.expectedFilePath;
            
            if (keywordsMatch && textMatch && filePathMatch) {
                console.log('✅ PASS - Parsing successful and values correct');
                console.log(`   Keywords: ${JSON.stringify(result.keywords)}`);
                console.log(`   Text: ${result.text}`);
                console.log(`   FilePath: ${result.filePath}`);
                passed++;
            } else {
                console.log('❌ FAIL - Parsing successful but values incorrect');
                console.log(`   Expected keywords: ${JSON.stringify(test.expectedKeywords)}, got: ${JSON.stringify(result.keywords)}`);
                console.log(`   Expected text: ${test.expectedText}, got: ${result.text}`);
                console.log(`   Expected filePath: ${test.expectedFilePath}, got: ${result.filePath}`);
                failed++;
            }
        } else {
            console.log('❌ FAIL - Should pass but failed');
            console.log(`   Error: ${result.error}`);
            failed++;
        }
    } else {
        if (!result.success) {
            console.log('✅ PASS - Correctly rejected');
            console.log(`   Error: ${result.error}`);
            passed++;
        } else {
            console.log('❌ FAIL - Should fail but passed');
            failed++;
        }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
});

console.log(`📊 Results: ${passed}/${tests.length} passed, ${failed}/${tests.length} failed\n`);

if (failed === 0) {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
} else {
    console.log('⚠️  Some tests failed!\n');
    process.exit(1);
}
