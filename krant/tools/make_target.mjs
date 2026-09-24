#!/usr/bin/env node
/**
 * make_target.mjs - Genereert een .mind AR-marker voor één krantenpagina.
 *
 * Gebruik:
 *   cd tools && npm install        (eenmalig)
 *   node make_target.mjs <pagina.png> <output.mind>
 *
 * Bijvoorbeeld:
 *   node make_target.mjs ../pagina.png ../uploads/essays/2026-41/target.mind
 *
 * Tips voor een goed trackbare pagina:
 *   - hoge resolutie (min. 1000px op de lange zijde)
 *   - genoeg contrast en detail; vermijd grote egale vlakken
 *   - gebruik exact dezelfde afbeelding als wat in de krant gedrukt wordt
 */

import fs from 'fs';
import path from 'path';
import { loadImage } from 'canvas';

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
    console.error('Gebruik: node tools/make_target.mjs <pagina-afbeelding> <output.mind>');
    process.exit(1);
}

const inFile = path.resolve(inputPath);
if (!fs.existsSync(inFile)) {
    console.error('Bestand niet gevonden: ' + inFile);
    process.exit(1);
}

let OfflineCompiler;
try {
    ({ OfflineCompiler } = await import('mind-ar/src/image-target/offline-compiler.js'));
} catch (err) {
    console.error('mind-ar niet gevonden. Draai eerst: cd tools && npm install');
    process.exit(1);
}

console.log('Afbeelding laden: ' + inFile);
const img = await loadImage(inFile);

console.log('Compileren (kan een minuut duren)...');
const compiler = new OfflineCompiler();
await compiler.compileImageTargets([img], (progress) => {
    process.stdout.write('\r  Voortgang: ' + Math.round(progress) + '%');
});

const data = compiler.exportData();
const outFile = path.resolve(outputPath);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, Buffer.from(data));

console.log('\nMarker geschreven: ' + outFile + ' (' + (Buffer.byteLength(data) / 1024).toFixed(0) + ' KB)');
