const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SIGNS_JSON_PATH = path.join(ROOT_DIR, 'verkeersborden/data/signs.json');
const CHUNKS_JSON_PATH = path.join(ROOT_DIR, 'verkeersborden/data/chunks.json');

const signsData = JSON.parse(fs.readFileSync(SIGNS_JSON_PATH, 'utf8'));

const seriesMap = {
    'A': { id: 'serieA', name: 'Serie A: Gevaarsborden', description: 'Gevaarsborden in België (driehoekig met rode rand)' },
    'B': { id: 'serieB', name: 'Serie B: Voorrangsborden', description: 'Voorrangsborden in België (voorrang verlenen, stop, voorrangsweg)' },
    'C': { id: 'serieC', name: 'Serie C: Verbodsborden', description: 'Verbodsborden in België (cirkels met rode rand)' },
    'D': { id: 'serieD', name: 'Serie D: Gebodsborden', description: 'Gebodsborden in België (blauwe cirkels met witte pijlen)' },
    'E': { id: 'serieE', name: 'Serie E: Parkeren- en stilstaanborden', description: 'Parkeer- en stilstaanborden in België' },
    'F': { id: 'serieF', name: 'Serie F: Aanwijzingsborden', description: 'Aanwijzingsborden in België (blauwe rechthoeken)' },
};

const chunks = {};
for (const [key, meta] of Object.entries(seriesMap)) {
    chunks[key] = {
        id: meta.id,
        name: meta.name,
        serie: key,
        description: meta.description,
        signs: []
    };
}

for (const sign of signsData.signs) {
    const s = sign.serie || 'F';
    if (!chunks[s]) {
        chunks[s] = {
            id: `serie${s}`,
            name: `Serie ${s}`,
            serie: s,
            description: `Borden serie ${s}`,
            signs: []
        };
    }
    chunks[s].signs.push({
        id: sign.id,
        name: sign.name,
        search_query: sign.search_query,
        image: `verkeersborden/images/${sign.id}.png`,
        top30: !!sign.top30
    });
}

const chunksArray = Object.values(chunks);

const output = {
    _meta: {
        generated: new Date().toISOString().split('T')[0],
        total_chunks: chunksArray.length,
        total_signs: signsData.signs.length,
        engine: '8th Wall XR (Universal Multi-Target)'
    },
    chunks: chunksArray
};

fs.writeFileSync(CHUNKS_JSON_PATH, JSON.stringify(output, null, 2), 'utf8');
console.log(`chunks.json bijgewerkt met ${chunksArray.length} series en ${signsData.signs.length} borden.`);
