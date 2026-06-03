/**
 * Memeborden Module v2 - Belgische verkeersborden AR + GIF overlay
 * 
 * Multi-chunk versie: 55 borden verdeeld over 3 AR chunks (chunkA, chunkBC, chunkDEFZ).
 * Elke chunk heeft een eigen .mind bestand zodat niet alle 55 borden tegelijk geladen worden.
 * 
 * Dit bestand beheert:
 * - Laden van chunks.json met alle borden en chunk-verdeling
 * - Synthetische poster voor file manager (toont alle borden in slideshow)
 * - AR scene opbouw per chunk met MindAR targets
 * - GIF ophalen via Klipy API proxy bij target detectie
 * - Overlay weergave van geanimeerde GIFs op gedetecteerde borden
 */

// ==================== CONFIGURATIE ====================

const MEMEBORDEN_CONFIG = {
    // Poster metadata
    id: 'memeborden',
    title: 'MEMEBORDEN',
    description: 'Scan een Belgisch verkeersbord en ontdek de verborgen meme!',
    
    // Bestands-paden (multi-chunk: chunks.json bevat alle borden + .mind paden)
    dataFile: 'verkeersborden/data/chunks.json',
    imagesDir: 'verkeersborden/images/',
    
    // Cache-bust (wordt dynamisch gezet na laden chunks.json)
    cacheVer: '',

    // API endpoint
    gifEndpoint: '/api.php/verkeersborden/gif',
    
    // AR instellingen
    filterMinCF: 0.0001,
    filterBeta: 0.001,
    gifDisplaySize: 1.2,        // Grootte van GIF overlay in AR
    gifCooldownMs: 20000,       // 20 seconden cooldown
};

// ==================== DATA ====================

// Geladen chunk data (chunks.json)
let chunksData = null;        // Volledige chunks.json data
let allSignsFlat = null;      // Platte array van alle borden (voor gallery)
let signsLoaded = false;
let currentGifUrl = null;

// Actief chunk ID voor de huidige AR scene (bijv. 'chunkA')
let activeChunkId = null;

// Manuele GIF animatie loop (bypass A-Frame tick die niet altijd triggert)
let memeAnimFrame = null;
let activeGifComp = null;

// GIF cooldown cache: signId -> { url, timestamp }
// Eerste scan = random GIF. Binnen 20s opnieuw = zelfde GIF. Na 20s = nieuwe random GIF.
const gifCooldownCache = new Map();

// Als een GIF mislukt te laden, verwijder die URL uit de cache zodat de volgende detectie
// een verse GIF ophaalt bij Klipy i.p.v. de kapotte URL te hergebruiken
window.addEventListener('gif-error', (e) => {
    if (!e.detail || !e.detail.src) return;
    for (const [signId, cached] of gifCooldownCache.entries()) {
        if (cached.url === e.detail.src) {
            gifCooldownCache.delete(signId);
            console.log(`[Memeborden] Mislukte GIF verwijderd uit cache voor ${signId}, volgende detectie haalt verse GIF op`);
            break;
        }
    }
});

// ==================== DATA LADEN ====================

/**
 * Laad chunks.json met alle verkeersborden en chunk-verdeling.
 * Bouwt ook een platte array van alle borden voor de desktop gallery.
 * @returns {Promise<Array>} Platte array van alle sign objecten
 */
