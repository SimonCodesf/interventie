#!/usr/bin/env node
/**
 * MindAR Compiler voor Belgische Verkeersborden
 * 
 * Compileert de top 30 verkeersbord PNG's naar een .mind bestand
 * voor AR tracking met MindAR.
 * 
 * Gebruik: node tools/compile_signs_mind.js
 * 
 * Vereist: mind-ar + canvas npm pakketten (npm install in tools/)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, '..');
const IMAGES_DIR = path.resolve(BASE_DIR, 'verkeersborden/images');
const DATA_DIR = path.resolve(BASE_DIR, 'verkeersborden/data');
const OUTPUT_FILE = path.resolve(BASE_DIR, 'verkeersborden/signs-top30.mind');
const TOP30_FILE = path.resolve(DATA_DIR, 'top30.json');

async function main() {
    console.log('=== MindAR Verkeersborden Compiler ===\n');
    
    // Laad top30 data
    if (!fs.existsSync(TOP30_FILE)) {
        console.error('FOUT: top30.json niet gevonden. Draai eerst de scraper:');
        console.error('  node tools/scrape_verkeersborden.js --download --top30-only');
        process.exit(1);
    }
    
    const top30Data = JSON.parse(fs.readFileSync(TOP30_FILE, 'utf8'));
    const signs = top30Data.signs;
    
    console.log(`Gevonden: ${signs.length} borden in top30.json`);
    
    // Controleer of alle afbeeldingen bestaan
    const missingImages = [];
    const imagePaths = [];
    
    for (const sign of signs) {
        const imgPath = path.resolve(BASE_DIR, sign.image);
        if (!fs.existsSync(imgPath)) {
            missingImages.push(sign.id);
        } else {
            imagePaths.push(imgPath);
        }
    }
    
    if (missingImages.length > 0) {
        console.error(`FOUT: ${missingImages.length} afbeeldingen ontbreken:`);
        missingImages.forEach(id => console.error(`  - ${id}.png`));
        console.error('\nDraai de scraper opnieuw met --download:');
        console.error('  node tools/scrape_verkeersborden.js --download --top30-only');
        process.exit(1);
    }
    
    console.log(`Alle ${imagePaths.length} afbeeldingen gevonden.\n`);
    console.log('MindAR compiler starten...');
    console.log('(Dit kan enkele minuten duren)\n');
    
    try {
        // Importeer de MindAR OfflineCompiler (gebruikt canvas ipv browser)
        const { OfflineCompiler } = await import('mind-ar/src/image-target/offline-compiler.js');
        
        const compiler = new OfflineCompiler();
        
        // Laad afbeeldingen als canvas Image objecten
        // De MindAR compiler verwacht objecten die met drawImage() werken
        const imageList = [];
        
        for (let i = 0; i < imagePaths.length; i++) {
            const sign = signs[i];
            console.log(`  [${i + 1}/${imagePaths.length}] ${sign.id}: ${sign.name}`);
            
            const img = await loadImage(imagePaths[i]);
            imageList.push(img);
        }
        
        console.log('\nCompileren...');
        
        // Compileer alle afbeeldingen naar één .mind bestand
        await compiler.compileImageTargets(imageList, (progress) => {
            const percent = Math.round(progress);
            process.stdout.write(`\r  Voortgang: ${percent}%`);
        });
        
        console.log('\n\nExporteren naar .mind bestand...');
        
        // Exporteer het gecompileerde bestand
        const exportData = compiler.exportData();
        
        // Schrijf het .mind bestand
        const buffer = Buffer.from(exportData);
        fs.writeFileSync(OUTPUT_FILE, buffer);
        
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        console.log(`\n=== Compilatie succesvol! ===`);
        console.log(`Bestand: ${OUTPUT_FILE}`);
        console.log(`Grootte: ${fileSizeMB} MB`);
        console.log(`Targets: ${imagePaths.length}`);
        console.log(`\nTargetIndex mapping:`);
        
        signs.forEach((sign, i) => {
            console.log(`  ${i}: ${sign.id} - ${sign.name}`);
        });
        
        // Update top30.json met targetIndex
        signs.forEach((sign, i) => {
            sign.targetIndex = i;
        });
        fs.writeFileSync(TOP30_FILE, JSON.stringify(top30Data, null, 2), 'utf8');
        console.log('\ntop30.json bijgewerkt met targetIndex mapping.');
        
    } catch (err) {
        console.error('\nFOUT bij compilatie:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatale fout:', err);
    process.exit(1);
});
