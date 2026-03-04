/**
 * Compileer .mind bestanden voor elke memeborden chunk.
 * Gebruikt MindAR's OfflineCompiler om PNG afbeeldingen te compileren naar .mind bestanden
 * die gebruikt worden voor image-target herkenning in de AR app.
 * 
 * Usage: node tools/compile_memeborden_minds.mjs
 * 
 * Vereisten: canvas (npm package), mind-ar ^1.2.5
 */

import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js';
import { loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHUNKS_FILE = path.join(__dirname, '..', 'verkeersborden', 'data', 'chunks.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'verkeersborden', 'chunks');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function compileChunk(chunk) {
    console.log(`\n📦 Compileer chunk: ${chunk.id} (${chunk.signs.length} borden)`);
    console.log(`   ${chunk.description}`);
    
    const compiler = new OfflineCompiler();
    
    // Laad alle afbeeldingen voor deze chunk
    const images = [];
    for (const sign of chunk.signs) {
        const imgPath = path.join(__dirname, '..', sign.image);
        
        if (!fs.existsSync(imgPath)) {
            console.error(`   ❌ Afbeelding niet gevonden: ${sign.image}`);
            continue;
        }
        
        try {
            const img = await loadImage(imgPath);
            images.push(img);
            // Geen per-image log om spam te voorkomen
        } catch (e) {
            console.error(`   ❌ Kon niet laden: ${sign.id} - ${e.message}`);
        }
    }
    
    if (images.length === 0) {
        console.error(`   ❌ Geen afbeeldingen geladen voor ${chunk.id}`);
        return false;
    }
    
    console.log(`   ${images.length}/${chunk.signs.length} afbeeldingen geladen`);
    
    // Compileer naar .mind formaat
    let lastPercent = 0;
    try {
        const dataList = await compiler.compileImageTargets(images, (progress) => {
            const percent = Math.round(progress);
            if (percent >= lastPercent + 10) {
                process.stdout.write(`   ${percent}%...`);
                lastPercent = percent;
            }
        });
        
        console.log(' 100%');
        
        // Exporteer als .mind bestand
        const exportedBuffer = compiler.exportData();
        
        // Schrijf bestand
        const outputPath = path.join(OUTPUT_DIR, `${chunk.id}.mind`);
        fs.writeFileSync(outputPath, Buffer.from(exportedBuffer));
        
        const sizeMB = (exportedBuffer.byteLength / 1024 / 1024).toFixed(2);
        console.log(`   ✅ ${chunk.id}.mind geschreven (${sizeMB} MB, ${images.length} targets)`);
        
        return true;
    } catch (e) {
        console.error(`   ❌ Compilatie mislukt: ${e.message}`);
        return false;
    }
}

async function main() {
    console.log('🔧 Memeborden MindAR Compiler');
    console.log('─'.repeat(50));
    
    // Lees chunks.json
    const chunksData = JSON.parse(fs.readFileSync(CHUNKS_FILE, 'utf-8'));
    const totalSigns = chunksData.chunks.reduce((s, c) => s + c.signs.length, 0);
    
    console.log(`Chunks: ${chunksData.chunks.length}`);
    console.log(`Totaal borden: ${totalSigns}`);
    console.log(`Output: ${OUTPUT_DIR}`);
    
    // Compileer elke chunk
    let success = 0;
    let failed = 0;
    
    for (const chunk of chunksData.chunks) {
        const ok = await compileChunk(chunk);
        if (ok) success++;
        else failed++;
    }
    
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📊 Resultaat: ${success} chunks gecompileerd, ${failed} mislukt`);
    
    // Toon output bestanden
    if (fs.existsSync(OUTPUT_DIR)) {
        const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.mind'));
        console.log(`\n📁 Output bestanden:`);
        files.forEach(f => {
            const size = (fs.statSync(path.join(OUTPUT_DIR, f)).size / 1024).toFixed(0);
            console.log(`   ${f} (${size} KB)`);
        });
    }
}

main().catch(e => { console.error('Fatale fout:', e); process.exit(1); });
