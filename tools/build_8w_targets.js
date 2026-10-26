const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SIGNS_JSON_PATH = path.join(ROOT_DIR, 'verkeersborden/data/signs.json');
const TARGETS_DIR = path.join(ROOT_DIR, 'verkeersborden/targets');
const IMAGES_DIR = path.join(ROOT_DIR, 'verkeersborden/images');
const TARGETS8W_PATH = path.join(ROOT_DIR, 'verkeersborden/data/targets8w.json');
const TARGETS8W_ALL_PATH = path.join(ROOT_DIR, 'verkeersborden/data/targets8w_all.json');

if (!fs.existsSync(TARGETS_DIR)) {
    fs.mkdirSync(TARGETS_DIR, { recursive: true });
}

const signsData = JSON.parse(fs.readFileSync(SIGNS_JSON_PATH, 'utf8'));

console.log('=== CONVERTEREN NAAR 8TH WALL GEOPTIMALISEERDE JPEGS (MAX 640px) ===');

const allTargets = [];
const topTargets = [];

for (const sign of signsData.signs) {
    const pngPath = path.join(IMAGES_DIR, `${sign.id}.png`);
    const jpgRelPath = `verkeersborden/targets/${sign.id}.jpg`;
    const jpgAbsPath = path.join(ROOT_DIR, jpgRelPath);

    if (!fs.existsSync(pngPath)) continue;

    // Converteer naar JPEG max 640px breedte/hoogte met sips
    if (!fs.existsSync(jpgAbsPath) || fs.statSync(jpgAbsPath).size === 0) {
        try {
            execSync(`sips -s format jpeg -s formatOptions 85 -Z 640 "${pngPath}" --out "${jpgAbsPath}" > /dev/null 2>&1`);
        } catch (e) {
            console.error(`Fout bij converteren ${sign.id}:`, e.message);
            continue;
        }
    }

    // Lees exacte JPEG afmetingen via sips
    let width = 640, height = 640;
    try {
        const outW = execSync(`sips -g pixelWidth "${jpgAbsPath}"`, { encoding: 'utf8' });
        const outH = execSync(`sips -g pixelHeight "${jpgAbsPath}"`, { encoding: 'utf8' });
        const mW = outW.match(/pixelWidth:\s*(\d+)/);
        const mH = outH.match(/pixelHeight:\s*(\d+)/);
        if (mW) width = parseInt(mW[1], 10);
        if (mH) height = parseInt(mH[1], 10);
    } catch (e) {}

    const targetObj = {
        name: `sign_${sign.id.toUpperCase()}`,
        signId: sign.id,
        signName: sign.name,
        searchQuery: sign.search_query || 'traffic sign meme',
        imagePath: jpgRelPath,
        type: "PLANAR",
        properties: {
            left: 0,
            top: 0,
            width: width,
            height: height,
            isRotated: false,
            originalWidth: width,
            originalHeight: height
        },
        top30: !!sign.top30,
        serie: sign.serie
    };

    allTargets.push(targetObj);
    if (sign.top30) {
        topTargets.push(targetObj);
    }
}

// Sla targets8w.json op (Standaard actieve set: Top borden, past binnen 8th Wall 32-target window)
fs.writeFileSync(TARGETS8W_PATH, JSON.stringify(topTargets, null, 2), 'utf8');
fs.writeFileSync(TARGETS8W_ALL_PATH, JSON.stringify(allTargets, null, 2), 'utf8');

console.log(`✓ ${allTargets.length} borden geconverteerd naar geoptimaliseerde JPEGs.`);
console.log(`✓ targets8w.json (Top actieve borden): ${topTargets.length} targets`);
console.log(`✓ targets8w_all.json (Volledige catalogus): ${allTargets.length} targets`);
