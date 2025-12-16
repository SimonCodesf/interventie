const fs = require('fs');
const path = require('path');
const { decode, encode } = require('@msgpack/msgpack');

const ASSETS_DIR = path.resolve(__dirname, '../assets/nft');
const OUTPUT_DIR = path.resolve(__dirname, '../assets/chunks');
console.log('ASSETS_DIR:', ASSETS_DIR);
console.log('OUTPUT_DIR:', OUTPUT_DIR);
const CHUNK_SIZE = 10; // Number of targets per chunk

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function mergeMindFiles() {
    console.log('🔄 Starting MindAR file merge...');
    
    // 1. Find all .mind files
    const mindFiles = [];
    
    // Walk through assets/nft directory
    const items = fs.readdirSync(ASSETS_DIR);
    for (const item of items) {
        const itemPath = path.join(ASSETS_DIR, item);
        if (fs.statSync(itemPath).isDirectory()) {
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
    
    console.log(`found ${mindFiles.length} .mind files`);
    
    if (mindFiles.length === 0) {
        console.log('⚠️ No .mind files found to merge');
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
        
        console.log(`📦 Processing chunk ${chunkIndex} (${chunkFiles.length} files)...`);
        
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
                console.error(`❌ Error reading ${file.path}:`, e.message);
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
            console.log(`✅ Saved ${chunkFilename} (${(encoded.byteLength / 1024 / 1024).toFixed(2)} MB)`);
            
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
    console.log('📋 Saved manifest.json');
}

mergeMindFiles().catch(console.error);
