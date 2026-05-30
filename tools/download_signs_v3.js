#!/usr/bin/env node
/**
 * Download ontbrekende verkeersbord SVGs van Wikimedia Commons en converteer naar PNG.
 * 
 * Strategie: Download de originele SVG (niet thumbnail!) want de thumbnail service
 * blokkeert agressief met rate-limiting (HTTP 429/403).
 * Directe SVG downloads werken wel met redelijke pauze.
 * 
 * Vereisten: rsvg-convert (brew install librsvg)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const CHUNKS_FILE = path.join(__dirname, '..', 'verkeersborden', 'data', 'chunks.json');
const IMAGES_DIR = path.join(__dirname, '..', 'verkeersborden', 'images');
const TEMP_DIR = '/tmp/signs_svg';
const WIKI_API = 'https://commons.wikimedia.org/w/api.php';

// Pauze tussen downloads (3 seconden voor directe SVG is genoeg)
const DOWNLOAD_DELAY_MS = 3000;
// PNG breedte voor conversie
const PNG_WIDTH = 512;

// Controleer of rsvg-convert beschikbaar is
function checkDependencies() {
    try {
        const rsvgPath = execSync('which rsvg-convert', { encoding: 'utf-8' }).trim();
        console.log(`✓ rsvg-convert gevonden: ${rsvgPath}`);
        return rsvgPath;
    } catch {
        console.error('❌ rsvg-convert niet gevonden!');
        console.error('   Installeer met: brew install librsvg');
        process.exit(1);
    }
}

function fetchURL(url) {
    return new Promise((resolve, reject) => {
        const doRequest = (targetUrl, redirectCount = 0) => {
            if (redirectCount > 5) return reject(new Error('Te veel redirects'));
            const mod = targetUrl.startsWith('https') ? https : require('http');
            mod.get(targetUrl, {
                headers: {
                    'User-Agent': 'MemeBordenBot/1.0 (https://interventie.org; educational project)'
                },
                timeout: 30000
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    doRequest(res.headers.location, redirectCount + 1);
                    return;
                }
                if (res.statusCode === 429) {
                    const retryAfter = parseInt(res.headers['retry-after'] || '30') * 1000;
                    console.log(`      ⏳ Rate limited, wacht ${retryAfter / 1000}s...`);
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

function downloadToFile(url, dest) {
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

/**
 * Haal de ORIGINELE (niet thumbnail!) SVG URL op via Wikimedia API.
 * Gebruikt iiprop=url ZONDER iiurlwidth → geeft origineel bestand terug.
 */
