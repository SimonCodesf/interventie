/**
 * Extraheer een enkel target uit een multi-target .mind file
 * Gebruik: node tools/extract_single_target.js <input.mind> <targetIndex> <output.mind>
 */
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('@msgpack/msgpack');

const inputFile = process.argv[2];
const targetIndex = parseInt(process.argv[3]);
const outputFile = process.argv[4];

if (!inputFile || isNaN(targetIndex) || !outputFile) {
    console.error('Gebruik: node extract_single_target.js <input.mind> <targetIndex> <output.mind>');
    process.exit(1);
}

const inputPath = path.resolve(__dirname, '..', inputFile);
const outputPath = path.resolve(__dirname, '..', outputFile);

console.log(`Input: ${inputPath}`);
console.log(`Target index: ${targetIndex}`);
console.log(`Output: ${outputPath}`);

// Lees en decodeer de .mind file
const buffer = fs.readFileSync(inputPath);
const content = decode(new Uint8Array(buffer));

console.log(`Mind file versie: ${content.v}`);
console.log(`Totaal targets: ${content.dataList.length}`);

if (targetIndex >= content.dataList.length) {
    console.error(`Target index ${targetIndex} bestaat niet (max: ${content.dataList.length - 1})`);
    process.exit(1);
}

// Extraheer enkel target
const singleTarget = content.dataList[targetIndex];
console.log(`Target ${targetIndex}: ${singleTarget.targetImage.width}x${singleTarget.targetImage.height}`);

// Maak nieuwe .mind met enkel dit target (index wordt 0)
const newContent = {
    v: content.v,
    dataList: [singleTarget]
};

const encoded = encode(newContent);
fs.writeFileSync(outputPath, Buffer.from(encoded));

console.log(`Klaar! Nieuwe .mind geschreven naar ${outputPath}`);
console.log(`Originele grootte: ${(buffer.length / 1024).toFixed(1)} KB`);
console.log(`Nieuwe grootte: ${(encoded.length / 1024).toFixed(1)} KB`);
