// Admin.js - Client-side JavaScript voor het admin dashboard

// Browser-gecompileerde .mind buffers (worden automatisch aangemaakt vanuit JPEG)
let compiledMindBuffer = null;     // Nieuw upload formulier
let editCompiledMindBuffer = null; // Edit formulier

// Lopende compilatie promises - form submit wacht hierop als compilatie nog bezig is
let compilingMindPromise = null;     // Nieuw upload formulier
let editCompilingMindPromise = null; // Edit formulier

/**
 * Compileert een afbeelding naar een .mind bestand via de MindAR browser compiler.
 * Werkt volledig client-side, geen server-side native dependencies nodig.
 * @param {File} imageFile - De JPEG/PNG die als AR marker gecompileerd wordt
 * @param {HTMLElement} statusEl - Element om compilatie voortgang te tonen
 * @param {string} summaryId - ID van het summary element (bijv. 'summary-mind')
 * @returns {Promise<ArrayBuffer|null>} De gecompileerde .mind data, of null bij fout
 */
async function compileMindFromImage(imageFile, statusEl, summaryId) {
    if (!window.MINDAR || !window.MINDAR.IMAGE || !window.MINDAR.IMAGE.Compiler) {
        if (statusEl) statusEl.textContent = 'MindAR compiler niet geladen - upload handmatig een .mind bestand';
        return null;
    }
    
    const summaryEl = summaryId ? document.getElementById(summaryId) : null;
    const summarySpan = summaryEl ? summaryEl.querySelector('span') : null;
    
    if (statusEl) {
        statusEl.textContent = 'COMPILEREN... (30-60 sec)';
        statusEl.style.color = 'rgba(255,200,0,0.8)';
    }
    if (summaryEl) summaryEl.className = 'summary-item pending';
    if (summarySpan) summarySpan.textContent = 'Compileren...';
    
    try {
        const objectUrl = URL.createObjectURL(imageFile);
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Afbeelding laden mislukt'));
            img.src = objectUrl;
        });
        URL.revokeObjectURL(objectUrl);
        
        const compiler = new window.MINDAR.IMAGE.Compiler();
        await compiler.compileImageTargets([img], (progress) => {
            const pct = Math.round(progress * 100);
            if (statusEl) statusEl.textContent = `COMPILEREN... ${pct}%`;
            if (summarySpan) summarySpan.textContent = `${pct}%`;
        });
        
        const buffer = await compiler.exportData();
        const sizeKB = Math.round(buffer.byteLength / 1024);
        
        if (statusEl) {
            statusEl.textContent = `Automatisch gecompileerd (${sizeKB} KB)`;
            statusEl.style.color = 'rgba(0,255,0,0.8)';
        }
        if (summaryEl) summaryEl.className = 'summary-item ok';
        if (summarySpan) summarySpan.textContent = `Auto (${sizeKB} KB)`;
        
        console.log(`[MIND] Compilatie voltooid: ${sizeKB} KB`);
        return buffer;
    } catch (e) {
        console.error('[MIND] Compilatie fout:', e);
        if (statusEl) {
            statusEl.textContent = 'Compilatie mislukt - upload handmatig een .mind bestand';
            statusEl.style.color = 'rgba(255,80,80,0.8)';
        }
        if (summaryEl) summaryEl.className = 'summary-item pending';
        if (summarySpan) summarySpan.textContent = 'Mislukt';
        return null;
    }
}

// Layer Configuration - centraal beheer van layers
const LAYER_CONFIG = {
    maxLayers: 8,
    defaultLayers: [
        { num: 1, name: 'Base - op poster oppervlak', defaultZ: 0.000 },
        { num: 2, name: '1cm boven poster', defaultZ: 0.010 },
        { num: 3, name: '4cm boven poster', defaultZ: 0.040 },
        { num: 4, name: '10cm boven poster', defaultZ: 0.100 },
        { num: 5, name: 'Extra layer 5', defaultZ: 0.150 },
        { num: 6, name: 'Extra layer 6', defaultZ: 0.200 },
        { num: 7, name: 'Extra layer 7', defaultZ: 0.250 },
        { num: 8, name: 'Extra layer 8', defaultZ: 0.300 }
    ]
};

// Huidige poster data voor AR preview
let currentPosterData = null;
// Geladen poster thumbnail voor AR preview achtergrond
let previewPosterImage = null;
const previewTextSeeds = {};

