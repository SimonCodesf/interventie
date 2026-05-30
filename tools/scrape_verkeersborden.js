#!/usr/bin/env node
/**
 * Scraper voor Belgische verkeersborden van Wikipedia
 * 
 * Dit script:
 * 1. Scraped alle verkeersborden van de Belgische Wikipedia-pagina's (series A-F)
 * 2. Download PNG renders van Wikimedia Commons (512px breed)
 * 3. Genereert verkeersborden/data/signs.json met alle metadata
 * 4. Markeert de top 30 meest voorkomende borden
 *
 * Gebruik: node tools/scrape_verkeersborden.js [--download] [--top30-only]
 *   --download     Download ook de PNG afbeeldingen
 *   --top30-only   Download alleen de top 30 borden
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// === CONFIGURATIE ===
const BASE_DIR = path.resolve(__dirname, '..');
const IMAGES_DIR = path.resolve(BASE_DIR, 'verkeersborden/images');
const DATA_DIR = path.resolve(BASE_DIR, 'verkeersborden/data');
const PNG_WIDTH = 512; // Breedte voor PNG renders (voor MindAR tracking)
const DOWNLOAD_DELAY = 2000; // ms tussen downloads (respecteer Wikimedia rate limits)
const MAX_RETRIES = 3; // Maximaal aantal herhaalpogingen bij 429 errors
const RETRY_BACKOFF = 5000; // Basis wachttijd bij retry (wordt vermenigvuldigd)

// Wikipedia pagina's per serie (niet-geëncodeerde titels)
const WIKI_PAGES = {
    'A': 'Verkeersborden in België - Serie A: Gevaarsborden',
    'B': 'Verkeersborden in België - Serie B: Voorrangsborden',
    'C': 'Verkeersborden in België - Serie C: Verbodsborden',
    'D': 'Verkeersborden in België - Serie D: Gebodsborden',
    'E': 'Verkeersborden in België - Serie E: Parkeren- en stilstaanborden',
    'F': 'Verkeersborden in België - Serie F: Aanwijzingsborden',
};

// Serie namen in het Nederlands
const SERIE_NAMEN = {
    'A': 'Gevaarsborden',
    'B': 'Voorrangsborden',
    'C': 'Verbodsborden',
    'D': 'Gebodsborden',
    'E': 'Parkeer- en stilstaanborden',
    'F': 'Aanwijzingsborden',
};

// Top 30 meest voorkomende Belgische verkeersborden
const TOP_30_CODES = [
    'A1a',  // Gevaarlijke bocht links
    'A1b',  // Gevaarlijke bocht rechts
    'A7a',  // Rijbaanversmalling
    'A13',  // Dwarse uitholling / ezelsrug
    'A14',  // Verkeersdrempel
    'A15',  // Gladde rijbaan
    'A21',  // Oversteekplaats voetgangers
    'A23',  // Kinderen
    'A25',  // Oversteekplaats fietsers
    'A31',  // Werken
    'A33',  // Verkeerslichten
    'A39',  // Twee richtingsverkeer
    'A49',  // Tramsporen
    'A50',  // File
    'A51',  // Algemeen gevaar
    'B1',   // Voorrang verlenen
    'B5',   // Stop
    'B9',   // Voorrangsweg
    'B15',  // Rotonde
    'C1',   // Verboden richting
    'C3',   // Verboden toegang
    'C31',  // Verboden voor motorvoertuigen
    'C43',  // Snelheidsbeperking (generiek)
    'D1',   // Verplichting rechtdoor
    'D5',   // Rotonde verplicht
    'E1',   // Parkeerverbod
    'E3',   // Stilstaan en parkeren verboden
    'F1',   // Begin bebouwde kom
    'F3',   // Einde bebouwde kom
    'F19',  // Eenrichtingsverkeer
];

// Engelse vertalingen voor Klipy GIF zoekopdrachten
// Verkort voor betere zoekresultaten
const TRANSLATIONS = {
    // A-serie gevaarsborden
    "A1a": "sharp left turn",
    "A1b": "sharp right turn",
    "A1c": "winding road",
    "A1d": "winding road",
    "A3": "steep downhill",
    "A5": "steep hill climb",
    "A7a": "road narrows",
    "A7b": "road squeeze left",
    "A7c": "road squeeze right",
    "A9": "drawbridge opening",
    "A11": "cliff edge water",
    "A13": "speed bump road",
    "A14": "speed bump",
    "A15": "slippery road ice",
    "A17": "gravel road",
    "A19": "falling rocks",
    "A21": "pedestrian crossing",
    "A23": "children school",
    "A25": "cyclists crossing",
    "A27": "deer crossing",
    "A29": "cows road",
    "A31": "road construction",
    "A33": "traffic light red",
    "A35": "low flying aircraft",
    "A37": "strong crosswind",
    "A39": "two way traffic",
    "A41": "railway crossing boom",
    "A43": "train crossing",
    "A45": "railway single track",
    "A47": "railway multi track",
    "A49": "tram tracks road",
    "A50": "traffic jam rage",
    "A51": "danger warning",
    // B-serie voorrangsborden
    "B1": "yield sign",
    "B3": "yield sign triangle",
    "B5": "stop sign",
    "B9": "priority road",
    "B11": "end priority road",
    "B15": "roundabout",
    "B17": "narrow passage yield",
    "B19": "narrow passage priority",
    "B21": "bike right red",
    "B22": "bike straight red",
    "B23": "bike right red light",
    // C-serie verbodsborden
    "C1": "wrong way",
    "C3": "no entry",
    "C5": "no cars allowed",
    "C7": "no motorcycles",
    "C9": "no mopeds",
    "C11": "no bicycles",
    "C13": "no horse cart",
    "C15": "no horse riding",
    "C21": "no heavy trucks",
    "C22": "no buses",
    "C23": "no trucks",
    "C24a": "no hazmat",
    "C24b": "no flammable",
    "C24c": "no pollutants",
    "C25": "no long vehicles",
    "C27": "no wide load",
    "C31": "no cars allowed",
    "C33": "no pedestrians",
    "C35": "no overtaking",
    "C39": "no truck passing",
    "C37": "end no passing",
    "C43": "speed limit",
    "C45": "end speed limit",
    "C47": "all restrictions lifted",
    // D-serie gebodsborden
    "D1": "straight ahead mandatory",
    "D3": "turn left mandatory",
    "D5": "roundabout mandatory",
    "D7": "keep right",
    "D9": "bike lane mandatory",
    "D10": "shared path pedestrians",
    // E-serie parkeren
    "E1": "no parking",
    "E3": "no stopping",
    "E5": "no parking odd",
    "E7": "no parking even",
    "E9a": "parking allowed",
    "E9b": "electric car charging",
    "E9c": "handicap parking",
    "E9d": "parking disc",
    "E9e": "cars only parking",
    "E9f": "trucks only parking",
    "E9g": "bus parking",
    // F-serie aanwijzingsborden
    "F1": "entering village town",
    "F1a": "entering town",
    "F3": "leaving town",
    "F5": "highway entrance",
    "F7": "highway exit",
    "F9": "cars only road",
    "F11": "end car road",
    "F13": "information sign",
    "F14": "dead end street",
    "F19": "one way street",
    "F21": "end one way",
    "F34a": "pedestrian crossing zone",
    "F34b": "end pedestrian zone",
    "F41": "hospital sign",
    "F43": "tourist information",
    "F49": "first aid emergency",
    "F51": "gas station",
    "F53": "car breakdown repair",
    "F55": "car wash",
    "F57": "drinking water",
    "F59": "public restroom",
    "F61": "electric charging station",
    "F63": "hotel motel",
    "F65": "restaurant eating",
    "F67": "bar drinks",
    "F69": "camping tent",
    "F71": "youth hostel",
    "F73": "airport plane",
    "F75": "train station",
    "F77": "harbour port",
    "F99a": "bicycle street",
    "F99b": "end bicycle street",
    "F101a": "pedestrian zone",
    "F101b": "end pedestrian zone",
    "F111": "speed zone",
    "F113": "end speed zone",
};

// === HELPER FUNCTIES ===

/**
 * HTTP(S) GET request met redirect volgen
 */
