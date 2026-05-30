#!/usr/bin/env node
/**
 * Download ontbrekende verkeersbord-afbeeldingen van Wikimedia Commons.
 * Leest chunks.json, checkt welke images ontbreken, downloadt SVG → converteert naar PNG.
 * 
 * Gebruik: node tools/download_signs.js
 * Vereist: geen extra dependencies (gebruikt native fetch + child_process voor SVG→PNG)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const CHUNKS_FILE = path.join(__dirname, '..', 'verkeersborden', 'data', 'chunks.json');
const IMAGES_DIR = path.join(__dirname, '..', 'verkeersborden', 'images');

// Wikimedia Commons API voor het ophalen van SVG download URL
const WIKI_API = 'https://commons.wikimedia.org/w/api.php';

async function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'MemeBorden/1.0 (educational project)' } }, (res) => {
            // Volg redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchJSON(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`JSON parse fout: ${e.message}`)); }
            });
        });
        req.on('error', reject);
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const makeRequest = (targetUrl) => {
            const mod = targetUrl.startsWith('https') ? https : require('http');
            mod.get(targetUrl, { headers: { 'User-Agent': 'MemeBorden/1.0 (educational project)' } }, (res) => {
                // Volg redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    makeRequest(res.headers.location);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode} voor ${targetUrl}`));
                    return;
                }
                const fileStream = fs.createWriteStream(dest);
                res.pipe(fileStream);
                fileStream.on('finish', () => { fileStream.close(); resolve(); });
                fileStream.on('error', reject);
            }).on('error', reject);
        };
        makeRequest(url);
    });
}

async function getSvgUrl(wikiFilename) {
    // Gebruik Wikimedia API om de directe SVG download URL op te halen
    const params = new URLSearchParams({
        action: 'query',
        titles: `File:${wikiFilename}`,
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json'
    });
    
    const data = await fetchJSON(`${WIKI_API}?${params}`);
    const pages = data.query?.pages;
    if (!pages) return null;
    
    const page = Object.values(pages)[0];
    if (page.missing !== undefined) return null;
    
    return page.imageinfo?.[0]?.url || null;
}

// Wikimedia biedt thumbnails in PNG formaat aan — direct een 512px breed PNG ophalen
function getThumbUrl(wikiFilename, width = 512) {
    // Wikimedia thumbnail URL formaat:
    // https://upload.wikimedia.org/wikipedia/commons/thumb/HASH/FILENAME/WIDTHpx-FILENAME.png
    // Maar we kennen de hash niet, dus gebruiken we de API
    return null; // Fallback naar SVG + conversie
}

async function getPngThumbUrl(wikiFilename, width = 512) {
    // Wikimedia verwacht spaties i.p.v. underscores in 'titles' parameter
    const titleName = wikiFilename.replace(/_/g, ' ');
    const params = new URLSearchParams({
        action: 'query',
        titles: `File:${titleName}`,
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: width.toString(),
        format: 'json'
    });
    
    const data = await fetchJSON(`${WIKI_API}?${params}`);
    const pages = data.query?.pages;
    if (!pages) return null;
    
    const page = Object.values(pages)[0];
    if (page.missing !== undefined) return null;
    
    // thumburl is de geschaalde PNG versie van de SVG
    return page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url || null;
}

async function main() {
    console.log('📦 Memeborden image downloader\n');
    
    // Lees chunks.json
    const chunksData = JSON.parse(fs.readFileSync(CHUNKS_FILE, 'utf-8'));
    
    // Verzamel alle borden
    const allSigns = [];
    for (const chunk of chunksData.chunks) {
        for (const sign of chunk.signs) {
            allSigns.push({ ...sign, chunk: chunk.id });
        }
    }
    
    console.log(`Totaal: ${allSigns.length} borden over ${chunksData.chunks.length} chunks\n`);
    
    // Check welke images ontbreken
    const missing = [];
    const existing = [];
    
    for (const sign of allSigns) {
        const imgPath = path.join(__dirname, '..', sign.image);
        if (fs.existsSync(imgPath)) {
            existing.push(sign);
        } else {
            missing.push(sign);
        }
    }
    
    console.log(`✅ Bestaand: ${existing.length}`);
    console.log(`❌ Ontbrekend: ${missing.length}\n`);
    
    if (missing.length === 0) {
        console.log('Alle afbeeldingen zijn al aanwezig!');
        return;
    }
    
    // Download ontbrekende afbeeldingen
    let downloaded = 0;
    let failed = 0;
    
    for (const sign of missing) {
        const imgPath = path.join(__dirname, '..', sign.image);
        const dir = path.dirname(imgPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        console.log(`⬇️  ${sign.id} (${sign.chunk}): ${sign.wiki_filename}...`);
        
        try {
            // Probeer eerst PNG thumbnail (512px breed, geen SVG conversie nodig)
            const thumbUrl = await getPngThumbUrl(sign.wiki_filename, 512);
            
            if (thumbUrl) {
                await downloadFile(thumbUrl, imgPath);
                downloaded++;
                console.log(`   ✅ Gedownload: ${path.basename(imgPath)}`);
            } else {
                // Fallback: download SVG en converteer handmatig
                const svgUrl = await getSvgUrl(sign.wiki_filename);
                if (svgUrl) {
                    const svgPath = imgPath.replace('.png', '.svg');
                    await downloadFile(svgUrl, svgPath);
                    
                    // Probeer conversie met sips (macOS) of rsvg-convert
                    try {
                        // macOS: sips kan geen SVG, probeer qlmanage voor PNG thumbnail
                        execSync(`qlmanage -t -s 512 -o "${dir}" "${svgPath}" 2>/dev/null`, { stdio: 'pipe' });
                        const qlOutput = svgPath.replace('.svg', '.svg.png');
                        if (fs.existsSync(qlOutput)) {
                            fs.renameSync(qlOutput, imgPath);
                        }
                    } catch {
                        // Bewaar SVG voor handmatige conversie
                        console.log(`   ⚠️  SVG gedownload, handmatige PNG conversie nodig: ${svgPath}`);
                    }
                    
                    // Cleanup SVG als PNG bestaat
                    if (fs.existsSync(imgPath)) {
                        if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);
                        downloaded++;
                        console.log(`   ✅ Geconverteerd: ${path.basename(imgPath)}`);
                    } else {
                        failed++;
                    }
                } else {
                    console.log(`   ❌ Niet gevonden op Wikimedia: ${sign.wiki_filename}`);
                    failed++;
                }
            }
            
            // Langere pauze om Wikimedia rate limiting (429) te voorkomen
            await new Promise(r => setTimeout(r, 2000));
            
        } catch (e) {
            console.log(`   ❌ Fout: ${e.message}`);
            failed++;
        }
    }
    
    console.log(`\n📊 Resultaat: ${downloaded} gedownload, ${failed} mislukt`);
    
    if (failed > 0) {
        console.log('\n⚠️  Ontbrekende borden die handmatig gedownload moeten worden:');
        for (const sign of missing) {
            const imgPath = path.join(__dirname, '..', sign.image);
            if (!fs.existsSync(imgPath)) {
                console.log(`   - ${sign.id}: https://commons.wikimedia.org/wiki/File:${sign.wiki_filename}`);
            }
        }
    }
}

main().catch(e => { console.error('Fatale fout:', e); process.exit(1); });
