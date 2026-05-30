#!/usr/bin/env node
/**
 * Download ontbrekende verkeersbord-afbeeldingen van Wikimedia Commons.
 * Fase 1: Haal alle thumbnail URLs op via batch API (max 50 per request)
 * Fase 2: Download individueel met 5s pauze om rate limiting te voorkomen
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CHUNKS_FILE = path.join(__dirname, '..', 'verkeersborden', 'data', 'chunks.json');
const IMAGES_DIR = path.join(__dirname, '..', 'verkeersborden', 'images');
const WIKI_API = 'https://commons.wikimedia.org/w/api.php';

function fetchURL(url) {
    return new Promise((resolve, reject) => {
        const doRequest = (targetUrl, redirectCount = 0) => {
            if (redirectCount > 5) return reject(new Error('Te veel redirects'));
            const mod = targetUrl.startsWith('https') ? https : require('http');
            mod.get(targetUrl, { 
                headers: { 'User-Agent': 'MemeBordenBot/1.0 (https://interventie.org; educational project; simon@example.com)' },
                timeout: 30000
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    doRequest(res.headers.location, redirectCount + 1);
                    return;
                }
                if (res.statusCode === 429) {
                    // Rate limited - wacht en probeer opnieuw
                    const retryAfter = parseInt(res.headers['retry-after'] || '10') * 1000;
                    console.log(`      ⏳ Rate limited, wacht ${retryAfter/1000}s...`);
                    let body = '';
                    res.on('data', d => body += d);
                    res.on('end', () => {
                        setTimeout(() => doRequest(targetUrl, redirectCount), retryAfter);
                    });
                    return;
                }
                if (res.statusCode !== 200) {
                    let body = '';
                    res.on('data', d => body += d);
                    res.on('end', () => reject(new Error(`HTTP ${res.statusCode}`)));
                    return;
                }
                resolve(res);
            }).on('error', reject);
        };
        doRequest(url);
    });
}

async function fetchJSON(url) {
    const res = await fetchURL(url);
    return new Promise((resolve, reject) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
        });
    });
}

function downloadFile(url, dest) {
    return new Promise(async (resolve, reject) => {
        try {
            const res = await fetchURL(url);
            const fileStream = fs.createWriteStream(dest);
            res.pipe(fileStream);
            fileStream.on('finish', () => { fileStream.close(); resolve(); });
            fileStream.on('error', reject);
        } catch (e) {
            reject(e);
        }
    });
}

// Batch opvragen van thumbnail URLs via Wikimedia API (max 50 titels per request)
async function batchGetThumbUrls(wikiFilenames, width = 512) {
    const results = {};  // wiki_filename → thumbUrl
    
    // Splits in groepen van 50 (API limiet)
    for (let i = 0; i < wikiFilenames.length; i += 50) {
        const batch = wikiFilenames.slice(i, i + 50);
        const titles = batch.map(f => `File:${f.replace(/_/g, ' ')}`).join('|');
        
        const params = new URLSearchParams({
            action: 'query',
            titles: titles,
            prop: 'imageinfo',
            iiprop: 'url',
            iiurlwidth: width.toString(),
            format: 'json'
        });
        
        console.log(`  API batch ${Math.floor(i/50) + 1}: ${batch.length} bestanden...`);
        const data = await fetchJSON(`${WIKI_API}?${params}`);
        
        const pages = data.query?.pages || {};
        for (const page of Object.values(pages)) {
            if (page.missing !== undefined) continue;
            const thumbUrl = page.imageinfo?.[0]?.thumburl;
            if (thumbUrl) {
                // Match terug naar originele filename
                const pageTitle = page.title.replace('File:', '').replace(/ /g, '_');
                results[pageTitle] = thumbUrl;
            }
        }
        
        // Korte pauze tussen API calls
        if (i + 50 < wikiFilenames.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    
    return results;
}

async function main() {
    console.log('📦 Memeborden image downloader v2\n');
    
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
    let existingCount = 0;
    
    for (const sign of allSigns) {
        const imgPath = path.join(__dirname, '..', sign.image);
        if (fs.existsSync(imgPath)) {
            existingCount++;
        } else {
            missing.push(sign);
        }
    }
    
    console.log(`✅ Bestaand: ${existingCount}`);
    console.log(`❌ Ontbrekend: ${missing.length}\n`);
    
    if (missing.length === 0) {
        console.log('Alle afbeeldingen zijn al aanwezig!');
        return;
    }
    
    // Fase 1: Batch ophalen van alle thumbnail URLs
    console.log('📡 Fase 1: Thumbnail URLs ophalen via Wikimedia API...');
    const wikiFilenames = missing.map(s => s.wiki_filename);
    const thumbUrls = await batchGetThumbUrls(wikiFilenames);
    
    const resolved = Object.keys(thumbUrls).length;
    console.log(`   ${resolved}/${missing.length} URLs gevonden\n`);
    
    // Fase 2: Download individueel met pauze
    console.log('⬇️  Fase 2: Afbeeldingen downloaden (5s pauze per download)...\n');
    
    let downloaded = 0;
    let failed = 0;
    const failedSigns = [];
    
    for (let i = 0; i < missing.length; i++) {
        const sign = missing[i];
        const imgPath = path.join(__dirname, '..', sign.image);
        const dir = path.dirname(imgPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const thumbUrl = thumbUrls[sign.wiki_filename];
        
        if (!thumbUrl) {
            console.log(`   [${i+1}/${missing.length}] ${sign.id}: ❌ Geen URL gevonden op Wikimedia`);
            failedSigns.push(sign);
            failed++;
            continue;
        }
        
        process.stdout.write(`   [${i+1}/${missing.length}] ${sign.id}: downloaden...`);
        
        try {
            await downloadFile(thumbUrl, imgPath);
            console.log(` ✅`);
            downloaded++;
        } catch (e) {
            console.log(` ❌ ${e.message}`);
            failedSigns.push(sign);
            failed++;
        }
        
        // 5 seconden pauze tussen downloads (Wikimedia rate limit = ~200/min maar thumbnails strenger)
        if (i < missing.length - 1) {
            await new Promise(r => setTimeout(r, 5000));
        }
    }
    
    console.log(`\n📊 Resultaat: ${downloaded} gedownload, ${failed} mislukt`);
    
    if (failedSigns.length > 0) {
        console.log('\n⚠️  Handmatig downloaden:');
        for (const sign of failedSigns) {
            console.log(`   - ${sign.id}: https://commons.wikimedia.org/wiki/File:${sign.wiki_filename}`);
        }
    }
}

main().catch(e => { console.error('Fatale fout:', e); process.exit(1); });