function httpGet(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) return reject(new Error('Te veel redirects'));
        
        const lib = url.startsWith('https') ? https : http;
        lib.get(url, { 
            headers: { 
                'User-Agent': 'MemebordenBot/1.0 (interventie.org; educatief project)' 
            }
        }, (res) => {
            // Volg redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const urlObj = new URL(url);
                    redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
                }
                return resolve(httpGet(redirectUrl, maxRedirects - 1));
            }
            
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} voor ${url}`));
            }
            
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Download een bestand en sla op naar pad
 */
async function downloadFile(url, destPath) {
    const data = await httpGet(url);
    fs.writeFileSync(destPath, data);
    return data.length;
}

/**
 * Wacht een aantal milliseconden
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse Wikipedia API HTML en extraheer bord-codes en beschrijvingen
 * De HTML structuur bevat gallery items met:
 *   <a href="..." title="A1a: Gevaarlijke bocht naar links.">
 *   en Belgian_road_sign_A1a.svg als bestandsnaam
 */
function parseWikiPage(html, serie) {
    const signs = [];
    const seen = new Set();
    
    // Patroon: gallery items met title="CODE: BESCHRIJVING" en Belgian_road_sign_CODE.svg
    // We zoeken naar gallerybox items die zowel een bestandsnaam als beschrijving bevatten
    
    // Stap 1: Zoek alle gallery items via gallerytext div
    // Formaat: <div class="gallerytext">A1a: Gevaarlijke bocht naar links.</div>
    const galleryRegex = /<li class="gallerybox"[^>]*>([\s\S]*?)<\/li>/g;
    let galleryMatch;
    
    while ((galleryMatch = galleryRegex.exec(html)) !== null) {
        const block = galleryMatch[1];
        
        // Zoek bestandsnaam
        const fileMatch = block.match(/Belgian_(?:road|traffic)_sign_([A-Za-z0-9_()]+)\.svg/);
        if (!fileMatch) continue;
        
        const filename = `Belgian_road_sign_${fileMatch[1]}.svg`;
        // Verwerk de raw code: verwijder haakjes, trailing underscores
        let rawCode = fileMatch[1];
        
        // Zoek beschrijving in gallerytext
        const textMatch = block.match(/<div class="gallerytext">\s*([^<]+)/);
        if (!textMatch) continue;
        
        const fullText = textMatch[1].trim();
        // Parse "CODE: BESCHRIJVING" formaat
        const codeDescMatch = fullText.match(/^([A-Za-z0-9]+[a-z]*):\s*(.+?)\.?\s*$/);
        
        let code, description;
        if (codeDescMatch) {
            code = codeDescMatch[1];
            description = codeDescMatch[2].trim();
        } else {
            // Fallback: gebruik raw code uit bestandsnaam
            code = rawCode.replace(/[_()\s]+$/, '').replace(/[()]/g, '');
            description = fullText.replace(/\.?\s*$/, '');
        }
        
        // Skip duplicaten
        if (seen.has(code)) continue;
        seen.add(code);
        
        // Bepaal de correcte wiki bestandsnaam (kan afwijken door haakjes etc.)
        const actualFilename = fileMatch[0].endsWith('.svg') 
            ? `Belgian_road_sign_${fileMatch[1]}.svg`
            : fileMatch[0];
        
        signs.push({
            id: code,
            name: description,
            serie: serie,
            wiki_filename: actualFilename,
            search_query: TRANSLATIONS[code] || null,
        });
    }
    
    return signs;
}

/**
 * Haal Wikipedia pagina op via MediaWiki API (geeft gestructureerde HTML)
 */
async function fetchWikiPage(pageTitle) {
    const encodedTitle = encodeURIComponent(pageTitle);
    const apiUrl = `https://nl.wikipedia.org/w/api.php?action=parse&page=${encodedTitle}&prop=text&format=json&formatversion=2`;
    console.log(`  Ophalen: ${pageTitle}`);
    
    const data = await httpGet(apiUrl);
    const json = JSON.parse(data.toString('utf8'));
    
    if (json.error) {
        throw new Error(`Wikipedia API fout: ${json.error.info}`);
    }
    
    return json.parse.text;
}