async function loadSignsData() {
    if (signsLoaded && allSignsFlat) return allSignsFlat;
    
    try {
        const response = await fetch(`${MEMEBORDEN_CONFIG.dataFile}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        chunksData = await response.json();
        MEMEBORDEN_CONFIG.cacheVer = chunksData._meta?.generated || Date.now();
        
        // Bouw platte array van alle borden met chunk info en targetIndex
        allSignsFlat = [];
        for (const chunk of chunksData.chunks) {
            chunk.signs.forEach((sign, index) => {
                allSignsFlat.push({
                    ...sign,
                    chunkId: chunk.id,
                    chunkName: chunk.name,
                    serie: chunk.serie,
                    serieName: chunk.name,
                    targetIndex: index  // targetIndex binnen de chunk (0-based)
                });
            });
        }
        
        signsLoaded = true;
        console.log(`[Memeborden] ${allSignsFlat.length} verkeersborden geladen over ${chunksData.chunks.length} chunks`);
        return allSignsFlat;
    } catch (e) {
        console.error('[Memeborden] Kon chunks data niet laden:', e);
        return [];
    }
}

/**
 * Geef de borden terug voor een specifieke chunk
 * @param {string} chunkId - De chunk ID (bijv. 'chunkA')
 * @returns {Array} Array van sign objecten voor die chunk
 */
function getSignsForChunk(chunkId) {
    if (!allSignsFlat) return [];
    return allSignsFlat.filter(s => s.chunkId === chunkId);
}

/**
 * Geef chunk metadata terug (uit chunks.json)
 * @param {string} chunkId - De chunk ID
 * @returns {Object|null} Chunk object met id, name, serie, description, mindFile
 */
function getChunkMeta(chunkId) {
    if (!chunksData || !chunksData.chunks) return null;
    return chunksData.chunks.find(c => c.id === chunkId) || null;
}

// ==================== SYNTHETISCHE POSTERS ====================

/**
 * Maak per chunk een apart synthetisch poster-object voor de file manager.
 * Elke poster toont enkel de borden van die chunk in de slideshow gallery,
 * zodat gebruikers weten welke borden ze moeten scannen per AR sessie.
 * @returns {Array<Object>} Array van poster objecten (1 per chunk)
 */
function createMemebordenPosters() {
    if (!chunksData || !chunksData.chunks) return [];

    const generatedRaw = chunksData?._meta?.generated || null;
    const generatedDate = generatedRaw
        ? (new Date(`${generatedRaw}T00:00:00Z`).toISOString())
        : '2024-01-01T00:00:00.000Z';
    
    return chunksData.chunks.map(chunk => {
        const chunkSigns = getSignsForChunk(chunk.id);
        const galleryImages = chunkSigns.map(s => `/${s.image}?v=${MEMEBORDEN_CONFIG.cacheVer}`);
        const chunkLabel = `MB ${chunk.id}`;
        
        return {
            id: `memeborden-${chunk.id}`,
            title: `MB ${chunk.id}`,
            description: `${chunk.name} (${chunk.signs.length} borden)`,
            location_description: 'Belgie, overal',
            created_at: generatedDate,
            upload_date: generatedDate,
            downloads: 0,
            thumbnail: galleryImages.length > 0 ? galleryImages[0] : 'img/placeholder.png',
            gallery_images: galleryImages,
            ar_marker: 'memeborden',    // Markeer als AR-enabled
            project: 'memeborden',
            isMemeborden: true,          // Speciale vlag voor herkenning
            memebordenChunkId: chunk.id, // Chunk ID voor AR scene koppeling
            memebordenChunkName: chunk.name,
            chunkKey: `memeborden-${chunk.id}`,
            chunkLabel,
            // Geen layers - Memeborden heeft dynamische GIF overlay
            layers: null,
            // Geen download bestanden
            jpeg_url: null,
            pdf_a3_url: null,
            pdf_a0_url: null,
        };
    });
}

// ==================== FILE MANAGER WINDOW ====================

/**
 * Genereer aangepaste window HTML voor Memeborden poster
 * Per-chunk versie: toont info specifiek voor de chunk van deze poster
 * @param {Object} poster - Het Memeborden poster object (met memebordenChunkId)
 * @returns {string} Terminal output HTML
 */
function getMemebordenTerminalHTML(poster) {
    const chunkId = poster.memebordenChunkId;
    const chunkMeta = chunkId ? getChunkMeta(chunkId) : null;
    const chunkSigns = chunkId ? getSignsForChunk(chunkId) : [];
    const totalSigns = allSignsFlat ? allSignsFlat.length : 0;
    
    // Bouw borden-lijst voor deze chunk
    let signsHTML = '';
    if (chunkSigns.length > 0) {
        signsHTML = chunkSigns.map(sign => {
            return `<div class="term-row"><span class="term-key">${sign.id}</span><span class="term-val">${sign.name}</span></div>`;
        }).join('');
    }
    
    const chunkName = chunkMeta ? chunkMeta.name : 'Onbekend';
    const chunkDesc = chunkMeta ? chunkMeta.description : '';
    
    return `
        <div class="term-line"><span class="term-prompt">$</span> cat ./${chunkId || 'memeborden'}.info</div>
        <div class="term-output">
            <div class="term-row"><span class="term-key">CHUNK</span><span class="term-val">${chunkName}</span></div>
            <div class="term-row"><span class="term-key">DESC</span><span class="term-val">${chunkDesc}</span></div>
            <div class="term-row"><span class="term-key">BORDEN</span><span class="term-val">${chunkSigns.length} van ${totalSigns} totaal</span></div>
            <div class="term-row"><span class="term-key">STATUS</span><span class="term-val term-ok">ONLINE</span></div>
        </div>
        <div class="term-line"><span class="term-prompt">$</span> ls ./borden/</div>
        <div class="term-output">
            ${signsHTML}
        </div>
        <div class="term-line"><span class="term-prompt">$</span> echo "Scan een van deze borden!"</div>
        <div class="term-output">
            <div class="term-row"><span class="term-val" style="color: #0f0;">Open op je telefoon en richt de camera op een bord uit deze chunk.</span></div>
        </div>
        <div class="term-line term-cursor"><span class="term-prompt">$</span> <span class="cursor">_</span></div>
    `;
}

// ==================== AR SCENE BUILDER ====================

/**
 * Bouw de Memeborden AR scene voor een specifieke chunk.
 * Elke target entity krijgt een <a-plane gif> kind dat geactiveerd wordt bij detectie.
 * 
 * @param {string} chunkId - De chunk ID (bijv. 'chunkA')
 * @returns {string} HTML string met A-Frame entities
 */
function buildMemebordenScene(chunkId) {
    const signs = getSignsForChunk(chunkId);
    
    if (!signs || signs.length === 0) {
        console.error(`[Memeborden] Geen signs data voor chunk ${chunkId}`);
        return '';
    }
    
    let entitiesHTML = '';
    signs.forEach((sign) => {
        // Elk bord krijgt een rode border plane + gif plane - initieel verborgen
        // targetIndex = positie binnen deze chunk (0-based)
        entitiesHTML += `
            <a-entity 
                mindar-image-target="targetIndex: ${sign.targetIndex}" 
                data-sign-id="${sign.id}"
                data-sign-name="${sign.name}"
                data-search-query="${sign.search_query || ''}"
                data-memeborden="true"
                data-chunk-id="${chunkId}">
                
                <!-- Dikke rode border (verkeersbord stijl) - iets groter dan de GIF plane -->
                <a-plane
                    data-meme-border="${sign.id}"
                    position="0 0 0.005"
                    width="1.4"
                    height="1.4"
                    color="#CC0000"
                    visible="false">
                </a-plane>
                
                <!-- GIF overlay plane - niet transparant, 110% marker breedte -->
                <a-plane
                    id="meme-gif-plane-${sign.id}"
                    data-meme-sign="${sign.id}"
                    position="0 0 0.01"
                    width="1.1"
                    height="1.1"
                    visible="false"
                    gif="autoplay: true; transparent: false">
                </a-plane>
            </a-entity>
        `;
    });
    
    return entitiesHTML;
}

/**
 * Laad de Memeborden AR scene voor een specifieke chunk.
 * Preloadt de .mind file en bouwt de A-Frame scene.
 * 
 * @param {string} chunkId - De chunk ID (bijv. 'chunkA', 'chunkBC', 'chunkDEFZ')
 *                           Als null/undefined, gebruik eerste chunk
 */
async function loadMemebordenARScene(chunkId) {
    // Zorg dat data geladen is
    await loadSignsData();
    
    // Bepaal welke chunk te laden
    if (!chunkId && chunksData && chunksData.chunks.length > 0) {
        chunkId = chunksData.chunks[0].id;
    }
    
    const chunkMeta = getChunkMeta(chunkId);
    if (!chunkMeta) {
        console.error(`[Memeborden] Chunk ${chunkId} niet gevonden`);
        return;
    }
    
    activeChunkId = chunkId;
    const signs = getSignsForChunk(chunkId);
    console.log(`[Memeborden] AR scene laden voor ${chunkId} (${signs.length} borden)...`);
    
    // Verwijder bestaande scene
    const existingScene = document.getElementById('ar-scene');
    if (existingScene) {
        existingScene.querySelectorAll('[gif]').forEach(el => {
            if (el.components && el.components.gif) {
                el.components.gif.isPlaying = false;
            }
        });
        existingScene.remove();
    }
    
    // Bepaal mind file URL (gebruik preloaded data indien beschikbaar)
    let imageTargetSrc;
    const manifestChunkIndex = getMemebordenManifestIndex(chunkId);
    
    if (manifestChunkIndex !== -1 && window.preloadedChunks && window.preloadedChunks[manifestChunkIndex]) {
        // Gebruik preloaded ArrayBuffer -> blob URL
        if (window._memebordenBlobUrl) {
            URL.revokeObjectURL(window._memebordenBlobUrl);
        }
        const blob = new Blob([window.preloadedChunks[manifestChunkIndex]], { type: 'application/octet-stream' });
        imageTargetSrc = URL.createObjectURL(blob);
        window._memebordenBlobUrl = imageTargetSrc;
        console.log(`[Memeborden] Blob URL vanuit preloaded data (manifest index ${manifestChunkIndex})`);
    } else {
        // Directe fetch met cache-bust
        imageTargetSrc = `${chunkMeta.mindFile}?v=${Date.now()}`;
        console.log(`[Memeborden] Directe URL: ${chunkMeta.mindFile}`);
    }
    
    const entitiesHTML = buildMemebordenScene(chunkId);
    
    const sceneHTML = `
        <a-scene
            id="ar-scene"
            mindar-image="imageTargetSrc: ${imageTargetSrc}; filterMinCF: ${MEMEBORDEN_CONFIG.filterMinCF}; filterBeta: ${MEMEBORDEN_CONFIG.filterBeta}; warmupTolerance: 0; missTolerance: 2;"
            color-space="sRGB"
            renderer="colorManagement: true; physicallyCorrectLights: true;"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false">
            
            <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
            <a-light type="ambient" color="#FFF" intensity="1.0"></a-light>
            
            ${entitiesHTML}
        </a-scene>
    `;
    
    document.body.insertAdjacentHTML('beforeend', sceneHTML);
    
    // Setup event listeners
    const scene = document.getElementById('ar-scene');
    setupMemebordenEventListeners(scene);
    
    console.log(`[Memeborden] AR scene geladen: ${chunkId} met ${signs.length} targets`);
}

// ==================== AR EVENT HANDLERS ====================

/**
 * Setup event listeners voor Memeborden AR targets
 * Elke target luistert naar targetFound/targetLost
 */
function setupMemebordenEventListeners(scene) {
    // AR gereed
    scene.addEventListener('arReady', () => {
        console.log('[Memeborden] AR Ready');
        
        // Verberg loader
        const loader = document.getElementById('arjs-loader');
        if (loader) loader.classList.add('hidden');
        
        // Pas video filter toe
        setTimeout(() => {
            document.querySelectorAll('video').forEach(v => {
                v.style.filter = 'grayscale(100%) contrast(2.5) brightness(1)';
                v.setAttribute('playsinline', 'true');
                v.setAttribute('webkit-playsinline', 'true');
                v.muted = true;
                if (v.paused) v.play().catch(() => {});
            });
        }, 200);
    });
    
    scene.addEventListener('arError', (e) => {
        console.error('[Memeborden] AR Error:', e.detail || e);
        const loader = document.getElementById('arjs-loader');
        if (loader) loader.classList.add('hidden');
    });
    
    // Luister naar alle targets
    const targets = scene.querySelectorAll('[data-memeborden="true"]');
    targets.forEach(target => {
        target.addEventListener('targetFound', () => {
            const signId = target.getAttribute('data-sign-id');
            const signName = target.getAttribute('data-sign-name');
            const searchQuery = target.getAttribute('data-search-query');
            
            console.log(`[Memeborden] Bord gevonden: ${signId} - ${signName}`);
            
            // Vergrendel chunk cycling en stop scan
            window.chunkLocked = true;
            window.isChunkScanning = false;
            if (typeof stopScanCycles === 'function') stopScanCycles('found');
            if (typeof hideChunkCycleButton === 'function') hideChunkCycleButton();

            // Track scan (eerste per sessie)
            if (!window._memeScannedIds) window._memeScannedIds = new Set();
            if (!window._memeScannedIds.has(signId)) {
                window._memeScannedIds.add(signId);
                fetch('/api.php/verkeersborden/scan/' + encodeURIComponent(signId), { method: 'POST' }).catch(() => {});
            }
            
            // Reveal AR scene met camera feed zichtbaar (geen zwarte achtergrond)
            if (typeof revealARScene === 'function') {
                revealARScene({ ar_camera_feed: 1 });
            }
            
            // Toon detected state in UI
            showMemebordenDetected(signId, signName);
            
            // Toon GIF op de <a-plane> binnen deze target entity (echte A-Frame AR)
            fetchAndDisplayGif(signId, searchQuery, target);
        });
        
        target.addEventListener('targetLost', () => {
            const signId = target.getAttribute('data-sign-id');
            console.log(`[Memeborden] Bord verloren: ${signId}`);
            
            // Ontgrendel chunk cycling
            window.chunkLocked = false;
            
            // Stop manuele GIF animatie
            stopManualGifAnimation();
            
            // Verberg GIF plane
            hideGifOverlay(target);
            
            // Verberg AR scene
            if (typeof hideARScene === 'function') {
                hideARScene();
            }
            
            // Reset detected state
            if (typeof hideDetectedPosterState === 'function') {
                hideDetectedPosterState();
            }
            
            // Toon scan knop
            if (typeof showChunkCycleButtonAgain === 'function') {
                showChunkCycleButtonAgain();
            }
        });
    });
}

// ==================== GIF OPHALEN & TONEN ====================

/**
 * Haal een random GIF op van Klipy en toon als A-Frame plane op het AR bord.
 * 20-seconden cooldown: eerste scan = random GIF, herscan binnen 20s = zelfde GIF,
 * herscan na 20s = nieuwe random GIF.
 */
async function fetchAndDisplayGif(signId, searchQuery, targetEntity) {
    if (!searchQuery) {
        console.warn(`[Memeborden] Geen zoekterm voor bord ${signId}`);
        return;
    }
    
    const apiUrl = window.API_URL || (window.location.origin + '/api.php');
    
    // Zoek plane binnen target entity
    const plane = targetEntity ? targetEntity.querySelector(`[data-meme-sign="${signId}"]`) : null;
    if (!plane) {
        console.warn(`[Memeborden] Geen plane gevonden voor ${signId}`);
        return;
    }
    
    // Check cooldown cache: hergebruik GIF als binnen 20 seconden
    const cached = gifCooldownCache.get(signId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp < MEMEBORDEN_CONFIG.gifCooldownMs)) {
        console.log(`[Memeborden] Cooldown actief voor ${signId}, hergebruik cached GIF`);
        plane.setAttribute('visible', 'true');
        activateGifOnPlane(plane, cached.url);
        return;
    }
    
    try {
        console.log(`[Memeborden] GIF ophalen voor "${searchQuery}"...`);
        
        const response = await fetch(`${apiUrl}/verkeersborden/gif?sign=${encodeURIComponent(signId)}&t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.success && data.gif && data.gif.url) {
            // Gebruik gif-proxy om CORS te omzeilen
            const proxyUrl = `${apiUrl}/verkeersborden/gif-proxy?url=${encodeURIComponent(data.gif.url)}`;
            currentGifUrl = proxyUrl;
            console.log(`[Memeborden] GIF via proxy: ${data.gif.url.substring(0, 60)}...`);
            
            // Cache de URL met timestamp voor cooldown systeem
            gifCooldownCache.set(signId, { url: proxyUrl, timestamp: Date.now() });
            
            // Maak plane zichtbaar en laad GIF
            plane.setAttribute('visible', 'true');
            activateGifOnPlane(plane, proxyUrl);
        } else {
            console.warn('[Memeborden] Geen GIF URL in response:', data);
        }
    } catch (e) {
        console.error(`[Memeborden] Fout bij ophalen GIF voor ${signId}:`, e);
    }
}

