/**
 * Test for the "both" type fix in handleAddPrivateResponseCommand
 */

import { handleCommand } from '../plugins/commands.js';

console.log('🧪 Testing "كامل" (both) response type fix...\n');

// Mock objects
const sock = {};
const telegramBot = {};

// Test case 1: Correct usage with 3 parts (keywords | text | filepath)
const msg1 = {
    key: {
        remoteJid: '201234567890@s.whatsapp.net',
        participant: '201234567890@s.whatsapp.net',
        id: 'test1'
    },
    pushName: 'Test User',
    message: {
        conversation: '.اضافة_رد كامل اسايمنت | ✍️ Assignment المحاضرة الأولى | /path/to/assignment.jpg'
    }
};

console.log('Test 1: Correct usage (3 parts separated by |)');
console.log('Command: .اضافة_رد كامل اسايمنت | ✍️ Assignment المحاضرة الأولى | /path/to/assignment.jpg\n');

handleCommand(msg1, sock, telegramBot).then(result => {
    if (result && result.handled && result.response.includes('✅')) {
        console.log('✅ PASS - Command accepted');
        console.log('Response:', result.response);
    } else {
        console.log('❌ FAIL - Command should be accepted');
        console.log('Response:', result ? result.response : 'No response');
    }
    console.log('\n' + '='.repeat(60) + '\n');

    // Test case 2: Incorrect usage with only 2 parts (should fail)
    const msg2 = {
        key: {
            remoteJid: '201234567890@s.whatsapp.net',
            participant: '201234567890@s.whatsapp.net',
            id: 'test2'
        },
        pushName: 'Test User',
        message: {
            conversation: '.اضافة_رد كامل اسايمنت | /path/to/assignment.jpg'
        }
    };

    console.log('Test 2: Incorrect usage (only 2 parts)');
    console.log('Command: .اضافة_رد كامل اسايمنت | /path/to/assignment.jpg\n');

    return handleCommand(msg2, sock, telegramBot);
}).then(result => {
    if (result && result.handled && result.response.includes('❌')) {
        console.log('✅ PASS - Command correctly rejected');
        console.log('Response:', result.response);
    } else {
        console.log('❌ FAIL - Command should be rejected');
        console.log('Response:', result ? result.response : 'No response');
    }
    console.log('\n' + '='.repeat(60) + '\n');

    // Test case 3: Multiple keywords with correct both format
    const msg3 = {
        key: {
            remoteJid: '201234567890@s.whatsapp.net',
            participant: '201234567890@s.whatsapp.net',
            id: 'test3'
        },
        pushName: 'Test User',
        message: {
            conversation: '.اضافة_رد كامل اسايمنت,assignment,واجب | 📝 تفاصيل الواجب | /path/to/file.pdf'
        }
    };

    console.log('Test 3: Multiple keywords with correct format');
    console.log('Command: .اضافة_رد كامل اسايمنت,assignment,واجب | 📝 تفاصيل الواجب | /path/to/file.pdf\n');

    return handleCommand(msg3, sock, telegramBot);
}).then(result => {
    if (result && result.handled && result.response.includes('✅')) {
        console.log('✅ PASS - Command accepted with multiple keywords');
        console.log('Response:', result.response);
    } else {
        console.log('❌ FAIL - Command should be accepted');
        console.log('Response:', result ? result.response : 'No response');
    }
    console.log('\n🎉 All tests completed!\n');
}).catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
});
