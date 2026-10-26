const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SIGNS_JSON_PATH = path.join(ROOT_DIR, 'verkeersborden/data/signs.json');
const TARGETS8W_PATH = path.join(ROOT_DIR, 'verkeersborden/data/targets8w.json');
const IMAGES_DIR = path.join(ROOT_DIR, 'verkeersborden/images');

const signsData = JSON.parse(fs.readFileSync(SIGNS_JSON_PATH, 'utf8'));

const targets = [];
let missingImages = 0;

for (const sign of signsData.signs) {
    const imgRelative = `verkeersborden/images/${sign.id}.png`;
    const imgAbsolute = path.join(ROOT_DIR, imgRelative);

    if (!fs.existsSync(imgAbsolute) || fs.statSync(imgAbsolute).size === 0) {
        missingImages++;
        continue;
    }

    const buf = fs.readFileSync(imgAbsolute);
    if (buf.length < 24) continue;

    let width = 960, height = 960;
    try {
        width = buf.readUInt32BE(16);
        height = buf.readUInt32BE(20);
    } catch (e) {}

    targets.push({
        name: `sign_${sign.id.toUpperCase()}`,
        signId: sign.id,
        signName: sign.name,
        searchQuery: sign.search_query || 'traffic sign meme',
        imagePath: imgRelative,
        type: "PLANAR",
        properties: {
            left: 0,
            top: 0,
            width: width,
            height: height,
            isRotated: false,
            originalWidth: width,
            originalHeight: height
        }
    });
}

fs.writeFileSync(TARGETS8W_PATH, JSON.stringify(targets, null, 2), 'utf8');
console.log(`=== 8TH WALL TARGETS8W GEGENEREERD ===`);
console.log(`Geregistreerde 8th Wall targets: ${targets.length}`);
console.log(`Ontbrekende afbeeldingen: ${missingImages}`);