/**
 * Download PNG render van Wikipedia SVG via Wikimedia Commons
 * Gebruikt Special:Redirect/file voor directe PNG conversie
 */
async function downloadSignPNG(wikiFilename, destPath) {
    // Wikimedia Commons biedt PNG renders van SVGs via de thumb API
    const url = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(wikiFilename)}?width=${PNG_WIDTH}`;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const size = await downloadFile(url, destPath);
            return { success: true, size };
        } catch (err) {
            const isRateLimit = err.message.includes('429');
            if (isRateLimit && attempt < MAX_RETRIES) {
                const waitTime = RETRY_BACKOFF * attempt;
                console.log(`    Rate limited (429), wacht ${waitTime/1000}s (poging ${attempt}/${MAX_RETRIES})...`);
                await sleep(waitTime);
            } else if (attempt < MAX_RETRIES) {
                console.log(`    Fout: ${err.message}, herpoging ${attempt}/${MAX_RETRIES}...`);
                await sleep(2000);
            } else {
                console.error(`    FOUT na ${MAX_RETRIES} pogingen: ${err.message}`);
                return { success: false, error: err.message };
            }
        }
    }
    return { success: false, error: 'Max retries bereikt' };
}

// === HOOFDLOGICA ===

async function main() {
    const args = process.argv.slice(2);
    const shouldDownload = args.includes('--download');
    const top30Only = args.includes('--top30-only');
    
    console.log('=== Belgische Verkeersborden Scraper ===');
    console.log(`Modus: ${shouldDownload ? 'Scrape + Download' : 'Alleen scrape'}`);
    console.log(`Filter: ${top30Only ? 'Alleen top 30' : 'Alle borden'}\n`);
    
    // Zorg dat mappen bestaan
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    fs.mkdirSync(DATA_DIR, { recursive: true });
    
    // Verzamel alle borden van alle series
    let allSigns = [];
    
    for (const [serie, pageTitle] of Object.entries(WIKI_PAGES)) {
        console.log(`\n--- Serie ${serie}: ${SERIE_NAMEN[serie]} ---`);
        
        try {
            const html = await fetchWikiPage(pageTitle);
            const signs = parseWikiPage(html, serie);
            console.log(`  Gevonden: ${signs.length} borden`);
            
            allSigns.push(...signs);
            
            // Respecteer rate limits
            await sleep(500);
        } catch (err) {
            console.error(`  FOUT bij serie ${serie}: ${err.message}`);
        }
    }
    
    // Verwijder duplicaten (op basis van id)
    const seenIds = new Set();
    allSigns = allSigns.filter(sign => {
        if (seenIds.has(sign.id)) return false;
        seenIds.add(sign.id);
        return true;
    });
    
    // Markeer top 30
    allSigns.forEach(sign => {
        sign.top30 = TOP_30_CODES.includes(sign.id);
    });
    
    // Sorteer: eerst op serie, dan op nummer
    allSigns.sort((a, b) => {
        const serieA = a.serie || '';
        const serieB = b.serie || '';
        if (serieA !== serieB) return serieA.localeCompare(serieB);
        // Numeriek sorteren binnen serie
        const numA = parseInt(a.id.replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt(b.id.replace(/[^0-9]/g, '')) || 0;
        return numA - numB;
    });
    
    console.log(`\n=== Totaal: ${allSigns.length} unieke borden gevonden ===`);
    console.log(`Top 30 gemarkeerd: ${allSigns.filter(s => s.top30).length}`);
    console.log(`Met Engelse vertaling: ${allSigns.filter(s => s.search_query).length}`);
    
    // Filter op top 30 als gevraagd
    const signsToProcess = top30Only ? allSigns.filter(s => s.top30) : allSigns;
    
    // Download PNG afbeeldingen
    if (shouldDownload) {
        console.log(`\n=== PNG downloads starten (${signsToProcess.length} borden) ===`);
        
        let downloaded = 0;
        let skipped = 0;
        let failed = 0;
        
        for (const sign of signsToProcess) {
            const destPath = path.join(IMAGES_DIR, `${sign.id}.png`);
            sign.image = `verkeersborden/images/${sign.id}.png`;
            
            // Skip als bestand al bestaat
            if (fs.existsSync(destPath)) {
                const stat = fs.statSync(destPath);
                if (stat.size > 100) { // Niet een leeg/corrupt bestand
                    skipped++;
                    console.log(`  [SKIP] ${sign.id}.png (bestaat al, ${stat.size} bytes)`);
                    continue;
                }
            }
            
            console.log(`  [DOWN] ${sign.id}.png van ${sign.wiki_filename}...`);
            const result = await downloadSignPNG(sign.wiki_filename, destPath);
            
            if (result.success) {
                downloaded++;
                console.log(`    OK (${result.size} bytes)`);
            } else {
                failed++;
                sign.image = null; // Markeer als niet beschikbaar
            }
            
            // Rate limiting
            await sleep(DOWNLOAD_DELAY);
        }
        
        console.log(`\n=== Download resultaten ===`);
        console.log(`  Gedownload: ${downloaded}`);
        console.log(`  Overgeslagen (bestond al): ${skipped}`);
        console.log(`  Mislukt: ${failed}`);
    } else {
        // Stel image pad in zonder te downloaden
        signsToProcess.forEach(sign => {
            sign.image = `verkeersborden/images/${sign.id}.png`;
        });
    }
    
    // Maak de uiteindelijke output structuur
    const output = {
        _meta: {
            generated: new Date().toISOString(),
            description: "Belgische verkeersborden database voor Memeborden AR project",
            total_signs: allSigns.length,
            top30_count: allSigns.filter(s => s.top30).length,
            with_translation: allSigns.filter(s => s.search_query).length,
            source: "Wikipedia NL - Verkeersborden in België",
        },
        series: SERIE_NAMEN,
        signs: allSigns.map((sign, index) => ({
            id: sign.id,
            name: sign.name,
            serie: sign.serie,
            serie_name: SERIE_NAMEN[sign.serie] || 'Onbekend',
            search_query: sign.search_query,
            image: sign.image || `verkeersborden/images/${sign.id}.png`,
            wiki_filename: sign.wiki_filename,
            top30: sign.top30,
            targetIndex: sign.top30 ? TOP_30_CODES.indexOf(sign.id) : null,
        })),
    };
    
    // Schrijf signs.json
    const jsonPath = path.join(DATA_DIR, 'signs.json');
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\n=== signs.json geschreven naar ${jsonPath} ===`);
    
    // Schrijf ook een compacte top30.json voor de frontend
    const top30Signs = output.signs.filter(s => s.top30);
    const top30Output = {
        _meta: {
            generated: new Date().toISOString(),
            description: "Top 30 Belgische verkeersborden voor MindAR tracking",
            count: top30Signs.length,
        },
        signs: top30Signs.sort((a, b) => a.targetIndex - b.targetIndex),
    };
    
    const top30Path = path.join(DATA_DIR, 'top30.json');
    fs.writeFileSync(top30Path, JSON.stringify(top30Output, null, 2), 'utf8');
    console.log(`=== top30.json geschreven naar ${top30Path} ===`);
    
    // Print samenvatting top 30
    console.log('\n=== Top 30 Borden ===');
    top30Signs.forEach((sign, i) => {
        const status = sign.search_query ? '✓' : '✗';
        console.log(`  ${String(i + 1).padStart(2)}. [${sign.id}] ${sign.name} → "${sign.search_query || 'GEEN VERTALING'}" ${status}`);
    });
    
    console.log('\nKlaar! Volgende stappen:');
    if (!shouldDownload) {
        console.log('  1. Draai opnieuw met --download om PNG afbeeldingen te downloaden');
        console.log('     node tools/scrape_verkeersborden.js --download --top30-only');
    }
    console.log('  2. Compileer .mind bestand met: node tools/compile_signs_mind.js');
    console.log('  3. Test de Klipy API proxy');
}

// === START ===
main().catch(err => {
    console.error('Fatale fout:', err);
    process.exit(1);
});
