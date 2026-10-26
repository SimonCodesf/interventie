const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const ALL_TARGETS_PATH = path.join(ROOT_DIR, 'verkeersborden/data/targets8w_all.json');
const OUTPUT_CHUNKS_PATH = path.join(ROOT_DIR, 'verkeersborden/data/chunks8w.json');

const allTargets = JSON.parse(fs.readFileSync(ALL_TARGETS_PATH, 'utf8'));

// Filter per serie of categorie
const serieA = allTargets.filter(t => t.serie === 'A');
const serieB = allTargets.filter(t => t.serie === 'B');
const serieC = allTargets.filter(t => t.serie === 'C');
const serieD = allTargets.filter(t => t.serie === 'D');
const serieE = allTargets.filter(t => t.serie === 'E');
const serieF = allTargets.filter(t => t.serie === 'F');
const onderborden = allTargets.filter(t => t.serie === 'G' || t.serie === 'M' || t.signId.startsWith('G') || t.signId.startsWith('M'));

// Splits C in 2 delen
const cMid = Math.ceil(serieC.length / 2);
const serieC1 = serieC.slice(0, cMid);
const serieC2 = serieC.slice(cMid);

// Splits F in 3 delen van ~25
const fPart1 = serieF.slice(0, 30);
const fPart2 = serieF.slice(30, 60);
const fPart3 = serieF.slice(60);

// Splits Onderborden
const mBorden = onderborden.filter(t => t.signId.startsWith('M'));
const gBorden = onderborden.filter(t => !t.signId.startsWith('M'));

const chunks = [
    {
        id: 'chunk_top',
        name: 'Top Verkeersborden',
        label: 'Top Borden',
        description: 'De 28 meest voorkomende verkeersborden in het Belgische straatbeeld',
        targets: allTargets.filter(t => t.top30)
    },
    {
        id: 'chunk_serieA',
        name: 'Serie A: Gevaarsborden',
        label: 'Serie A (Gevaar)',
        description: 'Alle gevaarsborden (bochten, versmallingen, drempels, overwegen)',
        targets: serieA
    },
    {
        id: 'chunk_serieBC1',
        name: 'Serie B & C (Deel 1)',
        label: 'Serie B & C1',
        description: 'Voorrangsborden (B1, B5, B9) en Verbodsborden deel 1',
        targets: [...serieB, ...serieC1]
    },
    {
        id: 'chunk_serieC2D',
        name: 'Serie C (Deel 2) & D',
        label: 'Serie C2 & D',
        description: 'Verbodsborden deel 2 en Gebodsborden (verplichte rijrichtingen, rotondes)',
        targets: [...serieC2, ...serieD]
    },
    {
        id: 'chunk_serieEM',
        name: 'Serie E & M (Parkeren & Fietsers)',
        label: 'Serie E & M',
        description: 'Parkeerborden (E-serie) en fiets/bromfiets onderborden (M-serie)',
        targets: [...serieE, ...mBorden]
    },
    {
        id: 'chunk_serieF1',
        name: 'Serie F: Aanwijzingsborden (1)',
        label: 'Serie F (1-34)',
        description: 'Aanwijzingsborden F1 tot F34 (bebouwde kom, snelweg, voorwegwijzers)',
        targets: fPart1
    },
    {
        id: 'chunk_serieF2',
        name: 'Serie F: Aanwijzingsborden (2)',
        label: 'Serie F (35-85)',
        description: 'Aanwijzingsborden F35 tot F85 (toerisme, tunnels, hulpdiensten, rijstroken)',
        targets: fPart2
    },
    {
        id: 'chunk_serieF3',
        name: 'Serie F: Aanwijzingsborden (3)',
        label: 'Serie F (87-120)',
        description: 'Aanwijzingsborden F87 tot F120 (snelheidszones, emissiezones, fietsstraten)',
        targets: fPart3
    },
    {
        id: 'chunk_onderbordenG',
        name: 'Onderborden (Type G)',
        label: 'Onderborden G',
        description: 'Alle type I tot X onderborden (ijzel, afstanden, tijdvensters)',
        targets: gBorden
    }
];

const totalMapped = new Set();
chunks.forEach(c => c.targets.forEach(t => totalMapped.add(t.signId)));

const output = {
    _meta: {
        generated: new Date().toISOString(),
        total_chunks: chunks.length,
        total_unique_signs: totalMapped.size,
        engine: '8th Wall XR Engine (Dynamic Target Reconfigure)'
    },
    chunks: chunks
};

fs.writeFileSync(OUTPUT_CHUNKS_PATH, JSON.stringify(output, null, 2), 'utf8');

console.log(`=== CHUNKS8W GEGENEREERD ===`);
console.log(`Aantal chunks: ${chunks.length}`);
console.log(`Unieke borden gedekt over chunks: ${totalMapped.size} van de ${allTargets.length}`);
chunks.forEach((c, i) => {
    console.log(`  [Chunk ${i}] ${c.label}: ${c.targets.length} borden`);
});