// Beschikbare fonts voor tekstlagen (Google + Adobe-achtige fallbacks)
const TEXT_FONT_OPTIONS = [
    { label: 'Bebas Neue', value: '"Bebas Neue", sans-serif' },
    { label: 'Anton', value: '"Anton", sans-serif' },
    { label: 'Oswald', value: '"Oswald", sans-serif' },
    { label: 'Teko', value: '"Teko", sans-serif' },
    { label: 'Rajdhani', value: '"Rajdhani", sans-serif' },
    { label: 'Exo 2', value: '"Exo 2", sans-serif' },
    { label: 'Orbitron', value: '"Orbitron", sans-serif' },
    { label: 'Audiowide', value: '"Audiowide", sans-serif' },
    { label: 'Michroma', value: '"Michroma", sans-serif' },
    { label: 'Russo One', value: '"Russo One", sans-serif' },
    { label: 'Bangers', value: '"Bangers", cursive' },
    { label: 'Luckiest Guy', value: '"Luckiest Guy", cursive' },
    { label: 'Permanent Marker', value: '"Permanent Marker", cursive' },
    { label: 'Creepster', value: '"Creepster", cursive' },
    { label: 'Monoton', value: '"Monoton", cursive' },
    { label: 'Rubik Mono One', value: '"Rubik Mono One", sans-serif' },
    { label: 'Press Start 2P', value: '"Press Start 2P", monospace' },
    { label: 'Share Tech Mono', value: '"Share Tech Mono", monospace' },
    { label: 'Space Mono', value: '"Space Mono", monospace' },
    { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
    { label: 'Cinzel', value: '"Cinzel", serif' },
    { label: 'Playfair Display', value: '"Playfair Display", serif' },
    { label: 'Cormorant Garamond', value: '"Cormorant Garamond", serif' },
    { label: 'Abril Fatface', value: '"Abril Fatface", serif' },
    { label: 'Black Ops One', value: '"Black Ops One", sans-serif' },
    { label: 'Righteous', value: '"Righteous", sans-serif' },
    { label: 'Syncopate', value: '"Syncopate", sans-serif' },
    { label: 'Alfa Slab One', value: '"Alfa Slab One", serif' },
    { label: 'Futura PT*', value: '"futura-pt", "Bebas Neue", sans-serif' },
    { label: 'Proxima Nova*', value: '"proxima-nova", "Orbitron", sans-serif' }
];

const TEXT_FONT_CHOICES = TEXT_FONT_OPTIONS.map((opt) => opt.value);

function getTextFontOptionsHTML(selected = '"Bebas Neue", sans-serif') {
    return TEXT_FONT_OPTIONS.map((opt) => {
        const isSelected = opt.value === selected ? 'selected' : '';
        const escapedValue = opt.value.replace(/"/g, '&quot;');
        return `<option value="${escapedValue}" ${isSelected}>${opt.label}</option>`;
    }).join('');
}

let textFontsLoaded = false;

function ensureTextFontsLoaded() {
    if (textFontsLoaded) return;
    textFontsLoaded = true;

    if (!document.getElementById('google-text-fonts')) {
        const link = document.createElement('link');
        link.id = 'google-text-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Alfa+Slab+One&family=Anton&family=Audiowide&family=Bangers&family=Bebas+Neue&family=Black+Ops+One&family=Cinzel:wght@400;700&family=Cormorant+Garamond:wght@400;700&family=Creepster&family=Exo+2:wght@400;700;900&family=JetBrains+Mono:wght@400;700&family=Luckiest+Guy&family=Michroma&family=Monoton&family=Orbitron:wght@400;700;900&family=Oswald:wght@400;700&family=Permanent+Marker&family=Playfair+Display:wght@400;700;900&family=Press+Start+2P&family=Rajdhani:wght@400;700&family=Righteous&family=Rubik+Mono+One&family=Russo+One&family=Share+Tech+Mono&family=Space+Mono:wght@400;700&family=Syncopate:wght@400;700&family=Teko:wght@400;700&display=swap';
        document.head.appendChild(link);
    }
}

function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function generateRandomTextStylePreset(seedInput) {
    const seed = Number(seedInput) || Date.now();
    const rand = seededRandom(seed);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];

    const colors = ['#ffffff', '#ffeb3b', '#00e5ff', '#ff4081', '#76ff03', '#ff8a00', '#ffd1dc'];
    const outlineColors = ['#000000', '#111111', '#3d0f0f', '#0a1a2f', '#2e005d'];
    const effects = ['none', 'glow', 'shadow', 'neon'];
    const effect3d = ['none', 'extrude', 'tilt', 'float'];
    const aligns = ['left', 'center', 'right'];

    return {
        font: pick(TEXT_FONT_CHOICES),
        color: pick(colors),
        outlineColor: pick(outlineColors),
        outlineWidth: Math.round((2 + rand() * 5) * 10) / 10,
        fontSize: Math.round(56 + rand() * 70),
        effect: pick(effects),
        effect3d: pick(effect3d),
        align: pick(aligns),
    };
}

function applyRandomStyleBySpec(baseStyle, seedInput, randomSpec = {}) {
    const randomStyle = generateRandomTextStylePreset(seedInput);
    const finalStyle = { ...baseStyle };

    if (randomSpec.font) finalStyle.font = randomStyle.font;
    if (randomSpec.color) finalStyle.color = randomStyle.color;
    if (randomSpec.outline) {
        finalStyle.outlineColor = randomStyle.outlineColor;
        finalStyle.outlineWidth = randomStyle.outlineWidth;
    }
    if (randomSpec.effect) finalStyle.effect = randomStyle.effect;
    if (randomSpec.effect3d) finalStyle.effect3d = randomStyle.effect3d;
    if (randomSpec.size) finalStyle.fontSize = randomStyle.fontSize;
    if (randomSpec.align) finalStyle.align = randomStyle.align;

    return finalStyle;
}


// ========== GIF handling: use GIF directly as video ==========
// GIFs can be used directly in <a-video> tags; no conversion needed!
async function convertGifFileToMp4(file, label = 'layer') {
    if (file.type !== 'image/gif') {
        console.log(`[GIF] Not a GIF, skipping: ${file.name}`);
        return file;
    }
    
    console.log(`[GIF] Sending GIF directly as video (no conversion needed): ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    
    // Return GIF as-is; A-Frame can play GIFs directly in <a-video> elements
    return file;
}

// ========== Client-side layer image resize ==========
// Schaalt layer afbeeldingen clientside naar max 1024px voor snellere upload
// en minder server belasting. GIFs en videos worden overgeslagen.
async function prepareLayerImage(file, maxPx = 1024) {
    // Alleen statische afbeeldingen verwerken
    const isStaticImage = file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp';
    if (!isStaticImage) {
        return file; // GIF, video etc. ongewijzigd teruggeven
    }
    
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            
            // Als het al binnen de limiet valt, origineel bestand gebruiken
            if (img.width <= maxPx && img.height <= maxPx) {
                console.log(`[RESIZE] Layer al optimaal (${img.width}×${img.height}): ${file.name}`);
                resolve(file);
                return;
            }
            
            // Schaal het beeld naar max 1024px (verhouding behouden)
            const ratio = Math.min(maxPx / img.width, maxPx / img.height);
            const newW = Math.round(img.width * ratio);
            const newH = Math.round(img.height * ratio);
            
            const canvas = document.createElement('canvas');
            canvas.width = newW;
            canvas.height = newH;
            const ctx = canvas.getContext('2d');
            
            // PNG transparantie behouden
            if (file.type === 'image/png') {
                ctx.clearRect(0, 0, newW, newH);
            }
            ctx.drawImage(img, 0, 0, newW, newH);
            
            // Behoud origineel formaat (PNG voor transparantie, JPEG voor foto's)
            const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const outputQuality = outputType === 'image/jpeg' ? 0.88 : undefined;
            
            canvas.toBlob((blob) => {
                const kleinsteBlob = blob.size < file.size ? blob : file;
                const naam = kleinsteBlob === file ? file.name : file.name;
                console.log(`[RESIZE] ${file.name}: ${(file.size/1024).toFixed(0)}KB → ${(kleinsteBlob.size/1024).toFixed(0)}KB (${newW}×${newH})`);
                resolve(new File([kleinsteBlob], naam, { type: outputType }));
            }, outputType, outputQuality);
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            console.warn(`[RESIZE] Kon afbeelding niet laden, origineel gebruiken: ${file.name}`);
            resolve(file); // Fallback: origineel sturen
        };
        
        img.src = url;
    });
}



// Generate HTML for a single layer - COMPACT VERSION with visual preview
function generateLayerHTML(layerNum, isEditForm = false) {
    const prefix = isEditForm ? 'edit-' : '';
    const config = LAYER_CONFIG.defaultLayers.find(l => l.num === layerNum);
    const defaultZ = config ? config.defaultZ : 0;
    
    // Only open first layer by default
    const isOpen = layerNum === 1 ? 'open' : '';
    
    return `
        <details class="layer-card" ${isOpen}>
            <summary class="layer-header">
                <span class="layer-num">${layerNum}</span>
                <span class="layer-title">LAAG ${layerNum}</span>
                <span class="layer-status" id="${prefix}layer-${layerNum}-status">LEEG</span>
            </summary>
            
            <div class="layer-body">
                <!-- Unified File Upload -->
                <div class="layer-files">
                    <div class="file-slot">
                        <label>MEDIA</label>
                        <input type="file" id="${prefix}layer-${layerNum}-image" name="layer_${layerNum}_image" accept="image/png,image/jpeg,image/gif,video/mp4,video/webm,.glb,.gltf">
                        <input type="hidden" id="${prefix}layer-${layerNum}-delete" name="layer_${layerNum}_delete" value="0">
                        <input type="hidden" id="${prefix}layer-${layerNum}-delete-media" name="layer_${layerNum}_delete_media" value="0">
                        ${isEditForm ? `<span class="file-current" id="${prefix}layer-${layerNum}-current"></span>` : ''}
                        ${isEditForm ? `<button type="button" class="btn-delete-media" id="${prefix}layer-${layerNum}-delete-media-btn" onclick="deleteLayerMedia(${layerNum}, 'image')" title="Verwijder afbeelding" style="display:none;">×</button>` : ''}
                    </div>
                    <div class="file-slot file-slot-small">
                        <label>3D</label>
                        <input type="file" id="${prefix}layer-${layerNum}-glb" name="layer_${layerNum}_glb" accept=".glb,.gltf">
                        <input type="hidden" id="${prefix}layer-${layerNum}-delete-glb" name="layer_${layerNum}_delete_glb" value="0">
                        ${isEditForm ? `<span class="file-current" id="${prefix}layer-${layerNum}-glb-current"></span>` : ''}
                        ${isEditForm ? `<button type="button" class="btn-delete-media" id="${prefix}layer-${layerNum}-delete-glb-btn" onclick="deleteLayerMedia(${layerNum}, 'glb')" title="Verwijder 3D model" style="display:none;">×</button>` : ''}
                    </div>
                    <div class="file-slot file-slot-small">
                        <label>AUDIO</label>
                        <input type="file" id="${prefix}layer-${layerNum}-audio" name="layer_${layerNum}_audio" accept="audio/mpeg,audio/wav,.mp3,.wav">
                        <input type="hidden" id="${prefix}layer-${layerNum}-delete-audio" name="layer_${layerNum}_delete_audio" value="0">
                        ${isEditForm ? `<span class="file-current" id="${prefix}layer-${layerNum}-audio-current"></span>` : ''}
                        ${isEditForm ? `<button type="button" class="btn-delete-media" id="${prefix}layer-${layerNum}-delete-audio-btn" onclick="deleteLayerMedia(${layerNum}, 'audio')" title="Verwijder audio" style="display:none;">×</button>` : ''}
                    </div>
                </div>
                
                <!-- Transform Controls - Compact Grid -->
                <div class="layer-transform">
                    <div class="transform-group">
                        <span class="group-label">POS</span>
                        <div class="mini-input">
                            <span>X</span>
                            <input type="number" id="${prefix}layer-${layerNum}-pos-x" name="layer_${layerNum}_pos_x" value="0" step="0.01" data-layer="${layerNum}" data-param="posX">
                        </div>
                        <div class="mini-input">
                            <span>Y</span>
                            <input type="number" id="${prefix}layer-${layerNum}-pos-y" name="layer_${layerNum}_pos_y" value="0" step="0.01" data-layer="${layerNum}" data-param="posY">
                        </div>
                        <div class="mini-input">
                            <span>Z</span>
                            <input type="number" id="${prefix}layer-${layerNum}-z" name="layer_${layerNum}_z" value="${defaultZ.toFixed(2)}" step="0.01" data-layer="${layerNum}" data-param="posZ">
                        </div>
                    </div>
                    <div class="transform-group">
                        <span class="group-label">ROT</span>
                        <div class="mini-input">
                            <span>X</span>
                            <input type="number" id="${prefix}layer-${layerNum}-rot-x" name="layer_${layerNum}_rot_x" value="0" step="1" data-layer="${layerNum}" data-param="rotX">
                        </div>
                        <div class="mini-input">
                            <span>Y</span>
                            <input type="number" id="${prefix}layer-${layerNum}-rot-y" name="layer_${layerNum}_rot_y" value="0" step="1" data-layer="${layerNum}" data-param="rotY">
                        </div>
                        <div class="mini-input">
                            <span>Z</span>
                            <input type="number" id="${prefix}layer-${layerNum}-rot-z" name="layer_${layerNum}_rot_z" value="0" step="1" data-layer="${layerNum}" data-param="rotZ">
                        </div>
                    </div>
                    <div class="transform-group">
                        <span class="group-label">SIZE</span>
                        <div class="mini-input wide">
                            <span>SCALE</span>
                            <input type="number" id="${prefix}layer-${layerNum}-scale" name="layer_${layerNum}_scale" value="1.0" step="0.01" data-layer="${layerNum}" data-param="scale">
                        </div>
                    </div>
                </div>
                
                <!-- Quick Options Row -->
                <div class="layer-options">
                    <label class="option-toggle">
                        <input type="checkbox" id="${prefix}layer-${layerNum}-transparent" name="layer_${layerNum}_transparent" value="1" checked onchange="toggleBgColorPicker(this, '${prefix}', ${layerNum})">
                        <span>TRANSPARANT</span>
                    </label>
                    <div class="bg-color-picker" id="${prefix}layer-${layerNum}-bg-color-container" style="display: none;">
                        <input type="color" id="${prefix}layer-${layerNum}-bg-color" name="layer_${layerNum}_bg_color" value="#000000" title="Achtergrondkleur">
                    </div>
                    <label class="option-toggle">
                        <input type="checkbox" id="${prefix}layer-${layerNum}-exclusion" name="layer_${layerNum}_exclusion" value="1">
                        <span>MASKER</span>
                    </label>
                    <label class="option-toggle">
                        <input type="checkbox" id="${prefix}layer-${layerNum}-enable-anim" data-layer="${layerNum}">
                        <span>ANIMATIE</span>
                    </label>
                    ${isEditForm ? `<button type="button" class="delete-layer-btn" onclick="deleteLayer(${layerNum})">×</button>` : ''}
                </div>

                <!-- Tekstlaag instellingen -->
                <div class="text-layer-panel">
                    <div class="text-layer-head">
                        <label class="option-toggle">
                            <input type="checkbox" id="${prefix}layer-${layerNum}-text-enabled" name="layer_${layerNum}_text_enabled" value="1">
                            <span>TEKSTLAAG</span>
                        </label>
                        <label class="option-toggle">
                            <input type="checkbox" id="${prefix}layer-${layerNum}-text-random" name="layer_${layerNum}_text_random" value="1">
                            <span>RANDOM ALLES</span>
                        </label>
                    </div>
                    <div class="text-random-specs">
                        <label class="option-toggle"><input type="checkbox" id="${prefix}layer-${layerNum}-text-random-font" name="layer_${layerNum}_text_random_font" value="1"><span>R FONT</span></label>
                        <label class="option-toggle"><input type="checkbox" id="${prefix}layer-${layerNum}-text-random-color" name="layer_${layerNum}_text_random_color" value="1"><span>R KLEUR</span></label>
                        <label class="option-toggle"><input type="checkbox" id="${prefix}layer-${layerNum}-text-random-outline" name="layer_${layerNum}_text_random_outline" value="1"><span>R RAND</span></label>
                        <label class="option-toggle"><input type="checkbox" id="${prefix}layer-${layerNum}-text-random-effect" name="layer_${layerNum}_text_random_effect" value="1"><span>R FX</span></label>
                        <label class="option-toggle"><input type="checkbox" id="${prefix}layer-${layerNum}-text-random-3d" name="layer_${layerNum}_text_random_3d" value="1"><span>R 3D</span></label>
                        <label class="option-toggle"><input type="checkbox" id="${prefix}layer-${layerNum}-text-random-size" name="layer_${layerNum}_text_random_size" value="1"><span>R SIZE</span></label>
                        <label class="option-toggle"><input type="checkbox" id="${prefix}layer-${layerNum}-text-random-align" name="layer_${layerNum}_text_random_align" value="1"><span>R ALIGN</span></label>
                    </div>
                    <textarea
                        id="${prefix}layer-${layerNum}-text-content"
                        name="layer_${layerNum}_text_content"
                        class="text-layer-input"
                        rows="2"
                        placeholder="Typ je AR titel of tekst..."></textarea>
                    <div class="text-layer-grid">
                        <div class="mini-input wide">
                            <span>FONT</span>
                            <select id="${prefix}layer-${layerNum}-text-font" name="layer_${layerNum}_text_font_family" class="text-layer-select">
                                ${getTextFontOptionsHTML()}
                            </select>
                        </div>
                        <div class="mini-input">
                            <span>SIZE</span>
                            <input type="number" id="${prefix}layer-${layerNum}-text-size" name="layer_${layerNum}_text_font_size" value="96" min="24" max="220" step="1">
                        </div>
                        <div class="mini-input">
                            <span>ALIGN</span>
                            <select id="${prefix}layer-${layerNum}-text-align" name="layer_${layerNum}_text_align" class="text-layer-select">
                                <option value="left">L</option>
                                <option value="center" selected>C</option>
                                <option value="right">R</option>
                            </select>
                        </div>
                        <div class="mini-input">
                            <span>Y+</span>
                            <input type="number" id="${prefix}layer-${layerNum}-text-offset-y" name="layer_${layerNum}_text_offset_y" value="0.85" step="0.01">
                        </div>
                    </div>
                    <div class="text-layer-grid">
                        <div class="mini-input">
                            <span>KLEUR</span>
                            <input type="color" id="${prefix}layer-${layerNum}-text-color" name="layer_${layerNum}_text_color" value="#ffffff">
                        </div>
                        <div class="mini-input">
                            <span>RAND</span>
                            <input type="color" id="${prefix}layer-${layerNum}-text-outline-color" name="layer_${layerNum}_text_outline_color" value="#000000">
                        </div>
                        <div class="mini-input">
                            <span>RAND W</span>
                            <input type="number" id="${prefix}layer-${layerNum}-text-outline-width" name="layer_${layerNum}_text_outline_width" value="3" min="0" max="12" step="0.5">
                        </div>
                        <div class="mini-input">
                            <span>EFFECT</span>
                            <select id="${prefix}layer-${layerNum}-text-effect" name="layer_${layerNum}_text_effect" class="text-layer-select">
                                <option value="none">NONE</option>
                                <option value="glow">GLOW</option>
                                <option value="shadow">SHADOW</option>
                                <option value="neon">NEON</option>
                            </select>
                        </div>
                        <div class="mini-input">
                            <span>3D</span>
                            <select id="${prefix}layer-${layerNum}-text-3d" name="layer_${layerNum}_text_3d_effect" class="text-layer-select">
                                <option value="none">NONE</option>
                                <option value="extrude">EXTRUDE</option>
                                <option value="tilt">TILT</option>
                                <option value="float">FLOAT</option>
                            </select>
                        </div>
                    </div>
                    <div class="text-layer-grid text-3d-params">
                        <div class="mini-input">
                            <span>DEPTH</span>
                            <input type="number" id="${prefix}layer-${layerNum}-text-3d-depth" name="layer_${layerNum}_text_3d_depth" value="3" min="0" max="20" step="1">
                        </div>
                        <div class="mini-input">
                            <span>TILT X</span>
                            <input type="number" id="${prefix}layer-${layerNum}-text-3d-tilt-x" name="layer_${layerNum}_text_3d_tilt_x" value="16" min="-45" max="45" step="1">
                        </div>
                        <div class="mini-input">
                            <span>TILT Y</span>
                            <input type="number" id="${prefix}layer-${layerNum}-text-3d-tilt-y" name="layer_${layerNum}_text_3d_tilt_y" value="0" min="-45" max="45" step="1">
                        </div>
                        <div class="mini-input">
                            <span>FLOAT PX</span>
                            <input type="number" id="${prefix}layer-${layerNum}-text-3d-float-px" name="layer_${layerNum}_text_3d_float_px" value="4" min="0" max="80" step="1">
                        </div>
                    </div>
                </div>
                
                <!-- Animation Panel (hidden by default) -->
                <div id="${prefix}layer-${layerNum}-anim-container" class="anim-panel hidden">
                    <div class="anim-row">
                        <select id="${prefix}layer-${layerNum}-anim-preset" onchange="applyAnimPreset(this, '${prefix}', ${layerNum})" class="anim-preset-select">
                            <option value="">PRESET</option>
                            <option value="spin-y">SPIN Y</option>
                            <option value="spin-x">SPIN X</option>
                            <option value="hover">HOVER</option>
                            <option value="pulse">PULSE</option>
                            <option value="float-up">FLOAT</option>
                        </select>
                    </div>
                    
                    <!-- Positie animatie (ΔX, ΔY, ΔZ) -->
                    <div class="anim-group">
                        <div class="anim-row">
                            <div class="mini-input"><span>ΔX</span><input type="number" id="${prefix}layer-${layerNum}-anim-x" name="layer_${layerNum}_anim_x" value="0" step="0.01"></div>
                            <div class="mini-input"><span>ΔY</span><input type="number" id="${prefix}layer-${layerNum}-anim-y" name="layer_${layerNum}_anim_y" value="0" step="0.01"></div>
                            <div class="mini-input"><span>ΔZ</span><input type="number" id="${prefix}layer-${layerNum}-anim-z" name="layer_${layerNum}_anim_z" value="0" step="0.01"></div>
                            <div class="mini-input dur"><span>DUR</span><input type="number" id="${prefix}layer-${layerNum}-anim-pos-duration" name="layer_${layerNum}_anim_pos_duration" value="0" step="100" placeholder="ms"></div>
                        </div>
                    </div>
                    
                    <!-- Rotatie animatie (RX, RY, RZ) met origin selector -->
                    <div class="anim-group">
                        <div class="anim-row">
                            <div class="mini-input"><span>RX</span><input type="number" id="${prefix}layer-${layerNum}-anim-rot-x" name="layer_${layerNum}_anim_rot_x" value="0" step="1"></div>
                            <div class="mini-input"><span>RY</span><input type="number" id="${prefix}layer-${layerNum}-anim-rot-y" name="layer_${layerNum}_anim_rot_y" value="0" step="1"></div>
                            <div class="mini-input"><span>RZ</span><input type="number" id="${prefix}layer-${layerNum}-anim-rot-z" name="layer_${layerNum}_anim_rot_z" value="0" step="1"></div>
                            <div class="mini-input dur"><span>DUR</span><input type="number" id="${prefix}layer-${layerNum}-anim-rot-duration" name="layer_${layerNum}_anim_rot_duration" value="0" step="100" placeholder="ms"></div>
                        </div>
                        <div class="anim-row">
                            <label class="origin-label">ORIGIN:</label>
                            <select id="${prefix}layer-${layerNum}-anim-rot-origin" name="layer_${layerNum}_anim_rot_origin" class="origin-select">
                                <option value="center">CENTER</option>
                                <option value="top">BOVEN</option>
                                <option value="bottom">ONDER</option>
                                <option value="left">LINKS</option>
                                <option value="right">RECHTS</option>
                                <option value="top-left">LINKS-BOVEN</option>
                                <option value="top-right">RECHTS-BOVEN</option>
                                <option value="bottom-left">LINKS-ONDER</option>
                                <option value="bottom-right">RECHTS-ONDER</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Scale/Opacity animatie -->
                    <div class="anim-group">
                        <div class="anim-row">
                            <div class="mini-input"><span>SCALE</span><input type="number" id="${prefix}layer-${layerNum}-anim-scale" name="layer_${layerNum}_anim_scale" value="1" step="0.1"></div>
                            <div class="mini-input"><span>OPACITY</span><input type="number" id="${prefix}layer-${layerNum}-anim-opacity" name="layer_${layerNum}_anim_opacity" value="1" step="0.1" min="0" max="1"></div>
                            <div class="mini-input dur"><span>DUR</span><input type="number" id="${prefix}layer-${layerNum}-anim-scale-duration" name="layer_${layerNum}_anim_scale_duration" value="0" step="100" placeholder="ms"></div>
                        </div>
                    </div>
                </div>
            </div>
        </details>
    `;
}

// Verwijder een AR laag (alleen in edit mode)
function deleteLayer(layerNum) {
    if (!confirm(`Weet je zeker dat je laag ${layerNum} wilt verwijderen?`)) {
        return;
    }
    
    // Reset al laag input velden
    const inputIds = [
        `edit-layer-${layerNum}-image`,
        `edit-layer-${layerNum}-pos-x`,
        `edit-layer-${layerNum}-pos-y`,
        `edit-layer-${layerNum}-z`,
        `edit-layer-${layerNum}-scale`,
        `edit-layer-${layerNum}-rot-z`,
        `edit-layer-${layerNum}-exclusion`,
        `edit-layer-${layerNum}-enable-anim`,
        `edit-layer-${layerNum}-anim-x`,
        `edit-layer-${layerNum}-anim-y`,
        `edit-layer-${layerNum}-anim-z`,
        `edit-layer-${layerNum}-anim-pos-duration`,
        `edit-layer-${layerNum}-anim-rot-x`,
        `edit-layer-${layerNum}-anim-rot-y`,
        `edit-layer-${layerNum}-anim-rot-z`,
        `edit-layer-${layerNum}-anim-rot-duration`,
        `edit-layer-${layerNum}-anim-rot-origin`,
        `edit-layer-${layerNum}-anim-scale`,
        `edit-layer-${layerNum}-anim-opacity`,
        `edit-layer-${layerNum}-anim-scale-duration`,
        `edit-layer-${layerNum}-anim-preset`,
        `edit-layer-${layerNum}-text-enabled`,
        `edit-layer-${layerNum}-text-random`,
        `edit-layer-${layerNum}-text-random-font`,
        `edit-layer-${layerNum}-text-random-color`,
        `edit-layer-${layerNum}-text-random-outline`,
        `edit-layer-${layerNum}-text-random-effect`,
        `edit-layer-${layerNum}-text-random-3d`,
        `edit-layer-${layerNum}-text-random-size`,
        `edit-layer-${layerNum}-text-random-align`,
        `edit-layer-${layerNum}-text-content`,
        `edit-layer-${layerNum}-text-font`,
        `edit-layer-${layerNum}-text-size`,
        `edit-layer-${layerNum}-text-align`,
        `edit-layer-${layerNum}-text-offset-y`,
        `edit-layer-${layerNum}-text-color`,
        `edit-layer-${layerNum}-text-outline-color`,
        `edit-layer-${layerNum}-text-outline-width`,
        `edit-layer-${layerNum}-text-effect`,
        `edit-layer-${layerNum}-text-3d`,
        `edit-layer-${layerNum}-text-3d-depth`,
        `edit-layer-${layerNum}-text-3d-tilt-x`,
        `edit-layer-${layerNum}-text-3d-tilt-y`,
        `edit-layer-${layerNum}-text-3d-float-px`
    ];
    
    // Set delete flag
    const deleteInput = document.getElementById(`edit-layer-${layerNum}-delete`);
    if (deleteInput) {
        deleteInput.value = '1';
    }
    
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = false;
            } else if (el.type === 'file') {
                el.value = '';
            } else if (el.tagName === 'SELECT') {
                el.value = '';
            } else {
                const defaultVal = LAYER_CONFIG.defaultLayers.find(l => l.num === layerNum)?.defaultZ?.toFixed(3) || '0.000';
                el.value = id.includes('pos-x') || id.includes('pos-y') ? '0.000' : 
                           id.includes('-z') && !id.includes('rot') ? defaultVal :
                           id.includes('text-size') ? '96' :
                           id.includes('text-offset-y') ? '0.85' :
                           id.includes('text-color') ? '#ffffff' :
                           id.includes('text-outline-color') ? '#000000' :
                           id.includes('text-outline-width') ? '3' :
                           id.includes('text-3d-depth') ? '3' :
                           id.includes('text-3d-tilt-x') ? '16' :
                           id.includes('text-3d-tilt-y') ? '0' :
                           id.includes('text-3d-float-px') ? '4' :
                           id.includes('text-align') ? 'center' :
                           id.includes('text-font') ? '"Bebas Neue", sans-serif' :
                           id.includes('text-effect') || id.includes('text-3d') ? 'none' :
                           id.includes('scale') ? '1.0' :
                           '';
            }
        }
    });
    
    // Reset GLB en audio file inputs
    const glbInput = document.getElementById(`edit-layer-${layerNum}-glb`);
    const audioInput = document.getElementById(`edit-layer-${layerNum}-audio`);
    if (glbInput) glbInput.value = '';
    if (audioInput) audioInput.value = '';
    
    // Reset GLB en audio current info
    const glbCurrent = document.getElementById(`edit-layer-${layerNum}-glb-current`);
    const audioCurrent = document.getElementById(`edit-layer-${layerNum}-audio-current`);
    if (glbCurrent) {
        glbCurrent.textContent = 'Geen 3D model';
        glbCurrent.style.color = '#999';
    }
    if (audioCurrent) {
        audioCurrent.textContent = 'Geen audio';
        audioCurrent.style.color = '#999';
    }
    
    // Reset animation container
    const animContainer = document.getElementById(`edit-layer-${layerNum}-anim-container`);
    if (animContainer) {
        animContainer.style.display = 'none';
    }
    
    // Reset extras container
    const extrasContainer = document.getElementById(`edit-layer-${layerNum}-extras-container`);
    if (extrasContainer) {
        extrasContainer.style.display = 'none';
    }
    const extrasToggle = document.getElementById(`edit-layer-${layerNum}-enable-extras`);
    if (extrasToggle) {
        extrasToggle.checked = false;
    }
    
    // Update status badge
    const statusBadge = document.getElementById(`edit-layer-${layerNum}-status`);
    if (statusBadge) {
        statusBadge.textContent = 'Leeg';
    }
    
    // Update current file info
    const currentFileInfo = document.getElementById(`edit-layer-${layerNum}-current`);
    if (currentFileInfo) {
        currentFileInfo.textContent = 'Geen afbeelding';
        currentFileInfo.style.color = '#999';
    }
    
    alert(`Laag ${layerNum} is verwijderd!`);
}

// Toggle achtergrondkleur picker zichtbaarheid
function toggleBgColorPicker(checkbox, prefix, layerNum) {
    const colorContainer = document.getElementById(`${prefix}layer-${layerNum}-bg-color-container`);
    if (colorContainer) {
        // Toon kleurkiezer alleen als NIET transparant
        colorContainer.style.display = checkbox.checked ? 'none' : 'inline-flex';
    }
}

// Verwijder specifiek media type van een laag (afbeelding, glb, of audio)
function deleteLayerMedia(layerNum, mediaType) {
    console.log('[Admin] deleteLayerMedia aangeroepen voor laag', layerNum, 'type:', mediaType);
    
    const prefix = 'edit-';
    
    if (mediaType === 'image') {
        // Set delete flag voor backend
        const deleteFlag = document.getElementById(`${prefix}layer-${layerNum}-delete-media`);
        if (deleteFlag) deleteFlag.value = '1';
        
        // Clear file input
        const fileInput = document.getElementById(`${prefix}layer-${layerNum}-image`);
        if (fileInput) fileInput.value = '';
        
        // Update current info
        const currentInfo = document.getElementById(`${prefix}layer-${layerNum}-current`);
        if (currentInfo) {
            currentInfo.textContent = 'Wordt verwijderd bij opslaan';
            currentInfo.style.color = '#f44';
        }
        
        // Hide delete button
        const deleteBtn = document.getElementById(`${prefix}layer-${layerNum}-delete-media-btn`);
        if (deleteBtn) deleteBtn.style.display = 'none';
        
    } else if (mediaType === 'glb') {
        // Set delete flag voor backend
        const deleteFlag = document.getElementById(`${prefix}layer-${layerNum}-delete-glb`);
        if (deleteFlag) deleteFlag.value = '1';
        
        // Clear file input
        const fileInput = document.getElementById(`${prefix}layer-${layerNum}-glb`);
        if (fileInput) fileInput.value = '';
        
        // Update current info
        const currentInfo = document.getElementById(`${prefix}layer-${layerNum}-glb-current`);
        if (currentInfo) {
            currentInfo.textContent = 'Wordt verwijderd bij opslaan';
            currentInfo.style.color = '#f44';
        }
        
        // Hide delete button
        const deleteBtn = document.getElementById(`${prefix}layer-${layerNum}-delete-glb-btn`);
        if (deleteBtn) deleteBtn.style.display = 'none';
        
    } else if (mediaType === 'audio') {
        // Set delete flag voor backend
        const deleteFlag = document.getElementById(`${prefix}layer-${layerNum}-delete-audio`);
        if (deleteFlag) deleteFlag.value = '1';
        
        // Clear file input
        const fileInput = document.getElementById(`${prefix}layer-${layerNum}-audio`);
        if (fileInput) fileInput.value = '';
        
        // Update current info
        const currentInfo = document.getElementById(`${prefix}layer-${layerNum}-audio-current`);
        if (currentInfo) {
            currentInfo.textContent = 'Wordt verwijderd bij opslaan';
            currentInfo.style.color = '#f44';
        }
        
        // Hide delete button
        const deleteBtn = document.getElementById(`${prefix}layer-${layerNum}-delete-audio-btn`);
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
    
    console.log('[Admin] Media delete gemarkeerd voor laag', layerNum, 'type:', mediaType);
    
    // Update preview
    updatePreviewFromInputs();
}

// API URL - Detect environment
const API_URL = window.location.origin + '/api.php'; // cPanel with PHP backend
const BASE_URL = window.location.origin; // Voor statische bestanden

// Utility function voor file size formatting
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Get file size category for styling
function getFileSizeCategory(bytes, maxBytes) {
    const percentage = (bytes / maxBytes) * 100;
    if (percentage > 80) return 'large';
    if (percentage > 50) return 'medium';
    return 'small';
}

// Apply animation preset
function applyAnimPreset(selectEl, prefix, layerNum) {
    const preset = selectEl.value;
    if (!preset) return;

    const setVal = (id, val) => {
        const el = document.getElementById(`${prefix}layer-${layerNum}-${id}`);
        if (el) el.value = val;
    };

    // Reset all first
    setVal('anim-x', 0); setVal('anim-y', 0); setVal('anim-z', 0);
    setVal('anim-pos-duration', 0);
    setVal('anim-rot-x', 0); setVal('anim-rot-y', 0); setVal('anim-rot-z', 0);
    setVal('anim-rot-duration', 0); setVal('anim-rot-origin', 'center');
    setVal('anim-scale', 1.0); setVal('anim-opacity', 1.0); setVal('anim-scale-duration', 0);

    switch(preset) {
        case 'reset':
            // Already reset above
            break;
        case 'spin-y':
            setVal('anim-rot-y', 360);
            setVal('anim-rot-duration', 5000);
            break;
        case 'spin-x':
            setVal('anim-rot-x', 360);
            setVal('anim-rot-duration', 5000);
            break;
        case 'spin-z':
            setVal('anim-rot-z', 360);
            setVal('anim-rot-duration', 5000);
            break;
        case 'float-up':
            setVal('anim-y', 0.5); // 50cm up
            setVal('anim-pos-duration', 3000);
            break;
        case 'hover':
            setVal('anim-y', 0.2); // 20cm up/down
            setVal('anim-pos-duration', 2000);
            break;
        case 'slide-in':
            setVal('anim-x', -1.0); // Start from left
            setVal('anim-pos-duration', 1500);
            break;
        case 'pulse':
            setVal('anim-scale', 1.2);
            setVal('anim-scale-duration', 1000);
            break;
        case 'fade-in':
            setVal('anim-opacity', 0); 
            setVal('anim-scale-duration', 2000);
            break;
        case 'pop-in':
            setVal('anim-scale', 0.01); // Start small
            setVal('anim-scale-duration', 800);
            break;
        case 'blink':
            setVal('anim-opacity', 0);
            setVal('anim-scale-duration', 500);
            break;
    }
}

// Session timeout warning (1 hour = 3600 seconds)
const SESSION_TIMEOUT = 3600000; // milliseconds
let sessionTimer = null;

// AR Preview state
let previewLayers = {};
let previewCanvas = null;
let previewCtx = null;
let arPreviewWindow = null;
let arPreviewZIndex = 1000;
let adminUXBound = false;
let editModalUXBound = false;

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    renderLayers(false); // Render layers first so elements exist
    setupAdminUX();
    setupEditModalUX();

    const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
    if (isLoggedIn === 'true') {
        showUploadSection();
        loadAdminPosters();
        startSessionTimer(); // Restart timer on page load
    }
    
    setupLoginForm();
    setupUploadForm();
    setupFilePreview();
    setupLogoutButton();
    setupFileSummaryListeners(); // Core files
    setupCreditsSection(); // Credits dynamic rows
    setupUploadTypeSelector(); // Upload modus dropdown
    
    // Defer layer listeners slightly to ensure inputs exist
    setTimeout(() => {
        setupLayerSummaryListeners();
        setupLayerAnimationToggles(); // Animation toggles
        setupARPreview(); // Visual preview
        setupLayerApiSources(); // API bron selectors per laag
        refreshAdminUXState();
    }, 500);
});

function setupAdminUX() {
    if (adminUXBound) {
        refreshAdminUXState();
        return;
    }

    adminUXBound = true;
    const form = document.getElementById('upload-form');
    const focusSelect = document.getElementById('ux-focus-mode');
    const stepButtons = Array.from(document.querySelectorAll('.ux-step-btn'));
    const layerFilterInput = document.getElementById('layer-filter-input');
    const layerFilterActiveOnly = document.getElementById('layer-filter-active-only');

    if (focusSelect && form) {
        focusSelect.addEventListener('change', () => {
            form.dataset.focus = focusSelect.value;
            refreshAdminUXState();
        });
        form.dataset.focus = focusSelect.value;
    }

    stepButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const panelId = btn.dataset.targetPanel;
            const panel = panelId ? document.getElementById(panelId) : null;
            const focusMap = {
                'metadata-panel': 'meta',
                'files-panel': 'files',
                'layers-panel': 'layers',
                'submit-panel': 'submit'
            };

            if (focusSelect && panelId && focusMap[panelId]) {
                focusSelect.value = focusMap[panelId];
                if (form) form.dataset.focus = focusMap[panelId];
            }

            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            setActiveStepButton(panelId);
            refreshAdminUXState();
        });
    });

    const onLayerFilterChange = () => {
        applyLayerFilters();
        refreshAdminUXState();
    };

    if (layerFilterInput) {
        layerFilterInput.addEventListener('input', onLayerFilterChange);
    }
    if (layerFilterActiveOnly) {
        layerFilterActiveOnly.addEventListener('change', onLayerFilterChange);
    }

    if (form) {
        const formActivityListener = () => refreshAdminUXState();
        form.addEventListener('input', formActivityListener);
        form.addEventListener('change', formActivityListener);
    }

    refreshAdminUXState();
}

function setActiveStepButton(panelId) {
    document.querySelectorAll('.ux-step-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.targetPanel === panelId);
    });
}

function applyLayerFilters() {
    const query = (document.getElementById('layer-filter-input')?.value || '').trim().toLowerCase();
    const activeOnly = !!document.getElementById('layer-filter-active-only')?.checked;
    const cards = Array.from(document.querySelectorAll('#layers-container .layer-card'));

    cards.forEach((card) => {
        const title = card.querySelector('.layer-title')?.textContent?.toLowerCase() || '';
        const status = card.querySelector('.layer-status')?.textContent?.toLowerCase() || '';
        const statusIsActive = status !== '' && status !== 'leeg';
        const matchQuery = query === '' || title.includes(query) || status.includes(query);
        const matchActive = !activeOnly || statusIsActive;
        card.classList.toggle('is-filtered-out', !(matchQuery && matchActive));
    });
}

function refreshAdminUXState() {
    updateUXStats();
    updateUXSteps();
    applyLayerFilters();
}

function setupEditModalUX() {
    if (editModalUXBound) {
        refreshEditModalUXState();
        return;
    }

    editModalUXBound = true;
    const form = document.getElementById('edit-form');
    const focusSelect = document.getElementById('edit-ux-focus-mode');
    const stepButtons = Array.from(document.querySelectorAll('.edit-ux-step-btn'));
    const layerFilterInput = document.getElementById('edit-layer-filter-input');
    const layerFilterActiveOnly = document.getElementById('edit-layer-filter-active-only');

    if (focusSelect && form) {
        focusSelect.addEventListener('change', () => {
            form.dataset.editFocus = focusSelect.value;
            refreshEditModalUXState();
        });
        form.dataset.editFocus = focusSelect.value;
    }

    stepButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const panelId = btn.dataset.editTargetPanel;
            const panel = panelId ? document.getElementById(panelId) : null;
            const focusMap = {
                'edit-metadata-panel': 'meta',
                'edit-files-panel': 'files',
                'edit-layers-panel': 'layers',
                'edit-submit-panel': 'submit'
            };

            if (focusSelect && panelId && focusMap[panelId]) {
                focusSelect.value = focusMap[panelId];
                if (form) form.dataset.editFocus = focusMap[panelId];
            }

            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            setActiveEditStepButton(panelId);
            refreshEditModalUXState();
        });
    });

    const onLayerFilterChange = () => {
        applyEditLayerFilters();
        refreshEditModalUXState();
    };

    if (layerFilterInput) layerFilterInput.addEventListener('input', onLayerFilterChange);
    if (layerFilterActiveOnly) layerFilterActiveOnly.addEventListener('change', onLayerFilterChange);

    if (form) {
        const formActivityListener = () => refreshEditModalUXState();
        form.addEventListener('input', formActivityListener);
        form.addEventListener('change', formActivityListener);
    }
}

function setActiveEditStepButton(panelId) {
    document.querySelectorAll('.edit-ux-step-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.editTargetPanel === panelId);
    });
}

function applyEditLayerFilters() {
    const query = (document.getElementById('edit-layer-filter-input')?.value || '').trim().toLowerCase();
    const activeOnly = !!document.getElementById('edit-layer-filter-active-only')?.checked;
    const cards = Array.from(document.querySelectorAll('#edit-layers-container .layer-card'));

    cards.forEach((card) => {
        const title = card.querySelector('.layer-title')?.textContent?.toLowerCase() || '';
        const status = card.querySelector('.layer-status')?.textContent?.toLowerCase() || '';
        const statusIsActive = status !== '' && status !== 'leeg';
        const matchQuery = query === '' || title.includes(query) || status.includes(query);
        const matchActive = !activeOnly || statusIsActive;
        card.classList.toggle('is-filtered-out', !(matchQuery && matchActive));
    });
}

function refreshEditModalUXState() {
    const modal = document.getElementById('edit-modal');
    if (!modal || modal.style.display !== 'block') return;
    updateEditModalUXStats();
    updateEditModalUXSteps();
    applyEditLayerFilters();
}

function updateEditModalUXStats() {
    const activeLayers = Array.from(document.querySelectorAll('#edit-layers-container .layer-status')).filter((el) => {
        const status = (el.textContent || '').trim().toUpperCase();
        return status !== '' && status !== 'LEEG';
    }).length;

    const changedFiles = [
        'edit-jpeg',
        'edit-ar-marker-file',
        'edit-pdf-medium',
        'edit-pdf-large',
        'edit-gallery-images'
    ].reduce((count, id) => count + (document.getElementById(id)?.files?.length ? 1 : 0), 0);

    const coreReady = [
        (document.getElementById('edit-title')?.value || '').trim().length > 0,
        !!document.getElementById('edit-poster-id')?.value,
        activeLayers > 0 || changedFiles > 0
    ];
    const readiness = Math.round((coreReady.filter(Boolean).length / coreReady.length) * 100);

    const layersEl = document.getElementById('edit-ux-stat-layers');
    const filesEl = document.getElementById('edit-ux-stat-files');
    const readinessEl = document.getElementById('edit-ux-stat-readiness');

    if (layersEl) layersEl.textContent = String(activeLayers);
    if (filesEl) filesEl.textContent = String(changedFiles);
    if (readinessEl) readinessEl.textContent = `${readiness}%`;
}

function updateEditModalUXSteps() {
    const stepState = {
        'edit-metadata-panel': (document.getElementById('edit-title')?.value || '').trim().length > 0,
        'edit-files-panel': !!document.getElementById('edit-jpeg')?.files?.[0] || !!document.getElementById('edit-pdf-medium')?.files?.[0] || !!document.getElementById('edit-pdf-large')?.files?.[0],
        'edit-layers-panel': Array.from(document.querySelectorAll('#edit-layers-container .layer-status')).some((el) => (el.textContent || '').trim().toUpperCase() !== 'LEEG'),
        'edit-submit-panel': false
    };

    stepState['edit-submit-panel'] = stepState['edit-metadata-panel'] && (stepState['edit-files-panel'] || stepState['edit-layers-panel']);

    document.querySelectorAll('.edit-ux-step-btn').forEach((btn) => {
        const key = btn.dataset.editTargetPanel;
        btn.classList.toggle('is-done', !!stepState[key]);
    });
}

function updateUXStats() {
    const postersCount = document.querySelectorAll('#admin-poster-list .sidebar-poster-item').length;
    const layerStatusEls = Array.from(document.querySelectorAll('#layers-container .layer-status'));
    const activeLayers = layerStatusEls.filter((el) => (el.textContent || '').trim().toUpperCase() !== 'LEEG').length;

    const titleFilled = (document.getElementById('poster-title')?.value || '').trim().length > 0;
    const jpegSelected = !!document.getElementById('poster-jpeg')?.files?.[0];
    const readinessParts = [titleFilled, jpegSelected, activeLayers > 0];
    const readiness = Math.round((readinessParts.filter(Boolean).length / readinessParts.length) * 100);

    const postersEl = document.getElementById('ux-stat-posters');
    const layersEl = document.getElementById('ux-stat-layers');
    const readinessEl = document.getElementById('ux-stat-readiness');

    if (postersEl) postersEl.textContent = String(postersCount);
    if (layersEl) layersEl.textContent = String(activeLayers);
    if (readinessEl) readinessEl.textContent = `${readiness}%`;
}

function updateUXSteps() {
    const stepState = {
        'metadata-panel': (document.getElementById('poster-title')?.value || '').trim().length > 0,
        'files-panel': !!document.getElementById('poster-jpeg')?.files?.[0],
        'layers-panel': Array.from(document.querySelectorAll('#layers-container .layer-status')).some((el) => (el.textContent || '').trim().toUpperCase() !== 'LEEG'),
        'submit-panel': false
    };

    stepState['submit-panel'] = stepState['metadata-panel'] && stepState['files-panel'];

    document.querySelectorAll('.ux-step-btn').forEach((btn) => {
        const key = btn.dataset.targetPanel;
        const done = !!stepState[key];
        btn.classList.toggle('is-done', done);
    });
}

// Setup animation toggle listeners (show/hide anim panel)
function setupLayerAnimationToggles() {
    for (let i = 1; i <= LAYER_CONFIG.maxLayers; i++) {
        // Upload form
        const animToggle = document.getElementById(`layer-${i}-enable-anim`);
        const animContainer = document.getElementById(`layer-${i}-anim-container`);
        if (animToggle && animContainer) {
            animToggle.addEventListener('change', function() {
                animContainer.classList.toggle('hidden', !this.checked);
            });
        }
        
        // Edit form
        const editAnimToggle = document.getElementById(`edit-layer-${i}-enable-anim`);
        const editAnimContainer = document.getElementById(`edit-layer-${i}-anim-container`);
        if (editAnimToggle && editAnimContainer) {
            editAnimToggle.addEventListener('change', function() {
                editAnimContainer.classList.toggle('hidden', !this.checked);
            });
        }
    }
}

// Setup AR Preview - Nu als popup window
function setupARPreview() {
    // Verwijder oude static preview als die bestaat
    const oldContainer = document.getElementById('ar-preview-container');
    if (oldContainer) oldContainer.remove();
    
    // Voeg preview knop toe aan layers panel header
    const layersPanelHeader = document.querySelector('#layers-container')?.closest('.panel-box')?.querySelector('.panel-header');
    if (layersPanelHeader && !layersPanelHeader.querySelector('.preview-toggle-btn')) {
        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'preview-toggle-btn';
        previewBtn.textContent = 'PREVIEW';
        previewBtn.onclick = toggleARPreviewWindow;
        layersPanelHeader.appendChild(previewBtn);
    }
    
    // Event delegation voor real-time preview updates
    // Dit werkt ook voor dynamisch aangemaakte elementen
    document.addEventListener('input', (e) => {
        // Check of het een layer input is (positie, rotatie, scale, animatie)
        if (e.target.matches('input[id*="layer-"][id*="-pos-"], input[id*="layer-"][id*="-rot-"], input[id*="layer-"][id*="-scale"], input[id*="layer-"][id*="-z"], input[id*="layer-"][id*="-anim-"], input[id*="layer-"][id*="-text-"]') ||
            e.target.matches('textarea[id*="layer-"][id*="-text-content"]') ||
            e.target.matches('select[id*="layer-"][id*="-text-"]')) {
            updatePreviewFromInputs();
        }
    });
    
    // File upload change events voor real-time preview
    document.addEventListener('change', (e) => {
        if (e.target.matches('input[type="file"][id*="layer-"][id*="-image"]') ||
            e.target.matches('input[id*="layer-"][id*="-text-enabled"], input[id*="layer-"][id*="-text-random"]')) {
            updatePreviewFromInputs();
        }
    });
}

// Toggle AR Preview Window
function toggleARPreviewWindow() {
    if (arPreviewWindow && document.body.contains(arPreviewWindow)) {
        closeARPreviewWindow();
    } else {
        openARPreviewWindow();
    }
}

// Open AR Preview Window
function openARPreviewWindow() {
    if (arPreviewWindow && document.body.contains(arPreviewWindow)) return;
    
    // Create window
    const windowWidth = 350;
    const windowHeight = 400;
    const posX = window.innerWidth - windowWidth - 50;
    const posY = 100;
    
    arPreviewWindow = document.createElement('div');
    arPreviewWindow.id = 'ar-preview-window';
    arPreviewWindow.className = 'ar-preview-window';
    arPreviewWindow.style.cssText = `
        position: fixed;
        left: ${posX}px;
        top: ${posY}px;
        width: ${windowWidth}px;
        height: ${windowHeight}px;
        z-index: ${++arPreviewZIndex};
    `;
    
    arPreviewWindow.innerHTML = `
        <div class="ar-window-header">
            <span class="ar-window-title">┌─[ AR PREVIEW ]─┐</span>
            <div class="ar-window-controls">
                <button type="button" class="ar-win-btn ar-win-close" title="Sluiten">×</button>
            </div>
        </div>
        <div class="ar-window-content">
            <div class="ar-view-controls">
                <button type="button" class="ar-view-btn active" data-view="front">FRONT</button>
                <button type="button" class="ar-view-btn" data-view="side">SIDE</button>
                <button type="button" class="ar-view-btn" data-view="top">TOP</button>
            </div>
            <div id="ar-canvas-wrapper" style="position: relative; flex: 1; min-height: 0; overflow: hidden; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.2);">
                <canvas id="ar-preview-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
                <div id="ar-preview-overlays" style="position: absolute; inset: 0; pointer-events: none; overflow: hidden;"></div>
            </div>
            <div class="ar-preview-legend">
                <span><span class="legend-dot" style="background:#fff"></span>L1</span>
                <span><span class="legend-dot" style="background:#f00"></span>L2</span>
                <span><span class="legend-dot" style="background:#0f0"></span>L3</span>
                <span><span class="legend-dot" style="background:#00f"></span>L4</span>
            </div>
        </div>
        <div class="ar-resize-handle ar-resize-se"></div>
        <div class="ar-resize-handle ar-resize-sw"></div>
        <div class="ar-resize-handle ar-resize-ne"></div>
        <div class="ar-resize-handle ar-resize-nw"></div>
    `;
    
    document.body.appendChild(arPreviewWindow);
    
    // Setup interactions
    setupARWindowDrag(arPreviewWindow);
    setupARWindowResize(arPreviewWindow);
    setupARWindowControls(arPreviewWindow);
    
    // Setup canvas
    previewCanvas = document.getElementById('ar-preview-canvas');
    if (previewCanvas) {
        previewCtx = previewCanvas.getContext('2d');
        resizePreviewCanvas();
        updatePreviewFromInputs();
    }
}

// Close AR Preview Window
function closeARPreviewWindow() {
    if (arPreviewWindow) {
        // Stop any running animations
        if (typeof cancelAnimationFrame === 'function' && window._arPreviewAnimationId) {
            cancelAnimationFrame(window._arPreviewAnimationId);
        }
        
        arPreviewWindow.remove();
        arPreviewWindow = null;
        previewCanvas = null;
        previewCtx = null;
    }
}
window.closeARPreviewWindow = closeARPreviewWindow;
window.toggleARPreviewWindow = toggleARPreviewWindow;

// Setup AR Window Dragging
function setupARWindowDrag(windowEl) {
    const header = windowEl.querySelector('.ar-window-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('ar-win-btn')) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = windowEl.offsetLeft;
        startTop = windowEl.offsetTop;
        
        windowEl.style.zIndex = ++arPreviewZIndex;
        windowEl.classList.add('dragging');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        windowEl.style.left = `${startLeft + dx}px`;
        windowEl.style.top = `${startTop + dy}px`;
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            windowEl.classList.remove('dragging');
        }
    });
}

// Setup AR Window Resizing
function setupARWindowResize(windowEl) {
    const handles = windowEl.querySelectorAll('.ar-resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    const minWidth = 250;
    const minHeight = 300;
    
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            currentHandle = handle;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = windowEl.offsetWidth;
            startHeight = windowEl.offsetHeight;
            startLeft = windowEl.offsetLeft;
            startTop = windowEl.offsetTop;
            
            windowEl.style.zIndex = ++arPreviewZIndex;
            windowEl.classList.add('resizing');
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing || !currentHandle) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        if (currentHandle.classList.contains('ar-resize-se') || currentHandle.classList.contains('ar-resize-ne')) {
            windowEl.style.width = `${Math.max(minWidth, startWidth + dx)}px`;
        }
        if (currentHandle.classList.contains('ar-resize-sw') || currentHandle.classList.contains('ar-resize-nw')) {
            const newWidth = Math.max(minWidth, startWidth - dx);
            windowEl.style.width = `${newWidth}px`;
            windowEl.style.left = `${startLeft + (startWidth - newWidth)}px`;
        }
        if (currentHandle.classList.contains('ar-resize-se') || currentHandle.classList.contains('ar-resize-sw')) {
            windowEl.style.height = `${Math.max(minHeight, startHeight + dy)}px`;
        }
        if (currentHandle.classList.contains('ar-resize-ne') || currentHandle.classList.contains('ar-resize-nw')) {
            const newHeight = Math.max(minHeight, startHeight - dy);
            windowEl.style.height = `${newHeight}px`;
            windowEl.style.top = `${startTop + (startHeight - newHeight)}px`;
        }
        
        resizePreviewCanvas();
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            currentHandle = null;
            windowEl.classList.remove('resizing');
        }
    });
}

// Setup AR Window Controls
function setupARWindowControls(windowEl) {
    // Close button
    const closeBtn = windowEl.querySelector('.ar-win-close');
    if (closeBtn) {
        closeBtn.onclick = closeARPreviewWindow;
    }
    
    // View buttons
    windowEl.querySelectorAll('.ar-view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            windowEl.querySelectorAll('.ar-view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderARPreview();
        });
    });
}

function resizePreviewCanvas() {
    if (!previewCanvas) return;
    const wrapper = document.getElementById('ar-canvas-wrapper');
    if (!wrapper) return;
    
    // Canvas dimensions = wrapper dimensions (100% fill)
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    
    // Update internal resizing
    if (previewCanvas.width !== width || previewCanvas.height !== height) {
        previewCanvas.width = width;
        previewCanvas.height = height;
        renderARPreview();
    }
}

function updatePreviewFromInputs() {
    // Gather all layer data from inputs (check both upload en edit forms)
    previewLayers = {};
    const isEditMode = document.getElementById('edit-modal')?.style.display === 'block';
    const prefix = isEditMode ? 'edit-' : '';
    
    // Haal poster ID op voor URL constructie (alleen bij edit)
    const posterId = document.getElementById('edit-poster-id')?.value || null;
    
    for (let i = 1; i <= LAYER_CONFIG.maxLayers; i++) {
        const getVal = (id, def = 0) => {
            const el = document.getElementById(id);
            return el ? parseFloat(el.value) || def : def;
        };
        
        const posX = getVal(`${prefix}layer-${i}-pos-x`, 0);
        const posY = getVal(`${prefix}layer-${i}-pos-y`, 0);
        const posZ = getVal(`${prefix}layer-${i}-z`, 0);
        const scale = getVal(`${prefix}layer-${i}-scale`, 1);
        const rotX = getVal(`${prefix}layer-${i}-rot-x`, 0);
        const rotY = getVal(`${prefix}layer-${i}-rot-y`, 0);
        const rotZ = getVal(`${prefix}layer-${i}-rot-z`, 0);
        
        // Animatie parameters
        const animX = getVal(`${prefix}layer-${i}-anim-x`, 0);
        const animY = getVal(`${prefix}layer-${i}-anim-y`, 0);
        const animZ = getVal(`${prefix}layer-${i}-anim-z`, 0);
        const animPosDuration = getVal(`${prefix}layer-${i}-anim-pos-duration`, 0);
        const animRotX = getVal(`${prefix}layer-${i}-anim-rot-x`, 0);
        const animRotY = getVal(`${prefix}layer-${i}-anim-rot-y`, 0);
        const animRotZ = getVal(`${prefix}layer-${i}-anim-rot-z`, 0);
        const animRotDuration = getVal(`${prefix}layer-${i}-anim-rot-duration`, 0);
        const animRotOrigin = document.getElementById(`${prefix}layer-${i}-anim-rot-origin`)?.value || 'center';
        const animScale = getVal(`${prefix}layer-${i}-anim-scale`, 1);
        const animOpacity = getVal(`${prefix}layer-${i}-anim-opacity`, 1);
        const animScaleDuration = getVal(`${prefix}layer-${i}-anim-scale-duration`, 0);

        // Tekstlaag parameters
        const textEnabledEl = document.getElementById(`${prefix}layer-${i}-text-enabled`);
        const textRandomEl = document.getElementById(`${prefix}layer-${i}-text-random`);
        const textContentEl = document.getElementById(`${prefix}layer-${i}-text-content`);
        const textFontEl = document.getElementById(`${prefix}layer-${i}-text-font`);
        const textSizeEl = document.getElementById(`${prefix}layer-${i}-text-size`);
        const textAlignEl = document.getElementById(`${prefix}layer-${i}-text-align`);
        const textOffsetYEl = document.getElementById(`${prefix}layer-${i}-text-offset-y`);
        const textColorEl = document.getElementById(`${prefix}layer-${i}-text-color`);
        const textOutlineColorEl = document.getElementById(`${prefix}layer-${i}-text-outline-color`);
        const textOutlineWidthEl = document.getElementById(`${prefix}layer-${i}-text-outline-width`);
        const textEffectEl = document.getElementById(`${prefix}layer-${i}-text-effect`);
        const text3DEl = document.getElementById(`${prefix}layer-${i}-text-3d`);
        const text3DDepthEl = document.getElementById(`${prefix}layer-${i}-text-3d-depth`);
        const text3DTiltXEl = document.getElementById(`${prefix}layer-${i}-text-3d-tilt-x`);
        const text3DTiltYEl = document.getElementById(`${prefix}layer-${i}-text-3d-tilt-y`);
        const text3DFloatPxEl = document.getElementById(`${prefix}layer-${i}-text-3d-float-px`);
        const textRandomFontEl = document.getElementById(`${prefix}layer-${i}-text-random-font`);
        const textRandomColorEl = document.getElementById(`${prefix}layer-${i}-text-random-color`);
        const textRandomOutlineEl = document.getElementById(`${prefix}layer-${i}-text-random-outline`);
        const textRandomEffectEl = document.getElementById(`${prefix}layer-${i}-text-random-effect`);
        const textRandom3DEl = document.getElementById(`${prefix}layer-${i}-text-random-3d`);
        const textRandomSizeEl = document.getElementById(`${prefix}layer-${i}-text-random-size`);
        const textRandomAlignEl = document.getElementById(`${prefix}layer-${i}-text-random-align`);

        const textEnabled = !!textEnabledEl?.checked;
        const textRandom = !!textRandomEl?.checked;
        const textContent = (textContentEl?.value || '').trim();
        const textHasContent = textEnabled && textContent.length > 0;
        
        // Check of layer media heeft (file input of bestaand bestand uit poster data)
        const fileInput = document.getElementById(`${prefix}layer-${i}-image`);
        const hasFile = fileInput?.files?.length > 0;
        
        // Check bestaand bestand via opgeslagen poster data
        let existingFilename = null;
        let existingGlbModel = null;
        if (isEditMode && currentPosterData?.layers) {
            const layerKey = `layer_${i}`;
            const layerDataFromPoster = currentPosterData.layers[layerKey];
            
            // Check of media gemarkeerd is voor verwijdering
            const deleteMediaFlag = document.getElementById(`${prefix}layer-${i}-delete-media`);
            const deleteGlbFlag = document.getElementById(`${prefix}layer-${i}-delete-glb`);
            const mediaMarkedForDelete = deleteMediaFlag?.value === '1';
            const glbMarkedForDelete = deleteGlbFlag?.value === '1';
            
            if (layerDataFromPoster?.filename && !mediaMarkedForDelete) {
                existingFilename = layerDataFromPoster.filename;
            }
            if (layerDataFromPoster?.glb_model && !glbMarkedForDelete) {
                existingGlbModel = layerDataFromPoster.glb_model;
            }
        }
        
        // Check voor nieuwe GLB upload
        const glbInput = document.getElementById(`${prefix}layer-${i}-glb`);
        const hasGlbFile = glbInput?.files?.length > 0;
        
        // Check voor API random layer (via actieve selectie of opgeslagen posterdata)
        let isApiRandom = false;
        let apiRandomQuery = '';
        const activeApiData = apiLayerData[`${prefix}layer-${i}`];
        if (activeApiData?.api_mode === 'random') {
            isApiRandom = true;
            apiRandomQuery = activeApiData.query || '';
        } else if (isEditMode && currentPosterData?.layers) {
            const savedLayerData = currentPosterData.layers[`layer_${i}`];
            if (savedLayerData?.api_mode === 'random') {
                isApiRandom = true;
                apiRandomQuery = savedLayerData.api_query || '';
            }
        }
        
        // ALLEEN layers met content tonen in preview
        if (hasFile || existingFilename || hasGlbFile || existingGlbModel || isApiRandom || textHasContent) {
            const layerData = { 
                posX, posY, posZ, scale, rotX, rotY, rotZ, 
                // Animatie parameters
                animX, animY, animZ, animPosDuration,
                animRotX, animRotY, animRotZ, animRotDuration, animRotOrigin,
                animScale, animOpacity, animScaleDuration,
                hasContent: true,
                imageSrc: null,
                imageLoaded: false,
                imageEl: null,
                isVideo: false,
                isGlb: false,
                glbFilename: null,
                isApiRandom: false,
                apiRandomQuery: '',
                hasText: textHasContent,
                textContent,
                textRandom,
                textRandomSpec: {
                    font: !!textRandomFontEl?.checked,
                    color: !!textRandomColorEl?.checked,
                    outline: !!textRandomOutlineEl?.checked,
                    effect: !!textRandomEffectEl?.checked,
                    effect3d: !!textRandom3DEl?.checked,
                    size: !!textRandomSizeEl?.checked,
                    align: !!textRandomAlignEl?.checked,
                },
                textFont: textFontEl?.value || '"Bebas Neue", sans-serif',
                textSize: parseFloat(textSizeEl?.value) || 96,
                textAlign: textAlignEl?.value || 'center',
                textOffsetY: parseFloat(textOffsetYEl?.value) || 0.85,
                textColor: textColorEl?.value || '#ffffff',
                textOutlineColor: textOutlineColorEl?.value || '#000000',
                textOutlineWidth: parseFloat(textOutlineWidthEl?.value) || 3,
                textEffect: textEffectEl?.value || 'none',
                text3d: text3DEl?.value || 'none',
                text3dDepth: parseFloat(text3DDepthEl?.value) || 3,
                text3dTiltX: parseFloat(text3DTiltXEl?.value) || 16,
                text3dTiltY: parseFloat(text3DTiltYEl?.value) || 0,
                text3dFloatPx: parseFloat(text3DFloatPxEl?.value) || 4,
                textSeed: parseInt(currentPosterData?.layers?.[`layer_${i}`]?.text_style_seed, 10) ||
                          previewTextSeeds[`${prefix}${i}`] ||
                          (previewTextSeeds[`${prefix}${i}`] = Date.now() + i)
            };
            
            // Laad afbeelding voor preview
            if (hasFile) {
                // Nieuw geüploade bestand - gebruik FileReader
                const file = fileInput.files[0];
                if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const img = new Image();
                            img.onload = () => {
                                layerData.imageEl = img;
                                layerData.imageLoaded = true;
                                renderARPreview();
                            };
                            img.src = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    } else {
                        // Video - toon placeholder
                        layerData.isVideo = true;
                        layerData.imageLoaded = true;
                    }
                }
            } else if (existingFilename) {
                // Bestaand bestand - laad van server
                // Treat GIF as image so it animates in preview
                const isVideo = existingFilename.endsWith('.mp4') || existingFilename.endsWith('.webm');
                
                if (isVideo) {
                    // Video - toon placeholder met play icoon
                    layerData.isVideo = true;
                    layerData.imageLoaded = true;
                    layerData.filename = existingFilename;
                } else {
                    // Afbeelding (JPG, PNG, GIF) - laad van server
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        layerData.imageEl = img;
                        layerData.imageLoaded = true;
                        renderARPreview();
                    };
                    img.onerror = () => {
                        console.warn('Kon afbeelding niet laden:', existingFilename);
                        layerData.imageLoaded = true; // Toon placeholder bij error
                    };
                    // Cache buster om verse afbeelding te laden na update
                    const cacheBuster = Date.now();
                    img.src = `../uploads/ar-layers/${existingFilename}?_=${cacheBuster}`;
                }
            }
            
            // GLB 3D model check - toon placeholder in preview
            if (hasGlbFile || existingGlbModel) {
                layerData.isGlb = true;
                layerData.glbFilename = existingGlbModel || (hasGlbFile ? glbInput.files[0].name : null);
                layerData.imageLoaded = true; // Markeer als "geladen" zodat preview rendert
                console.log(`[Preview] Layer ${i} heeft GLB: ${layerData.glbFilename}`);
            }
            
            // API random layer placeholder
            if (isApiRandom && !hasFile && !existingFilename) {
                layerData.isApiRandom = true;
                layerData.apiRandomQuery = apiRandomQuery;
                layerData.imageLoaded = true; // Markeer als geladen zodat preview rendert
            }
            
            console.log(`[Preview] Layer ${i} toegevoegd aan previewLayers:`, {
                hasFile, existingFilename, hasGlbFile, existingGlbModel,
                isGlb: layerData.isGlb, imageLoaded: layerData.imageLoaded
            });
            
            previewLayers[i] = layerData;
        }
    }
    renderARPreview();
}

function renderARPreview() {
    if (!previewCanvas || !previewCtx) return;
    ensureTextFontsLoaded();
    
    const ctx = previewCtx;
    const w = previewCanvas.width;
    const h = previewCanvas.height;
    
    if (w <= 0 || h <= 0) return;
    
    const activeView = document.querySelector('.ar-view-btn.active')?.dataset.view || 'front';
    
    // Clear with dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    const gridSize = 25;
    for (let x = 0; x <= w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    
    // Center point
    const cx = w / 2;
    const cy = h / 2;
    const pxPerMeter = Math.min(w, h) * 0.6; // Scale based on canvas size
    
    // Draw poster base (represents the AR target)
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    const posterW = 1 * pxPerMeter * 0.8;
    const posterH = 1.4 * pxPerMeter * 0.8;
    
    if (activeView === 'front') {
        ctx.fillRect(cx - posterW/2, cy - posterH/2, posterW, posterH);
        ctx.strokeRect(cx - posterW/2, cy - posterH/2, posterW, posterH);
        // Toon echte poster thumbnail als die beschikbaar is
        if (previewPosterImage && previewPosterImage.complete && previewPosterImage.naturalWidth > 0) {
            ctx.drawImage(previewPosterImage, cx - posterW/2, cy - posterH/2, posterW, posterH);
            // Subtiele rand over de afbeelding heen
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - posterW/2, cy - posterH/2, posterW, posterH);
        } else {
            // Fallback label
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '10px Roboto Mono';
            ctx.textAlign = 'center';
            ctx.fillText('POSTER', cx, cy);
        }
    } else if (activeView === 'side') {
        ctx.fillRect(cx - 3, cy - posterH/2, 6, posterH);
        ctx.strokeRect(cx - 3, cy - posterH/2, 6, posterH);
    } else if (activeView === 'top') {
        ctx.fillRect(cx - posterW/2, cy - 3, posterW, 6);
        ctx.strokeRect(cx - posterW/2, cy - 3, posterW, 6);
    }
    
    // Update overlays
    const overlayContainer = document.getElementById('ar-preview-overlays');
    if (overlayContainer) overlayContainer.innerHTML = '';
    
    // Clear oude animatie keyframes
    let animStyleEl = document.getElementById('preview-animations');
    if (animStyleEl) {
        animStyleEl.textContent = '';
    }
    
    // Check of er layers zijn met content
    const layersWithContent = Object.entries(previewLayers).filter(([_, data]) => data.hasContent);
    console.log('[Preview] Layers met content:', layersWithContent.length, 'GLB layers:', layersWithContent.filter(([_,d]) => d.isGlb).length);
    
    if (layersWithContent.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px Roboto Mono';
        ctx.textAlign = 'center';
        ctx.fillText('Upload een bestand om preview te zien', cx, cy + posterH/2 + 25);
        return;
    }
    
    // Draw layers
    const colors = ['#ffffff', '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8844'];
    
    // In AR: 1.4 * scale = werkelijke grootte in meters
    // De poster is ook ~1.4m, dus scale=1 = poster grootte
    // We gebruiken posterW als referentie (= 1.4m equivalent)
    const arUnitSize = posterW; // Basis grootte voor scale=1
    
    layersWithContent.forEach(([layerNum, data]) => {
        const idx = parseInt(layerNum) - 1;
        const color = colors[idx] || '#fff';
        
        let x, y;
        // Layer grootte: scale * basis (in AR is dit 1.4 * scale meters)
        const layerSize = arUnitSize * data.scale;
        
        if (activeView === 'front') {
            x = cx + data.posX * pxPerMeter;
            y = cy - data.posY * pxPerMeter;
        } else if (activeView === 'side') {
            x = cx + data.posZ * pxPerMeter;
            y = cy - data.posY * pxPerMeter;
        } else if (activeView === 'top') {
            x = cx + data.posX * pxPerMeter;
            y = cy - data.posZ * pxPerMeter;
        }
        
        // 1. Draw helper badge/placeholder on Canvas
        ctx.save();
        ctx.translate(x, y);
        
        // GLB 3D models: toon altijd als placeholder met nummer
        const is3DModel = data.isGlb;
        
        if (activeView !== 'front' || is3DModel) {
            let drawW = layerSize, drawH = layerSize;
            
            // Side and top view: thin lines
            if (activeView === 'side') { 
                drawW = 4;
            } else if (activeView === 'top') {
                drawH = 4;
            } else if (is3DModel) {
                // Front view 3D model placeholder - duidelijke kubus indicatie
                const size = Math.max(40, layerSize * 0.3); // Schaal mee met layer grootte
                
                // Achtergrond vierkant met 3D effect
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.3;
                ctx.fillRect(-size/2, -size/2, size, size);
                ctx.globalAlpha = 1;
                
                // Border
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.strokeRect(-size/2, -size/2, size, size);
                
                // 3D kubus lijnen (isometrisch effect)
                const offset = size * 0.2;
                ctx.beginPath();
                ctx.moveTo(-size/2, -size/2);
                ctx.lineTo(-size/2 + offset, -size/2 - offset);
                ctx.lineTo(size/2 + offset, -size/2 - offset);
                ctx.lineTo(size/2, -size/2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(size/2 + offset, -size/2 - offset);
                ctx.lineTo(size/2 + offset, size/2 - offset);
                ctx.lineTo(size/2, size/2);
                ctx.stroke();
                
                // "3D" label
                ctx.fillStyle = color;
                ctx.font = 'bold 11px Roboto Mono';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('3D', 0, -4);
                
                // Laagnummer
                ctx.font = 'bold 9px Roboto Mono';
                ctx.fillText(`L${layerNum}`, 0, 8);
            }
            
            if (!is3DModel) {
                // Side/Top view lines
                ctx.fillStyle = color;
                ctx.fillRect(-drawW/2, -drawH/2, drawW, drawH);
                
                // Badge
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(-drawW/2 + 8, -drawH/2 + 8, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 7px Roboto Mono';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(layerNum, -drawW/2 + 8, -drawH/2 + 8);
            }
        }
        ctx.restore();
        
        // 2. Draw Images / GIFs / Video placeholders via DOM Overlays (only in FRONT view)
        if (activeView === 'front' && !is3DModel && overlayContainer) {
            let domW, domH;
            
            if ((data.imageLoaded && data.imageEl) || (data.isVideo && data.filename) || data.isApiRandom || data.hasText) {
                
                // AR gebruikt dezelfde logica voor alle media:
                // Base size = 1.4 * scale (= posterH in preview termen, want poster is ~1.4m hoog)
                // Dus: hoogte = posterH * scale, breedte volgt uit aspect ratio
                const baseHeight = posterH * data.scale;
                
                if (data.imageEl) {
                    const img = data.imageEl;
                    const aspectRatio = img.width / img.height;
                    // Hoogte = poster hoogte * scale, breedte volgt uit aspect ratio
                    domH = baseHeight;
                    domW = baseHeight * aspectRatio;
                    
                    // Cap max breedte (zoals in AR: max 2.0 * scale relatief)
                    const maxWidth = posterW * data.scale * 1.4; // ~140% van poster breedte max
                    if (domW > maxWidth) {
                        domW = maxWidth;
                        domH = maxWidth / aspectRatio;
                    }
                } else if (data.isVideo) {
                    // Video default 16:9
                    domH = baseHeight;
                    domW = baseHeight * (16/9);
                } else if (data.isApiRandom) {
                    // API random GIF: vierkante placeholder (1:1 aspect ratio)
                    domH = baseHeight;
                    domW = baseHeight;
                } else if (data.hasText) {
                    // Tekstlaag: brede banner boven poster
                    domH = Math.max(42, baseHeight * 0.24);
                    domW = Math.min(w * 0.86, baseHeight * 1.8);
                    y = y - (data.textOffsetY * pxPerMeter);
                }
                
                // Create Overlay Element
                const el = document.createElement('div');
                el.style.position = 'absolute';
                el.style.left = `${x - domW/2}px`;
                el.style.top = `${y - domH/2}px`;
                el.style.width = `${domW}px`;
                el.style.height = `${domH}px`;
                el.style.zIndex = layerNum;
                el.style.border = `2px solid ${color}`;
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.cursor = 'move';
                el.title = `Layer ${layerNum} — sleep om te herpositioneren`;
                
                // Drag-to-reposition: sleep de layer om pos_x/pos_y aan te passen
                el.addEventListener('pointerdown', (startEvt) => {
                    startEvt.preventDefault();
                    el.setPointerCapture(startEvt.pointerId);
                    const startMouseX = startEvt.clientX;
                    const startMouseY = startEvt.clientY;
                    const startPosX = data.posX;
                    const startPosY = data.posY;
                    el.style.opacity = '0.7';
                    
                    const onMove = (moveEvt) => {
                        const dx = (moveEvt.clientX - startMouseX) / pxPerMeter;
                        const dy = -(moveEvt.clientY - startMouseY) / pxPerMeter;
                        const newX = Math.round((startPosX + dx) * 1000) / 1000;
                        const newY = Math.round((startPosY + dy) * 1000) / 1000;
                        
                        // Update de input velden
                        const isEditMode = document.getElementById('edit-modal')?.style.display === 'block';
                        const pfx = isEditMode ? 'edit-' : '';
                        const posXInput = document.getElementById(`${pfx}layer-${layerNum}-pos-x`);
                        const posYInput = document.getElementById(`${pfx}layer-${layerNum}-pos-y`);
                        if (posXInput) posXInput.value = newX.toFixed(3);
                        if (posYInput) posYInput.value = newY.toFixed(3);
                        
                        // Update de data meteen voor vloeiende preview
                        data.posX = newX;
                        data.posY = newY;
                        el.style.left = `${x - domW/2 + (newX - startPosX) * pxPerMeter}px`;
                        el.style.top = `${y - domH/2 - (newY - startPosY) * pxPerMeter}px`;
                    };
                    
                    const onUp = () => {
                        el.style.opacity = '1';
                        el.removeEventListener('pointermove', onMove);
                        el.removeEventListener('pointerup', onUp);
                        // Herrender volledig na loslaten
                        updatePreviewFromInputs();
                    };
                    
                    el.addEventListener('pointermove', onMove);
                    el.addEventListener('pointerup', onUp);
                });
                
                // Basis transform (rotatie)
                const baseTransform = `rotateX(${data.rotX}deg) rotateY(${data.rotY}deg) rotateZ(${data.rotZ}deg)`;
                el.style.transform = baseTransform;
                
                // Transform origin berekenen op basis van animRotOrigin
                const originMap = {
                    'center': 'center center',
                    'top': 'center top',
                    'bottom': 'center bottom',
                    'left': 'left center',
                    'right': 'right center',
                    'top-left': 'left top',
                    'top-right': 'right top',
                    'bottom-left': 'left bottom',
                    'bottom-right': 'right bottom'
                };
                el.style.transformOrigin = originMap[data.animRotOrigin] || 'center center';
                
                // Animatie parameters ophalen
                const animX = data.animX || 0;
                const animY = data.animY || 0;
                const animPosDur = data.animPosDuration || 0;
                const animRotX = data.animRotX || 0;
                const animRotY = data.animRotY || 0;
                const animRotZ = data.animRotZ || 0;
                const animRotDur = data.animRotDuration || 0;
                const animScaleVal = data.animScale || 1;
                const animOpacityVal = data.animOpacity || 1;
                const animScaleDur = data.animScaleDuration || 0;
                
                const hasPositionAnim = (animX !== 0 || animY !== 0) && animPosDur > 0;
                const hasRotationAnim = (animRotX !== 0 || animRotY !== 0 || animRotZ !== 0) && animRotDur > 0;
                const hasScaleAnim = (animScaleVal !== 1 || animOpacityVal !== 1) && animScaleDur > 0;
                
                // Verzamel alle animaties
                const animations = [];
                
                // Maak of update style element
                let styleEl = document.getElementById('preview-animations');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'preview-animations';
                    document.head.appendChild(styleEl);
                }
                
                // Positie animatie
                if (hasPositionAnim) {
                    const animId = `anim-pos-${layerNum}-${Math.random().toString(36).substr(2, 5)}`;
                    const animXPx = animX * pxPerMeter;
                    const animYPx = -animY * pxPerMeter;
                    
                    const keyframeCSS = `
                        @keyframes ${animId} {
                            0% { translate: 0px 0px; }
                            100% { translate: ${animXPx}px ${animYPx}px; }
                        }
                    `;
                    styleEl.textContent += keyframeCSS;
                    animations.push(`${animId} ${animPosDur}ms ease-in-out infinite alternate`);
                }
                
                // Rotatie animatie
                if (hasRotationAnim) {
                    const animId = `anim-rot-${layerNum}-${Math.random().toString(36).substr(2, 5)}`;
                    const endRotX = data.rotX + animRotX;
                    const endRotY = data.rotY + animRotY;
                    const endRotZ = data.rotZ + animRotZ;
                    
                    const keyframeCSS = `
                        @keyframes ${animId} {
                            0% { rotate: ${data.rotZ}deg; }
                            100% { rotate: ${endRotZ}deg; }
                        }
                    `;
                    styleEl.textContent += keyframeCSS;
                    animations.push(`${animId} ${animRotDur}ms ease-in-out infinite alternate`);
                }
                
                // Scale/Opacity animatie
                if (hasScaleAnim) {
                    const animId = `anim-scale-${layerNum}-${Math.random().toString(36).substr(2, 5)}`;
                    
                    const keyframeCSS = `
                        @keyframes ${animId} {
                            0% { scale: 1; opacity: 1; }
                            100% { scale: ${animScaleVal}; opacity: ${animOpacityVal}; }
                        }
                    `;
                    styleEl.textContent += keyframeCSS;
                    animations.push(`${animId} ${animScaleDur}ms ease-in-out infinite alternate`);
                }
                
                // Pas alle animaties toe
                if (animations.length > 0) {
                    el.style.animation = animations.join(', ');
                    console.log(`[Preview] Animaties toegepast op layer ${layerNum}: ${animations.length} animatie(s)`);
                }
                
                // Add Content
                if (data.hasText) {
                    const baseStyle = {
                        font: data.textFont,
                        color: data.textColor,
                        outlineColor: data.textOutlineColor,
                        outlineWidth: data.textOutlineWidth,
                        fontSize: data.textSize,
                        effect: data.textEffect,
                        effect3d: data.text3d,
                        align: data.textAlign,
                    };
                    const style = data.textRandom
                        ? generateRandomTextStylePreset(data.textSeed)
                        : applyRandomStyleBySpec(baseStyle, data.textSeed, data.textRandomSpec || {});

                    el.style.background = 'rgba(0,0,0,0.15)';
                    el.style.backdropFilter = 'blur(1px)';
                    el.style.borderColor = style.color;
                    el.style.padding = '6px 10px';

                    const textNode = document.createElement('div');
                    textNode.textContent = data.textContent;
                    textNode.style.width = '100%';
                    textNode.style.whiteSpace = 'pre-wrap';
                    textNode.style.lineHeight = '1.05';
                    textNode.style.textAlign = style.align;
                    textNode.style.fontFamily = style.font;
                    textNode.style.fontSize = `${Math.max(12, Math.min(40, style.fontSize / 4.2))}px`;
                    textNode.style.fontWeight = '700';
                    textNode.style.color = style.color;
                    const strokePx = Math.max(0, style.outlineWidth / 3);
                    textNode.style.webkitTextStroke = `${strokePx}px ${style.outlineColor}`;
                    // Fallback rand voor browsers zonder text-stroke ondersteuning
                    const outlineShadow = strokePx > 0
                        ? `${strokePx}px 0 ${style.outlineColor}, -${strokePx}px 0 ${style.outlineColor}, 0 ${strokePx}px ${style.outlineColor}, 0 -${strokePx}px ${style.outlineColor}`
                        : '';
                    const effectShadow = style.effect === 'glow'
                        ? `0 0 8px ${style.color}, 0 0 14px ${style.color}`
                        : style.effect === 'shadow'
                            ? '2px 2px 0 rgba(0,0,0,0.7)'
                            : style.effect === 'neon'
                                ? `0 0 5px ${style.color}, 0 0 11px ${style.color}, 0 0 18px ${style.color}`
                                : '';
                    textNode.style.textShadow = [outlineShadow, effectShadow].filter(Boolean).join(', ') || 'none';

                    if (style.effect3d === 'tilt') {
                        const tiltX = parseFloat(data.text3dTiltX) || 0;
                        const tiltY = parseFloat(data.text3dTiltY) || 0;
                        textNode.style.transform = `perspective(320px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
                    } else if (style.effect3d === 'float') {
                        const floatPx = Math.max(0, parseFloat(data.text3dFloatPx) || 4);
                        textNode.style.transform = `translateY(-${floatPx}px)`;
                    } else if (style.effect3d === 'extrude') {
                        const depth = Math.max(1, Math.round(parseFloat(data.text3dDepth) || 3));
                        const depthShadows = Array.from({ length: depth }, (_, idx) => {
                            const step = idx + 1;
                            return `-${step}px ${step}px 0 ${style.outlineColor}`;
                        }).join(', ');
                        textNode.style.textShadow = `${textNode.style.textShadow !== 'none' ? textNode.style.textShadow + ', ' : ''}${depthShadows}`;
                    }

                    el.appendChild(textNode);
                } else if (data.imageEl) {
                    // Image or GIF
                    const img = document.createElement('img');
                    img.src = data.imageEl.src;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    el.appendChild(img);
                } else if (data.isVideo) {
                    // Video Placeholder
                    el.style.backgroundColor = `${color}33`; // 20% opacity hex
                    const playIcon = document.createElement('div');
                    playIcon.style.width = '0';
                    playIcon.style.height = '0';
                    playIcon.style.borderLeft = '10px solid ' + color;
                    playIcon.style.borderTop = '6px solid transparent';
                    playIcon.style.borderBottom = '6px solid transparent';
                    el.appendChild(playIcon);
                } else if (data.isApiRandom) {
                    // API Random GIF placeholder
                    el.style.backgroundColor = '#1a237e33';
                    el.style.flexDirection = 'column';
                    el.style.gap = '4px';
                    el.style.padding = '6px';
                    el.style.textAlign = 'center';
                    const apiLabel = document.createElement('div');
                    apiLabel.style.color = '#90caf9';
                    apiLabel.style.fontSize = '9px';
                    apiLabel.style.fontFamily = 'Roboto Mono, monospace';
                    apiLabel.style.fontWeight = 'bold';
                    apiLabel.textContent = 'API RANDOM GIF';
                    const queryLabel = document.createElement('div');
                    queryLabel.style.color = '#bbdefb';
                    queryLabel.style.fontSize = '8px';
                    queryLabel.style.fontFamily = 'Roboto Mono, monospace';
                    queryLabel.style.maxWidth = '100%';
                    queryLabel.style.overflow = 'hidden';
                    queryLabel.style.textOverflow = 'ellipsis';
                    queryLabel.style.whiteSpace = 'nowrap';
                    queryLabel.textContent = `"${data.apiRandomQuery}"`;
                    el.appendChild(apiLabel);
                    el.appendChild(queryLabel);
                    el.style.borderColor = '#90caf9';
                }
                
                // Badge
                const badge = document.createElement('div');
                badge.textContent = layerNum;
                badge.style.position = 'absolute';
                badge.style.top = '4px';
                badge.style.left = '4px';
                badge.style.width = '16px';
                badge.style.height = '16px';
                badge.style.borderRadius = '50%';
                badge.style.backgroundColor = color;
                badge.style.color = '#000';
                badge.style.fontSize = '9px';
                badge.style.fontWeight = 'bold';
                badge.style.display = 'flex';
                badge.style.alignItems = 'center';
                badge.style.justifyContent = 'center';
                el.appendChild(badge);
                
                overlayContainer.appendChild(el);
            }
        }
    });

    // Draw axis indicator (on canvas)
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px Roboto Mono';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    
    const axisLabels = {
        front: ['X →', 'Y ↑'],
        side: ['Z →', 'Y ↑'],
        top: ['X →', 'Z ↑']
    };
    
    ctx.fillText(axisLabels[activeView][0], 8, h - 8);
    ctx.fillText(axisLabels[activeView][1], 8, h - 20);
}

