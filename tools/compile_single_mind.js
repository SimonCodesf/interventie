#!/usr/bin/env node
/**
 * Compileer een enkele poster JPEG naar een .mind bestand
 * Wordt aangeroepen door PHP na reclame-upload (of poster zonder .mind)
 * 
 * Gebruik: node tools/compile_single_mind.js <poster-id> <jpeg-path>
 * Output: assets/nft/<poster-id>/<poster-id>.mind
 */

const fs = require('fs');
const path = require('path');

const posterId = process.argv[2];
const jpegPath = process.argv[3];

if (!posterId || !jpegPath) {
    console.error('Gebruik: node compile_single_mind.js <poster-id> <jpeg-pad>');
    process.exit(1);
}

const absoluteJpegPath = path.resolve(jpegPath);
const outputDir = path.resolve(__dirname, '../assets/nft', posterId);
const outputFile = path.join(outputDir, posterId + '.mind');

async function compileMind() {
    console.log(`[MIND-COMPILE] Start compilatie voor poster: ${posterId}`);
    console.log(`[MIND-COMPILE] JPEG: ${absoluteJpegPath}`);
    
    if (!fs.existsSync(absoluteJpegPath)) {
        console.error(`[MIND-COMPILE] FOUT: JPEG niet gevonden: ${absoluteJpegPath}`);
        process.exit(1);
    }
    
    // Maak output directory aan
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
        // Dynamische import voor ESM modules
        const { OfflineCompiler } = await import('mind-ar/src/image-target/offline-compiler.js');
        const { createCanvas, loadImage } = await import('canvas');
        
        const compiler = new OfflineCompiler();
        
        // Laad de poster afbeelding
        console.log('[MIND-COMPILE] Afbeelding laden...');
        const img = await loadImage(absoluteJpegPath);
        console.log(`[MIND-COMPILE] Afbeelding geladen: ${img.width}x${img.height}`);
        
        // Compileer naar MindAR target (1 afbeelding = 1 target)
        console.log('[MIND-COMPILE] Compileren...');
        await compiler.compileImageTargets([img], (progress) => {
            const percent = Math.round(progress);
            if (percent % 25 === 0) {
                console.log(`[MIND-COMPILE] Voortgang: ${percent}%`);
            }
        });
        
        // Exporteer .mind bestand
        const exportData = compiler.exportData();
        const buffer = Buffer.from(exportData);
        fs.writeFileSync(outputFile, buffer);
        
        const fileSizeKB = (buffer.length / 1024).toFixed(1);
        console.log(`[MIND-COMPILE] Succesvol! ${outputFile} (${fileSizeKB} KB)`);
        process.exit(0);
        
    } catch (err) {
        console.error(`[MIND-COMPILE] FOUT bij compilatie: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    }
}

compileMind();
