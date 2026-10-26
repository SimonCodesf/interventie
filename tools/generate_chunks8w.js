const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ALL_TARGETS_PATH = path.join(ROOT_DIR, 'verkeersborden/data/targets8w_all.json');
const OUTPUT_CHUNKS_PATH = path.join(ROOT_DIR, 'verkeersborden/data/chunks8w.json');

const rawTargets = JSON.parse(fs.readFileSync(ALL_TARGETS_PATH, 'utf8'));

// Compacte target builder (alle overbodige metadata eruit, alleen wat 8th Wall & UI nodig hebben)
function compactTarget(t) {
    const w = (t.properties && (t.properties.originalWidth || t.properties.width)) || 640;
    const h = (t.properties && (t.properties.originalHeight || t.properties.height)) || 640;
    
    // Verkort lange encyclopedische namen tot een heldere bordtitel
    let name = t.signName || t.signId;
    if (name.length > 55) {
        const parts = name.split(/[:.]/);
        name = parts[0].trim();
        if (name.length < 5 && parts[1]) name = parts[1].trim();
        if (name.length > 55) name = name.substring(0, 52) + '…';
    }

    return {
        name: t.name || `sign_${t.signId.toUpperCase()}`,
        signId: t.signId,
        signName: name,
        searchQuery: t.searchQuery || 'traffic meme',
        imagePath: t.imagePath,
        type: 'PLANAR',
        properties: {
            left: 0,
            top: 0,
            width: w,
            height: h,
            isRotated: false,
            originalWidth: w,
            originalHeight: h
        }
    };
}

const all = rawTargets.map(compactTarget);

// Groepeer per prefix
const serieA = all.filter(t => t.signId.startsWith('A')); // 32
const serieB = all.filter(t => t.signId.startsWith('B')); // 13
const serieC = all.filter(t => t.signId.startsWith('C')); // 33
const serieD = all.filter(t => t.signId.startsWith('D')); // 12
const serieE = all.filter(t => t.signId.startsWith('E')); // 16
const serieF = all.filter(t => t.signId.startsWith('F')); // 95
const serieG = all.filter(t => t.signId.startsWith('G')); // 19
const serieM = all.filter(t => t.signId.startsWith('M')); // 17

// Splits A in A1 (16) en A2 (16)
const aMid = Math.ceil(serieA.length / 2);
const a1 = serieA.slice(0, aMid);
const a2 = serieA.slice(aMid);

// Splits C in C1 (17) en C2 (16)
const cMid = Math.ceil(serieC.length / 2);
const c1 = serieC.slice(0, cMid);
const c2 = serieC.slice(cMid);

// Splits F in 4 behapbare delen van ~24 borden
const f1 = serieF.slice(0, 24);
const f2 = serieF.slice(24, 48);
const f3 = serieF.slice(48, 72);
const f4 = serieF.slice(72);

// Top 25 borden (de absolute straatklassiekers)
const topIds = new Set([
    'B5', 'B1', 'B9', 'B15a', 'B17',
    'C1', 'C3', 'C43_30', 'C43_50', 'C43_70', 'C43_90', 'C46',
    'D1a', 'D1d', 'D1e', 'D7', 'D9a',
    'A1a', 'A1b', 'A7a', 'A14', 'A15', 'A23',
    'E1', 'E9a', 'F1', 'F19', 'F4a'
]);
const topTargets = all.filter(t => topIds.has(t.signId));

const chunks = [
    {
        id: 'chunk_top',
        name: 'Top Verkeersborden',
        label: 'Top Borden',
        description: '28 meest voorkomende borden (B5, B1, C3, D1a, E1, F1)',
        targets: topTargets
    },
    {
        id: 'chunk_serieA1',
        name: 'Serie A1 (Gevaar: Bochten & Rijbaan)',
        label: 'Serie A1',
        description: 'Gevaarsborden bochten, versmallingen, drempels',
        targets: a1
    },
    {
        id: 'chunk_serieA2',
        name: 'Serie A2 (Gevaar: Verkeer & Overwegen)',
        label: 'Serie A2',
        description: 'Gevaarsborden kruispunten, spoorwegen, werken',
        targets: a2
    },
    {
        id: 'chunk_serieBD',
        name: 'Serie B & D (Voorrang & Gebod)',
        label: 'Serie B & D',
        description: 'Stopborden (B5), voorrang (B1) en verplichte richtingen (D1-D9)',
        targets: [...serieB, ...serieD]
    },
    {
        id: 'chunk_serieC1',
        name: 'Serie C1 (Verbodsborden Deel 1)',
        label: 'Serie C1',
        description: 'Verboden toegang en verboden richtingen (C1-C21)',
        targets: c1
    },
    {
        id: 'chunk_serieC2',
        name: 'Serie C2 (Verbodsborden Deel 2)',
        label: 'Serie C2',
        description: 'Snelheidslimieten (C43) en inhaalverboden',
        targets: c2
    },
    {
        id: 'chunk_serieE',
        name: 'Serie E (Parkeren & Stilstaan)',
        label: 'Serie E',
        description: 'Parkeerverboden (E1-E3) en parkeerzones (E9)',
        targets: serieE
    },
    {
        id: 'chunk_serieM',
        name: 'Serie M (Fietsers & Bromfietsers)',
        label: 'Serie M',
        description: 'Onderborden voor fietsers (M1-M20)',
        targets: serieM
    },
    {
        id: 'chunk_serieF1',
        name: 'Serie F1 (Aanwijzing 1-34)',
        label: 'Serie F1',
        description: 'Bebouwde kom (F1), snelweg (F5) en hoofdwegen',
        targets: f1
    },
    {
        id: 'chunk_serieF2',
        name: 'Serie F2 (Aanwijzing 35-65)',
        label: 'Serie F2',
        description: 'Doodlopende weg, tunnels, bushaltes, ziekenhuizen',
        targets: f2
    },
    {
        id: 'chunk_serieF3',
        name: 'Serie F3 (Aanwijzing 67-95)',
        label: 'Serie F3',
        description: 'Rijstrookindeling, spitsstroken, afstanden',
        targets: f3
    },
    {
        id: 'chunk_serieF4',
        name: 'Serie F4 (Aanwijzing 97-120)',
        label: 'Serie F4',
        description: 'Emissiezones, schoolstraten, fietszones',
        targets: f4
    },
    {
        id: 'chunk_onderbordenG',
        name: 'Onderborden (Type G)',
        label: 'Onderborden G',
        description: 'Afstanden, tijdsvensters, ijzel, helling',
        targets: serieG
    }
];

const totalUnique = new Set();
chunks.slice(1).forEach(c => c.targets.forEach(t => totalUnique.add(t.signId)));

const output = {
    _meta: {
        generated: new Date().toISOString(),
        total_chunks: chunks.length,
        total_unique_signs: totalUnique.size,
        engine: '8th Wall XR Engine (Multi-Chunk Auto-Track)'
    },
    chunks: chunks
};

fs.writeFileSync(OUTPUT_CHUNKS_PATH, JSON.stringify(output, null, 2), 'utf8');

console.log(`=== CHUNKS8W GEGENEREERD ===`);
console.log(`Totaal chunks: ${chunks.length}`);
console.log(`Unieke borden gedekt: ${totalUnique.size} van de ${all.length}`);
chunks.forEach((c, i) => {
    console.log(`  [Chunk ${i}] ${c.label} (${c.name}): ${c.targets.length} targets`);
});
