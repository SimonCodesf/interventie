const fs = require('fs');
const { decode, encode } = require('@msgpack/msgpack');

const filePath = process.argv[2];

if (!filePath) {
    console.error('Please provide a file path');
    process.exit(1);
}

try {
    const buffer = fs.readFileSync(filePath);
    const content = decode(buffer);
    
    console.log('Type of content:', typeof content);
    if (Array.isArray(content)) {
        console.log('Is Array: Yes');
        console.log('Length:', content.length);
        console.log('First item keys:', Object.keys(content[0]));
    } else {
        console.log('Is Array: No');
        console.log('Keys:', Object.keys(content));
    }
    
} catch (e) {
    console.error('Error:', e);
}