// ========== Credits Sectie - Dynamische rijen ==========

function createCreditRow(item = '', owner = '') {
    const row = document.createElement('div');
    row.className = 'credit-row';
    row.innerHTML = `
        <input type="text" class="credit-item" placeholder="Item (bv. Foto)" value="${item}">
        <input type="text" class="credit-owner" placeholder="Eigenaar" value="${owner}">
        <button type="button" class="btn-remove-credit" title="Verwijder">&times;</button>
    `;
    
    // Verwijder knop event
    row.querySelector('.btn-remove-credit').addEventListener('click', () => {
        row.remove();
    });
    
    return row;
}

function setupCreditsSection() {
    // Upload form
    const addBtn = document.getElementById('add-credit-btn');
    const container = document.getElementById('credits-container');
    
    if (addBtn && container) {
        // Setup remove knop voor de eerste rij
        const firstRemoveBtn = container.querySelector('.btn-remove-credit');
        if (firstRemoveBtn) {
            firstRemoveBtn.addEventListener('click', function() {
                // Als er maar 1 rij is, leeg de velden i.p.v. verwijderen
                const rows = container.querySelectorAll('.credit-row');
                if (rows.length <= 1) {
                    this.closest('.credit-row').querySelectorAll('input').forEach(inp => inp.value = '');
                } else {
                    this.closest('.credit-row').remove();
                }
            });
        }
        
        addBtn.addEventListener('click', () => {
            container.appendChild(createCreditRow());
        });
    }
    
    // Edit form
    const editAddBtn = document.getElementById('edit-add-credit-btn');
    if (editAddBtn) {
        editAddBtn.addEventListener('click', () => {
            const editContainer = document.getElementById('edit-credits-container');
            if (editContainer) {
                editContainer.appendChild(createCreditRow());
            }
        });
    }
}