/**
 * Activeer GIF op een A-Frame plane via gif-component + manuele animatie loop.
 */
function activateGifOnPlane(plane, gifUrl) {
    stopManualGifAnimation();
    
    const loadViaComponent = () => {
        const gifComp = plane.components && plane.components.gif;
        if (gifComp) {
            gifComp.loadedSrc = null;
            gifComp.data.src = gifUrl;
            gifComp.data.transparent = false;
            gifComp.loadGif(gifUrl);
            console.log('[Memeborden] loadGif() aangeroepen');
            startManualGifAnimation(gifComp);
        } else {
            console.warn('[Memeborden] gif component nog niet klaar, retry...');
            setTimeout(loadViaComponent, 200);
        }
    };
    loadViaComponent();
}

// ==================== MANUELE GIF ANIMATIE ====================

/**
 * Start een requestAnimationFrame loop die de gif-component frames handmatig aanstuurt.
 * Bypassed A-Frame's tick systeem dat niet betrouwbaar triggert voor dynamisch geladen GIFs.
 */
function startManualGifAnimation(gifComp) {
    stopManualGifAnimation();
    activeGifComp = gifComp;
    let dimensionsUpdated = false;
    
    function animate() {
        if (!activeGifComp || activeGifComp !== gifComp) return;
        
        if (!gifComp.isLoaded || !gifComp.gifData || gifComp.gifData.frames.length <= 1) {
            memeAnimFrame = requestAnimationFrame(animate);
            return;
        }
        
        // Eenmalig: pas afmetingen aan op basis van GIF aspect ratio
        if (!dimensionsUpdated) {
            dimensionsUpdated = true;
            updateGifPlaneDimensions(gifComp);
        }
        
        // Koppel texture aan mesh (niet transparant)
        if (gifComp.texture) {
            const mesh = gifComp.el.getObject3D('mesh');
            if (mesh && mesh.material && mesh.material.map !== gifComp.texture) {
                mesh.material.map = gifComp.texture;
                mesh.material.transparent = false;
                mesh.material.needsUpdate = true;
                console.log('[Memeborden] Texture gekoppeld aan mesh');
            }
        }
        
        // Frame advance op basis van GIF delay timing
        const now = performance.now();
        const delay = gifComp.gifData.delays[gifComp.currentFrame] || 100;
        
        if (now - gifComp.lastFrameTime >= delay) {
            gifComp.lastFrameTime = now;
            const prevFrame = gifComp.currentFrame;
            gifComp.currentFrame = (gifComp.currentFrame + 1) % gifComp.gifData.frames.length;
            
            if (prevFrame === 0 && gifComp.currentFrame === 1) {
                console.log('[Memeborden] GIF animatie gestart!');
            }
            
            gifComp.drawFrame(gifComp.currentFrame);
            
            if (gifComp.texture) {
                gifComp.texture.needsUpdate = true;
            }
        }
        
        memeAnimFrame = requestAnimationFrame(animate);
    }
    
    memeAnimFrame = requestAnimationFrame(animate);
    console.log('[Memeborden] Manuele animatie loop gestart');
}