async function batchGetOriginalUrls(wikiFilenames) {
    const results = {}; // wiki_filename → originele SVG URL

    for (let i = 0; i < wikiFilenames.length; i += 50) {
        const batch = wikiFilenames.slice(i, i + 50);
        const titles = batch.map(f => `File:${f.replace(/_/g, ' ')}`).join('|');

        const params = new URLSearchParams({
            action: 'query',
            titles: titles,
            prop: 'imageinfo',
            iiprop: 'url', // Alleen URL, geen thumbnail
            format: 'json'
        });

        console.log(`  API batch ${Math.floor(i / 50) + 1}: ${batch.length} bestanden...`);
        const data = await fetchJSON(`${WIKI_API}?${params}`);

        const pages = data.query?.pages || {};
        for (const page of Object.values(pages)) {
            if (page.missing !== undefined) {
                // Bestand niet gevonden op Wikimedia
                const pageTitle = page.title?.replace('File:', '').replace(/ /g, '_');
                if (pageTitle) results[pageTitle] = null;
                continue;
            }
            const originalUrl = page.imageinfo?.[0]?.url;
            if (originalUrl) {
                const pageTitle = page.title.replace('File:', '').replace(/ /g, '_');
                results[pageTitle] = originalUrl;
            }
        }

        if (i + 50 < wikiFilenames.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    return results;
}

/**
 * Converteer SVG naar PNG met rsvg-convert
 */
function convertSvgToPng(svgPath, pngPath, width = PNG_WIDTH) {
    try {
        execSync(`rsvg-convert -w ${width} "${svgPath}" -o "${pngPath}"`, {
            encoding: 'utf-8',
            timeout: 15000
        });
        return fs.existsSync(pngPath) && fs.statSync(pngPath).size > 0;
    } catch (e) {
        console.error(`      Conversie fout: ${e.message}`);
        return false;
    }
}

async function main() {
    console.log('📦 Memeborden SVG downloader + PNG converter v3\n');

    // Controleer dependencies
    checkDependencies();

    // Maak temp directory
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

    // Lees chunks data
    const chunksData = JSON.parse(fs.readFileSync(CHUNKS_FILE, 'utf-8'));

    // Verzamel alle borden
    const allSigns = [];
    for (const chunk of chunksData.chunks) {
        for (const sign of chunk.signs) {
            allSigns.push({ ...sign, chunk: chunk.id });
        }
    }

    console.log(`\nTotaal: ${allSigns.length} borden over ${chunksData.chunks.length} chunks`);

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
        console.log('Alle afbeeldingen zijn al aanwezig! 🎉');
        return;
    }

    // Fase 1: Batch ophalen van ORIGINELE SVG URLs (niet thumbnails!)
    console.log('📡 Fase 1: Originele SVG URLs ophalen via Wikimedia API...');
    const wikiFilenames = missing.map(s => s.wiki_filename);
    const svgUrls = await batchGetOriginalUrls(wikiFilenames);

    const resolved = Object.values(svgUrls).filter(u => u !== null).length;
    const notFound = Object.values(svgUrls).filter(u => u === null).length;
    console.log(`   ${resolved}/${missing.length} URLs gevonden`);
    if (notFound > 0) console.log(`   ${notFound} niet gevonden op Wikimedia`);
    console.log('');

    // Fase 2: Download SVGs + converteer naar PNG
    console.log(`⬇️  Fase 2: SVGs downloaden + converteren naar PNG (${DOWNLOAD_DELAY_MS / 1000}s pauze)...\n`);

    let downloaded = 0;
    let failed = 0;
    const failedSigns = [];

    for (let i = 0; i < missing.length; i++) {
        const sign = missing[i];
        const imgPath = path.join(__dirname, '..', sign.image);
        const dir = path.dirname(imgPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const svgUrl = svgUrls[sign.wiki_filename];

        if (!svgUrl) {
            console.log(`   [${i + 1}/${missing.length}] ${sign.id}: ❌ Niet gevonden op Wikimedia`);
            failedSigns.push({ ...sign, reason: 'Niet op Wikimedia' });
            failed++;
            continue;
        }

        process.stdout.write(`   [${i + 1}/${missing.length}] ${sign.id}: SVG downloaden...`);

        const svgPath = path.join(TEMP_DIR, `${sign.id}.svg`);

        try {
            // Download originele SVG
            await downloadToFile(svgUrl, svgPath);

            // Valideer SVG
            const svgSize = fs.statSync(svgPath).size;
            if (svgSize < 100) {
                throw new Error(`SVG te klein (${svgSize} bytes)`);
            }

            // Converteer SVG → PNG
            process.stdout.write(` → PNG converteren...`);
            const success = convertSvgToPng(svgPath, imgPath);

            if (success) {
                const pngSize = fs.statSync(imgPath).size;
                console.log(` ✅ (${Math.round(pngSize / 1024)}KB)`);
                downloaded++;
            } else {
                console.log(` ❌ Conversie mislukt`);
                failedSigns.push({ ...sign, reason: 'Conversie mislukt' });
                failed++;
            }

            // Verwijder tijdelijke SVG
            fs.unlinkSync(svgPath);

        } catch (e) {
            console.log(` ❌ ${e.message}`);
            failedSigns.push({ ...sign, reason: e.message });
            failed++;
            // Cleanup bij fout
            if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);
        }

        // Pauze tussen downloads
        if (i < missing.length - 1) {
            await new Promise(r => setTimeout(r, DOWNLOAD_DELAY_MS));
        }
    }

    // Cleanup temp dir
    try { fs.rmdirSync(TEMP_DIR); } catch { }

    // Rapport
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📊 Resultaat:`);
    console.log(`   ✅ Gedownload + geconverteerd: ${downloaded}`);
    console.log(`   📁 Al aanwezig: ${existingCount}`);
    console.log(`   ❌ Mislukt: ${failed}`);
    console.log(`   📊 Totaal beschikbaar: ${existingCount + downloaded}/${allSigns.length}`);

    if (failedSigns.length > 0) {
        console.log(`\n⚠️  Handmatig downloaden:`);
        for (const sign of failedSigns) {
            console.log(`   - ${sign.id} (${sign.reason}): https://commons.wikimedia.org/wiki/File:${sign.wiki_filename}`);
        }
    }
}

main().catch(e => { console.error('Fatale fout:', e); process.exit(1); });