// Verzamel alle credits uit een container als JSON array
function collectCredits(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const credits = [];
    container.querySelectorAll('.credit-row').forEach(row => {
        const item = row.querySelector('.credit-item').value.trim();
        const owner = row.querySelector('.credit-owner').value.trim();
        if (item || owner) {
            credits.push({ item: item, owner: owner });
        }
    });
    
    return credits;
}

// Vul credits container met bestaande data
function populateCredits(containerId, creditsData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = ''; // Leeg de container
    
    let credits = [];
    
    // Parse credits als het een string is (JSON)
    if (typeof creditsData === 'string' && creditsData) {
        try {
            credits = JSON.parse(creditsData);
        } catch (e) {
            console.warn('Credits JSON parse error:', e);
            // Fallback: oude photographer_credit formaat
            credits = [{ item: 'Foto', owner: creditsData }];
        }
    } else if (Array.isArray(creditsData)) {
        credits = creditsData;
    }
    
    if (credits.length === 0) {
        // Voeg lege rij toe
        container.appendChild(createCreditRow());
    } else {
        credits.forEach(c => {
            container.appendChild(createCreditRow(c.item || '', c.owner || ''));
        });
    }
}

function setupFileSummaryListeners() {
    const inputs = [
        { id: 'poster-jpeg', summaryId: 'summary-jpeg' },
        { id: 'ar-marker-file', summaryId: 'summary-mind' },
        { id: 'poster-pdf-medium', summaryId: 'summary-pdf-a3' },
        { id: 'poster-pdf-large', summaryId: 'summary-pdf-a0' }
    ];

    inputs.forEach(input => {
        const el = document.getElementById(input.id);
        if (el) {
            el.addEventListener('change', function() {
                const summaryEl = document.getElementById(input.summaryId);
                if (this.files && this.files[0]) {
                    summaryEl.classList.add('completed');
                    summaryEl.classList.remove('pending');
                    // Format size
                    const size = (this.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                    summaryEl.querySelector('span').textContent = `[OK] ${size}`;
                } else {
                    summaryEl.classList.remove('completed');
                    summaryEl.classList.add('pending');
                    // Reset tekst: originele tekst behouden
                    const isOptional = input.id.includes('glb') || input.id.includes('audio');
                    summaryEl.querySelector('span').textContent = isOptional ? 'optioneel' : '...';
                }
            });
        }
    });
}

function setupLayerSummaryListeners() {
    const layersContainer = document.getElementById('summary-layers-container');
    const updateLayersSummary = () => {
        const activeLayers = [];
        
        // Check all 8 possible layers
        for (let i = 1; i <= 8; i++) {
            const input = document.getElementById(`layer-${i}-image`);
            if (input && input.files && input.files[0]) {
                const size = (input.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                activeLayers.push({
                    name: `Laag ${i}`,
                    size: size,
                    filename: input.files[0].name
                });
            }
        }
        
        if (activeLayers.length === 0) {
            layersContainer.innerHTML = '<div class="summary-item pending" style="font-style: italic; opacity: 0.5;">Geen lagen geselecteerd</div>';
        } else {
            layersContainer.innerHTML = activeLayers.map(l => `
                <div class="summary-item completed">
                    ${l.name}
                    <span>[OK] ${l.size}</span>
                </div>
            `).join('');
        }

        refreshAdminUXState();
    };

    // Attach listeners to layer inputs
    for (let i = 1; i <= 8; i++) {
        const input = document.getElementById(`layer-${i}-image`);
        if (input) {
            input.addEventListener('change', updateLayersSummary);
        }
    }
}

// Track changes in edit modal
function setupEditChangesSummary() {
    const summaryContainer = document.getElementById('edit-changes-summary');
    if (!summaryContainer) return;

    const updateSummary = () => {
        const changes = [];
        
        // Check file changes
        const fileChecks = [
            { id: 'edit-jpeg', label: 'Nieuwe JPEG' },
            { id: 'edit-ar-marker-file', label: 'Nieuwe AR Marker' },
            { id: 'edit-pdf-medium', label: 'Nieuwe PDF (A3)' },
            { id: 'edit-pdf-large', label: 'Nieuwe PDF (A0)' },
            { id: 'edit-glb-model', label: 'Nieuw 3D Model' },
            { id: 'edit-audio', label: 'Nieuw Audio bestand' }
        ];
        
        fileChecks.forEach(check => {
            const input = document.getElementById(check.id);
            if (input && input.files && input.files[0]) {
                const size = (input.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                changes.push({ label: check.label, value: `[OK] ${size}` });
            }
        });
        
        // Check verwijderingen
        const deleteGlb = document.getElementById('edit-delete-glb');
        const deleteAudio = document.getElementById('edit-delete-audio');
        if (deleteGlb && deleteGlb.value === '1') {
            changes.push({ label: '3D Model', value: '[VERWIJDEREN]', isDelete: true });
        }
        if (deleteAudio && deleteAudio.value === '1') {
            changes.push({ label: 'Audio bestand', value: '[VERWIJDEREN]', isDelete: true });
        }
        
        // Check layer changes
        for (let i = 1; i <= 8; i++) {
            const input = document.getElementById(`edit-layer-${i}-image`);
            if (input && input.files && input.files[0]) {
                const size = (input.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                changes.push({ label: `Laag ${i}`, value: `[OK] ${size}` });
            }
        }
        
        // Render summary
        if (changes.length === 0) {
            summaryContainer.innerHTML = '<div class="summary-item pending" style="font-style: italic; opacity: 0.5;">Geen wijzigingen</div>';
        } else {
            summaryContainer.innerHTML = changes.map(c => `
                <div class="summary-item ${c.isDelete ? 'delete' : 'completed'}">
                    ${c.label}
                    <span>${c.value}</span>
                </div>
            `).join('');
        }

        refreshEditModalUXState();
    };

    // Attach listeners to all edit inputs
    const allInputs = ['edit-jpeg', 'edit-ar-marker-file', 'edit-pdf-medium', 'edit-pdf-large', 'edit-glb-model', 'edit-audio'];
    allInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('change', updateSummary);
    });
    
    // Layer inputs
    for (let i = 1; i <= 8; i++) {
        const input = document.getElementById(`edit-layer-${i}-image`);
        if (input) input.addEventListener('change', updateSummary);
    }
    
    // Initial state
    updateSummary();
}

// ========== Upload Type Selector ==========
// Schakelt tussen "poster" (volledig) en "reclame" (snel) upload modus
let currentUploadType = 'poster';

function setupUploadTypeSelector() {
    const dropdown = document.getElementById('upload-type');
    const hint = document.getElementById('upload-type-hint');
    const arMarkerInput = document.getElementById('ar-marker-file');
    
    if (!dropdown) return;
    
    dropdown.addEventListener('change', () => {
        currentUploadType = dropdown.value;
        
        if (currentUploadType === 'reclame') {
            document.body.classList.add('upload-mode-reclame');
            document.body.classList.remove('upload-mode-poster');
            hint.textContent = 'Snelle upload: foto van reclame, .mind wordt automatisch gegenereerd';
            // AR marker niet meer verplicht
            if (arMarkerInput) arMarkerInput.removeAttribute('required');
        } else {
            document.body.classList.remove('upload-mode-reclame');
            document.body.classList.add('upload-mode-poster');
            hint.textContent = 'Volledige poster met GPS, PDFs, AR layers en metadata';
            // AR marker weer verplicht in poster modus (tenzij je die zelf genereert)
            // Niet required zetten - in poster modus is het optioneel maar aanbevolen
        }
    });
    
    // Default state
    document.body.classList.add('upload-mode-poster');
}

// ========== API Bron Selectors voor AR Layers ==========
// Voegt per layer een bron-dropdown toe: Handmatig | Klipy GIF | Meme (Imgflip) | Random

// Bijhouden welke API content per layer is geselecteerd
const apiLayerData = {};

function setupLayerApiSources() {
    for (let i = 1; i <= LAYER_CONFIG.maxLayers; i++) {
        injectApiSourceUI(i, '');        // Upload formulier
        injectApiSourceUI(i, 'edit-');   // Edit formulier
    }
}

function injectApiSourceUI(layerNum, prefix) {
    const fileSlot = document.querySelector(`#${prefix}layer-${layerNum}-image`)?.closest('.file-slot');
    if (!fileSlot) return;
    
    // Maak source selector
    const sourceDiv = document.createElement('div');
    sourceDiv.className = 'layer-source-selector';
    sourceDiv.innerHTML = `
        <label>BRON:</label>
        <select class="layer-source-select" id="${prefix}layer-${layerNum}-source" data-layer="${layerNum}" data-prefix="${prefix}">
            <option value="manual">BESTAND</option>
            <option value="klipy">KLIPY GIF</option>
            <option value="meme">MEMES (Reddit)</option>
            <option value="imgflip">DANK MEMES (Reddit)</option>
            <option value="sketchfab">3D MODEL (Sketchfab)</option>
        </select>
    `;
    
    // Maak API zoek panel
    const searchPanel = document.createElement('div');
    searchPanel.className = 'api-search-panel hidden';
    searchPanel.id = `${prefix}layer-${layerNum}-api-panel`;
    searchPanel.innerHTML = `
        <div class="api-search-row">
            <input type="text" class="api-search-input" id="${prefix}layer-${layerNum}-api-query" placeholder="Zoekterm..." data-layer="${layerNum}">
            <button type="button" class="api-search-btn" id="${prefix}layer-${layerNum}-api-search-btn" data-layer="${layerNum}" data-prefix="${prefix}">ZOEK</button>
            <label class="api-random-label" title="Kies automatisch een willekeurig resultaat uit de top 20">
                <input type="checkbox" id="${prefix}layer-${layerNum}-api-random"> RANDOM
            </label>
        </div>
        <div class="api-results-grid" id="${prefix}layer-${layerNum}-api-results"></div>
        <div class="api-selected-preview hidden" id="${prefix}layer-${layerNum}-api-selected"></div>
    `;
    
    // Voeg toe voor de file input
    fileSlot.insertBefore(sourceDiv, fileSlot.firstChild);
    fileSlot.insertBefore(searchPanel, sourceDiv.nextSibling);
    
    // Event: bron wijzigen
    const sourceSelect = sourceDiv.querySelector('.layer-source-select');
    sourceSelect.addEventListener('change', () => {
        const source = sourceSelect.value;
        const fileInput = document.getElementById(`${prefix}layer-${layerNum}-image`);
        const panel = document.getElementById(`${prefix}layer-${layerNum}-api-panel`);
        const queryInput = document.getElementById(`${prefix}layer-${layerNum}-api-query`);
        
        if (source === 'manual') {
            panel.classList.add('hidden');
            if (fileInput) fileInput.style.display = '';
        } else {
            panel.classList.remove('hidden');
            if (fileInput) fileInput.style.display = 'none';
            // Update placeholder per bron
            if (queryInput) {
                queryInput.placeholder = source === 'klipy'      ? 'bv. funny cat, dance, surprise...' :
                                         source === 'meme'        ? 'bv. drake, distracted boyfriend, doge...' :
                                         source === 'imgflip'     ? 'bv. stonks, gigachad, surprised pikachu...' :
                                         source === 'sketchfab'   ? 'bv. cat, robot, tree, car (low-poly)...' :
                                         'Zoekterm...';
            }
        }
    });
    
    // Event: zoek knop
    const searchBtn = document.getElementById(`${prefix}layer-${layerNum}-api-search-btn`);
    searchBtn.addEventListener('click', () => {
        const source = sourceSelect.value;
        const query = document.getElementById(`${prefix}layer-${layerNum}-api-query`).value.trim();
        if (!query) return;
        
        // Check of RANDOM mode actief is
        const randomCheckbox = document.getElementById(`${prefix}layer-${layerNum}-api-random`);
        const isRandom = randomCheckbox && randomCheckbox.checked;
        
        if (isRandom) {
            // RANDOM mode: sla enkel de zoekterm op, geen specifiek resultaat ophalen.
            // De AR frontend kiest bij elke scan zelf een random GIF (30s cooldown).
            const key = `${prefix}layer-${layerNum}`;
            apiLayerData[key] = { api_mode: 'random', source, query };
            
            // Toon bevestiging in de results container
            const resultsContainer = document.getElementById(`${prefix}layer-${layerNum}-api-results`);
            resultsContainer.innerHTML = `<div class="api-loading">RANDOM QUERY OPGESLAGEN: "${escapeHtml(query)}"<br><small style="opacity:0.6">Elke scan krijgt een willekeurig resultaat (30s cooldown)</small></div>`;
            
            // Update layer status
            const statusEl = document.getElementById(`${prefix}layer-${layerNum}-status`);
            if (statusEl) {
                statusEl.textContent = 'RANDOM';
                statusEl.style.color = '#0f0';
            }
            return;
        }
        
        searchApiContent(layerNum, prefix, source, query);
    });
    
    // Enter key zoeken
    const queryInput = document.getElementById(`${prefix}layer-${layerNum}-api-query`);
    queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBtn.click();
        }
    });
}

// API zoek functie - stuurt naar juiste API
async function searchApiContent(layerNum, prefix, source, query) {
    const resultsContainer = document.getElementById(`${prefix}layer-${layerNum}-api-results`);
    const searchBtn = document.getElementById(`${prefix}layer-${layerNum}-api-search-btn`);
    
    resultsContainer.innerHTML = '<div class="api-loading">ZOEKEN...</div>';
    searchBtn.disabled = true;
    
    // Controleer of RANDOM mode actief is
    const randomCheckbox = document.getElementById(`${prefix}layer-${layerNum}-api-random`);
    const isRandom = randomCheckbox && randomCheckbox.checked;
    
    try {
        let results = [];
        let is3D = (source === 'sketchfab');
        
        if (source === 'klipy') {
            results = await searchKlipyApi(query);
        } else if (source === 'meme') {
            results = await searchMemeApi(query);
        } else if (source === 'imgflip') {
            results = await searchImgflipApi(query);
        } else if (source === 'sketchfab') {
            results = await searchSketchfab3DApi(query);
        }
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="api-error">Geen resultaten gevonden</div>';
            return;
        }
        
        // 3D modellen hebben een eigen grid renderer
        if (is3D && !isRandom) {
            render3DResults(layerNum, prefix, results);
            return;
        }
        
        if (isRandom && is3D) {
            // RANDOM 3D: sla de zoekterm op, model wordt bij elke scan geladen
            const key = `${prefix}layer-${layerNum}`;
            apiLayerData[key] = { api_mode: 'random', source: 'sketchfab', query };
            resultsContainer.innerHTML = `<div class="api-loading">RANDOM 3D OPGESLAGEN: "${escapeHtml(query)}"<br><small style="opacity:0.6">Elk scan laadt een willekeurig low-poly Sketchfab model (30s cooldown)</small></div>`;
            const statusEl = document.getElementById(`${prefix}layer-${layerNum}-status`);
            if (statusEl) { statusEl.textContent = '3D RANDOM'; statusEl.style.color = '#0f0'; }
            return;
        }
        
        if (isRandom) {
            // Kies random uit top 20 resultaten en selecteer automatisch
            const top20 = results.slice(0, 20);
            const randomItem = top20[Math.floor(Math.random() * top20.length)];
            
            // Toon kort bevestiging in results container
            resultsContainer.innerHTML = '<div class="api-loading">RANDOM GESELECTEERD...</div>';
            
            // Maak een tijdelijk element om selectApiResult mee te kunnen aanroepen
            const tempEl = document.createElement('div');
            tempEl.className = 'api-result-item selected';
            resultsContainer.innerHTML = '';
            resultsContainer.appendChild(tempEl);
            selectApiResult(layerNum, prefix, randomItem, tempEl);
            return;
        }
        
        // Handmatige modus: toon alle resultaten als grid
        resultsContainer.innerHTML = '';
        results.forEach(item => {
            const el = document.createElement('div');
            el.className = 'api-result-item';
            el.innerHTML = `
                <img src="${escapeHtml(item.preview_url || item.url)}" alt="${escapeHtml(item.title || '')}" loading="lazy">
                <span class="result-label">${escapeHtml(item.title || item.id || '')}</span>
            `;
            el.addEventListener('click', () => selectApiResult(layerNum, prefix, item, el));
            resultsContainer.appendChild(el);
        });
    } catch (err) {
        resultsContainer.innerHTML = `<div class="api-error">Fout: ${escapeHtml(err.message)}</div>`;
    } finally {
        searchBtn.disabled = false;
    }
}

