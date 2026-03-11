const fs = require('fs');
const path = require('path');
const { decode, encode } = require('@msgpack/msgpack');

const ASSETS_DIR = path.resolve(__dirname, '../assets/nft');
const OUTPUT_DIR = path.resolve(__dirname, '../assets/chunks');
const DB_PATH = path.resolve(__dirname, '../data/posters.db');
console.log('ASSETS_DIR:', ASSETS_DIR);
console.log('OUTPUT_DIR:', OUTPUT_DIR);
console.log('DB_PATH:', DB_PATH);
const CHUNK_SIZE = 10; // Number of targets per chunk

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Haal poster IDs op uit de database, gesorteerd op upload datum (nieuwste eerst)
function getValidPosterIds() {
    try {
        // Gebruik better-sqlite3 als het beschikbaar is, anders lees JSON via PHP bridge
        const Database = require('better-sqlite3');
        const db = new Database(DB_PATH, { readonly: true });
        // Sorteer op created_at DESC zodat nieuwste posters eerst komen (chunk 0)
        const rows = db.prepare('SELECT id, created_at FROM posters ORDER BY created_at DESC').all();
        db.close();
        return rows.map(r => ({ id: r.id, created_at: r.created_at }));
    } catch (e) {
        // Fallback: lees alle poster IDs uit een tijdelijk JSON bestand
        // Dit wordt aangemaakt door PHP voordat dit script draait
        const tempFile = path.resolve(__dirname, '../data/poster_ids.json');
        if (fs.existsSync(tempFile)) {
            try {
                const ids = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
                console.log('Using poster IDs from JSON fallback');
                // JSON fallback moet ook gesorteerd zijn op datum (PHP regelt dit)
                return ids;
            } catch (e2) {
                console.error('Error reading poster_ids.json:', e2.message);
            }
        }
        console.warn('Could not read database, using all .mind files');
        return null; // null = gebruik alle bestanden
    }
}

async function mergeMindFiles() {
    console.log('Starting MindAR file merge...');
    
    // Haal geldige poster IDs op uit database (al gesorteerd op datum, nieuwste eerst)
    const validPosterData = getValidPosterIds();
    if (validPosterData) {
        console.log(`Database bevat ${validPosterData.length} posters (gesorteerd op datum)`);
        // Log de eerste paar om de volgorde te verifiëren
        console.log('Eerste 3 posters (nieuwste):', validPosterData.slice(0, 3).map(p => p.id || p));
    }
    
    // 1. Find all .mind files
    const mindFiles = [];
    const missingMind = []; // Posters in DB maar zonder .mind bestand
    
    // Walk through assets/nft directory
    const items = fs.existsSync(ASSETS_DIR) ? fs.readdirSync(ASSETS_DIR) : [];
    const foundInFilesystem = new Set();
    
    for (const item of items) {
        const itemPath = path.join(ASSETS_DIR, item);
        if (fs.statSync(itemPath).isDirectory()) {
            // Check of poster in database staat
            // Support zowel oude format (array van strings) als nieuwe format (array van objects)
            let posterData = null;
            if (validPosterData) {
                posterData = validPosterData.find(p => {
                    if (typeof p === 'string') return p === item;
                    return p.id === item;
                });
                if (!posterData) {
                    console.log(`Skipping ${item} - niet in database`);
                    continue;
                }
            }
            
            foundInFilesystem.add(item);
            
            // Look for .mind file inside (usually same name as folder)
            const mindFile = path.join(itemPath, `${item}.mind`);
            if (fs.existsSync(mindFile)) {
                // Gebruik mtime van het .mind bestand als primaire sorteerbasis
                // Dit reflecteert wanneer de marker écht is aangemaakt/bijgewerkt
                const mtime = fs.statSync(mindFile).mtime.getTime();
                mindFiles.push({
                    id: item,
                    path: mindFile,
                    created_at: posterData && typeof posterData === 'object' ? posterData.created_at : null,
                    mtime: mtime
                });
            } else {
                console.log(`WAARSCHUWING: Poster ${item} heeft geen .mind bestand (map bestaat wel)`);
                missingMind.push(item);
            }
        }
    }
    
    // Check ook DB posters die helemaal geen map hebben in assets/nft/
    if (validPosterData) {
        for (const p of validPosterData) {
            const pid = typeof p === 'string' ? p : p.id;
            if (!foundInFilesystem.has(pid)) {
                console.log(`WAARSCHUWING: Poster ${pid} heeft geen map in assets/nft/`);
                missingMind.push(pid);
            }
        }
    }
    
    if (missingMind.length > 0) {
        console.log(`MISSING_MIND_COUNT:${missingMind.length}`);
        console.log(`MISSING_MIND_IDS:${missingMind.join(',')}`);
    }
    
    console.log(`Gevonden: ${mindFiles.length} geldige .mind files`);
    
    if (mindFiles.length === 0) {
        console.log('Geen .mind files gevonden om te mergen');
        return;
    }

    // 2. Process in chunks - sorteer op mtime van .mind bestand (nieuwste eerst voor chunk 0)
    // mtime is betrouwbaarder dan created_at in de DB: reflecteert wanneer het bestand
    // écht is aangemaakt/overschreven, ongeacht of DB timestamps correct zijn.
    mindFiles.sort((a, b) => b.mtime - a.mtime);
    console.log('Gesorteerd op .mind bestand datum (nieuwste eerst in chunk 0)');
    console.log('Volgorde na sortering:', mindFiles.slice(0, 3).map(f => f.id));
    
    const chunks = [];
    let currentChunk = [];
    let chunkIndex = 0;
    
    const manifest = {
        generatedAt: new Date().toISOString(),
        totalPosters: mindFiles.length,
        chunkSize: CHUNK_SIZE,
        chunks: []
    };
    
    for (let i = 0; i < mindFiles.length; i += CHUNK_SIZE) {
        const chunkFiles = mindFiles.slice(i, i + CHUNK_SIZE);
        const chunkDataList = [];
        const chunkPosterIds = [];
        
console.log(`Processing chunk ${chunkIndex} (${chunkFiles.length} files)...`);

        for (const file of chunkFiles) {
            try {
                const buffer = fs.readFileSync(file.path);
                const content = decode(buffer);
                
                if (content.dataList && Array.isArray(content.dataList)) {
                    // Add all targets from this file (usually just 1)
                    // We need to track which target index corresponds to which poster
                    content.dataList.forEach((data, index) => {
                        chunkDataList.push(data);
                        // Map the new target index to the poster ID
                        // In the merged file, target 0 is poster A, target 1 is poster B, etc.
                    });
                    chunkPosterIds.push(file.id);
                }
            } catch (e) {
                console.error(`Error reading ${file.path}:`, e.message);
            }
        }
        
        if (chunkDataList.length > 0) {
            // Create merged content
            const mergedContent = {
                v: 2,
                dataList: chunkDataList
            };
            
            // Encode and save
            const encoded = encode(mergedContent);
            const chunkFilename = `chunk_${chunkIndex}.mind`;
            const chunkPath = path.join(OUTPUT_DIR, chunkFilename);
            
            fs.writeFileSync(chunkPath, encoded);
            console.log(`Saved ${chunkFilename} (${(encoded.byteLength / 1024 / 1024).toFixed(2)} MB)`);
            
            // Add to manifest
            manifest.chunks.push({
                file: chunkFilename,
                posterIds: chunkPosterIds
            });
            
            chunkIndex++;
        }
    }
    
    // Save manifest
    fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('Saved manifest.json');
    console.log(`Klaar! ${manifest.totalPosters} posters verwerkt.`);
}

mergeMindFiles().catch(console.error);
