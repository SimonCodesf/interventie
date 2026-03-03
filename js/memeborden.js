/**
 * Memeborden Module - Belgische verkeersborden AR + GIF overlay
 * 
 * Dit bestand beheert de Memeborden functionaliteit:
 * - Synthetische poster voor file manager
 * - AR scene opbouw met verkeersborden .mind bestand
 * - GIF ophalen via Klipy API proxy bij target detectie
 * - Overlay weergave van GIFs op gedetecteerde borden
 */

// ==================== CONFIGURATIE ====================

const MEMEBORDEN_CONFIG = {
    // Poster metadata
    id: 'memeborden',
    title: 'MEMEBORDEN',
    description: 'Scan een Belgisch verkeersbord en ontdek de verborgen meme! 28 borden herkenbaar via AR.',
    
    // Bestands-paden
    mindFile: 'verkeersborden/signs-top30.mind',
    dataFile: 'verkeersborden/data/top30.json',
    imagesDir: 'verkeersborden/images/',
    
    // API endpoint
    gifEndpoint: '/api.php/verkeersborden/gif',
    
    // AR instellingen
    filterMinCF: 0.0001,
    filterBeta: 0.001,
    gifDisplaySize: 1.2,        // Grootte van GIF overlay in AR
    gifRefreshInterval: 8000,   // Nieuwe GIF elke 8 seconden
};

// ==================== DATA ====================

// Geladen sign data (top30.json)
let signsData = null;
let signsLoaded = false;
let currentGifUrl = null;
let gifRefreshTimer = null;

// ==================== SIGNS DATA LADEN ====================

/**
 * Laad verkeersborden data (top30.json)
 * @returns {Promise<Array>} Array van sign objecten
 */