/**
 * Pas GIF plane en border afmetingen aan op basis van de originele GIF aspect ratio
 */
function updateGifPlaneDimensions(gifComp) {
    if (!gifComp.gifData) return;
    
    const el = gifComp.el;
    const signId = el.getAttribute('data-meme-sign');
    const parent = el.parentEl || el.parentNode;
    
    const gifWidth = 1.1;
    const ratio = gifComp.gifData.height / gifComp.gifData.width;
    const gifHeight = gifWidth * ratio;
    const borderPad = 0.18;
    
    el.setAttribute('width', gifWidth);
    el.setAttribute('height', gifHeight);
    
    if (parent && signId) {
        const border = parent.querySelector(`[data-meme-border="${signId}"]`);
        if (border) {
            border.setAttribute('width', gifWidth + borderPad);
            border.setAttribute('height', gifHeight + borderPad);
            border.setAttribute('visible', 'true');
        }
    }
    
    console.log(`[Memeborden] Afmetingen: ${gifWidth}x${gifHeight.toFixed(2)} (GIF ratio: ${ratio.toFixed(2)})`);
}

function stopManualGifAnimation() {
    if (memeAnimFrame) {
        cancelAnimationFrame(memeAnimFrame);
        memeAnimFrame = null;
    }
    activeGifComp = null;
}