// Selecteer een API resultaat als layer content
function selectApiResult(layerNum, prefix, item, element) {
    // Markeer geselecteerde
    const grid = element.closest('.api-results-grid');
    grid.querySelectorAll('.api-result-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    
    // Sla data op
    const key = `${prefix}layer-${layerNum}`;
    apiLayerData[key] = {
        type: 'api',
        source: document.getElementById(`${prefix}layer-${layerNum}-source`).value,
        url: item.url,
        preview_url: item.preview_url || item.url,
        title: item.title || '',
        id: item.id || '',
        width: item.width || 0,
        height: item.height || 0
    };
    
    // Toon geselecteerde preview
    const selectedDiv = document.getElementById(`${prefix}layer-${layerNum}-api-selected`);
    selectedDiv.classList.remove('hidden');
    selectedDiv.innerHTML = `
        <img src="${escapeHtml(item.preview_url || item.url)}" alt="">
        <div class="preview-info">
            <strong>${escapeHtml(item.title || 'Geselecteerd')}</strong><br>
            ${item.width ? item.width + '×' + item.height : ''}
        </div>
        <button type="button" class="preview-clear" onclick="clearApiSelection(${layerNum}, '${prefix}')">×</button>
    `;
    
    // Update layer status
    const statusEl = document.getElementById(`${prefix}layer-${layerNum}-status`);
    if (statusEl) {
        const sourceLabel = document.getElementById(`${prefix}layer-${layerNum}-source`).value.toUpperCase();
        statusEl.textContent = sourceLabel;
        statusEl.style.color = '#0f0';
    }
}

function clearApiSelection(layerNum, prefix) {
    const key = `${prefix}layer-${layerNum}`;
    delete apiLayerData[key];
    
    const selectedDiv = document.getElementById(`${prefix}layer-${layerNum}-api-selected`);
    if (selectedDiv) {
        selectedDiv.classList.add('hidden');
        selectedDiv.innerHTML = '';
    }
    
    // Reset status
    const statusEl = document.getElementById(`${prefix}layer-${layerNum}-status`);
    if (statusEl) {
        statusEl.textContent = 'LEEG';
        statusEl.style.color = '';
    }
    
    // Deselecteer in grid
    const grid = document.getElementById(`${prefix}layer-${layerNum}-api-results`);
    if (grid) grid.querySelectorAll('.api-result-item').forEach(el => el.classList.remove('selected'));
}
window.clearApiSelection = clearApiSelection;

// ========== API Zoek Functies ==========

// Klipy GIF API (via server proxy - meerdere resultaten)
async function searchKlipyApi(query) {
    const token = sessionStorage.getItem('adminToken');
    const response = await fetch(`${API_URL}/api-search/gifs?q=${encodeURIComponent(query)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!response.ok) throw new Error('Klipy zoeken mislukt');
    const data = await response.json();
    
    if (data.success && data.gifs && data.gifs.length > 0) {
        return data.gifs.map(gif => ({
            id: gif.id,
            title: gif.title || gif.slug || query,
            url: gif.url,
            preview_url: gif.preview_url || gif.url,
            width: gif.width,
            height: gif.height,
            source: 'klipy'
        }));
    }
    return [];
}

// Meme API — Reddit r/memes via server proxy
async function searchMemeApi(query) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api-search/memes?q=${encodeURIComponent(query)}&source=memes`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) throw new Error('Meme API niet bereikbaar');
        const data = await response.json();
        if (!data.success || !data.memes?.length) return [];
        return data.memes.map(m => ({
            id: m.id,
            title: m.title,
            url: m.url,
            preview_url: m.preview_url || m.url,
            width: 0,
            height: 0,
            source: 'meme'
        }));
    } catch (err) {
        console.error('Meme API fout:', err);
        return [];
    }
}

// Dank Memes — Reddit r/dankmemes via server proxy
async function searchImgflipApi(query) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/api-search/memes?q=${encodeURIComponent(query)}&source=dankmemes`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) throw new Error('Meme API niet bereikbaar');
        const data = await response.json();
        if (!data.success || !data.memes?.length) return [];
        return data.memes.map(m => ({
            id: m.id,
            title: m.title,
            url: m.url,
            preview_url: m.preview_url || m.url,
            width: 0,
            height: 0,
            source: 'imgflip'
        }));
    } catch (err) {
        console.error('Dank memes API fout:', err);
        return [];
    }
}

// Sketchfab 3D model API — zoek via server proxy (admin only)
async function searchSketchfab3DApi(query, maxTriangles = 10000) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const url = `${API_URL}/api-search/3d?q=${encodeURIComponent(query)}&max_triangles=${maxTriangles}`;
        const response = await fetch(url, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || 'Sketchfab zoeken mislukt');
        }
        const data = await response.json();
        if (!data.success || !data.models?.length) return [];
        return data.models.map(m => ({
            id:           m.uid,
            title:        m.name,
            url:          m.embed_url,
            preview_url:  m.thumbnail,
            face_count:   m.face_count,
            vertex_count: m.vertex_count,
            license:      m.license,
            author:       m.author,
            glb_size_kb:  Math.round((m.glb_size || 0) / 1024),
            source:       'sketchfab',
            type:         '3d',
        }));
    } catch (err) {
        console.error('Sketchfab 3D API fout:', err);
        throw err;
    }
}

// Render 3D modelresultaten als speciaal grid met triangle count badge
function render3DResults(layerNum, prefix, items) {
    const resultsContainer = document.getElementById(`${prefix}layer-${layerNum}-api-results`);
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';
    resultsContainer.classList.add('results-3d');

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'api-result-item api-result-3d';
        const triangleLabel = item.face_count
            ? `<span class="tri-badge">${item.face_count.toLocaleString()} tri</span>`
            : '';
        const sizeLabel = item.glb_size_kb
            ? `<span class="glb-size">${item.glb_size_kb} KB</span>`
            : '';
        el.innerHTML = `
            <div class="model-thumb-wrap">
                <img src="${escapeHtml(item.preview_url)}" alt="${escapeHtml(item.title)}" loading="lazy">
                ${triangleLabel}
                ${sizeLabel}
            </div>
            <span class="result-label" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
            <span class="result-meta">${escapeHtml(item.license || '')} — ${escapeHtml(item.author || '')}</span>
        `;
        el.addEventListener('click', () => select3DModel(layerNum, prefix, item, el));
        resultsContainer.appendChild(el);
    });
}

// Selecteer een 3D model als layer content
function select3DModel(layerNum, prefix, item, element) {
    const grid = element.closest('.api-results-grid');
    if (grid) grid.querySelectorAll('.api-result-item').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    const key = `${prefix}layer-${layerNum}`;
    apiLayerData[key] = {
        type:         '3d',
        api_mode:     '3d_model',
        source:       'sketchfab',
        uid:          item.id,
        title:        item.title,
        thumbnail:    item.preview_url,
        face_count:   item.face_count,
    };

    // Preview tonen
    const selectedDiv = document.getElementById(`${prefix}layer-${layerNum}-api-selected`);
    if (selectedDiv) {
        selectedDiv.classList.remove('hidden');
        selectedDiv.innerHTML = `
            <img src="${escapeHtml(item.preview_url)}" alt="" style="max-height:80px;">
            <div class="preview-info">
                <strong>${escapeHtml(item.title)}</strong><br>
                <small>${item.face_count?.toLocaleString() || '?'} triangles — ${escapeHtml(item.license || '')}</small>
            </div>
            <button type="button" class="preview-clear" onclick="clearApiSelection(${layerNum}, '${prefix}')">×</button>
        `;
    }

    // Status badge
    const statusEl = document.getElementById(`${prefix}layer-${layerNum}-status`);
    if (statusEl) { statusEl.textContent = '3D'; statusEl.style.color = '#0ff'; }
}

// HTML escaping helper
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Setup login form
function setupLoginForm() {
    const form = document.getElementById('login-form');
    const errorMsg = document.getElementById('login-error');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const password = document.getElementById('admin-password').value;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Inloggen...';
        
        try {
            const response = await fetch(`${API_URL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
                credentials: 'include' // Important: include cookies for session
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store secure token (not password!)
                sessionStorage.setItem('adminLoggedIn', 'true');
                sessionStorage.setItem('adminToken', data.token);
                
                // Start session timeout timer
                startSessionTimer();
                
                showUploadSection();
                loadAdminPosters();
                errorMsg.textContent = '';
                errorMsg.style.color = '';
            } else {
                // Show error message
                if (data.locked) {
                    errorMsg.textContent = data.message;
                    errorMsg.style.color = '#e74c3c';
                } else {
                    errorMsg.textContent = data.message || 'Onjuist wachtwoord';
                    errorMsg.style.color = '#e74c3c';
                }
                document.getElementById('admin-password').value = '';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMsg.textContent = 'Kan niet inloggen. Controleer je internetverbinding.';
            errorMsg.style.color = '#e74c3c';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    };
}

// Session timeout management
function startSessionTimer() {
    // Clear existing timer
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
    
    // Set new timer (55 minutes - give 5 min warning before 1 hour timeout)
    sessionTimer = setTimeout(() => {
        alert('Je sessie verloopt bijna. Log opnieuw in om te blijven werken.');
        
        // Auto-logout after 1 hour
        setTimeout(() => {
            logout(true);
        }, 300000); // 5 minutes
    }, SESSION_TIMEOUT - 300000);
}

// Logout function
async function logout(sessionExpired = false) {
    try {
        await fetch(`${API_URL}/admin/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (e) {
        console.error('Logout error:', e);
    }
    
    // Clear session
    sessionStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem('adminToken');
    
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
    
    // Show login screen
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    
    if (sessionExpired) {
        document.getElementById('login-error').textContent = 'Je sessie is verlopen. Log opnieuw in.';
        document.getElementById('login-error').style.color = '#e67e22';
    }
}

// ========== Instellingen Modal ==========

async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.style.display = 'block';

    // Controleer of Sketchfab key al is opgeslagen
    try {
        const token = sessionStorage.getItem('adminToken');
        const resp = await fetch(`${API_URL}/admin/settings`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (resp.ok) {
            const data = await resp.json();
            const statusEl = document.getElementById('sketchfab-key-status');
            if (statusEl) {
                statusEl.textContent = data.sketchfab_key_set
                    ? 'Sleutel is opgeslagen op de server'
                    : 'Geen sleutel opgeslagen';
                statusEl.style.color = data.sketchfab_key_set ? '#0f0' : '#f80';
            }
        }
    } catch (e) { /* stil falen */ }
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}
window.closeSettingsModal = closeSettingsModal;

function toggleKeyVisibility() {
    const input = document.getElementById('sketchfab-api-key');
    const btn = document.getElementById('sketchfab-key-toggle');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (btn) btn.textContent = input.type === 'password' ? 'TOON' : 'VERBERG';
}
window.toggleKeyVisibility = toggleKeyVisibility;

async function saveSettings() {
    const keyInput = document.getElementById('sketchfab-api-key');
    const statusEl = document.getElementById('sketchfab-key-status');
    const saveBtn = document.getElementById('save-settings-btn');
    const key = keyInput ? keyInput.value.trim() : '';

    if (!key) {
        if (statusEl) { statusEl.textContent = 'Voer een sleutel in'; statusEl.style.color = '#f44'; }
        return;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'OPSLAAN...'; }

    try {
        const token = sessionStorage.getItem('adminToken');
        const resp = await fetch(`${API_URL}/admin/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ sketchfab_api_key: key })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            if (statusEl) { statusEl.textContent = 'Sleutel opgeslagen!'; statusEl.style.color = '#0f0'; }
            if (keyInput) keyInput.value = '';
            setTimeout(closeSettingsModal, 1200);
        } else {
            if (statusEl) { statusEl.textContent = data.message || 'Opslaan mislukt'; statusEl.style.color = '#f44'; }
        }
    } catch (e) {
        if (statusEl) { statusEl.textContent = 'Fout: ' + e.message; statusEl.style.color = '#f44'; }
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'OPSLAAN'; }
    }
}

// Setup logout button
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.onclick = () => logout(false);

    // Setup Instellingen knop
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.onclick = openSettingsModal;

    // Setup opslaan knop in modal
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) saveSettingsBtn.onclick = saveSettings;
    
    // Setup AR Rebuild button
    const rebuildBtn = document.getElementById('rebuild-mind-btn');
    if (rebuildBtn) {
        rebuildBtn.onclick = async () => {
            console.log('AR Rebuild button clicked'); // Debug log
            
            // Bypass confirm() - directe actie om blokkades te vermijden
            // We tonen gewoon "Bezig..." en de gebruiker ziet wel wat er gebeurt
            
            rebuildBtn.disabled = true;
            rebuildBtn.innerHTML = 'Bezig... <span class="spinner"></span>';
            console.log('Starting fetch request...');
            
            try {
                const token = sessionStorage.getItem('adminToken');
                const response = await fetch(`${API_URL}/admin/rebuild-mind`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('Response received', response.status);
                const result = await response.json();
                
                // Show console output if available
                if (result.output) {
                    console.group("AR Rebuild Server Output");
                    console.log(`%c=== START LOGS ===`, 'color: #00ff00; font-weight: bold;');
                    result.output.forEach(line => console.log(`%c${line}`, 'color: #aaa; font-family: monospace;'));
                    console.log(`%c=== END LOGS ===`, 'color: #00ff00; font-weight: bold;');
                    console.groupEnd();
                }
                
                // Toon welke posters zonder .mind zijn
                if (result.missingMind && result.missingMind.length > 0) {
                    const names = result.missingMind.map(p => `• ${p.title} (${p.id.substring(0, 8)}...)`).join('\n');
                    console.warn(`[Rebuild] ${result.missingMind.length} poster(s) zonder .mind bestand:\n${names}`);
                    setTimeout(() => alert(
                        `AR Rebuild klaar: ${result.missingMind.length} poster(s) missen nog een AR marker:\n\n${names}\n\nOpen deze posters in Edit, upload de JPEG opnieuw, en sla op.`
                    ), 100);
                } else if (result.success) {
                    console.log('Rebuild compleet. Alle posters hebben een .mind bestand.');
                    setTimeout(() => alert('AR rebuild succesvol!\nAlle posters staan in de chunks.'), 100);
                } else {
                    console.error('Rebuild failed:', result.message);
                    setTimeout(() => alert('Fout: ' + (result.message || 'Onbekende fout')), 100);
                }
            } catch (err) {
                console.error('Fetch error:', err);
                setTimeout(() => alert('Fout bij rebuild: ' + err.message), 100);
            } finally {
                rebuildBtn.disabled = false;
                rebuildBtn.textContent = 'AR Rebuild';
            }
        };
    }
}

// Toon upload sectie
function showUploadSection() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('upload-section').style.display = 'block';
    document.getElementById('logout-btn').style.display = 'inline-block';
    refreshAdminUXState();
}

// Setup upload form
function setupUploadForm() {
    const form = document.getElementById('upload-form');
    const successMsg = document.getElementById('upload-success');
    const errorMsg = document.getElementById('upload-error');
    const uploadBtn = document.getElementById('upload-btn');
    const btnText = uploadBtn.querySelector('.btn-text');
    const btnLoader = uploadBtn.querySelector('.btn-loader');
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        // Clear messages
        successMsg.textContent = '';
        errorMsg.textContent = '';
        
        // Get form data
        const formData = new FormData();
        formData.append('title', document.getElementById('poster-title').value);
        formData.append('description', document.getElementById('poster-description').value);
        
        // Parse and add location data
        const coordinatesInput = document.getElementById('poster-coordinates').value.trim();
        let latitude = '';
        let longitude = '';
        
        if (coordinatesInput) {
            // Parse format: "51.04932179780276, 3.7185706753061156"
            const parts = coordinatesInput.split(',').map(p => p.trim());
            if (parts.length === 2) {
                latitude = parts[0];
                longitude = parts[1];
            } else {
                errorMsg.textContent = 'Ongeldig coördinaten formaat. Gebruik: latitude, longitude';
                return;
            }
        }
        
        const locationDescription = document.getElementById('poster-location').value;
        if (latitude) formData.append('latitude', latitude);
        if (longitude) formData.append('longitude', longitude);
        if (locationDescription) formData.append('location_description', locationDescription);
        
        // Add article link
        const artikelLink = document.getElementById('poster-artikel-link').value;
        if (artikelLink) formData.append('artikel_link', artikelLink);
        
        // AR camera feed instelling (checkbox: 1 = camera tonen, 0 = zwart)
        const arCameraFeed = document.getElementById('poster-ar-camera-feed')?.checked ? '1' : '0';
        formData.append('ar_camera_feed', arCameraFeed);
        
        // Add credits (JSON array)
        const credits = collectCredits('credits-container');
        if (credits.length > 0) {
            formData.append('credits', JSON.stringify(credits));
        }
        
        // Add gallery images
        const galleryInput = document.getElementById('gallery-images');
        if (galleryInput && galleryInput.files.length > 0) {
            for (let i = 0; i < galleryInput.files.length; i++) {
                formData.append('gallery_images[]', galleryInput.files[i]);
            }
        }
        
        // Add AR marker file: handmatig heeft prioriteit, anders browser-gecompileerd, anders niets
        const arMarkerFile = document.getElementById('ar-marker-file').files[0];
        
        // Upload type meesturen
        formData.append('upload_type', currentUploadType);
        
        if (arMarkerFile) {
            // Handmatig geüpload .mind bestand
            formData.append('ar_marker_file', arMarkerFile);
        } else {
            // Wacht op lopende compilatie als die nog bezig is
            if (compilingMindPromise) {
                const mindStatusEl = document.getElementById('mind-compile-status');
                if (mindStatusEl) {
                    mindStatusEl.textContent = 'Upload wacht op AR-marker compilatie...';
                    mindStatusEl.style.color = 'rgba(255,200,0,0.8)';
                }
                btnText.textContent = 'Wachten op compilatie...';
                try {
                    await compilingMindPromise;
                } catch (e) {
                    console.warn('[MIND] Compilatie fout tijdens wachten:', e);
                }
            }
            
            if (compiledMindBuffer) {
                // Browser-gecompileerd .mind bestand (automatisch vanuit JPEG)
                const mindBlob = new Blob([compiledMindBuffer], { type: 'application/octet-stream' });
                formData.append('ar_marker_file', mindBlob, 'auto_compiled.mind');
                console.log('[MIND] Browser-gecompileerd .mind meegezonden met upload');
            } else {
                console.warn('[MIND] Geen .mind bestand beschikbaar - poster wordt opgeslagen zonder AR tracking');
            }
        }
        
        // AR Layers (8 layers with positioning and animation)
        for (let i = 1; i <= 8; i++) {
            const imageInput = document.getElementById(`layer-${i}-image`);
            const zInput = document.getElementById(`layer-${i}-z`);
            const exclusionInput = document.getElementById(`layer-${i}-exclusion`);
            
            // Base position and scale inputs
            const posXInput = document.getElementById(`layer-${i}-pos-x`);
            const posYInput = document.getElementById(`layer-${i}-pos-y`);
            const scaleInput = document.getElementById(`layer-${i}-scale`);
            const rotZInput = document.getElementById(`layer-${i}-rot-z`);
            
            // Animation inputs
            const animXInput = document.getElementById(`layer-${i}-anim-x`);
            const animYInput = document.getElementById(`layer-${i}-anim-y`);
            const animZInput = document.getElementById(`layer-${i}-anim-z`);
            const animPosDurationInput = document.getElementById(`layer-${i}-anim-pos-duration`);
            const animRotXInput = document.getElementById(`layer-${i}-anim-rot-x`);
            const animRotYInput = document.getElementById(`layer-${i}-anim-rot-y`);
            const animRotZInput = document.getElementById(`layer-${i}-anim-rot-z`);
            const animRotDurationInput = document.getElementById(`layer-${i}-anim-rot-duration`);
            const animRotOriginInput = document.getElementById(`layer-${i}-anim-rot-origin`);
            const animScaleInput = document.getElementById(`layer-${i}-anim-scale`);
            const animOpacityInput = document.getElementById(`layer-${i}-anim-opacity`);
            const animScaleDurationInput = document.getElementById(`layer-${i}-anim-scale-duration`);

            // Tekstlaag inputs
            const textEnabledInput = document.getElementById(`layer-${i}-text-enabled`);
            const textRandomInput = document.getElementById(`layer-${i}-text-random`);
            const textContentInput = document.getElementById(`layer-${i}-text-content`);
            const textFontInput = document.getElementById(`layer-${i}-text-font`);
            const textSizeInput = document.getElementById(`layer-${i}-text-size`);
            const textAlignInput = document.getElementById(`layer-${i}-text-align`);
            const textOffsetInput = document.getElementById(`layer-${i}-text-offset-y`);
            const textColorInput = document.getElementById(`layer-${i}-text-color`);
            const textOutlineColorInput = document.getElementById(`layer-${i}-text-outline-color`);
            const textOutlineWidthInput = document.getElementById(`layer-${i}-text-outline-width`);
            const textEffectInput = document.getElementById(`layer-${i}-text-effect`);
            const text3DInput = document.getElementById(`layer-${i}-text-3d`);
            const text3DDepthInput = document.getElementById(`layer-${i}-text-3d-depth`);
            const text3DTiltXInput = document.getElementById(`layer-${i}-text-3d-tilt-x`);
            const text3DTiltYInput = document.getElementById(`layer-${i}-text-3d-tilt-y`);
            const text3DFloatPxInput = document.getElementById(`layer-${i}-text-3d-float-px`);
            const textRandomFontInput = document.getElementById(`layer-${i}-text-random-font`);
            const textRandomColorInput = document.getElementById(`layer-${i}-text-random-color`);
            const textRandomOutlineInput = document.getElementById(`layer-${i}-text-random-outline`);
            const textRandomEffectInput = document.getElementById(`layer-${i}-text-random-effect`);
            const textRandom3DInput = document.getElementById(`layer-${i}-text-random-3d`);
            const textRandomSizeInput = document.getElementById(`layer-${i}-text-random-size`);
            const textRandomAlignInput = document.getElementById(`layer-${i}-text-random-align`);
            
            // Skip if layer inputs don't exist
            if (!imageInput || !zInput) {
                continue;
            }
            
            let layerImage = imageInput.files[0];
            const layerZ = zInput.value;
            const isExclusion = exclusionInput ? exclusionInput.checked : false;
            
            // Check of er een API-geselecteerde afbeelding is voor deze laag
            const apiKey = `layer-${i}`;
            const apiData = apiLayerData[apiKey];
            
            if (apiData && apiData.api_mode === 'random') {
                // RANDOM mode: geen bestand uploaden, enkel de zoekterm opslaan.
                // De AR frontend haalt zelf bij elke scan een random GIF op.
                formData.append(`layer_${i}_api_mode`, 'random');
                formData.append(`layer_${i}_api_source`, apiData.source);
                formData.append(`layer_${i}_api_query`, apiData.query);
            } else if (apiData && apiData.type === '3d' && apiData.uid) {
                // Specifiek 3D model: sla UID op als api_mode=3d_model
                formData.append(`layer_${i}_api_mode`, '3d_model');
                formData.append(`layer_${i}_api_source`, 'sketchfab');
                formData.append(`layer_${i}_api_query`, apiData.uid);
            } else if (apiData && apiData.url) {
                // Handmatige API selectie: download de content en upload als bestand
                try {
                    const proxyUrl = apiData.source === 'klipy' 
                        ? `${API_URL}/verkeersborden/gif-proxy?url=${encodeURIComponent(apiData.url)}`
                        : apiData.url;
                    const imgResponse = await fetch(proxyUrl);
                    const blob = await imgResponse.blob();
                    const ext = blob.type.includes('gif') ? 'gif' : blob.type.includes('png') ? 'png' : 'jpg';
                    const apiFile = new File([blob], `api_${apiData.source}_${i}.${ext}`, { type: blob.type });
                    formData.append(`layer_${i}_image`, apiFile);
                    formData.append(`layer_${i}_api_source`, apiData.source);
                    formData.append(`layer_${i}_api_url`, apiData.url);
                } catch (apiErr) {
                    console.warn(`[Layer ${i}] API afbeelding downloaden mislukt:`, apiErr);
                }
            } else if (layerImage) {
                // Handmatige upload (bestaand gedrag)
                if (layerImage.type === 'image/gif') {
                    // GIF direct doorsturen (A-Frame GIF shader speelt ze af)
                    layerImage = await convertGifFileToMp4(layerImage, `upload_layer_${i}`);
                } else {
                    // Schaal statische afbeeldingen clientside naar max 1024px
                    layerImage = await prepareLayerImage(layerImage);
                }
                formData.append(`layer_${i}_image`, layerImage);
            }
            
            // Always send configuration
            formData.append(`layer_${i}_z`, layerZ || '0');
            formData.append(`layer_${i}_exclusion`, isExclusion ? '1' : '0');
            
            // Base position and scale
            formData.append(`layer_${i}_pos_x`, posXInput ? posXInput.value || '0' : '0');
            formData.append(`layer_${i}_pos_y`, posYInput ? posYInput.value || '0' : '0');
            formData.append(`layer_${i}_scale`, scaleInput ? scaleInput.value || '1.0' : '1.0');
            formData.append(`layer_${i}_rot_z`, rotZInput ? rotZInput.value || '0' : '0');
            
            // Animation params
            formData.append(`layer_${i}_anim_x`, animXInput ? animXInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_y`, animYInput ? animYInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_z`, animZInput ? animZInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_pos_duration`, animPosDurationInput ? animPosDurationInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_x`, animRotXInput ? animRotXInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_y`, animRotYInput ? animRotYInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_z`, animRotZInput ? animRotZInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_duration`, animRotDurationInput ? animRotDurationInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_origin`, animRotOriginInput ? animRotOriginInput.value || 'center' : 'center');
            formData.append(`layer_${i}_anim_scale`, animScaleInput ? animScaleInput.value || '1.0' : '1.0');
            formData.append(`layer_${i}_anim_opacity`, animOpacityInput ? animOpacityInput.value || '1.0' : '1.0');
            formData.append(`layer_${i}_anim_scale_duration`, animScaleDurationInput ? animScaleDurationInput.value || '0' : '0');

            // Tekstlaag payload
            const isTextEnabled = !!textEnabledInput?.checked;
            const isTextRandom = !!textRandomInput?.checked;
            const textSeed = Date.now() + i;
            formData.append(`layer_${i}_text_enabled`, isTextEnabled ? '1' : '0');
            formData.append(`layer_${i}_text_random`, isTextRandom ? '1' : '0');
            formData.append(`layer_${i}_text_content`, textContentInput ? textContentInput.value || '' : '');
            formData.append(`layer_${i}_text_font_family`, textFontInput ? textFontInput.value || '"Bebas Neue", sans-serif' : '"Bebas Neue", sans-serif');
            formData.append(`layer_${i}_text_font_size`, textSizeInput ? textSizeInput.value || '96' : '96');
            formData.append(`layer_${i}_text_align`, textAlignInput ? textAlignInput.value || 'center' : 'center');
            formData.append(`layer_${i}_text_offset_y`, textOffsetInput ? textOffsetInput.value || '0.85' : '0.85');
            formData.append(`layer_${i}_text_color`, textColorInput ? textColorInput.value || '#ffffff' : '#ffffff');
            formData.append(`layer_${i}_text_outline_color`, textOutlineColorInput ? textOutlineColorInput.value || '#000000' : '#000000');
            formData.append(`layer_${i}_text_outline_width`, textOutlineWidthInput ? textOutlineWidthInput.value || '3' : '3');
            formData.append(`layer_${i}_text_effect`, textEffectInput ? textEffectInput.value || 'none' : 'none');
            formData.append(`layer_${i}_text_3d_effect`, text3DInput ? text3DInput.value || 'none' : 'none');
            formData.append(`layer_${i}_text_3d_depth`, text3DDepthInput ? text3DDepthInput.value || '3' : '3');
            formData.append(`layer_${i}_text_3d_tilt_x`, text3DTiltXInput ? text3DTiltXInput.value || '16' : '16');
            formData.append(`layer_${i}_text_3d_tilt_y`, text3DTiltYInput ? text3DTiltYInput.value || '0' : '0');
            formData.append(`layer_${i}_text_3d_float_px`, text3DFloatPxInput ? text3DFloatPxInput.value || '4' : '4');
            formData.append(`layer_${i}_text_random_font`, textRandomFontInput?.checked ? '1' : '0');
            formData.append(`layer_${i}_text_random_color`, textRandomColorInput?.checked ? '1' : '0');
            formData.append(`layer_${i}_text_random_outline`, textRandomOutlineInput?.checked ? '1' : '0');
            formData.append(`layer_${i}_text_random_effect`, textRandomEffectInput?.checked ? '1' : '0');
            formData.append(`layer_${i}_text_random_3d`, textRandom3DInput?.checked ? '1' : '0');
            formData.append(`layer_${i}_text_random_size`, textRandomSizeInput?.checked ? '1' : '0');
            formData.append(`layer_${i}_text_random_align`, textRandomAlignInput?.checked ? '1' : '0');
            formData.append(`layer_${i}_text_style_seed`, String(textSeed));
            
            // Per-laag AR extras: GLB model en audio
            const layerGlbInput = document.getElementById(`layer-${i}-glb`);
            const layerAudioInput = document.getElementById(`layer-${i}-audio`);
            
            if (layerGlbInput && layerGlbInput.files[0]) {
                const glbFile = layerGlbInput.files[0];
                if (glbFile.size > 10 * 1024 * 1024) {
                    errorMsg.textContent = `Laag ${i}: GLB model is te groot (max 10MB)`;
                    return;
                }
                formData.append(`layer_${i}_glb`, glbFile);
            }
            
            if (layerAudioInput && layerAudioInput.files[0]) {
                const audioFile = layerAudioInput.files[0];
                if (audioFile.size > 10 * 1024 * 1024) {
                    errorMsg.textContent = `Laag ${i}: Audio bestand is te groot (max 10MB)`;
                    return;
                }
                formData.append(`layer_${i}_audio`, audioFile);
            }
        }
        
        const jpegFile = document.getElementById('poster-jpeg').files[0];
        const pdfMediumFile = document.getElementById('poster-pdf-medium').files[0];
        const pdfLargeFile = document.getElementById('poster-pdf-large').files[0];
        
        // Validate files (PDF is optioneel)
        if (!jpegFile) {
            errorMsg.textContent = 'JPEG afbeelding is verplicht';
            return;
        }
        
        // Check file sizes (max 300MB total for high-quality posters)
        const totalSize = jpegFile.size + (pdfMediumFile?.size || 0) + (pdfLargeFile?.size || 0);
        if (totalSize > 300 * 1024 * 1024) {
            errorMsg.textContent = 'Totale bestandsgrootte is te groot (max 300MB)';
            return;
        }
        
        formData.append('jpeg', jpegFile);
        if (pdfMediumFile) formData.append('pdfMedium', pdfMediumFile);
        if (pdfLargeFile) formData.append('pdfLarge', pdfLargeFile);
        
        // Show loading state and progress bar
        uploadBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';
        
        // Scroll to bottom to show progress
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        
        const progressContainer = document.getElementById('upload-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const progressPercentage = document.getElementById('progress-percentage');
        const uploadSpeed = document.getElementById('upload-speed');
        const uploadEta = document.getElementById('upload-eta');
        
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';
        progressPercentage.textContent = '0%';
        
        // Calculate total size for progress display
        const uploadTotalSize = jpegFile.size + (pdfMediumFile?.size || 0) + (pdfLargeFile?.size || 0);
        progressText.textContent = `Voorbereiden upload van ${formatFileSize(uploadTotalSize)}...`;
        
        let startTime = Date.now();
        let lastLoaded = 0;
        let lastTime = startTime;
        
        try {
            const token = sessionStorage.getItem('adminToken');
            
            // Use XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentage = Math.round((e.loaded / e.total) * 100);
                    const currentTime = Date.now();
                    const timeElapsed = (currentTime - startTime) / 1000; // seconds
                    const bytesUploaded = e.loaded;
                    const totalBytes = e.total;
                    
                    // Update progress bar
                    progressFill.style.width = percentage + '%';
                    progressPercentage.textContent = percentage + '%';
                    progressText.textContent = `${formatFileSize(bytesUploaded)} / ${formatFileSize(totalBytes)}...`;
                    
                    // Calculate speed (bytes per second)
                    if (timeElapsed > 0) {
                        const speed = bytesUploaded / timeElapsed;
                        const speedMB = (speed / (1024 * 1024)).toFixed(1);
                        if (uploadSpeed) uploadSpeed.textContent = `${speedMB} MB/s`;
                        
                        // Calculate ETA
                        const remainingBytes = totalBytes - bytesUploaded;
                        const remainingTime = remainingBytes / speed;
                        
                        if (remainingTime > 0 && percentage < 100) {
                            const eta = Math.ceil(remainingTime);
                            const minutes = Math.floor(eta / 60);
                            const seconds = eta % 60;
                            
                            if (uploadEta) {
                                if (minutes > 0) {
                                    uploadEta.textContent = `${minutes}m ${seconds}s resterend`;
                                } else {
                                    uploadEta.textContent = `${seconds}s resterend`;
                                }
                            }
                        } else {
                            if (uploadEta) uploadEta.textContent = 'Bijna klaar...';
                        }
                    }
                }
            });
            
            // Handle completion
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    progressText.textContent = `Upload voltooid! (${formatFileSize(uploadTotalSize)} verzonden)`;
                    if (uploadSpeed) uploadSpeed.textContent = 'Gereed';
                    if (uploadEta) uploadEta.textContent = 'Verwerken...';
                    
                    try {
                        const result = JSON.parse(xhr.responseText);
                        successMsg.textContent = 'Poster succesvol geüpload';
                        
                        // Reset form
                        form.reset();
                        document.getElementById('preview-container').style.display = 'none';
                        progressContainer.style.display = 'none';
                        
                        // Reload poster list
                        setTimeout(() => {
                            loadAdminPosters();
                            successMsg.textContent = '';
                        }, 2000);
                    } catch (parseError) {
                        console.error('Parse error:', parseError);
                        errorMsg.textContent = 'Upload succesvol maar fout bij verwerken response';
                        progressContainer.style.display = 'none';
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        errorMsg.textContent = `Upload mislukt: ${error.message || 'Onbekende fout'}`;
                    } catch {
                        errorMsg.textContent = `Upload mislukt: HTTP ${xhr.status}`;
                    }
                    progressContainer.style.display = 'none';
                }
            });
            
            // Handle errors
            xhr.addEventListener('error', () => {
                console.error('Upload error: Network error');
                errorMsg.textContent = 'Upload mislukt. Controleer je internetverbinding.';
                progressContainer.style.display = 'none';
            });
            
            // Handle timeout
            xhr.addEventListener('timeout', () => {
                console.error('Upload timeout');
                errorMsg.textContent = 'Upload timeout. Bestanden te groot of langzame verbinding.';
                progressContainer.style.display = 'none';
            });
            
            // Configure and send request
            xhr.timeout = 300000; // 5 minutes timeout
            xhr.open('POST', `${API_URL}/admin/upload`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.withCredentials = true;
            xhr.send(formData);
            
        } catch (error) {
            console.error('Upload error:', error);
            errorMsg.textContent = 'Upload mislukt. Controleer of de server draait.';
            progressContainer.style.display = 'none';
        } finally {
            // Reset button state
            uploadBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    };
}