async function loadSignsData() {
    if (signsLoaded && signsData) return signsData;
    
    try {
        const response = await fetch(`${MEMEBORDEN_CONFIG.dataFile}?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        signsData = data.signs || [];
        signsLoaded = true;
        console.log(`[Memeborden] ${signsData.length} verkeersborden geladen`);
        return signsData;
    } catch (e) {
        console.error('[Memeborden] Kon signs data niet laden:', e);
        return [];
    }
}

// ==================== SYNTHETISCHE POSTER ====================

/**
 * Maak een synthetisch poster-object voor de file manager
 * Wordt geïnjecteerd in window.allPosters
 * @returns {Object} Poster object compatible met file-manager.js
 */
function createMemebordenPoster() {
    // Bouw gallery images array van alle 28 borden
    const signs = signsData || [];
    const galleryImages = signs.map(s => `/${s.image}`);
    
    return {
        id: MEMEBORDEN_CONFIG.id,
        title: MEMEBORDEN_CONFIG.title,
        description: MEMEBORDEN_CONFIG.description,
        location_description: 'België, overal',
        created_at: new Date().toISOString(),
        downloads: 0,
        thumbnail: galleryImages.length > 0 ? galleryImages[0] : 'img/placeholder.png',
        gallery_images: galleryImages,
        ar_marker: 'memeborden', // Markeer als AR-enabled
        isMemeborden: true,      // Speciale vlag voor herkenning
        // Geen layers - Memeborden heeft dynamische GIF overlay
        layers: null,
        // Geen download bestanden
        jpeg_url: null,
        pdf_a3_url: null,
        pdf_a0_url: null,
    };
}

// ==================== FILE MANAGER WINDOW ====================

/**
 * Genereer aangepaste window HTML voor Memeborden poster
 * Vervangt de standaard download knoppen met borden-info
 * @param {Object} poster - Het Memeborden poster object
 * @returns {string} Terminal output HTML
 */
function getMemebordenTerminalHTML(poster) {
    const signCount = signsData ? signsData.length : 28;
    
    // Bouw serie-overzicht
    const series = {};
    if (signsData) {
        signsData.forEach(s => {
            if (!series[s.serie]) series[s.serie] = { name: s.serie_name, count: 0 };
            series[s.serie].count++;
        });
    }
    
    const seriesHTML = Object.entries(series).map(([code, info]) => 
        `<div class="term-row"><span class="term-key">SERIE_${code}</span><span class="term-val">${info.name} [${info.count}]</span></div>`
    ).join('');
    
    return `
        <div class="term-line"><span class="term-prompt">$</span> cat ./memeborden.info</div>
        <div class="term-output">
            <div class="term-row"><span class="term-key">PROJECT</span><span class="term-val">MEMEBORDEN v1.0</span></div>
            <div class="term-row"><span class="term-key">DESC</span><span class="term-val">Belgische verkeersborden + AR meme generator</span></div>
            <div class="term-row"><span class="term-key">BORDEN</span><span class="term-val">${signCount} herkenbare verkeersborden</span></div>
            <div class="term-row"><span class="term-key">LOC</span><span class="term-val">België, overal</span></div>
            <div class="term-row"><span class="term-key">STATUS</span><span class="term-val term-ok">ONLINE</span></div>
        </div>
        <div class="term-line"><span class="term-prompt">$</span> ls ./series/</div>
        <div class="term-output">
            ${seriesHTML}
        </div>
        <div class="term-line"><span class="term-prompt">$</span> echo "Scan een verkeersbord met je camera!"</div>
        <div class="term-output">
            <div class="term-row"><span class="term-val" style="color: #0f0;">Open deze pagina op je telefoon en richt de camera op een Belgisch verkeersbord.</span></div>
            <div class="term-row"><span class="term-val" style="color: #0f0;">Een random GIF verschijnt als overlay!</span></div>
        </div>
        <div class="term-line term-cursor"><span class="term-prompt">$</span> <span class="cursor">_</span></div>
    `;
}

// ==================== AR SCENE BUILDER ====================

/**
 * Bouw de Memeborden AR scene
 * Wordt aangeroepen vanuit loadChunkScene() wanneer het de Memeborden chunk is
 * @returns {string} A-Frame scene HTML
 */
function buildMemebordenScene() {
    if (!signsData || signsData.length === 0) {
        console.error('[Memeborden] Geen signs data beschikbaar voor AR scene');
        return '';
    }
    
    // Bouw entities voor elk verkeersbord (28 targets)
    let entitiesHTML = '';
    signsData.forEach((sign, index) => {
        entitiesHTML += `
            <a-entity 
                mindar-image-target="targetIndex: ${sign.targetIndex}" 
                data-sign-id="${sign.id}"
                data-sign-name="${sign.name}"
                data-search-query="${sign.search_query || ''}"
                data-memeborden="true">
                
                <!-- GIF overlay plane - begint onzichtbaar, wordt gevuld bij detectie -->
                <a-plane 
                    id="memebord-gif-${sign.id}"
                    position="0 0 0.05"
                    width="${MEMEBORDEN_CONFIG.gifDisplaySize}"
                    height="${MEMEBORDEN_CONFIG.gifDisplaySize}"
                    material="transparent: true; opacity: 0; side: double; shader: flat;"
                    visible="false">
                </a-plane>
                
                <!-- Laad-indicator (draaiende ring) -->
                <a-ring
                    id="memebord-loader-${sign.id}"
                    position="0 0 0.06"
                    radius-inner="0.15"
                    radius-outer="0.2"
                    color="#00ff00"
                    material="shader: flat;"
                    visible="false"
                    animation="property: rotation; from: 0 0 0; to: 0 0 360; dur: 1000; easing: linear; loop: true;">
                </a-ring>
            </a-entity>
        `;
    });
    
    return entitiesHTML;
}

/**
 * Laad de volledige Memeborden AR scene (vervangt chunk scene)
 * Preloadt de .mind file en bouwt de A-Frame scene
 */
async function loadMemebordenARScene() {
    console.log('[Memeborden] AR scene laden...');
    
    // Zorg dat signs data geladen is
    await loadSignsData();
    
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
    const memebordenChunkIndex = getMemebordenChunkIndex();
    
    if (memebordenChunkIndex !== -1 && window.preloadedChunks && window.preloadedChunks[memebordenChunkIndex]) {
        // Gebruik preloaded ArrayBuffer
        if (window._memebordenBlobUrl) {
            URL.revokeObjectURL(window._memebordenBlobUrl);
        }
        const blob = new Blob([window.preloadedChunks[memebordenChunkIndex]], { type: 'application/octet-stream' });
        imageTargetSrc = URL.createObjectURL(blob);
        window._memebordenBlobUrl = imageTargetSrc;
        console.log('[Memeborden] Blob URL aangemaakt vanuit preloaded data');
    } else {
        // Directe fetch
        imageTargetSrc = `${MEMEBORDEN_CONFIG.mindFile}?v=${Date.now()}`;
        console.log('[Memeborden] Directe URL gebruikt (niet preloaded)');
    }
    
    const entitiesHTML = buildMemebordenScene();
    
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
    
    console.log('[Memeborden] AR scene geladen met', signsData.length, 'targets');
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
            
            // Vergrendel chunk cycling
            window.chunkLocked = true;
            window.isChunkScanning = false;
            
            // Toon laad indicator
            const loaderRing = document.getElementById(`memebord-loader-${signId}`);
            if (loaderRing) loaderRing.setAttribute('visible', 'true');
            
            // Reveal AR scene (als die verborgen was)
            if (typeof revealARScene === 'function') {
                revealARScene(null);
            }
            
            // Toon detected state
            showMemebordenDetected(signId, signName);
            
            // Haal GIF op en toon
            fetchAndDisplayGif(signId, searchQuery);
            
            // Start GIF refresh timer
            startGifRefreshTimer(signId, searchQuery);
        });
        
        target.addEventListener('targetLost', () => {
            const signId = target.getAttribute('data-sign-id');
            console.log(`[Memeborden] Bord verloren: ${signId}`);
            
            // Ontgrendel chunk cycling
            window.chunkLocked = false;
            
            // Verberg GIF overlay
            hideGifOverlay(signId);
            
            // Stop refresh timer
            stopGifRefreshTimer();
            
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
 * Haal een random GIF op van Klipy en toon als AR overlay
 * @param {string} signId - Het verkeersbord ID (bijv. "A1a")
 * @param {string} searchQuery - De Engelse zoekterm voor Klipy
 */
async function fetchAndDisplayGif(signId, searchQuery) {
    if (!searchQuery) {
        console.warn(`[Memeborden] Geen zoekterm voor bord ${signId}`);
        return;
    }
    
    const apiUrl = window.API_URL || (window.location.origin + '/api.php');
    
    try {
        console.log(`[Memeborden] GIF ophalen voor "${searchQuery}"...`);
        
        const response = await fetch(`${apiUrl}/verkeersborden/gif?sign=${encodeURIComponent(signId)}&t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.success && data.gif && data.gif.url) {
            displayGifOverlay(signId, data.gif.url);
            currentGifUrl = data.gif.url;
            console.log(`[Memeborden] GIF geladen: ${data.gif.url.substring(0, 80)}...`);
        } else {
            console.warn('[Memeborden] Geen GIF URL in response:', data);
            // Toon fallback tekst of placeholder
            displayFallbackOverlay(signId);
        }
    } catch (e) {
        console.error(`[Memeborden] Fout bij ophalen GIF voor ${signId}:`, e);
        displayFallbackOverlay(signId);
    }
}

