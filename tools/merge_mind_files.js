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

// Haal poster IDs op uit de database
function getValidPosterIds() {
    try {
        // Gebruik better-sqlite3 als het beschikbaar is, anders lees JSON via PHP bridge
        const Database = require('better-sqlite3');
        const db = new Database(DB_PATH, { readonly: true });
        const rows = db.prepare('SELECT id FROM posters').all();
        db.close();
        return rows.map(r => r.id);
    } catch (e) {
        // Fallback: lees alle poster IDs uit een tijdelijk JSON bestand
        // Dit wordt aangemaakt door PHP voordat dit script draait
        const tempFile = path.resolve(__dirname, '../data/poster_ids.json');
        if (fs.existsSync(tempFile)) {
            try {
                const ids = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
                console.log('Using poster IDs from JSON fallback');
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
    
    // Haal geldige poster IDs op uit database
    const validPosterIds = getValidPosterIds();
    if (validPosterIds) {
        console.log(`Database bevat ${validPosterIds.length} posters`);
    }
    
    // 1. Find all .mind files
    const mindFiles = [];
    
    // Walk through assets/nft directory
    const items = fs.readdirSync(ASSETS_DIR);
    for (const item of items) {
        const itemPath = path.join(ASSETS_DIR, item);
        if (fs.statSync(itemPath).isDirectory()) {
            // Skip als poster niet in database staat
            if (validPosterIds && !validPosterIds.includes(item)) {
                console.log(`Skipping ${item} - niet in database`);
                continue;
            }
            
            // Look for .mind file inside (usually same name as folder)
            const mindFile = path.join(itemPath, `${item}.mind`);
            if (fs.existsSync(mindFile)) {
                mindFiles.push({
                    id: item,
                    path: mindFile
                });
            }
        }
    }
    
    console.log(`Gevonden: ${mindFiles.length} geldige .mind files`);
    
    if (mindFiles.length === 0) {
        console.log('Geen .mind files gevonden om te mergen');
        return;
    }

    // 2. Process in chunks
    const chunks = [];
    let currentChunk = [];
    let chunkIndex = 0;
    
    // Sort files alphabetically by ID (deterministic, matches database order)
    // This ensures targetIndex in .mind files always matches poster array order
    mindFiles.sort((a, b) => a.id.localeCompare(b.id));
    
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