function hideGifOverlay(targetEntity) {
    if (targetEntity) {
        const plane = targetEntity.querySelector('[id^="meme-gif-plane-"]');
        if (plane) {
            plane.setAttribute('visible', 'false');
            if (plane.components && plane.components.gif) {
                plane.components.gif.isPlaying = false;
            }
        }
        const border = targetEntity.querySelector('[data-meme-border]');
        if (border) {
            border.setAttribute('visible', 'false');
        }
    }
    currentGifUrl = null;
}

// ==================== UI HELPERS ====================

function showMemebordenDetected(signId, signName) {
    const posterInfo = document.getElementById('detected-poster-info');
    if (posterInfo) {
        posterInfo.innerHTML = `
            <div class="detected-title">MEMEBORD: ${signId}</div>
            <div class="detected-subtitle">${signName}</div>
        `;
        posterInfo.classList.add('visible');
    }
}

// ==================== MANIFEST HELPERS ====================

/**
 * Geeft de index terug van een specifieke memeborden chunk in het AR manifest.
 * @param {string} chunkId - De chunk ID (bijv. 'chunkA')
 * @returns {number} Manifest chunk index of -1
 */
function getMemebordenManifestIndex(chunkId) {
    if (!window.arManifest || !window.arManifest.chunks) return -1;
    return window.arManifest.chunks.findIndex(c => 
        c.isMemeborden === true && c.memebordenChunkId === chunkId
    );
}

