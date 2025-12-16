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
    
    console.log('Version:', content.v);
    console.log('dataList is Array:', Array.isArray(content.dataList));
    console.log('dataList length:', content.dataList.length);
    if (content.dataList.length > 0) {
        console.log('First item in dataList keys:', Object.keys(content.dataList[0]));
    }
    
} catch (e) {
    console.error('Error:', e);
}