/**
 * Toon GIF als AR overlay op het gedetecteerde verkeersbord
 * @param {string} signId - Het verkeersbord ID
 * @param {string} gifUrl - URL van de GIF
 */
function displayGifOverlay(signId, gifUrl) {
    const plane = document.getElementById(`memebord-gif-${signId}`);
    const loaderRing = document.getElementById(`memebord-loader-${signId}`);
    
    if (!plane) return;
    
    // Preload de GIF afbeelding
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
        // Bereken aspect ratio
        const aspectRatio = this.width / this.height;
        let width = MEMEBORDEN_CONFIG.gifDisplaySize;
        let height = MEMEBORDEN_CONFIG.gifDisplaySize;
        
        if (aspectRatio > 1) {
            height = width / aspectRatio;
        } else {
            width = height * aspectRatio;
        }
        
        // Update plane dimensies
        plane.setAttribute('width', width.toFixed(3));
        plane.setAttribute('height', height.toFixed(3));
        
        // Stel GIF in als texture
        plane.setAttribute('material', `src: url(${gifUrl}); transparent: true; side: double; shader: flat; alphaTest: 0.1;`);
        plane.setAttribute('visible', 'true');
        plane.setAttribute('material', 'opacity', '1');
        
        // Verberg loader ring
        if (loaderRing) loaderRing.setAttribute('visible', 'false');
        
        console.log(`[Memeborden] GIF overlay zichtbaar: ${width.toFixed(1)}x${height.toFixed(1)}`);
    };
    img.onerror = function() {
        console.warn(`[Memeborden] GIF kon niet geladen worden: ${gifUrl}`);
        if (loaderRing) loaderRing.setAttribute('visible', 'false');
        displayFallbackOverlay(signId);
    };
    img.src = gifUrl;
}