/**
 * Geeft de eerste memeborden chunk index in het manifest
 * @returns {number} Index of -1
 */
function getMemebordenChunkIndex() {
    if (!window.arManifest || !window.arManifest.chunks) return -1;
    return window.arManifest.chunks.findIndex(c => c.isMemeborden === true);
}

/**
 * Check of een chunk in het manifest een Memeborden chunk is
 * @param {number} chunkIndex - De manifest chunk index
 * @returns {boolean}
 */
function isMemeBordenChunk(chunkIndex) {
    if (!window.arManifest || !window.arManifest.chunks) return false;
    const chunk = window.arManifest.chunks[chunkIndex];
    return chunk && chunk.isMemeborden === true;
}

/**
 * Geeft alle memeborden chunk entries terug voor het AR manifest.
 * Wordt aangeroepen door app.js bij het opbouwen van het manifest.
 * @returns {Array} Array van chunk entries voor het manifest
 */
function getMemebordenManifestChunks() {
    if (!chunksData || !chunksData.chunks) return [];
    
    return chunksData.chunks.map(chunk => ({
        file: chunk.mindFile,
        posterIds: [`memeborden-${chunk.id}`],
        isMemeborden: true,
        memebordenChunkId: chunk.id,
        memebordenChunkName: chunk.name,
        memebordenSignCount: chunk.signs.length
    }));
}