// Setup file preview
function setupFilePreview() {
    const jpegInput = document.getElementById('poster-jpeg');
    const pdfMediumInput = document.getElementById('poster-pdf-medium');
    const pdfLargeInput = document.getElementById('poster-pdf-large');
    const mindInput = document.getElementById('ar-marker-file');
    
    // Ensure elements exist before attaching listeners
    if (!jpegInput) return;

    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    
    const jpegSizeInfo = document.getElementById('jpeg-size-info');
    const pdfMediumSizeInfo = document.getElementById('pdf-medium-size-info');
    const pdfLargeSizeInfo = document.getElementById('pdf-large-size-info');
    const mindSizeInfo = document.getElementById('mind-size-info');
    const totalSummary = document.getElementById('total-size-summary');
    const sizeBreakdown = document.getElementById('size-breakdown');
    const sizeTotal = document.getElementById('size-total');
    
    let currentFiles = {
        jpeg: null,
        pdfMedium: null,
        pdfLarge: null,
        mind: null,
        layers: {}
    };
    
    function updateFileSizeDisplay() {
        let hasFiles = false;
        let totalSize = 0;
        let breakdown = [];
        
        // JPEG handling
        if (currentFiles.jpeg) {
            const size = currentFiles.jpeg.size;
            const maxSize = 50 * 1024 * 1024; // 50MB
            const category = getFileSizeCategory(size, maxSize);
            
            if (jpegSizeInfo) {
                jpegSizeInfo.textContent = `${currentFiles.jpeg.name} - ${formatFileSize(size)}`;
                jpegSizeInfo.className = `file-size-info show ${category}`;
                jpegSizeInfo.style.display = 'inline-block';
            }
            
            totalSize += size;
            breakdown.push(`<div><strong>JPEG:</strong> ${currentFiles.jpeg.name} <span style="color:#666">(${formatFileSize(size)})</span></div>`);
            hasFiles = true;
        } else {
            if (jpegSizeInfo) jpegSizeInfo.style.display = 'none';
        }
        
        // PDF Medium handling
        if (currentFiles.pdfMedium) {
            const size = currentFiles.pdfMedium.size;
            const maxSize = 120 * 1024 * 1024; // 120MB
            const category = getFileSizeCategory(size, maxSize);
            
            if (pdfMediumSizeInfo) {
                pdfMediumSizeInfo.textContent = `${currentFiles.pdfMedium.name} - ${formatFileSize(size)}`;
                pdfMediumSizeInfo.className = `file-size-info show ${category}`;
                pdfMediumSizeInfo.style.display = 'inline-block';
            }
            
            totalSize += size;
            breakdown.push(`<div><strong>PDF (A3):</strong> ${currentFiles.pdfMedium.name} <span style="color:#666">(${formatFileSize(size)})</span></div>`);
            hasFiles = true;
        } else {
            if (pdfMediumSizeInfo) pdfMediumSizeInfo.style.display = 'none';
        }
        
        // PDF Large handling
        if (currentFiles.pdfLarge) {
            const size = currentFiles.pdfLarge.size;
            const maxSize = 120 * 1024 * 1024; // 120MB
            const category = getFileSizeCategory(size, maxSize);
            
            if (pdfLargeSizeInfo) {
                pdfLargeSizeInfo.textContent = `${currentFiles.pdfLarge.name} - ${formatFileSize(size)}`;
                pdfLargeSizeInfo.className = `file-size-info show ${category}`;
                pdfLargeSizeInfo.style.display = 'inline-block';
            }
            
            totalSize += size;
            breakdown.push(`<div><strong>PDF (A0):</strong> ${currentFiles.pdfLarge.name} <span style="color:#666">(${formatFileSize(size)})</span></div>`);
            hasFiles = true;
        } else {
            if (pdfLargeSizeInfo) pdfLargeSizeInfo.style.display = 'none';
        }
        
        // .mind file handling
        if (currentFiles.mind) {
            const size = currentFiles.mind.size;
            const maxSize = 10 * 1024 * 1024; // 10MB
            const category = getFileSizeCategory(size, maxSize);
            
            if (mindSizeInfo) {
                mindSizeInfo.textContent = `${currentFiles.mind.name} - ${formatFileSize(size)}`;
                mindSizeInfo.className = `file-size-info show ${category}`;
                mindSizeInfo.style.display = 'inline-block';
            }
            
            totalSize += size;
            breakdown.push(`<div><strong>Marker:</strong> ${currentFiles.mind.name} <span style="color:#666">(${formatFileSize(size)})</span></div>`);
            hasFiles = true;
        } else {
            if (mindSizeInfo) mindSizeInfo.style.display = 'none';
        }
        
        // AR Layer files handling
        let layerCount = 0;
        let layersTotalSize = 0;
        for (let i = 1; i <= 8; i++) {
            if (currentFiles.layers[i]) {
                layerCount++;
                layersTotalSize += currentFiles.layers[i].size;
                breakdown.push(`<div><strong>Laag ${i}:</strong> ${currentFiles.layers[i].name} <span style="color:#666">(${formatFileSize(currentFiles.layers[i].size)})</span></div>`);
            }
        }
        if (layerCount > 0) {
            totalSize += layersTotalSize;
            hasFiles = true;
        }
        
        // Update total summary (indien elementen bestaan)
        if (hasFiles && sizeBreakdown && sizeTotal && totalSummary) {
            sizeBreakdown.innerHTML = breakdown.join('');
            sizeTotal.textContent = `Totaal: ${formatFileSize(totalSize)} (max 300MB)`;
            totalSummary.style.display = 'block';
            
            // Color code total size
            if (totalSize > 250 * 1024 * 1024) {
                sizeTotal.style.color = '#c62828'; // Red warning
            } else if (totalSize > 150 * 1024 * 1024) {
                sizeTotal.style.color = '#ef6c00'; // Orange warning
            } else {
                sizeTotal.style.color = '#2e7d32'; // Green ok
            }
        } else if (totalSummary) {
            totalSummary.style.display = 'none';
        }
    }
    
    // JPEG input handler: toon preview + start automatische .mind compilatie
    jpegInput.onchange = (e) => {
        const file = e.target.files[0];
        currentFiles.jpeg = file;
        
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                previewContainer.style.display = 'block';
                // Gebruik de geüploade JPEG ook als preview achtergrond
                const img = new Image();
                img.onload = () => { previewPosterImage = img; renderARPreview(); };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            
            // Start browser-side .mind compilatie op de achtergrond
            // zodat het klaar is wanneer de admin op upload klikt
            const mindStatusEl = document.getElementById('mind-compile-status');
            compiledMindBuffer = null; // Reset vorige compilatie
            compilingMindPromise = compileMindFromImage(file, mindStatusEl, 'summary-mind').then(buf => {
                compiledMindBuffer = buf;
                compilingMindPromise = null; // Klaar
                // Submit knop weer inschakelen als compilatie klaar is
                const btn = document.getElementById('upload-btn');
                if (btn) btn.disabled = false;
                return buf;
            });
            // Disable submit knop tijdens compilatie zodat admin niet per ongeluk indient
            const btn = document.getElementById('upload-btn');
            if (btn) btn.disabled = true;
        }
        
        updateFileSizeDisplay();
    };
    
    // PDF Medium input handler
    pdfMediumInput.onchange = (e) => {
        currentFiles.pdfMedium = e.target.files[0];
        updateFileSizeDisplay();
    };
    
    // PDF Large input handler
    pdfLargeInput.onchange = (e) => {
        currentFiles.pdfLarge = e.target.files[0];
        updateFileSizeDisplay();
    };
    
    // .mind file input handler
    if (mindInput) {
        mindInput.onchange = (e) => {
            currentFiles.mind = e.target.files[0];
            updateFileSizeDisplay();
        };
    }
    
    // AR Layer inputs handlers (8 layers)
    for (let i = 1; i <= 8; i++) {
        const layerInput = document.getElementById(`layer-${i}-image`);
        const glbInput = document.getElementById(`layer-${i}-glb`);
        const audioInput = document.getElementById(`layer-${i}-audio`);
        
        // Helper functie om layer status badge te updaten
        const updateLayerStatus = (layerNum) => {
            const statusBadge = document.getElementById(`layer-${layerNum}-status`);
            if (!statusBadge) return;
            
            // Check of er enig bestand is geselecteerd
            const hasMedia = currentFiles.layers[layerNum];
            const hasGlb = currentFiles.layerGlbs && currentFiles.layerGlbs[layerNum];
            const hasAudio = currentFiles.layerAudios && currentFiles.layerAudios[layerNum];
            
            if (hasMedia || hasGlb || hasAudio) {
                statusBadge.textContent = 'GESELECTEERD';
                statusBadge.classList.add('active');
            } else {
                statusBadge.textContent = 'LEEG';
                statusBadge.classList.remove('active');
            }
        };
        
        if (layerInput) {
            layerInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    currentFiles.layers[i] = file;
                } else {
                    delete currentFiles.layers[i];
                }
                updateLayerStatus(i);
                updateFileSizeDisplay();
            };
        }
        
        if (glbInput) {
            // Init layerGlbs object if needed
            if (!currentFiles.layerGlbs) currentFiles.layerGlbs = {};
            
            glbInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    currentFiles.layerGlbs[i] = file;
                } else {
                    delete currentFiles.layerGlbs[i];
                }
                updateLayerStatus(i);
                updateFileSizeDisplay();
            };
        }
        
        if (audioInput) {
            // Init layerAudios object if needed
            if (!currentFiles.layerAudios) currentFiles.layerAudios = {};
            
            audioInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    currentFiles.layerAudios[i] = file;
                } else {
                    delete currentFiles.layerAudios[i];
                }
                updateLayerStatus(i);
                updateFileSizeDisplay();
            };
        }
    }
}

// Laad alle posters voor admin overzicht
async function loadAdminPosters() {
    try {
        const response = await fetch(`${API_URL}/posters`);
        if (!response.ok) throw new Error('Kan posters niet laden');
        
        const posters = await response.json();
        
        const postersList = document.getElementById('admin-poster-list');
        if (posters.length === 0) {
            postersList.innerHTML = '<p style="text-align: center; color: #666; padding: 1rem; font-size: 0.9rem;">Nog geen posters.</p>';
            return;
        }
        
        postersList.innerHTML = posters.map(poster => {
            const typeLabel = poster.upload_type === 'reclame' ? '<span style="color:#f90;font-size:0.45rem;"> [RECLAME]</span>' : '';
            return `
            <div class="sidebar-poster-item" data-id="${poster.id}" onclick="openEditModal('${poster.id}')">
                <div class="poster-item-header">
                    <h4 class="poster-item-title">${poster.title}${typeLabel}</h4>
                </div>
                <p class="poster-item-meta">${formatDate(poster.upload_date || poster.uploadDate)}</p>
            </div>
        `;
        }).join('');

        refreshAdminUXState();
        
    } catch (error) {
        console.error('Error loading posters:', error);
        document.getElementById('admin-poster-list').innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 1rem;">Fout bij laden</p>';
        refreshAdminUXState();
    }
}