/**
 * Toon een fallback overlay als er geen GIF beschikbaar is
 * @param {string} signId - Het verkeersbord ID
 */
function displayFallbackOverlay(signId) {
    const plane = document.getElementById(`memebord-gif-${signId}`);
    const loaderRing = document.getElementById(`memebord-loader-${signId}`);
    
    if (plane) {
        // Groene semi-transparante plane als fallback
        plane.setAttribute('material', 'color: #00ff00; transparent: true; opacity: 0.3; side: double; shader: flat;');
        plane.setAttribute('visible', 'true');
    }
    if (loaderRing) loaderRing.setAttribute('visible', 'false');
}

/**
 * Verberg GIF overlay wanneer target verloren gaat
 * @param {string} signId - Het verkeersbord ID
 */
function hideGifOverlay(signId) {
    const plane = document.getElementById(`memebord-gif-${signId}`);
    if (plane) {
        plane.setAttribute('visible', 'false');
        plane.setAttribute('material', 'opacity', '0');
    }
    currentGifUrl = null;
}

// ==================== GIF REFRESH TIMER ====================

/**
 * Start timer die periodiek een nieuwe GIF laadt
 * Zorgt voor variatie in de overlay (elke X seconden een nieuwe GIF)
 */
function startGifRefreshTimer(signId, searchQuery) {
    stopGifRefreshTimer(); // Stop eventuele bestaande timer
    
    gifRefreshTimer = setInterval(() => {
        console.log(`[Memeborden] GIF vernieuwen voor ${signId}...`);
        fetchAndDisplayGif(signId, searchQuery);
    }, MEMEBORDEN_CONFIG.gifRefreshInterval);
}

/**
 * Stop de GIF refresh timer
 */
function stopGifRefreshTimer() {
    if (gifRefreshTimer) {
        clearInterval(gifRefreshTimer);
        gifRefreshTimer = null;
    }
}

// ==================== UI HELPERS ====================

/**
 * Toon gedetecteerd bord info in de UI
 * @param {string} signId - Het verkeersbord ID
 * @param {string} signName - Naam van het bord
 */
function showMemebordenDetected(signId, signName) {
    // Gebruik bestaande detected poster state UI als die er is
    const posterInfo = document.getElementById('detected-poster-info');
    if (posterInfo) {
        posterInfo.innerHTML = `
            <div class="detected-title">MEMEBORD: ${signId}</div>
            <div class="detected-subtitle">${signName}</div>
        `;
        posterInfo.classList.add('visible');
    }
}

/**
 * Geeft de chunk index terug van de Memeborden chunk in het manifest
 * @returns {number} Chunk index of -1 als niet gevonden
 */
function getMemebordenChunkIndex() {
    if (!window.arManifest || !window.arManifest.chunks) return -1;
    return window.arManifest.chunks.findIndex(c => c.isMemeborden === true);
}

/**
 * Check of een chunk de Memeborden chunk is
 * @param {number} chunkIndex - De index van de chunk
 * @returns {boolean}
 */
function isMemeBordenChunk(chunkIndex) {
    if (!window.arManifest || !window.arManifest.chunks) return false;
    const chunk = window.arManifest.chunks[chunkIndex];
    return chunk && chunk.isMemeborden === true;
}

// ==================== INITIALISATIE ====================

/**
 * Initialiseer Memeborden module
 * Laadt signs data en maakt de synthetische poster aan
 * Wordt aangeroepen vanuit loadFilesFromPosters()
 */
async function initMemeborden() {
    console.log('[Memeborden] Module initialiseren...');
    
    await loadSignsData();
    
    if (!signsData || signsData.length === 0) {
        console.warn('[Memeborden] Geen verkeersborden data - module overgeslagen');
        return null;
    }
    
    const poster = createMemebordenPoster();
    console.log(`[Memeborden] Synthetische poster aangemaakt met ${signsData.length} borden in gallery`);
    
    return poster;
}

// ==================== EXPORTS ====================

// Beschikbaar voor file-manager.js en app.js
window.MEMEBORDEN_CONFIG = MEMEBORDEN_CONFIG;
window.initMemeborden = initMemeborden;
window.loadMemebordenARScene = loadMemebordenARScene;
window.isMemeBordenChunk = isMemeBordenChunk;
window.getMemebordenChunkIndex = getMemebordenChunkIndex;
window.getMemebordenTerminalHTML = getMemebordenTerminalHTML;
window.loadSignsData = loadSignsData;