// ==================== INITIALISATIE ====================

/**
 * Initialiseer Memeborden module.
 * Laadt chunks.json en maakt per chunk een synthetische poster aan.
 * @returns {Promise<Array<Object>|null>} Array van poster objecten (1 per chunk) of null bij fout
 */
async function initMemeborden() {
    console.log('[Memeborden] Module initialiseren (v2 multi-chunk)...');
    
    await loadSignsData();
    
    if (!allSignsFlat || allSignsFlat.length === 0) {
        console.warn('[Memeborden] Geen verkeersborden data - module overgeslagen');
        return null;
    }
    
    const posters = createMemebordenPosters();
    console.log(`[Memeborden] ${posters.length} chunk-posters aangemaakt: ${allSignsFlat.length} borden, ${chunksData.chunks.length} chunks`);
    
    return posters;
}

// ==================== EXPORTS ====================

// Beschikbaar voor file-manager.js en app.js
window.MEMEBORDEN_CONFIG = MEMEBORDEN_CONFIG;
window.initMemeborden = initMemeborden;
window.loadMemebordenARScene = loadMemebordenARScene;
window.isMemeBordenChunk = isMemeBordenChunk;
window.getMemebordenChunkIndex = getMemebordenChunkIndex;
window.getMemebordenTerminalHTML = getMemebordenTerminalHTML;
window.getMemebordenManifestChunks = getMemebordenManifestChunks;
window.loadSignsData = loadSignsData;