// Verwijder poster
async function deletePoster(posterId) {
    console.log('[Delete] deletePoster called with ID:', posterId);
    
    // Gebruik custom confirm modal in plaats van native confirm()
    const confirmed = await showConfirmModal(
        'POSTER VERWIJDEREN',
        'Weet je zeker dat je deze poster wilt verwijderen? Dit kan niet ongedaan worden gemaakt.'
    );
    
    if (!confirmed) {
        console.log('[Delete] User cancelled');
        return;
    }
    
    console.log('[Delete] User confirmed, proceeding with delete...');
    
    try {
        const token = sessionStorage.getItem('adminToken');
        console.log('[Delete] Token:', token ? 'present' : 'missing');
        
        const response = await fetch(`${API_URL}/admin/posters/${posterId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include' // Include session cookies
        });
        
        console.log('[Delete] Response status:', response.status);
        
        if (response.ok) {
            console.log('[Delete] Success!');
            // Close modal if open
            closeEditModal();
            
            // Verwijder van UI
            const posterElement = document.querySelector(`[data-id="${posterId}"]`);
            if (posterElement) {
                posterElement.style.opacity = '0';
                setTimeout(() => {
                    posterElement.remove();
                    loadAdminPosters();
                }, 300);
            }
        } else {
            const errorText = await response.text();
            console.error('[Delete] Server error:', errorText);
            alert('Kon poster niet verwijderen. Probeer opnieuw.');
        }
    } catch (error) {
        console.error('[Delete] Error:', error);
        alert('Kon poster niet verwijderen. Controleer of de server draait.');
    }
}

// Custom confirm modal (vervangt native confirm() die geblokkeerd kan worden)
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const yesBtn = document.getElementById('confirm-yes');
        
        if (!modal) {
            // Fallback naar native confirm als modal niet bestaat
            resolve(confirm(message));
            return;
        }
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'block';
        
        // Store resolve function for buttons
        window._confirmResolve = resolve;
        
        yesBtn.onclick = () => {
            closeConfirmModal(true);
        };
    });
}

function closeConfirmModal(result) {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    if (window._confirmResolve) {
        window._confirmResolve(result);
        window._confirmResolve = null;
    }
}
window.closeConfirmModal = closeConfirmModal;

// Formatteer datum
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('nl-NL', options);
}

// Formatteer locatie voor admin interface
function formatLocationAdmin(poster) {
    if (!poster.latitude || !poster.longitude) {
        return '<p style="color: #999; font-size: 0.9rem; margin: 0.25rem 0;">Location: Not set</p>';
    }
    
    const lat = parseFloat(poster.latitude);
    const lng = parseFloat(poster.longitude);
    
    const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
    const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;
    
    let locationText = `${latStr}, ${lngStr}`;
    
    if (poster.location_description) {
        locationText += ` / ${poster.location_description}`;
    }
    
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    
    return `<p style="margin: 0.25rem 0;">
        Location: <a href="${mapsUrl}" target="_blank" title="Maps" 
           style="color: #666; text-decoration: underline; font-size: 0.9rem;">
            ${locationText}
        </a>
    </p>`;
}

// Open edit modal
// Setup file preview for edit form
function setupEditFilePreview() {
    const jpegInput = document.getElementById('edit-jpeg');
    const pdfMediumInput = document.getElementById('edit-pdf-medium');
    const pdfLargeInput = document.getElementById('edit-pdf-large');
    const mindInput = document.getElementById('edit-ar-marker-file');
    
    const jpegSizeInfo = document.getElementById('edit-jpeg-size-info');
    const pdfMediumSizeInfo = document.getElementById('edit-pdf-medium-size-info');
    const pdfLargeSizeInfo = document.getElementById('edit-pdf-large-size-info');
    const mindSizeInfo = document.getElementById('edit-ar-marker-file-size-info');
    
    // Helper to update badge
    const updateBadge = (file, badgeEl, maxSize) => {
        if (!badgeEl) return;
        
        if (file) {
            const size = file.size;
            const category = getFileSizeCategory(size, maxSize);
            badgeEl.textContent = `${file.name} - ${formatFileSize(size)}`;
            badgeEl.className = `file-size-info show ${category}`;
            badgeEl.style.display = 'inline-block';
        } else {
            badgeEl.style.display = 'none';
        }
    };

    if (jpegInput) {
        jpegInput.onchange = (e) => {
            const file = e.target.files[0];
            updateBadge(file, jpegSizeInfo, 50 * 1024 * 1024);
            
            // Preview
            const previewContainer = document.getElementById('edit-preview-container');
            const previewImage = document.getElementById('edit-preview-image');
            
            if (file && file.type.startsWith('image/') && previewContainer && previewImage) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
                
                // Start automatische .mind compilatie (edit mode)
                editCompiledMindBuffer = null;
                editCompilingMindPromise = compileMindFromImage(file, mindSizeInfo, null).then(buf => {
                    editCompiledMindBuffer = buf;
                    editCompilingMindPromise = null; // Klaar
                    // Herstel save knop
                    const saveBtn = document.getElementById('save-edit-btn');
                    if (saveBtn) saveBtn.disabled = false;
                    return buf;
                });
                // Disable save knop tijdens compilatie
                const saveBtn = document.getElementById('save-edit-btn');
                if (saveBtn) saveBtn.disabled = true;
            } else if (previewContainer) {
                previewContainer.style.display = 'none';
            }
        };
    }
    if (pdfMediumInput) {
        pdfMediumInput.onchange = (e) => updateBadge(e.target.files[0], pdfMediumSizeInfo, 120 * 1024 * 1024);
    }
    if (pdfLargeInput) {
        pdfLargeInput.onchange = (e) => updateBadge(e.target.files[0], pdfLargeSizeInfo, 120 * 1024 * 1024);
    }
    if (mindInput) {
        mindInput.onchange = (e) => updateBadge(e.target.files[0], mindSizeInfo, 10 * 1024 * 1024);
    }
    
    // Layers
    for (let i = 1; i <= 8; i++) {
        const layerInput = document.getElementById(`edit-layer-${i}-image`);
        if (layerInput) {
            layerInput.onchange = (e) => {
                const file = e.target.files[0];
                const statusBadge = document.getElementById(`edit-layer-${i}-status`);
                if (file) {
                    if (statusBadge) {
                        statusBadge.textContent = 'Nieuw bestand';
                        statusBadge.classList.add('active');
                        statusBadge.style.background = '#e8f5e9';
                        statusBadge.style.color = '#2e7d32';
                    }
                } else {
                    if (statusBadge) {
                        statusBadge.textContent = 'Leeg'; // Or revert to "Huidig" if we knew it
                        statusBadge.classList.remove('active');
                        statusBadge.style.background = '#eee';
                        statusBadge.style.color = '#999';
                    }
                }
            };
        }
    }
}

async function openEditModal(posterId) {
    try {
        // Fetch poster data (met cache busting om verse data te krijgen)
        const cacheBuster = Date.now();
        const response = await fetch(`${API_URL}/posters/${posterId}?_=${cacheBuster}`, {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Poster niet gevonden');
        
        const poster = await response.json();
        
        // API stuurt poster.layers al als object (geparsed in PHP)
        // Fallback voor oude data: parse layers_data als het een string is
        if (!poster.layers) {
            if (poster.layers_data && typeof poster.layers_data === 'string') {
                try {
                    poster.layers = JSON.parse(poster.layers_data);
                } catch (e) {
                    console.warn('Kon layers_data niet parsen:', e);
                    poster.layers = {};
                }
            } else {
                poster.layers = {};
            }
        }
        
        // Sla poster data globaal op voor AR preview
        currentPosterData = poster;
        
        // Wis stale API layer data van vorige edit sessie
        for (let n = 1; n <= 8; n++) {
            delete apiLayerData[`edit-layer-${n}`];
        }
        
        // Laad de thumbnail voor gebruik als achtergrond in de preview
        previewPosterImage = null;
        if (poster.thumbnail) {
            const thumbImg = new Image();
            thumbImg.crossOrigin = 'anonymous';
            thumbImg.onload = () => {
                previewPosterImage = thumbImg;
                renderARPreview();
            };
            thumbImg.src = poster.thumbnail + '?_=' + Date.now();
        }
        
        // Populate form
        document.getElementById('edit-poster-id').value = poster.id;
        document.getElementById('edit-title').value = poster.title || '';
        document.getElementById('edit-description').value = poster.description || '';
        
        // Stel upload type in zodat edit modal weet of het reclame of poster is
        currentUploadType = poster.upload_type === 'reclame' ? 'reclame' : 'poster';
        
        // Combine lat/lng into single coordinates field
        const lat = poster.latitude || '';
        const lng = poster.longitude || '';
        const coordinatesValue = (lat && lng) ? `${lat}, ${lng}` : '';
        document.getElementById('edit-coordinates').value = coordinatesValue;
        
        document.getElementById('edit-location').value = poster.location_description || '';
        document.getElementById('edit-artikel-link').value = poster.artikel_link || '';
        
        // AR camera feed checkbox instellen
        const arCameraCheckbox = document.getElementById('edit-ar-camera-feed');
        if (arCameraCheckbox) arCameraCheckbox.checked = !!parseInt(poster.ar_camera_feed);
        
        // Populate credits (nieuw systeem of fallback van photographer_credit)
        const creditsData = poster.credits || poster.photographer_credit || '';
        populateCredits('edit-credits-container', creditsData);
        
        // Show current .mind file
        const markerInfo = document.getElementById('edit-ar-marker-current');
        if (markerInfo) {
            if (poster.ar_marker) {
                const filename = poster.ar_marker.split('/').pop() + '.mind';
                markerInfo.textContent = `Huidig: ${filename}`;
                markerInfo.style.color = '#27ae60';
            } else {
                markerInfo.textContent = 'Geen AR marker gekoppeld';
                markerInfo.style.color = '#e74c3c';
            }
        }
        
        // Render all 8 layers for edit form
        renderLayers(true);
        
        // Herinjecteer API source UI voor edit formulier (renderLayers wist de container)
        for (let n = 1; n <= 8; n++) {
            injectApiSourceUI(n, 'edit-');
        }
        
        // Setup file previews for edit form
        setupEditFilePreview();
        
        // Populate layer data if available
        for (let layerNum = 1; layerNum <= 8; layerNum++) {
            const layerData = poster.layers ? poster.layers[`layer_${layerNum}`] : null;
            
            if (layerData) {
                // Set z-position
                const zInput = document.getElementById(`edit-layer-${layerNum}-z`);
                // Fix: explicit check for undefined/null to allow 0 values
                if (zInput) {
                    const defaultZ = LAYER_CONFIG.defaultLayers.find(l => l.num === layerNum)?.defaultZ.toFixed(3) || '0.000';
                    zInput.value = (layerData.z !== undefined && layerData.z !== null) ? layerData.z : defaultZ;
                }
                
                // Set base position and scale
                const posXInput = document.getElementById(`edit-layer-${layerNum}-pos-x`);
                if (posXInput) posXInput.value = (layerData.pos_x !== undefined && layerData.pos_x !== null) ? layerData.pos_x : '0.000';
                
                const posYInput = document.getElementById(`edit-layer-${layerNum}-pos-y`);
                if (posYInput) posYInput.value = (layerData.pos_y !== undefined && layerData.pos_y !== null) ? layerData.pos_y : '0.000';
                
                const scaleInput = document.getElementById(`edit-layer-${layerNum}-scale`);
                if (scaleInput) {
                    const val = (layerData.scale !== undefined && layerData.scale !== null) ? layerData.scale : '1.0';
                    console.log(`[Admin] Layer ${layerNum} loaded scale:`, layerData.scale, 'Set to:', val);
                    scaleInput.value = val;
                }
                
                const rotXInput = document.getElementById(`edit-layer-${layerNum}-rot-x`);
                if (rotXInput) rotXInput.value = (layerData.rot_x !== undefined && layerData.rot_x !== null) ? layerData.rot_x : '0';
                
                const rotYInput = document.getElementById(`edit-layer-${layerNum}-rot-y`);
                if (rotYInput) rotYInput.value = (layerData.rot_y !== undefined && layerData.rot_y !== null) ? layerData.rot_y : '0';
                
                const rotZInput = document.getElementById(`edit-layer-${layerNum}-rot-z`);
                if (rotZInput) rotZInput.value = (layerData.rot_z !== undefined && layerData.rot_z !== null) ? layerData.rot_z : '0';
                
                // Set transparent checkbox
                const transparentCheckbox = document.getElementById(`edit-layer-${layerNum}-transparent`);
                if (transparentCheckbox) {
                    transparentCheckbox.checked = layerData.transparent || false;
                    // Toon/verberg kleurkiezer op basis van transparantie
                    const bgColorContainer = document.getElementById(`edit-layer-${layerNum}-bg-color-container`);
                    if (bgColorContainer) {
                        bgColorContainer.style.display = transparentCheckbox.checked ? 'none' : 'inline-flex';
                    }
                }
                
                // Set background color
                const bgColorInput = document.getElementById(`edit-layer-${layerNum}-bg-color`);
                if (bgColorInput) {
                    bgColorInput.value = layerData.bg_color || '#000000';
                }
                
                // Set exclusion filter checkbox
                const exclusionCheckbox = document.getElementById(`edit-layer-${layerNum}-exclusion`);
                if (exclusionCheckbox) {
                    exclusionCheckbox.checked = layerData.exclusion_filter || false;
                }

                // Tekstlaag velden
                const textEnabledEl = document.getElementById(`edit-layer-${layerNum}-text-enabled`);
                const textRandomEl = document.getElementById(`edit-layer-${layerNum}-text-random`);
                const textRandomFontEl = document.getElementById(`edit-layer-${layerNum}-text-random-font`);
                const textRandomColorEl = document.getElementById(`edit-layer-${layerNum}-text-random-color`);
                const textRandomOutlineEl = document.getElementById(`edit-layer-${layerNum}-text-random-outline`);
                const textRandomEffectEl = document.getElementById(`edit-layer-${layerNum}-text-random-effect`);
                const textRandom3DEl = document.getElementById(`edit-layer-${layerNum}-text-random-3d`);
                const textRandomSizeEl = document.getElementById(`edit-layer-${layerNum}-text-random-size`);
                const textRandomAlignEl = document.getElementById(`edit-layer-${layerNum}-text-random-align`);
                const textContentEl = document.getElementById(`edit-layer-${layerNum}-text-content`);
                const textFontEl = document.getElementById(`edit-layer-${layerNum}-text-font`);
                const textSizeEl = document.getElementById(`edit-layer-${layerNum}-text-size`);
                const textAlignEl = document.getElementById(`edit-layer-${layerNum}-text-align`);
                const textOffsetEl = document.getElementById(`edit-layer-${layerNum}-text-offset-y`);
                const textColorEl = document.getElementById(`edit-layer-${layerNum}-text-color`);
                const textOutlineColorEl = document.getElementById(`edit-layer-${layerNum}-text-outline-color`);
                const textOutlineWidthEl = document.getElementById(`edit-layer-${layerNum}-text-outline-width`);
                const textEffectEl = document.getElementById(`edit-layer-${layerNum}-text-effect`);
                const text3dEl = document.getElementById(`edit-layer-${layerNum}-text-3d`);
                const text3dDepthEl = document.getElementById(`edit-layer-${layerNum}-text-3d-depth`);
                const text3dTiltXEl = document.getElementById(`edit-layer-${layerNum}-text-3d-tilt-x`);
                const text3dTiltYEl = document.getElementById(`edit-layer-${layerNum}-text-3d-tilt-y`);
                const text3dFloatPxEl = document.getElementById(`edit-layer-${layerNum}-text-3d-float-px`);

                if (textEnabledEl) textEnabledEl.checked = !!layerData.text_enabled;
                if (textRandomEl) textRandomEl.checked = !!layerData.text_random_style;
                if (textRandomFontEl) textRandomFontEl.checked = !!layerData.text_random_font;
                if (textRandomColorEl) textRandomColorEl.checked = !!layerData.text_random_color;
                if (textRandomOutlineEl) textRandomOutlineEl.checked = !!layerData.text_random_outline;
                if (textRandomEffectEl) textRandomEffectEl.checked = !!layerData.text_random_effect;
                if (textRandom3DEl) textRandom3DEl.checked = !!layerData.text_random_3d;
                if (textRandomSizeEl) textRandomSizeEl.checked = !!layerData.text_random_size;
                if (textRandomAlignEl) textRandomAlignEl.checked = !!layerData.text_random_align;
                if (textContentEl) textContentEl.value = layerData.text_content || '';
                if (textFontEl) textFontEl.value = layerData.text_font_family || '"Bebas Neue", sans-serif';
                if (textSizeEl) textSizeEl.value = layerData.text_font_size || 96;
                if (textAlignEl) textAlignEl.value = layerData.text_align || 'center';
                if (textOffsetEl) textOffsetEl.value = (layerData.text_offset_y !== undefined && layerData.text_offset_y !== null) ? layerData.text_offset_y : 0.85;
                if (textColorEl) textColorEl.value = layerData.text_color || '#ffffff';
                if (textOutlineColorEl) textOutlineColorEl.value = layerData.text_outline_color || '#000000';
                if (textOutlineWidthEl) textOutlineWidthEl.value = layerData.text_outline_width || 3;
                if (textEffectEl) textEffectEl.value = layerData.text_effect || 'none';
                if (text3dEl) text3dEl.value = layerData.text_3d_effect || 'none';
                if (text3dDepthEl) text3dDepthEl.value = layerData.text_3d_depth || 3;
                if (text3dTiltXEl) text3dTiltXEl.value = (layerData.text_3d_tilt_x !== undefined && layerData.text_3d_tilt_x !== null) ? layerData.text_3d_tilt_x : 16;
                if (text3dTiltYEl) text3dTiltYEl.value = (layerData.text_3d_tilt_y !== undefined && layerData.text_3d_tilt_y !== null) ? layerData.text_3d_tilt_y : 0;
                if (text3dFloatPxEl) text3dFloatPxEl.value = layerData.text_3d_float_px || 4;
                
                // Check if has animation data (any non-zero anim value)
                const hasAnimation = layerData.anim_x || layerData.anim_y || layerData.anim_z || 
                                    layerData.anim_rot_x || layerData.anim_rot_y || layerData.anim_rot_z ||
                                    (layerData.anim_scale && layerData.anim_scale !== 1.0) ||
                                    (layerData.anim_opacity && layerData.anim_opacity !== 1.0) ||
                                    (layerData.anim_pos_duration && layerData.anim_pos_duration !== 0) ||
                                    (layerData.anim_rot_duration && layerData.anim_rot_duration !== 0) ||
                                    (layerData.anim_scale_duration && layerData.anim_scale_duration !== 0);
                
                // Set animation toggle
                const animToggle = document.getElementById(`edit-layer-${layerNum}-enable-anim`);
                if (animToggle) {
                    animToggle.checked = hasAnimation;
                    // Show/hide animation container
                    const animContainer = document.getElementById(`edit-layer-${layerNum}-anim-container`);
                    if (animContainer) {
                        animContainer.style.display = hasAnimation ? 'block' : 'none';
                    }
                }
                
                // Set animation values
                const animFields = [
                    'anim_x', 'anim_y', 'anim_z', 'anim_pos_duration',
                    'anim_rot_x', 'anim_rot_y', 'anim_rot_z', 'anim_rot_duration', 'anim_rot_origin',
                    'anim_scale', 'anim_opacity', 'anim_scale_duration'
                ];
                animFields.forEach(field => {
                    const input = document.getElementById(`edit-layer-${layerNum}-${field.replace(/_/g, '-')}`);
                    if (input && layerData[field] !== undefined) {
                        input.value = layerData[field];
                    }
                });
                
                // Show current filename if exists
                const currentFileInfo = document.getElementById(`edit-layer-${layerNum}-current`);
                const deleteMediaBtn = document.getElementById(`edit-layer-${layerNum}-delete-media-btn`);
                if (currentFileInfo && layerData.api_mode === 'random') {
                    currentFileInfo.textContent = `API: ${layerData.api_source || 'klipy'} — "${layerData.api_query || ''}"`;
                    currentFileInfo.style.color = '#2196f3';
                    if (deleteMediaBtn) deleteMediaBtn.style.display = 'none';
                } else if (currentFileInfo && layerData.api_mode === '3d_model') {
                    currentFileInfo.textContent = `3D MODEL: Sketchfab UID ${layerData.api_query || ''}`;
                    currentFileInfo.style.color = '#00bcd4';
                    if (deleteMediaBtn) deleteMediaBtn.style.display = 'none';
                } else if (currentFileInfo && layerData.filename) {
                    currentFileInfo.textContent = `Huidig: ${layerData.filename}`;
                    currentFileInfo.style.color = '#27ae60';
                    if (deleteMediaBtn) deleteMediaBtn.style.display = 'inline-block';
                } else if (currentFileInfo) {
                    currentFileInfo.textContent = 'Geen afbeelding';
                    currentFileInfo.style.color = '#999';
                    if (deleteMediaBtn) deleteMediaBtn.style.display = 'none';
                }
                
                // Update layer status badge in edit modal
                const statusBadge = document.getElementById(`edit-layer-${layerNum}-status`);
                if (statusBadge && layerData.api_mode === 'random') {
                    statusBadge.textContent = layerData.api_source === 'sketchfab' ? '3D RANDOM' : 'RANDOM';
                    statusBadge.style.background = '#e3f2fd';
                    statusBadge.style.color = '#1565c0';
                } else if (statusBadge && layerData.api_mode === '3d_model') {
                    statusBadge.textContent = '3D';
                    statusBadge.style.background = '#e0f7fa';
                    statusBadge.style.color = '#006064';
                } else if (statusBadge && layerData.filename) {
                    statusBadge.textContent = 'Gevuld';
                    statusBadge.style.background = '#e8f5e9';
                    statusBadge.style.color = '#2e7d32';
                } else if (statusBadge && layerData.text_enabled && layerData.text_content) {
                    statusBadge.textContent = 'TEKST';
                    statusBadge.style.background = '#fff8e1';
                    statusBadge.style.color = '#ef6c00';
                } else if (statusBadge) {
                    statusBadge.textContent = 'Leeg';
                    statusBadge.style.background = '#ffebee';
                    statusBadge.style.color = '#c62828';
                }
                
                // Herstel API layer state als deze laag een random API bron heeft
                if (layerData.api_mode === 'random') {
                    const sourceSelect = document.getElementById(`edit-layer-${layerNum}-source`);
                    if (sourceSelect) {
                        sourceSelect.value = layerData.api_source || 'klipy';
                        // Trigger change event: toont API panel en verbergt file input
                        sourceSelect.dispatchEvent(new Event('change'));
                    }
                    const queryInput = document.getElementById(`edit-layer-${layerNum}-api-query`);
                    if (queryInput) queryInput.value = layerData.api_query || '';
                    
                    const randomCb = document.getElementById(`edit-layer-${layerNum}-api-random`);
                    if (randomCb) randomCb.checked = true;
                    
                    // Vul apiLayerData zodat de opslaan-knop de juiste data verstuurt
                    apiLayerData[`edit-layer-${layerNum}`] = {
                        api_mode: 'random',
                        source: layerData.api_source || 'klipy',
                        query: layerData.api_query || ''
                    };
                    
                    // Toon bevestiging in results container
                    const resultsContainer = document.getElementById(`edit-layer-${layerNum}-api-results`);
                    if (resultsContainer) {
                        const isSketchfab = layerData.api_source === 'sketchfab';
                        resultsContainer.innerHTML = `<div class="api-loading">${isSketchfab ? '3D RANDOM' : 'RANDOM'}: "${escapeHtml(layerData.api_query || '')}"<br><small style="opacity:0.6">Elke scan: willekeurig resultaat (30s cooldown)</small></div>`;
                    }
                }
                
                // Herstel 3D model state als deze laag een specifiek Sketchfab model is
                if (layerData.api_mode === '3d_model') {
                    const sourceSelect = document.getElementById(`edit-layer-${layerNum}-source`);
                    if (sourceSelect) {
                        sourceSelect.value = 'sketchfab';
                        sourceSelect.dispatchEvent(new Event('change'));
                    }
                    apiLayerData[`edit-layer-${layerNum}`] = {
                        type: '3d', api_mode: '3d_model', source: 'sketchfab', uid: layerData.api_query || ''
                    };
                    const resultsContainer = document.getElementById(`edit-layer-${layerNum}-api-results`);
                    if (resultsContainer) {
                        resultsContainer.innerHTML = `<div class="api-loading">3D MODEL: Sketchfab UID <code>${escapeHtml(layerData.api_query || '')}</code></div>`;
                    }
                }
                
                // Toon huidige GLB/audio status per laag (in AR EXTRAS toggle)
                const glbInfo = document.getElementById(`edit-layer-${layerNum}-glb-current`);
                const audioInfo = document.getElementById(`edit-layer-${layerNum}-audio-current`);
                const deleteGlbBtn = document.getElementById(`edit-layer-${layerNum}-delete-glb-btn`);
                const deleteAudioBtn = document.getElementById(`edit-layer-${layerNum}-delete-audio-btn`);
                
                if (glbInfo) {
                    if (layerData.glb_model) {
                        glbInfo.textContent = `Huidig: ${layerData.glb_model}`;
                        glbInfo.style.color = '#27ae60';
                        if (deleteGlbBtn) deleteGlbBtn.style.display = 'inline-block';
                    } else {
                        glbInfo.textContent = 'Geen 3D model';
                        glbInfo.style.color = '#999';
                        if (deleteGlbBtn) deleteGlbBtn.style.display = 'none';
                    }
                }
                
                if (audioInfo) {
                    if (layerData.audio_file) {
                        audioInfo.textContent = `Huidig: ${layerData.audio_file}`;
                        audioInfo.style.color = '#27ae60';
                        if (deleteAudioBtn) deleteAudioBtn.style.display = 'inline-block';
                    } else {
                        audioInfo.textContent = 'Geen audio';
                        audioInfo.style.color = '#999';
                        if (deleteAudioBtn) deleteAudioBtn.style.display = 'none';
                    }
                }
            }
        }
        
        // Clear file inputs
        document.getElementById('edit-jpeg').value = '';
        document.getElementById('edit-pdf-medium').value = '';
        document.getElementById('edit-pdf-large').value = '';
        const arMarkerInput = document.getElementById('edit-ar-marker-file');
        if (arMarkerInput) arMarkerInput.value = '';
        
        // Gallery images - toon huidige en setup delete
        const galleryContainer = document.getElementById('edit-gallery-current');
        if (galleryContainer) {
            galleryContainer.innerHTML = '';
            window.deleteGalleryImages = []; // Reset delete tracking
            
            // Parse gallery_images
            let galleryImages = [];
            if (poster.gallery_images) {
                if (typeof poster.gallery_images === 'string') {
                    try { galleryImages = JSON.parse(poster.gallery_images); } catch(e) {}
                } else if (Array.isArray(poster.gallery_images)) {
                    galleryImages = poster.gallery_images;
                }
            }
            
            if (galleryImages.length > 0) {
                galleryImages.forEach((imgPath, idx) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'gallery-item';
                    wrapper.dataset.path = imgPath;
                    wrapper.innerHTML = `
                        <img src="${imgPath}" alt="Gallery ${idx + 1}">
                        <button type="button" class="gallery-delete-btn" onclick="markGalleryForDelete('${imgPath}', this)">&times;</button>
                    `;
                    galleryContainer.appendChild(wrapper);
                });
            } else {
                galleryContainer.innerHTML = '<span class="hint-text">Geen galerij fotos</span>';
            }
        }
        
        // Clear gallery input
        const editGalleryInput = document.getElementById('edit-gallery-images');
        if (editGalleryInput) editGalleryInput.value = '';
        
        // Clear layer file inputs (incl. GLB/audio per laag)
        for (let layerNum = 1; layerNum <= 8; layerNum++) {
            const fileInput = document.getElementById(`edit-layer-${layerNum}-image`);
            if (fileInput) fileInput.value = '';
            
            const deleteInput = document.getElementById(`edit-layer-${layerNum}-delete`);
            if (deleteInput) deleteInput.value = '0';
            
            // Clear GLB en audio inputs per laag
            const glbInput = document.getElementById(`edit-layer-${layerNum}-glb`);
            const audioInput = document.getElementById(`edit-layer-${layerNum}-audio`);
            if (glbInput) glbInput.value = '';
            if (audioInput) audioInput.value = '';
        }
        
        // Clear messages
        document.getElementById('edit-success').textContent = '';
        document.getElementById('edit-error').textContent = '';
        
        // Update header with poster title
        const titleHeader = document.getElementById('edit-poster-title-header');
        if (titleHeader) titleHeader.textContent = poster.title || posterId;
        
        // Setup changes summary tracking
        setupEditChangesSummary();
        
        // Show modal
        document.getElementById('edit-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        refreshEditModalUXState();
        
        // Setup delete button
        const deleteBtn = document.getElementById('delete-poster-btn');
        console.log('[Modal] Delete button found:', !!deleteBtn);
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                console.log('[Modal] Delete button clicked for poster:', posterId);
                deletePoster(posterId);
            };
        }
        
    } catch (error) {
        console.error('Error opening edit modal:', error);
        alert('Kan poster niet laden voor bewerken');
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('edit-form').reset();
    
    // Reset active layers to default (1 layer) for the create form
    // setActiveLayers([1]); // Removed as function is not defined
    renderLayers(false);
    // Herinjecteer API source UI voor upload formulier (renderLayers wist de container)
    for (let n = 1; n <= 8; n++) {
        injectApiSourceUI(n, '');
    }

    const editFocus = document.getElementById('edit-ux-focus-mode');
    const editForm = document.getElementById('edit-form');
    if (editFocus && editForm) {
        editFocus.value = 'all';
        editForm.dataset.editFocus = 'all';
    }
}

// Setup edit form submission
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const errorMsg = document.getElementById('edit-error');
            const successMsg = document.getElementById('edit-success');
            if (errorMsg) errorMsg.textContent = '';
            if (successMsg) successMsg.textContent = '';
            
            const posterIdEl = document.getElementById('edit-poster-id');
            if (!posterIdEl) {
                if (errorMsg) errorMsg.textContent = 'Poster ID not found';
                return;
            }
            
            const posterId = posterIdEl.value;
            const formData = new FormData();
            
            // Add text fields
            const titleEl = document.getElementById('edit-title');
            const descriptionEl = document.getElementById('edit-description');
            if (titleEl) formData.append('title', titleEl.value);
            if (descriptionEl) formData.append('description', descriptionEl.value);
            
            // Parse combined coordinates field
            const coordinatesEl = document.getElementById('edit-coordinates');
            const locationEl = document.getElementById('edit-location');
            const artikelLinkEl = document.getElementById('edit-artikel-link');
            
            let latitude = '';
            let longitude = '';
            if (coordinatesEl) {
                const coordinatesInput = coordinatesEl.value.trim();
                const parts = coordinatesInput.split(',').map(p => p.trim());
                if (parts.length === 2) {
                    latitude = parts[0];
                    longitude = parts[1];
                }
            }
            
            const location = locationEl ? locationEl.value : '';
            const artikelLink = artikelLinkEl ? artikelLinkEl.value : '';
            
            console.log('📝 Edit form data:', {
                title: titleEl ? titleEl.value : '',
                latitude: latitude
            });
            
            if (latitude) formData.append('latitude', latitude);
            if (longitude) formData.append('longitude', longitude);
            if (location) formData.append('location_description', location);
            if (artikelLink) formData.append('artikel_link', artikelLink);
            
            // AR camera feed instelling (checkbox: 1 = camera tonen, 0 = zwart)
            const editArCameraFeed = document.getElementById('edit-ar-camera-feed')?.checked ? '1' : '0';
            formData.append('ar_camera_feed', editArCameraFeed);
            
            // Add credits (JSON array)
            const credits = collectCredits('edit-credits-container');
            formData.append('credits', JSON.stringify(credits));
            
            // AR Layers (8 layers with positioning and animation)
            for (let i = 1; i <= 8; i++) {
                const layerImageEl = document.getElementById(`edit-layer-${i}-image`);
                const layerZEl = document.getElementById(`edit-layer-${i}-z`);
                
                // Base position and scale inputs
                const posXEl = document.getElementById(`edit-layer-${i}-pos-x`);
                const posYEl = document.getElementById(`edit-layer-${i}-pos-y`);
                const scaleEl = document.getElementById(`edit-layer-${i}-scale`);
                const rotXEl = document.getElementById(`edit-layer-${i}-rot-x`);
                const rotYEl = document.getElementById(`edit-layer-${i}-rot-y`);
                const rotZEl = document.getElementById(`edit-layer-${i}-rot-z`);
                
                // Animation inputs
                const animXEl = document.getElementById(`edit-layer-${i}-anim-x`);
                const animYEl = document.getElementById(`edit-layer-${i}-anim-y`);
                const animZEl = document.getElementById(`edit-layer-${i}-anim-z`);
                const animPosDurationEl = document.getElementById(`edit-layer-${i}-anim-pos-duration`);
                const animRotXEl = document.getElementById(`edit-layer-${i}-anim-rot-x`);
                const animRotYEl = document.getElementById(`edit-layer-${i}-anim-rot-y`);
                const animRotZEl = document.getElementById(`edit-layer-${i}-anim-rot-z`);
                const animRotDurationEl = document.getElementById(`edit-layer-${i}-anim-rot-duration`);
                const animRotOriginEl = document.getElementById(`edit-layer-${i}-anim-rot-origin`);
                const animScaleEl = document.getElementById(`edit-layer-${i}-anim-scale`);
                const animOpacityEl = document.getElementById(`edit-layer-${i}-anim-opacity`);
                const animScaleDurationEl = document.getElementById(`edit-layer-${i}-anim-scale-duration`);

                // Tekstlaag inputs
                const textEnabledEl = document.getElementById(`edit-layer-${i}-text-enabled`);
                const textRandomEl = document.getElementById(`edit-layer-${i}-text-random`);
                const textContentEl = document.getElementById(`edit-layer-${i}-text-content`);
                const textFontEl = document.getElementById(`edit-layer-${i}-text-font`);
                const textSizeEl = document.getElementById(`edit-layer-${i}-text-size`);
                const textAlignEl = document.getElementById(`edit-layer-${i}-text-align`);
                const textOffsetEl = document.getElementById(`edit-layer-${i}-text-offset-y`);
                const textColorEl = document.getElementById(`edit-layer-${i}-text-color`);
                const textOutlineColorEl = document.getElementById(`edit-layer-${i}-text-outline-color`);
                const textOutlineWidthEl = document.getElementById(`edit-layer-${i}-text-outline-width`);
                const textEffectEl = document.getElementById(`edit-layer-${i}-text-effect`);
                const text3DEl = document.getElementById(`edit-layer-${i}-text-3d`);
                const text3DDepthEl = document.getElementById(`edit-layer-${i}-text-3d-depth`);
                const text3DTiltXEl = document.getElementById(`edit-layer-${i}-text-3d-tilt-x`);
                const text3DTiltYEl = document.getElementById(`edit-layer-${i}-text-3d-tilt-y`);
                const text3DFloatPxEl = document.getElementById(`edit-layer-${i}-text-3d-float-px`);
                const textRandomFontEl = document.getElementById(`edit-layer-${i}-text-random-font`);
                const textRandomColorEl = document.getElementById(`edit-layer-${i}-text-random-color`);
                const textRandomOutlineEl = document.getElementById(`edit-layer-${i}-text-random-outline`);
                const textRandomEffectEl = document.getElementById(`edit-layer-${i}-text-random-effect`);
                const textRandom3DEl = document.getElementById(`edit-layer-${i}-text-random-3d`);
                const textRandomSizeEl = document.getElementById(`edit-layer-${i}-text-random-size`);
                const textRandomAlignEl = document.getElementById(`edit-layer-${i}-text-random-align`);
                
                // Skip if elements don't exist
                if (!layerImageEl || !layerZEl) {
                    continue;
                }
                
                let layerImage = layerImageEl.files[0];
                const layerZ = layerZEl.value;
                
                // Check of er een API-geselecteerde afbeelding is voor deze laag (edit modus)
                const editApiKey = `edit-layer-${i}`;
                const editApiData = apiLayerData[editApiKey];
                
                // Lees live DOM-waarden zodat handmatig getypte wijzigingen altijd meegestuurd worden
                const liveSourceEl = document.getElementById(`edit-layer-${i}-source`);
                const liveQueryEl = document.getElementById(`edit-layer-${i}-api-query`);
                const liveRandomEl = document.getElementById(`edit-layer-${i}-api-random`);
                const liveSource = liveSourceEl?.value || '';
                const liveQuery = (liveQueryEl?.value || '').trim();
                const liveIsRandom = liveRandomEl?.checked || false;
                const isApiRandom = (editApiData?.api_mode === 'random') ||
                                    (liveSource && liveSource !== 'manual' && liveIsRandom);
                
                if (isApiRandom) {
                    // RANDOM mode: geen bestand uploaden, enkel de zoekterm opslaan.
                    // Gebruik live DOM-waarden → vangt handmatig getypte query's op zonder ZOEK te klikken
                    const saveSource = liveSource || editApiData?.source || 'klipy';
                    const saveQuery = liveQuery !== '' ? liveQuery : (editApiData?.query || '');
                    formData.append(`layer_${i}_api_mode`, 'random');
                    formData.append(`layer_${i}_api_source`, saveSource);
                    formData.append(`layer_${i}_api_query`, saveQuery);
                } else if (editApiData && editApiData.type === '3d' && editApiData.uid) {
                    // Specifiek 3D model: sla UID op als api_mode=3d_model
                    formData.append(`layer_${i}_api_mode`, '3d_model');
                    formData.append(`layer_${i}_api_source`, 'sketchfab');
                    formData.append(`layer_${i}_api_query`, editApiData.uid);
                } else if (editApiData && editApiData.url) {
                    // Download de API content en voeg toe als bestand
                    try {
                        const proxyUrl = editApiData.source === 'klipy' 
                            ? `${API_URL}/verkeersborden/gif-proxy?url=${encodeURIComponent(editApiData.url)}`
                            : editApiData.url;
                        const imgResponse = await fetch(proxyUrl);
                        const blob = await imgResponse.blob();
                        const ext = blob.type.includes('gif') ? 'gif' : blob.type.includes('png') ? 'png' : 'jpg';
                        const apiFile = new File([blob], `api_${editApiData.source}_${i}.${ext}`, { type: blob.type });
                        formData.append(`layer_${i}_image`, apiFile);
                        formData.append(`layer_${i}_api_source`, editApiData.source);
                        formData.append(`layer_${i}_api_url`, editApiData.url);
                    } catch (apiErr) {
                        console.warn(`[Edit Layer ${i}] API afbeelding downloaden mislukt:`, apiErr);
                    }
                } else if (layerImage) {
                    // Handmatige upload (bestaand gedrag)
                    if (layerImage.type === 'image/gif') {
                        layerImage = await convertGifFileToMp4(layerImage, `edit_layer_${i}`);
                    } else {
                        layerImage = await prepareLayerImage(layerImage);
                    }
                    formData.append(`layer_${i}_image`, layerImage);
                }
                
                // Get exclusion filter checkbox
                const exclusionEl = document.getElementById(`edit-layer-${i}-exclusion`);
                const exclusion = exclusionEl ? (exclusionEl.checked ? '1' : '0') : '0';
                
                // Get transparent checkbox
                const transparentEl = document.getElementById(`edit-layer-${i}-transparent`);
                const transparent = transparentEl ? (transparentEl.checked ? '1' : '0') : '0';
                
                // Get background color
                const bgColorEl = document.getElementById(`edit-layer-${i}-bg-color`);
                const bgColor = bgColorEl ? bgColorEl.value : '#000000';
                
                // Get delete flag (hele laag)
                const deleteEl = document.getElementById(`edit-layer-${i}-delete`);
                const deleteFlag = deleteEl ? deleteEl.value : '0';
                
                // Get delete media flags (per media type)
                const deleteMediaEl = document.getElementById(`edit-layer-${i}-delete-media`);
                const deleteGlbEl = document.getElementById(`edit-layer-${i}-delete-glb`);
                const deleteAudioEl = document.getElementById(`edit-layer-${i}-delete-audio`);
                const deleteMedia = deleteMediaEl ? deleteMediaEl.value : '0';
                const deleteGlb = deleteGlbEl ? deleteGlbEl.value : '0';
                const deleteAudio = deleteAudioEl ? deleteAudioEl.value : '0';
                
                // Always send configuration (updates existing layer config)
                formData.append(`layer_${i}_z`, layerZ || '0');
                formData.append(`layer_${i}_exclusion`, exclusion);
                formData.append(`layer_${i}_transparent`, transparent);
                formData.append(`layer_${i}_bg_color`, bgColor);
                formData.append(`layer_${i}_delete`, deleteFlag);
                formData.append(`layer_${i}_delete_media`, deleteMedia);
                formData.append(`layer_${i}_delete_glb`, deleteGlb);
                formData.append(`layer_${i}_delete_audio`, deleteAudio);
                
                // Base position and scale
                formData.append(`layer_${i}_pos_x`, posXEl ? posXEl.value || '0' : '0');
                formData.append(`layer_${i}_pos_y`, posYEl ? posYEl.value || '0' : '0');
                formData.append(`layer_${i}_scale`, scaleEl ? scaleEl.value || '1.0' : '1.0');
                formData.append(`layer_${i}_rot_x`, rotXEl ? rotXEl.value || '0' : '0');
                formData.append(`layer_${i}_rot_y`, rotYEl ? rotYEl.value || '0' : '0');
                formData.append(`layer_${i}_rot_z`, rotZEl ? rotZEl.value || '0' : '0');
                
                // Animation params
                formData.append(`layer_${i}_anim_x`, animXEl ? animXEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_y`, animYEl ? animYEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_z`, animZEl ? animZEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_pos_duration`, animPosDurationEl ? animPosDurationEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_x`, animRotXEl ? animRotXEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_y`, animRotYEl ? animRotYEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_z`, animRotZEl ? animRotZEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_duration`, animRotDurationEl ? animRotDurationEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_origin`, animRotOriginEl ? animRotOriginEl.value || 'center' : 'center');
                formData.append(`layer_${i}_anim_scale`, animScaleEl ? animScaleEl.value || '1.0' : '1.0');
                formData.append(`layer_${i}_anim_opacity`, animOpacityEl ? animOpacityEl.value || '1.0' : '1.0');
                formData.append(`layer_${i}_anim_scale_duration`, animScaleDurationEl ? animScaleDurationEl.value || '0' : '0');

                // Tekstlaag payload
                const isTextEnabled = !!textEnabledEl?.checked;
                const isTextRandom = !!textRandomEl?.checked;
                const textSeed = parseInt(currentPosterData?.layers?.[`layer_${i}`]?.text_style_seed, 10) || (Date.now() + i);
                formData.append(`layer_${i}_text_enabled`, isTextEnabled ? '1' : '0');
                formData.append(`layer_${i}_text_random`, isTextRandom ? '1' : '0');
                formData.append(`layer_${i}_text_content`, textContentEl ? textContentEl.value || '' : '');
                formData.append(`layer_${i}_text_font_family`, textFontEl ? textFontEl.value || '"Bebas Neue", sans-serif' : '"Bebas Neue", sans-serif');
                formData.append(`layer_${i}_text_font_size`, textSizeEl ? textSizeEl.value || '96' : '96');
                formData.append(`layer_${i}_text_align`, textAlignEl ? textAlignEl.value || 'center' : 'center');
                formData.append(`layer_${i}_text_offset_y`, textOffsetEl ? textOffsetEl.value || '0.85' : '0.85');
                formData.append(`layer_${i}_text_color`, textColorEl ? textColorEl.value || '#ffffff' : '#ffffff');
                formData.append(`layer_${i}_text_outline_color`, textOutlineColorEl ? textOutlineColorEl.value || '#000000' : '#000000');
                formData.append(`layer_${i}_text_outline_width`, textOutlineWidthEl ? textOutlineWidthEl.value || '3' : '3');
                formData.append(`layer_${i}_text_effect`, textEffectEl ? textEffectEl.value || 'none' : 'none');
                formData.append(`layer_${i}_text_3d_effect`, text3DEl ? text3DEl.value || 'none' : 'none');
                formData.append(`layer_${i}_text_3d_depth`, text3DDepthEl ? text3DDepthEl.value || '3' : '3');
                formData.append(`layer_${i}_text_3d_tilt_x`, text3DTiltXEl ? text3DTiltXEl.value || '16' : '16');
                formData.append(`layer_${i}_text_3d_tilt_y`, text3DTiltYEl ? text3DTiltYEl.value || '0' : '0');
                formData.append(`layer_${i}_text_3d_float_px`, text3DFloatPxEl ? text3DFloatPxEl.value || '4' : '4');
                formData.append(`layer_${i}_text_random_font`, textRandomFontEl?.checked ? '1' : '0');
                formData.append(`layer_${i}_text_random_color`, textRandomColorEl?.checked ? '1' : '0');
                formData.append(`layer_${i}_text_random_outline`, textRandomOutlineEl?.checked ? '1' : '0');
                formData.append(`layer_${i}_text_random_effect`, textRandomEffectEl?.checked ? '1' : '0');
                formData.append(`layer_${i}_text_random_3d`, textRandom3DEl?.checked ? '1' : '0');
                formData.append(`layer_${i}_text_random_size`, textRandomSizeEl?.checked ? '1' : '0');
                formData.append(`layer_${i}_text_random_align`, textRandomAlignEl?.checked ? '1' : '0');
                formData.append(`layer_${i}_text_style_seed`, String(textSeed));
                
                // Per-laag AR extras: GLB model en audio
                const layerGlbEl = document.getElementById(`edit-layer-${i}-glb`);
                const layerAudioEl = document.getElementById(`edit-layer-${i}-audio`);
                
                if (layerGlbEl && layerGlbEl.files[0]) {
                    const glbFile = layerGlbEl.files[0];
                    if (glbFile.size > 10 * 1024 * 1024) {
                        if (errorMsg) errorMsg.textContent = `Laag ${i}: GLB model is te groot (max 10MB)`;
                        return;
                    }
                    formData.append(`layer_${i}_glb`, glbFile);
                }
                
                if (layerAudioEl && layerAudioEl.files[0]) {
                    const audioFile = layerAudioEl.files[0];
                    if (audioFile.size > 10 * 1024 * 1024) {
                        if (errorMsg) errorMsg.textContent = `Laag ${i}: Audio bestand is te groot (max 10MB)`;
                        return;
                    }
                    formData.append(`layer_${i}_audio`, audioFile);
                }
            }
            
            // Add files if provided
            const jpegEl = document.getElementById('edit-jpeg');
            const pdfMediumEl = document.getElementById('edit-pdf-medium');
            const pdfLargeEl = document.getElementById('edit-pdf-large');
            const arMarkerFileEl = document.getElementById('edit-ar-marker-file');
            
            const jpegFile = jpegEl ? jpegEl.files[0] : null;
            const pdfMediumFile = pdfMediumEl ? pdfMediumEl.files[0] : null;
            const pdfLargeFile = pdfLargeEl ? pdfLargeEl.files[0] : null;
            const arMarkerFile = arMarkerFileEl ? arMarkerFileEl.files[0] : null;
            
            if (jpegFile) formData.append('jpeg', jpegFile);
            if (pdfMediumFile) formData.append('pdfMedium', pdfMediumFile);
            if (pdfLargeFile) formData.append('pdfLarge', pdfLargeFile);
            if (arMarkerFile) {
                // Handmatig geüpload .mind bestand
                formData.append('ar_marker_file', arMarkerFile);
            } else if (jpegFile) {
                // Wacht op lopende edit compilatie als die nog bezig is
                if (editCompilingMindPromise) {
                    const editMindStatusEl = document.getElementById('edit-ar-marker-file-size-info');
                    if (editMindStatusEl) {
                        editMindStatusEl.textContent = 'Upload wacht op AR-marker compilatie...';
                        editMindStatusEl.style.color = 'rgba(255,200,0,0.8)';
                    }
                    try {
                        await editCompilingMindPromise;
                    } catch (e) {
                        console.warn('[MIND] Edit compilatie fout tijdens wachten:', e);
                    }
                }
                
                if (editCompiledMindBuffer) {
                    // Browser-gecompileerd .mind vanuit de nieuwe JPEG
                    const mindBlob = new Blob([editCompiledMindBuffer], { type: 'application/octet-stream' });
                    formData.append('ar_marker_file', mindBlob, 'auto_compiled.mind');
                    console.log('[MIND] Browser-gecompileerd .mind meegezonden met edit');
                } else {
                    console.warn('[MIND] Geen .mind beschikbaar voor edit - AR marker ongewijzigd');
                }
            }
            
            // Gallery images - verwijderen en toevoegen
            if (window.deleteGalleryImages && window.deleteGalleryImages.length > 0) {
                formData.append('delete_gallery_images', JSON.stringify(window.deleteGalleryImages));
                console.log('[Edit] Deleting gallery images:', window.deleteGalleryImages);
            }
            
            const editGalleryInput = document.getElementById('edit-gallery-images');
            if (editGalleryInput && editGalleryInput.files.length > 0) {
                console.log('[Edit] Adding gallery files:', editGalleryInput.files.length);
                const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                let hasInvalidFile = false;
                
                for (let i = 0; i < editGalleryInput.files.length; i++) {
                    const file = editGalleryInput.files[i];
                    const ext = file.name.split('.').pop().toLowerCase();
                    console.log(`[Edit] Gallery file ${i}: ${file.name} (${file.size} bytes, ext: ${ext})`);
                    
                    if (!allowedExtensions.includes(ext)) {
                        hasInvalidFile = true;
                        if (errorMsg) {
                            errorMsg.textContent = `Ongeldig bestandstype: ${file.name}. Gebruik JPG, PNG, GIF of WebP (geen HEIC/HEIF).`;
                        }
                        console.error(`[Edit] Invalid file type: ${ext}. HEIC is niet ondersteund - converteer naar JPG.`);
                        return; // Stop de upload
                    }
                    
                    formData.append('gallery_images[]', file);
                }
            } else {
                console.log('[Edit] No gallery files selected');
            }
            
            // Build summary of changes
            const changes = [];
            if (titleEl && titleEl.value) changes.push(`Titel: ${titleEl.value}`);
            if (jpegFile) changes.push(`Nieuwe JPEG: ${jpegFile.name}`);
            if (pdfMediumFile) changes.push(`Nieuwe PDF Medium: ${pdfMediumFile.name}`);
            if (pdfLargeFile) changes.push(`Nieuwe PDF Large: ${pdfLargeFile.name}`);
            if (arMarkerFile) changes.push(`Nieuwe AR Marker: ${arMarkerFile.name}`);
            
            // Count layer changes
            let layerChangesCount = 0;
            for (let i = 1; i <= 8; i++) {
                const layerImageEl = document.getElementById(`edit-layer-${i}-image`);
                if (layerImageEl && layerImageEl.files[0]) {
                    layerChangesCount++;
                    changes.push(`Nieuwe Layer ${i}: ${layerImageEl.files[0].name}`);
                }
                // Check voor GLB/audio per laag
                const layerGlbEl = document.getElementById(`edit-layer-${i}-glb`);
                const layerAudioEl = document.getElementById(`edit-layer-${i}-audio`);
                if (layerGlbEl && layerGlbEl.files[0]) {
                    changes.push(`Laag ${i} - Nieuw 3D Model: ${layerGlbEl.files[0].name}`);
                }
                if (layerAudioEl && layerAudioEl.files[0]) {
                    changes.push(`Laag ${i} - Nieuw Audio: ${layerAudioEl.files[0].name}`);
                }
            }
            
            // Show summary in success message area
            if (successMsg && changes.length > 0) {
                successMsg.innerHTML = `<strong>Aanpassingen:</strong><ul style="text-align: left; margin: 10px 0;">${changes.map(c => `<li>${c}</li>`).join('')}</ul>`;
            }
            
            // Calculate total size for progress
            let totalSize = 0;
            if (jpegFile) totalSize += jpegFile.size;
            if (pdfMediumFile) totalSize += pdfMediumFile.size;
            if (pdfLargeFile) totalSize += pdfLargeFile.size;
            if (arMarkerFile) totalSize += arMarkerFile.size;
            
            for (let i = 1; i <= 8; i++) {
                const layerImageEl = document.getElementById(`edit-layer-${i}-image`);
                if (layerImageEl && layerImageEl.files[0]) {
                    totalSize += layerImageEl.files[0].size;
                }
                
                const layerGlbEl = document.getElementById(`edit-layer-${i}-glb`);
                if (layerGlbEl && layerGlbEl.files[0]) {
                    totalSize += layerGlbEl.files[0].size;
                }
                
                const layerAudioEl = document.getElementById(`edit-layer-${i}-audio`);
                if (layerAudioEl && layerAudioEl.files[0]) {
                    totalSize += layerAudioEl.files[0].size;
                }
            }
            
            // Show progress bar if uploading files
            let progressContainer = document.getElementById('edit-upload-progress');
            if (!progressContainer) {
                progressContainer = document.createElement('div');
                progressContainer.id = 'edit-upload-progress';
                progressContainer.style.cssText = 'margin: 20px 0; display: none;';
                progressContainer.innerHTML = `
                    <div style="background: #f0f0f0; border-radius: 10px; overflow: hidden; height: 30px; position: relative;">
                        <div id="edit-progress-bar" style="background: linear-gradient(90deg, #4CAF50, #45a049); height: 100%; width: 0%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;"></div>
                    </div>
                    <p id="edit-progress-text" style="text-align: center; margin-top: 10px; font-size: 14px; color: #666;"></p>
                `;
                // Insert before the form-actions div
                const formActions = editForm.querySelector('.form-actions');
                if (formActions) {
                    editForm.insertBefore(progressContainer, formActions);
                } else {
                    // Fallback: append to end of form
                    editForm.appendChild(progressContainer);
                }
            }
            
            if (totalSize > 0) {
                progressContainer.style.display = 'block';
                const progressBar = document.getElementById('edit-progress-bar');
                const progressText = document.getElementById('edit-progress-text');
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';
                progressText.textContent = 'BEZIG MET UPLOADEN...';
            }
            
            try {
                const token = sessionStorage.getItem('adminToken');
                
                // Use XMLHttpRequest for progress tracking
                const xhr = new XMLHttpRequest();
                
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && totalSize > 0) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        const progressBar = document.getElementById('edit-progress-bar');
                        const progressText = document.getElementById('edit-progress-text');
                        if (progressBar) {
                            progressBar.style.width = percentComplete + '%';
                            progressBar.textContent = Math.round(percentComplete) + '%';
                        }
                        if (progressText) {
                            progressText.textContent = `${formatFileSize(e.loaded)} / ${formatFileSize(e.total)}`;
                        }
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        const progressContainer = document.getElementById('edit-upload-progress');
                        if (progressContainer) progressContainer.style.display = 'none';
                        if (successMsg) successMsg.innerHTML = '<strong style="color: #4CAF50;"> Poster succesvol bijgewerkt!</strong>';
                        setTimeout(() => {
                            closeEditModal();
                            loadAdminPosters();
                        }, 1500);
                    } else {
                        const progressContainer = document.getElementById('edit-upload-progress');
                        if (progressContainer) progressContainer.style.display = 'none';
                        
                        console.error('[Edit] HTTP Error:', xhr.status);
                        console.error('[Edit] Response Text:', xhr.responseText);
                        
                        let errorData;
                        try {
                            errorData = JSON.parse(xhr.responseText);
                        } catch (e) {
                            // Als JSON parse faalt, toon eerste 500 chars van response
                            console.error('[Edit] Could not parse response as JSON:', e);
                            errorData = { message: xhr.responseText.substring(0, 500) || 'Onbekende fout' };
                        }
                        if (errorMsg) errorMsg.textContent = `Update mislukt: ${errorData.message || 'Onbekende fout'}`;
                    }
                });
                
                xhr.addEventListener('error', () => {
                    const progressContainer = document.getElementById('edit-upload-progress');
                    if (progressContainer) progressContainer.style.display = 'none';
                    if (errorMsg) errorMsg.textContent = 'Upload mislukt. Controleer je verbinding.';
                });
                
                xhr.open('POST', `${API_URL}/admin/posters/${posterId}/update`);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.withCredentials = true;
                xhr.send(formData);
                
            } catch (error) {
                console.error('Update error:', error);
                const progressContainer = document.getElementById('edit-upload-progress');
                if (progressContainer) progressContainer.style.display = 'none';
                if (errorMsg) errorMsg.textContent = 'Update mislukt. Controleer je verbinding.';
            }
        };
    }
});

// Markeer gallery image voor verwijdering
function markGalleryForDelete(imgPath, btn) {
    if (!window.deleteGalleryImages) {
        window.deleteGalleryImages = [];
    }
    window.deleteGalleryImages.push(imgPath);
    
    // Verberg het item visueel
    const item = btn.closest('.gallery-item');
    if (item) {
        item.style.opacity = '0.3';
        item.style.textDecoration = 'line-through';
        btn.disabled = true;
        btn.textContent = '✓';
    }
}

// Make functions globally available
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.applyAnimPreset = applyAnimPreset;
window.deleteLayer = deleteLayer;
window.deleteLayerMedia = deleteLayerMedia;
window.toggleBgColorPicker = toggleBgColorPicker;
window.deletePoster = deletePoster;
window.markGalleryForDelete = markGalleryForDelete;

// Setup animation toggles for all layers
// document.addEventListener('DOMContentLoaded', () => {
//     setupAnimationToggles();
// });

function setupAnimationToggles() {
    // For create form layers (1-8)
    for (let i = 1; i <= 8; i++) {
        setupLayerAnimationToggle(i, false); // false = create form
    }
    
    // For edit form layers (1-8) - will be set up when modal opens
}

function setupLayerAnimationToggle(layerNum, isEditForm) {
    const prefix = isEditForm ? 'edit-' : '';
    const animContainer = document.getElementById(`${prefix}layer-${layerNum}-anim-container`);
    const enableCheckbox = document.getElementById(`${prefix}layer-${layerNum}-enable-anim`);
    
    if (!animContainer || !enableCheckbox) return;
    
    // Initial state based on checkbox
    animContainer.style.display = enableCheckbox.checked ? 'block' : 'none';
    
    // Toggle on checkbox change
    enableCheckbox.addEventListener('change', () => {
        animContainer.style.display = enableCheckbox.checked ? 'block' : 'none';
        
        // Reset values when disabling
        if (!enableCheckbox.checked) {
            const inputs = animContainer.querySelectorAll('input[type="number"]');
            inputs.forEach(input => {
                if (input.id.includes('scale') || input.id.includes('opacity')) {
                    input.value = '1.0';
                } else {
                    input.value = '0';
                }
            });
        }
    });
    
    // Setup AR Extras toggle for this layer
    setupLayerExtrasToggle(layerNum, isEditForm);
}

function setupTextRandomControls(layerNum, isEditForm) {
    const prefix = isEditForm ? 'edit-' : '';
    const master = document.getElementById(`${prefix}layer-${layerNum}-text-random`);
    if (!master) return;

    const specIds = [
        `${prefix}layer-${layerNum}-text-random-font`,
        `${prefix}layer-${layerNum}-text-random-color`,
        `${prefix}layer-${layerNum}-text-random-outline`,
        `${prefix}layer-${layerNum}-text-random-effect`,
        `${prefix}layer-${layerNum}-text-random-3d`,
        `${prefix}layer-${layerNum}-text-random-size`,
        `${prefix}layer-${layerNum}-text-random-align`,
    ];
    const specEls = specIds.map(id => document.getElementById(id)).filter(Boolean);

    master.addEventListener('change', () => {
        specEls.forEach(el => {
            el.checked = master.checked;
        });
        updatePreviewFromInputs();
    });
}

// Setup AR Extras (GLB/Audio) toggle per layer
function setupLayerExtrasToggle(layerNum, isEditForm) {
    const prefix = isEditForm ? 'edit-' : '';
    const extrasContainer = document.getElementById(`${prefix}layer-${layerNum}-extras-container`);
    const enableCheckbox = document.getElementById(`${prefix}layer-${layerNum}-enable-extras`);
    
    if (!extrasContainer || !enableCheckbox) return;
    
    // Initial state
    extrasContainer.style.display = enableCheckbox.checked ? 'block' : 'none';
    
    // Toggle on checkbox change
    enableCheckbox.addEventListener('change', () => {
        extrasContainer.style.display = enableCheckbox.checked ? 'block' : 'none';
    });
}

// Render all 8 layers by default (matching backup behavior)
function renderLayers(isEditForm = false) {
    const containerEl = document.getElementById(isEditForm ? 'edit-layers-container' : 'layers-container');
    if (!containerEl) return;
    
    containerEl.innerHTML = '';
    
    // Always render 8 layers
    for (let i = 1; i <= 8; i++) {
        containerEl.insertAdjacentHTML('beforeend', generateLayerHTML(i, isEditForm));
        setupLayerAnimationToggle(i, isEditForm);
        setupTextRandomControls(i, isEditForm);
    }

    if (!isEditForm) {
        refreshAdminUXState();
    } else {
        refreshEditModalUXState();
    }
}



// Initialize layers on page load
// document.addEventListener('DOMContentLoaded', () => {
//     renderLayers(false); // Create form layers
// });
