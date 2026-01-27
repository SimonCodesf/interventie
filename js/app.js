// Main.js - AR.js Version (iOS Compatible)
console.log('🚀 APP.JS LOADED - Start of file');

// ==================== SYSTEM LOADER LOGIC (DUTCH) ====================
const logQueue = [];
let isProcessingQueue = false;
let queueTimeout = null;

// Status indicator removed as per request
function updateLoaderStatus(status) {
    // No-op
}

function processLogQueue() {
    if (logQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }
    
    isProcessingQueue = true;
    const msg = logQueue.shift();
    const loaderContent = document.getElementById('loader-content');
    if (!loaderContent) return;
    
    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = `> ${msg}`;
    
    loaderContent.appendChild(line);
    loaderContent.scrollLeft = loaderContent.scrollWidth;
    
    while (loaderContent.children.length > 5) {
        loaderContent.removeChild(loaderContent.firstChild);
    }

    // Faster random delay (20ms - 400ms)
    const randomDelay = Math.floor(Math.random() * 380) + 20;
    queueTimeout = setTimeout(processLogQueue, randomDelay);
}

function logToLoader(msg, type = 'info') {
    // 1. Clean Emojis (Expanded Regex)
    msg = msg.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();

    // 2. Translate & Simplify (Dutch)
    if (msg.includes('Fetching posters')) { msg = 'POSTERS OPHALEN...'; }
    else if (msg.includes('Fetched')) msg = 'DATA GELADEN';
    else if (msg.includes('Switching to AR')) { msg = 'AR STARTEN...'; }
    else if (msg.includes('AR view displayed')) { msg = 'CAMERA ACTIEF'; }
    else if (msg.includes('WebGL available')) msg = 'GPU GEREED';
    else if (msg.includes('Found Chunk Manifest')) msg = 'MANIFEST GELADEN';
    else if (msg.includes('Legacy')) msg = 'LEGACY MODUS';
    else if (msg.includes('Starting AR.js')) msg = 'ENGINE STARTEN';
    else if (msg.includes('Poster detected')) { msg = 'GEVONDEN: ' + msg.split(':')[1].substring(0, 12) + '...'; }
    else if (msg.includes('Poster lost') || msg.includes('Target lost')) { msg = 'ZOEKEN...'; }
    else if (msg.includes('Video filter')) msg = 'FILTER ACTIEF';
    else if (msg.includes('WebGL cleanup')) msg = 'GEHEUGEN OPSCHONEN';
    else if (msg.includes('All GIFs already ready')) { msg = 'GIF BESTANDEN GEREED'; }
    else if (msg.includes('Pending GIF')) { msg = 'GIF LADEN...'; }
    else if (msg.includes('Waiting for GIFs')) { msg = 'WACHTEN OP DATA...'; }
    else if (msg.includes('Hiding loader')) { return; } 
    else if (msg.includes('SYSTEM_READY')) { msg = 'SYSTEEM GEREED'; }
    else if (msg.includes('AR scene hidden')) { return; } 
    else if (msg.includes('static feed')) { return; }
    else if (msg.includes('Applied grayscale')) { msg = 'FILTER TOEGEPAST'; }
    else if (msg.includes('Video filter observer')) { return; } // Noise
    else if (msg.includes('Camera requires HTTPS')) { msg = 'HTTPS VEREIST'; }
    else if (msg.includes('API Error')) { msg = 'API FOUT'; }
    else if (msg.includes('Cannot fetch')) { msg = 'VERBINDINGSFOUT'; }
    else if (msg.includes('No manifest found')) { msg = 'GEEN MANIFEST'; }
    else if (msg.includes('Using Legacy')) { msg = 'LEGACY MODUS'; }
    else if (msg.includes('Pre-compiling')) { msg = 'COMPILEREN...'; }
    else if (msg.includes('Target compiled')) { msg = 'TARGET GEREED'; }
    else if (msg.includes('Scanner rotation')) { return; } // Ignore verbose scanner logs
    else if (msg.includes('Switching target')) { msg = 'DOEL WISSELEN'; }
    // New translations
    else if (msg.includes('Starting scan')) { msg = 'SCAN STARTEN...'; }
    else if (msg.includes('Scan stopped')) { msg = 'SCAN GESTOPT'; }
    else if (msg.includes('Completed cycle')) { msg = 'CYCLUS VOLTOOID'; }
    else if (msg.includes('All scan cycles complete')) { msg = 'ALLE CYCLI VOLTOOID'; }
    else if (msg.includes('Created blob URL')) { return; } // Ignore
    else if (msg.includes('Quick switch error')) { msg = 'WISSEL FOUT'; }
    else if (msg.includes('Layer build')) { return; } // Ignore
    else if (msg.includes('Fixed')) { return; } // Ignore aspect ratio logs
    else if (msg.includes('MindAR ready')) { msg = 'AR ENGINE GEREED'; }
    else if (msg.includes('TARGET FOUND')) { msg = 'DOEL GEVONDEN'; }
    else if (msg.includes('TARGET LOST')) { msg = 'DOEL VERLOREN'; }
    else if (msg.includes('Layers updated')) { msg = 'LAGEN BIJGEWERKT'; }
    else if (msg.includes('Switching to poster')) { msg = 'WISSELEN NAAR POSTER'; }
    else if (msg.includes('Requesting camera permission')) { msg = 'CAMERA TOEGANG VRAGEN...'; }
    else if (msg.includes('Camera permission granted')) { msg = 'CAMERA TOEGANG VERLEEND'; }
    else if (msg.includes('Applying lens distortion')) { msg = 'LENS CORRECTIE...'; }
    else if (msg.includes('Adding MindAR image target')) { msg = 'AR DOEL TOEVOEGEN...'; }
    else if (msg.includes('Creating layers')) { msg = 'LAGEN AANMAKEN...'; }
    else if (msg.includes('MindAR target added')) { msg = 'AR DOEL TOEGEVOEGD'; }
    else if (msg.includes('Gallery ready')) { msg = 'GALERIJ GEREED'; }
    else if (msg.includes('Gallery CSS injected')) { return; }
    else if (msg.includes('DOM Content Loaded')) { msg = 'DOM GELADEN'; }
    else if (msg.includes('Detection Results')) { return; }
    else if (msg.includes('Starting AR mode')) { msg = 'AR MODUS STARTEN...'; }
    else if (msg.includes('Initializing Desktop Mode')) { msg = 'DESKTOP MODUS STARTEN...'; }
    else if (msg.includes('Loaded')) { msg = 'GELADEN'; }
    // Additional translations
    else if (msg.includes('Poster AR markers')) { return; } // Noise
    else if (msg.includes('Device Detection')) { msg = 'APPARAAT ANALYSE'; }
    else if (msg.includes('WebGL not supported')) { msg = 'GEEN WEBGL ONDERSTEUNING'; }
    else if (msg.includes('Upload to HTTPS')) { msg = 'HTTPS NODIG'; }
    else if (msg.includes('AR Support: WebGL available')) { msg = 'AR ONDERSTEUNING: OK'; }
    else if (msg.includes('Starting AR.js initialization')) { msg = 'AR ENGINE INITIALISEREN...'; }
    else if (msg.includes('Preloading all .mind files')) { msg = 'MARKERS VOORLADEN...'; }
    else if (msg.includes('Starting AR...')) { msg = 'AR STARTEN...'; }
    else if (msg.includes('Chunk AR Ready')) { msg = 'AR CHUNK GEREED'; }

    // 3. Filter out empty or irrelevant logs
    if (msg.length < 2) return;
    
    logQueue.push(msg.toUpperCase());
    
    if (!isProcessingQueue) {
        processLogQueue();
    }
}

function hideLoader() {
    // Just log ready, status updates automatically via queue/logic
    logToLoader("SYSTEEM GEREED");
}

// Hook console.log to feed the loader
const originalLog = console.log;
console.log = function(...args) {
    originalLog.apply(console, args);
    const msg = args.join(' ');
    // Filter for relevant keywords (replaced emoji check)
    const keywords = [
        'Fetching', 'Fetched', 'Switching', 'AR view', 'WebGL', 'Chunk', 'Legacy', 'Starting', 
        'Poster', 'Target', 'Video filter', 'GIF', 'Hiding', 'SYSTEM_READY', 'static feed', 
        'Applied grayscale', 'Camera', 'API', 'Cannot fetch', 'No manifest', 'Pre-compiling', 
        'Scanner', 'Scan', 'Completed', 'Created blob', 'Quick switch', 'Layer', 'Fixed', 
        'MindAR', 'TARGET', 'Layers', 'Requesting', 'Applying', 'Adding', 'Creating', 'Gallery', 
        'DOM', 'Detection', 'Initializing', 'Loaded', 'Device', 'Upload'
    ];
    
    if (keywords.some(k => msg.includes(k))) {
        logToLoader(msg);
    }
};

// API Configuration
const API_URL = window.location.origin + '/api.php'; // cPanel with PHP backend
const BASE_URL = window.location.origin; // Voor statische bestanden

// ==================== CREDITS HELPER ====================
// Parse credits en geef HTML terug voor weergave
function formatCredits(poster) {
    let creditItems = [];
    
    // Probeer eerst het nieuwe credits veld (JSON array)
    if (poster.credits) {
        try {
            let creditsArray = poster.credits;
            // Parse als het een string is
            if (typeof creditsArray === 'string') {
                creditsArray = JSON.parse(creditsArray);
            }
            // Check of het een array is met items
            if (Array.isArray(creditsArray) && creditsArray.length > 0) {
                creditItems = creditsArray.filter(c => c.item && c.owner);
            }
        } catch (e) {
            console.warn('Kon credits niet parsen:', e);
        }
    }
    
    // Fallback naar oud photographer_credit veld
    if (creditItems.length === 0 && poster.photographer_credit) {
        creditItems = [{ item: 'Foto', owner: poster.photographer_credit }];
    }
    
    if (creditItems.length === 0) return '';
    
    // Format als CREDITS sectie met items op één regel
    // Elk item in nowrap span zodat alleen bij | mag breken
    const creditLines = creditItems
        .map(c => `<span style="white-space:nowrap">${c.item}: ${c.owner}</span>`)
        .join(' | ');
    
    return `<div class="term-row"><span class="term-key">CREDITS</span><span class="term-val">${creditLines}</span></div>`;
}

// ==================== DEVICE DETECTION & AR INITIALIZATION ====================
let isMobileDevice = false;
let isARSupported = false;
window.allPosters = []; // Global array for AR tracking
let currentTrackedPoster = null;

// ==================== AUDIO PLAYBACK SYSTEEM ====================
let currentAudioElement = null; // Huidige audio element voor poster
let audioVolume = 0.5; // Standaard volume (0.0 - 1.0)

// Start audio playback voor een poster (per-laag audio)
function playPosterAudio(poster) {
    // Stop eventuele vorige audio
    stopPosterAudio();
    
    if (!poster || !poster.layers) {
        console.log(' Geen layers data beschikbaar voor deze poster');
        return;
    }
    
    // Zoek naar audio in de layers
    let audioFile = null;
    for (let i = 1; i <= 8; i++) {
        const layerData = poster.layers[`layer_${i}`];
        if (layerData && layerData.audio_file) {
            audioFile = layerData.audio_file;
            console.log(` Audio gevonden in laag ${i}:`, audioFile);
            break; // Gebruik eerste audio die gevonden wordt
        }
    }
    
    // Fallback naar poster-level audio (voor backwards compatibility)
    if (!audioFile && poster.audio_file) {
        audioFile = poster.audio_file;
    }
    
    if (!audioFile) {
        console.log(' Geen audio beschikbaar voor deze poster');
        return;
    }
    
    const audioPath = `uploads/ar-layers/${audioFile}`;
    console.log(' Audio starten:', audioPath);
    
    currentAudioElement = new Audio(audioPath);
    currentAudioElement.volume = audioVolume;
    currentAudioElement.loop = true; // Loop de audio
    
    // Speel af (met user gesture requirement handling)
    currentAudioElement.play().then(() => {
        console.log(' Audio speelt af:', poster.audio_file);
        logToLoader('AUDIO GESTART');
    }).catch(err => {
        console.log(' Audio autoplay geblokkeerd (user gesture vereist):', err);
        // Toon audio knop als fallback
        showAudioPlayButton(poster);
    });
}

// Stop huidige audio
function stopPosterAudio() {
    if (currentAudioElement) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
        currentAudioElement = null;
        console.log(' Audio gestopt');
    }
    hideAudioPlayButton();
}

// Toon audio play button (voor als autoplay geblokkeerd is)
function showAudioPlayButton(poster) {
    let btn = document.getElementById('ar-audio-play-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'ar-audio-play-btn';
        btn.innerHTML = '🔊 Speel Audio';
        btn.style.cssText = `
            position: fixed;
            bottom: 140px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10001;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border: 1px solid #af1d1f;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 14px;
            cursor: pointer;
        `;
        document.body.appendChild(btn);
    }
    btn.style.display = 'block';
    btn.onclick = () => {
        if (currentAudioElement) {
            currentAudioElement.play();
        } else {
            playPosterAudio(poster);
        }
        btn.style.display = 'none';
    };
}

// Helper: check of een poster GLB model heeft in een van de layers
function hasGLBInLayers(poster) {
    if (!poster || !poster.layers) return false;
    for (let i = 1; i <= 8; i++) {
        const layerData = poster.layers[`layer_${i}`];
        if (layerData && layerData.glb_model) {
            return true;
        }
    }
    // Fallback voor backwards compatibility
    return !!poster.glb_model;
}

// Helper: check of een poster audio heeft in een van de layers
function hasAudioInLayers(poster) {
    if (!poster || !poster.layers) return false;
    for (let i = 1; i <= 8; i++) {
        const layerData = poster.layers[`layer_${i}`];
        if (layerData && layerData.audio_file) {
            return true;
        }
    }
    // Fallback voor backwards compatibility
    return !!poster.audio_file;
}

// Verberg audio play button
function hideAudioPlayButton() {
    const btn = document.getElementById('ar-audio-play-btn');
    if (btn) btn.style.display = 'none';
}

// ==================== 3D MODEL INTERACTIVITEIT ====================
// Setup click handlers voor 3D modellen (per-laag GLB models)
function setupModelInteractivity() {
    // Zoek alle GLB modellen (per laag)
    const models = document.querySelectorAll('[id^="ar-glb-model"]');
    if (models.length === 0) {
        // Fallback: zoek naar oude single model ID
        const singleModel = document.getElementById('ar-glb-model');
        if (singleModel) {
            setupSingleModelInteractivity(singleModel);
        }
        return;
    }
    
    models.forEach(model => {
        setupSingleModelInteractivity(model);
    });
    
    console.log(` Model interactiviteit ingesteld voor ${models.length} model(len)`);
}

// Setup interactiviteit voor één GLB model
function setupSingleModelInteractivity(model) {
    const modelId = model.id;
    const baseScale = parseFloat(model.getAttribute('scale')?.x) || 0.3;
    
    // Toggle rotatie animatie bij klik
    model.addEventListener('click', function() {
        const currentAnim = model.getAttribute('animation__rotate');
        if (currentAnim) {
            // Stop rotatie
            model.removeAttribute('animation__rotate');
            // Eenmalige scale pulse
            model.setAttribute('animation__pulse', `property: scale; from: ${baseScale} ${baseScale} ${baseScale}; to: ${baseScale * 1.3} ${baseScale * 1.3} ${baseScale * 1.3}; dur: 300; dir: alternate; loop: 2`);
            console.log(` Model ${modelId} animatie gestopt`);
        } else {
            // Start rotatie weer
            model.setAttribute('animation__rotate', 'property: rotation; to: 0 360 0; dur: 10000; loop: true; easing: linear;');
            console.log(` Model ${modelId} animatie gestart`);
        }
    });
}

// Featured Poster Management (voor gescande poster in galerij)
let featuredPoster = null; // Momenteel geselecteerde gescande poster
let isFeaturedPosterOpen = false; // Of de galerij is geopend voor featured poster
let autoResetFeaturedPosterTimer = null; // Timer voor auto-reset als poster uit-gescanned

// Rotating scanner system - cycles through preloaded .mind data
// HIDDEN SCANNER: AR runs behind a static camera feed, revealed when poster found
let scannerInterval = null;
let scannerPaused = false;
let lastDetectedPosterIndex = -1;
const SCANNER_ROTATE_INTERVAL = 600; // ms between poster switches (optimized with blob URLs)

// HOT TARGET SWITCHING: Pre-compile all targets, switch which one is active
// This avoids creating/destroying WebGL contexts and MindAR controllers
let allCompiledTargets = []; // Array of {poster, controller, compiled: true/false}
let activeTargetIndex = 0;
let isCompiling = false;

// Parallel detection with multiple lightweight workers
let detectionWorkers = [];
const MAX_PARALLEL_CHECKS = 3; // Check 3 posters simultaneously

// Preloaded .mind file data for instant switching
let preloadedMindData = new Map();
let mindARController = null; // Reference to MindAR controller for direct access

// WebGL context management - prevents context overflow
let lastWebGLContext = null;
let webglContextCount = 0;
const MAX_WEBGL_CONTEXTS = 6; // Safe limit for mobile devices

// Static camera feed overlay (hides the flickering AR scene)
let staticCameraStream = null;
let arSceneHidden = true; // AR scene starts hidden behind static feed

// ==================== VIDEO FILTER OBSERVER ====================
// Automatically apply grayscale filter to ALL video elements
function setupVideoFilterObserver() {
    const applyFilter = (video) => {
        if (!video.dataset.filterApplied) {
            video.style.filter = 'grayscale(100%) contrast(2.5) brightness(1)';
            video.dataset.filterApplied = 'true';
            console.log(' Applied grayscale filter to video:', video.id || 'unnamed');
        }
    };
    
    // Apply to existing videos
    document.querySelectorAll('video').forEach(applyFilter);
    
    // Watch for new videos
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'VIDEO') {
                    applyFilter(node);
                }
                if (node.querySelectorAll) {
                    node.querySelectorAll('video').forEach(applyFilter);
                }
            });
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    console.log(' Video filter observer active');
}

// Force cleanup of WebGL contexts to prevent overflow
function cleanupWebGLContexts() {
    // Force garbage collection hint
    if (lastWebGLContext) {
        try {
            lastWebGLContext.getExtension('WEBGL_lose_context')?.loseContext();
        } catch (e) {
            // Ignore
        }
        lastWebGLContext = null;
    }
    
    // Track context count
    webglContextCount = Math.max(0, webglContextCount - 1);
    console.log(` WebGL cleanup (active contexts: ~${webglContextCount})`);
}

// Detect mobile device
function detectMobileDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent);
    
    console.log(' Device Detection:', {
        userAgent,
        isMobile,
        isTablet,
        result: isMobile || isTablet
    });
    
    return isMobile || isTablet;
}

// Check if browser supports WebGL for AR
function checkARSupport() {
    // Check for WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
        console.log('❌ WebGL not supported');
        return false;
    }
    
    // AR.js works on HTTP for development, but camera requires HTTPS in production
    const isHTTPS = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!isHTTPS && !isLocalhost) {
        console.log('⚠️ Camera requires HTTPS (or localhost) - current:', window.location.protocol);
        console.log('💡 Upload to HTTPS website for camera access');
    }
    
    console.log(' AR Support: WebGL available');
    return true;
}

// Initialize AR mode with AR.js
async function initializeARMode() {
    console.log(' Starting AR.js initialization...');
    
    try {
        // Fetch all posters from API
        console.log(' Fetching posters from API...');
        const response = await fetch(`${API_URL}/posters`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            try {
                const errorJson = JSON.parse(errorText);
                console.error('❌ API Error Details:', errorJson);
            } catch (e) {
                console.error('❌ Raw Error:', errorText);
            }
            throw new Error('Cannot fetch posters: ' + response.status);
        }
        
        window.allPosters = await response.json();
        console.log(' Fetched', window.allPosters.length, 'posters');
        console.log('📋 Poster AR markers:', window.allPosters.map(p => ({
            title: p.title,
            ar_marker: p.ar_marker || 'NO MARKER SET',
            id: p.id
        })));
        
        // Switch to AR view
        console.log(' Switching to AR view...');
        document.getElementById('desktop-view').style.display = 'none';
        document.getElementById('mobile-ar-view').style.display = 'flex';
        console.log(' AR view displayed');

        // Initialize UI controls immediately
        setupSwipeBarControls();
        injectGalleryStyles();
        
        // Start video filter observer to make all videos grayscale
        setupVideoFilterObserver();
        
        // Check for Chunk Manifest (New System)
        try {
            const manifestResp = await fetch('assets/chunks/manifest.json');
            if (manifestResp.ok) {
                const manifest = await manifestResp.json();
                console.log(' Found Chunk Manifest:', manifest);
                window.arManifest = manifest;
                window.useChunkSystem = true;
                
                // Initialize Chunk System
                initializeChunkAR();
                return;
            }
        } catch (e) {
            console.log('⚠️ No manifest found, falling back to legacy mode');
        }

        // === LEGACY MODE (Single Files) ===
        console.log('⚠️ Using Legacy Single-File Mode');
        
        // Filter posters that have a valid .mind file
        const postersWithMarkers = window.allPosters.filter(p => p.ar_marker);
        
        if (postersWithMarkers.length === 0) {
            alert('Geen posters met AR markers gevonden.');
            return;
        }
        
        // Validate all .mind files exist and are valid
        const validPosters = [];
        for (const poster of postersWithMarkers) {
            const mindPath = poster.ar_marker + '.mind';
            try {
                const testFetch = await fetch(mindPath, { method: 'HEAD' });
                if (testFetch.ok) {
                    validPosters.push({ ...poster, mindPath });
                }
            } catch (e) {}
        }
        
        if (validPosters.length === 0) {
            alert('Geen geldige .mind bestanden gevonden.');
            return;
        }
        
        // Store valid posters for AR tracking
        window.arPosters = validPosters;
        
        // PRELOAD all .mind files into memory for instant switching
        console.log(' Preloading all .mind files...');
        for (const poster of validPosters) {
            try {
                const response = await fetch(poster.mindPath);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    preloadedMindData.set(poster.id, {
                        poster: poster,
                        data: arrayBuffer,
                        mindPath: poster.mindPath
                    });
                }
            } catch (e) {}
        }
        
        // Create blob URLs for faster loading during scanning
        createMindBlobUrls();
        
        // Pre-build all scene HTML for instant switching
        prebuildAllSceneHTML();
        
        // Use the FIRST poster's .mind file to start
        window.arMarkerPath = validPosters[0].mindPath;
        window.currentARPosterIndex = 0;
        
        // STEP 1: Create static camera feed overlay
        await initializeStaticCameraFeed();
        
        // STEP 2: Initialize AR scene
        initializeARScene();
        
        // Show SCAN button
        if (validPosters.length > 1) {
            setTimeout(() => showScanButton(), 2000);
        }
        
    } catch (error) {
        console.error('❌ AR initialization failed:', error);
        showDesktopView();
        initFileManager();
        setupModal();
    }
}

// Initialize AR with Chunk System
async function initializeChunkAR() {
    console.log(' Initializing Chunk AR System');
    
    // Start with first chunk (nieuwste posters)
    window.currentChunkIndex = 0;
    window.chunkLocked = false; // True als we een poster gevonden hebben
    const firstChunk = window.arManifest.chunks[0];
    
    // Initialize static feed
    await initializeStaticCameraFeed();
    
    // Load first chunk scene (alleen de nieuwste 10 posters)
    loadChunkScene(0);
    
    // Toon chunk cycle knop als er meer dan 1 chunk is
    if (window.arManifest.chunks.length > 1) {
        showChunkCycleButton();
    }
    
    // Show Scan Button always (allows user to reset/scan)
    setTimeout(() => showScanButton('Scan'), 2000);
    
    // Failsafe: If AR doesn't become ready in 30 seconds, hide loader anyway
    setTimeout(() => {
        const loader = document.getElementById('arjs-loader');
        if (loader && !loader.classList.contains('hidden')) {
            console.warn('⚠️ AR init timeout (30s) - hiding loader');
            loader.classList.add('hidden');
        }
    }, 30000);
}

// Toon chunk scan knop
function showChunkCycleButton() {
    // Verwijder bestaande knop
    const existing = document.getElementById('chunk-cycle-btn');
    if (existing) existing.remove();
    
    // Add CSS animation voor spinner
    if (!document.getElementById('chunk-btn-style')) {
        const style = document.createElement('style');
        style.id = 'chunk-btn-style';
        style.innerHTML = `
            @keyframes spinLoader {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            #chunk-cycle-btn .spinner {
                display: inline-block;
                animation: spinLoader 1s linear infinite;
                margin-right: 4px;
            }
        `;
        document.head.appendChild(style);
    }
    
    const btn = document.createElement('button');
    btn.id = 'chunk-cycle-btn';
    btn.innerHTML = 'SCAN';
    btn.style.cssText = `
        position: fixed;
        bottom: 120px;
        left: 50%;
        z-index: 10000;
        background: transparent;
        color: #fff;
        border: 0.5px solid #fff;
        border-radius: 0;
        padding: 6px 12px;
        font-family: 'Roboto', sans-serif;
        font-size: 11px;
        letter-spacing: 2px;
        cursor: pointer;
    `;
    
    btn.onclick = startChunkScan;
    document.body.appendChild(btn);
}

// Verberg chunk knop
function hideChunkCycleButton() {
    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) btn.style.display = 'none';
}

// Toon chunk knop
function showChunkCycleButtonAgain() {
    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) btn.style.display = 'block';
}

// Start chunk scan - cycle door chunks tot poster gevonden
function startChunkScan() {
    if (window.chunkLocked) {
        console.log('Chunk vergrendeld - poster gevonden');
        return;
    }
    
    const totalChunks = window.arManifest.chunks.length;
    const btn = document.getElementById('chunk-cycle-btn');
    
    // Als er maar 1 chunk is, reload gewoon
    if (totalChunks === 1) {
        console.log('Single chunk - reloading');
        if (btn) {
            btn.innerHTML = `<span class="spinner">◐</span> 1/1`;
        }
        loadChunkScene(0);
        setTimeout(() => {
            if (btn) btn.innerHTML = 'SCAN';
        }, 2000);
        return;
    }
    
    // Start scan cycle
    window.isChunkScanning = true;
    let currentChunk = 0;
    
    const updateScanDisplay = () => {
        if (btn) {
            btn.innerHTML = `<span class="spinner">◐</span> ${currentChunk + 1}/${totalChunks}`;
        }
    };
    
    updateScanDisplay();
    
    const scanNextChunk = () => {
        if (!window.isChunkScanning || window.chunkLocked) {
            // Stop scanning
            if (btn) btn.innerHTML = 'SCAN';
            return;
        }
        
        // Stap naar volgende chunk
        currentChunk++;
        
        // Stop na alle chunks gescand
        if (currentChunk >= totalChunks) {
            window.isChunkScanning = false;
            if (btn) btn.innerHTML = 'SCAN';
            console.log('Alle chunks gescand');
            return;
        }
        
        // Laad volgende chunk
        console.log(`Scanning chunk ${currentChunk + 1}/${totalChunks}`);
        window.currentChunkIndex = currentChunk;
        updateScanDisplay();
        loadChunkScene(currentChunk);
        
        // Wacht 3 seconden voor detectie, dan volgende
        setTimeout(scanNextChunk, 3000);
    };
    
    // Start met huidige chunk, dan volgende na 3 sec
    setTimeout(scanNextChunk, 3000);
}

// Load a specific chunk scene
function loadChunkScene(chunkIndex) {
    const chunk = window.arManifest.chunks[chunkIndex];
    if (!chunk) return;
    
    console.log(` Loading Chunk ${chunkIndex}: ${chunk.file}`);
    
    // Remove existing scene
    const existingScene = document.getElementById('ar-scene');
    if (existingScene) existingScene.remove();
    
    // Build entities for all posters in this chunk
    let entitiesHTML = '';
    chunk.posterIds.forEach((posterId, targetIndex) => {
        const poster = window.allPosters.find(p => p.id === posterId);
        if (poster) {
            const layersHTML = buildLayersHTML(poster);
            entitiesHTML += `
                <a-entity mindar-image-target="targetIndex: ${targetIndex}" data-poster-id="${poster.id}">
                    ${layersHTML}
                </a-entity>
            `;
        }
    });
    
    const sceneHTML = `
        <a-scene
            id="ar-scene"
            mindar-image="imageTargetSrc: assets/chunks/${chunk.file}; filterMinCF: 0.0001; filterBeta: 0.001; warmupTolerance: 0; missTolerance: 2;"
            color-space="sRGB"
            renderer="colorManagement: true; physicallyCorrectLights: true;"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false">
            
            <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

            <a-light type="ambient" color="#FFF" intensity="1.2"></a-light>
            <a-light type="directional" color="#FFF" intensity="0.8" position="-0.5 1 1"></a-light>
            
            ${entitiesHTML}
        </a-scene>
    `;
    
    document.body.insertAdjacentHTML('beforeend', sceneHTML);
    
    // Setup listeners
    const scene = document.getElementById('ar-scene');
    setupChunkEventListeners(scene, chunk);
}

// Setup listeners for Chunk System
function setupChunkEventListeners(scene, chunk) {
    // Error handling voor MindAR
    scene.addEventListener('arError', (e) => {
        console.error('❌ AR Error:', e.detail || e);
        // Hide loader on error
        const loader = document.getElementById('arjs-loader');
        if (loader) loader.classList.add('hidden');
    });
    
    scene.addEventListener('arReady', () => {
        console.log(' Chunk AR Ready');
        fixLayerAspectRatios();
        
        // Hide loader
        const loader = document.getElementById('arjs-loader');
        if (loader) loader.classList.add('hidden');
        
        // Apply video filter and force playsinline for iOS
        setTimeout(() => {
            document.querySelectorAll('video').forEach((v) => {
                // Filter
                v.style.filter = 'grayscale(100%) contrast(2.5) brightness(1)';
                
                // Force iOS inline playback
                v.setAttribute('playsinline', 'true');
                v.setAttribute('webkit-playsinline', 'true');
                v.muted = true;
                
                // Try to play if paused
                if (v.paused) {
                    v.play().catch(e => console.log('Autoplay prevented:', e));
                }
            });
        }, 200);
    });
    
    // Listen for ANY target found
    const targets = scene.querySelectorAll('[mindar-image-target]');
    targets.forEach(target => {
        target.addEventListener('targetFound', (e) => {
            const posterId = target.getAttribute('data-poster-id');
            const poster = window.allPosters.find(p => p.id === posterId);
            console.log(` Found poster: ${poster?.title}`);
            
            // Vergrendel deze chunk - we hebben een poster gevonden!
            window.chunkLocked = true;
            window.isChunkScanning = false; // Stop chunk scan
            hideChunkCycleButton();
            
            revealARScene();
            stopScanCycles('found');
            
            currentTrackedPoster = poster;
            showDetectedPosterState(poster);
            
            // Set featured poster voor galerij weergave (KRITIEK!)
            if (poster) {
                setFeaturedPoster(poster);
                console.log('⭐ Featured poster set in rotating scanner:', poster.title);
            }
            
            // LAZY LOAD GIFs: Laad nu pas de GIFs voor deze specifieke target
            loadLazyGifsForTarget(target);
            
            // Check if we need to show loader for GIFs
            checkAndShowLoader(poster);
        });
        
        target.addEventListener('targetLost', () => {
            console.log(' Target lost');
            hideARScene();
            hideDetectedPosterState();
            
            // Ontgrendel chunk - gebruiker kan weer cyclen
            window.chunkLocked = false;
            showChunkCycleButtonAgain();
            
            // UNLOAD GIFs: Verwijder GIF shaders om geheugen vrij te maken
            unloadLazyGifsForTarget(target);
            
            currentTrackedPoster = null;
            showScanButton('↻ Scan een andere poster');
            hideGifLoader(); // Always hide loader when target lost
            
            // Reset featured poster ALLEEN als galerij NIET geopend is
            // Anders blijft featured poster zichtbaar totdat galerij sluit
            if (!isFeaturedPosterOpen) {
                console.log('📋 Galerij gesloten: featured poster reset');
                featuredPoster = null;
            } else {
                console.log('📋 Galerij geopend: featured poster blijft getoond totdat galerij sluit');
            }
        });
    });
}

/**
 * LAZY LOAD GIFs: Nu niet meer nodig - GIFs worden als normale images geladen
 * Behouden voor backwards compatibility
 */
function loadLazyGifsForTarget(target) {
    // GIFs worden nu als <a-image> geladen, geen lazy loading nodig
    console.log('[GIF] GIFs worden als normale images geladen (geen lazy loading)');
}

/**
 * UNLOAD GIFs: Nu niet meer nodig - GIFs zijn normale images
 * Behouden voor backwards compatibility  
 */
function unloadLazyGifsForTarget(target) {
    // GIFs zijn nu normale images, geen speciale cleanup nodig
    console.log('[GIF] GIF cleanup niet nodig (normale images)');
}

function checkAndShowLoader(poster) {
    if (!poster || !poster.layers) return;
    
    let hasGifLayer = false;
    let allGifsLoaded = true;
    
    // First, check if there are any GIF layers at all
    for (let i = 1; i <= 8; i++) {
        const layer = poster.layers[`layer_${i}`];
        if (layer && layer.filename && layer.filename.endsWith('.gif')) {
            hasGifLayer = true;
            const filename = layer.filename;
            const isLoaded = Array.from(loadedGifs).some(src => src.includes(filename));
            
            if (!isLoaded) {
                allGifsLoaded = false;
                console.log(` Pending GIF: ${filename}`);
            }
        }
    }
    
    if (hasGifLayer) {
        // Always show loader initially for effect and feedback
        showGifLoader();
        
        if (allGifsLoaded) {
            console.log(' All GIFs already ready. Hiding loader shortly...');
            // Give a small delay so the user sees the "Decrypting" effect
            setTimeout(() => {
                // Only hide if we are still tracking the same poster
                if (currentTrackedPoster && currentTrackedPoster.id === poster.id) {
                    hideGifLoader();
                }
            }, 800);
        } else {
            console.log(' Waiting for GIFs to load...');
            
            // Failsafe: Hide loader after 3 seconden (GIFs zijn klein, zou snel moeten zijn)
            setTimeout(() => {
                if (currentTrackedPoster && currentTrackedPoster.id === poster.id) {
                    console.warn('⚠️ GIF load timeout - hiding loader anyway');
                    hideGifLoader();
                }
            }, 3000);
        }
    }
}

function checkAndHideLoader(poster) {
    if (!poster || !poster.layers) {
        hideGifLoader();
        return;
    }
    
    let allLoaded = true;
    
    for (let i = 1; i <= 8; i++) {
        const layer = poster.layers[`layer_${i}`];
        if (layer && layer.filename && layer.filename.endsWith('.gif')) {
            const filename = layer.filename;
            const isLoaded = Array.from(loadedGifs).some(src => src.includes(filename));
            
            if (!isLoaded) {
                allLoaded = false;
                break;
            }
        }
    }
    
    if (allLoaded) {
        hideGifLoader();
    }
}

// Chunk Scanning Logic
function startChunkScan() {
    if (isScanning) return;
    isScanning = true;
    
    // Hide button, show progress
    const scanBtn = document.getElementById('scan-button');
    const progressContainer = document.querySelector('.scan-progress-container');
    if (scanBtn) scanBtn.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'flex';
    
    // Rotate through chunks
    let chunkIndex = window.currentChunkIndex;
    const totalChunks = window.arManifest.chunks.length;
    
    // If only 1 chunk, just reload it once to "reset" and show progress
    if (totalChunks === 1) {
        console.log(' Single chunk reset/scan');
        loadChunkScene(0);
        updateScanningIndicator(null, 0, 1);
        
        // Show "Scanning..." for 2 seconds then stop
        setTimeout(() => {
            stopScanCycles('complete');
            showScanButton('Scan');
        }, 2000);
        return;
    }
    
    const nextChunk = () => {
        if (!isScanning) return;
        
        chunkIndex = (chunkIndex + 1) % totalChunks;
        window.currentChunkIndex = chunkIndex;
        
        loadChunkScene(chunkIndex);
        updateScanningIndicator(null, chunkIndex, totalChunks);
        
        // Wait 5 seconds then switch
        scannerInterval = setTimeout(nextChunk, 5000);
    };
    
    // Start rotation
    scannerInterval = setTimeout(nextChunk, 5000);
}


// Show the SCAN button with optional custom text
function showScanButton(text = 'Scan een poster') {
    updateScanningIndicator(null, 0, 1);
    // Update button text
    const scanBtn = document.getElementById('scan-button');
    if (scanBtn) {
        scanBtn.textContent = text;
    }
}

// ==================== STATIC CAMERA FEED SYSTEM ====================
// Creates a static camera feed that overlays the AR scene
// This hides the flickering from MindAR scene switches
// When a poster is detected, we fade out the static feed to reveal AR content

async function initializeStaticCameraFeed() {
    console.log('📹 Initializing static camera feed overlay...');
    
    try {
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        
        staticCameraStream = stream;
        
        // Create static video element overlay
        const staticVideo = document.createElement('video');
        staticVideo.id = 'static-camera-feed';
        staticVideo.srcObject = stream;
        staticVideo.setAttribute('playsinline', '');
        staticVideo.setAttribute('autoplay', '');
        staticVideo.muted = true;
        staticVideo.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            object-fit: cover;
            z-index: 9997;
            filter: grayscale(100%) contrast(2.5) brightness(1);
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;
        
        document.body.appendChild(staticVideo);
        await staticVideo.play();
        
        console.log(' Static camera feed ready (overlay for hidden AR scanner)');
        arSceneHidden = true;
        
    } catch (error) {
        console.warn('⚠️ Could not create static camera feed:', error);
        // Continue without static feed - user will see some flicker
        arSceneHidden = false;
    }
}

// Reveal the AR scene (hide static feed) - called when poster detected
function revealARScene() {
    const staticFeed = document.getElementById('static-camera-feed');
    if (staticFeed) {
        staticFeed.style.opacity = '0';
        // Hide completely after transition
        setTimeout(() => {
            staticFeed.style.display = 'none';
        }, 300);
    }
    
    // Hide ALL video elements (both static feed and AR scene videos)
    // The black background layer (ar-layer-0) will show instead
    document.querySelectorAll('video').forEach(v => {
        v.style.opacity = '0';
    });
    
    // Ensure the AR scene canvas is visible for 3D content
    const arScene = document.getElementById('ar-scene');
    if (arScene) {
        const canvas = arScene.querySelector('canvas');
        if (canvas) {
            canvas.style.opacity = '1';
            canvas.style.visibility = 'visible';
        }
    }
    
    arSceneHidden = false;
    console.log(' AR scene revealed!');
}

// Hide the AR scene (show static feed) - called when poster lost
function hideARScene() {
    const staticFeed = document.getElementById('static-camera-feed');
    if (staticFeed) {
        staticFeed.style.display = 'block';
        // Small delay to ensure display:block is applied before opacity transition
        requestAnimationFrame(() => {
            staticFeed.style.opacity = '1';
        });
    }
    
    // Show AR scene videos again (for MindAR to work)
    document.querySelectorAll('#ar-scene video').forEach(v => {
        v.style.opacity = '1';
        v.style.filter = 'grayscale(100%) contrast(2.5) brightness(1)';
    });
    
    arSceneHidden = true;
    console.log(' AR scene hidden behind static feed');
}

// Custom smoothing for AR content - reduces jitter significantly
// This moves content OUTSIDE the target and manually applies smoothed transforms
function setupCustomSmoothing(target) {
    const scene = document.getElementById('ar-scene');
    const THREE = AFRAME.THREE;
    
    // Create a new entity outside the target for smoothed content
    const smoothedWrapper = document.createElement('a-entity');
    smoothedWrapper.id = 'ar-smoothed-wrapper';
    scene.appendChild(smoothedWrapper);
    
    // Move all children from target's smoothed-content to the new wrapper
    const originalContent = document.getElementById('ar-smoothed-content');
    if (originalContent) {
        // Clone the children to the new wrapper
        Array.from(originalContent.children).forEach(child => {
            const clone = child.cloneNode(true);
            smoothedWrapper.appendChild(clone);
        });
        // Hide original content
        originalContent.setAttribute('visible', 'false');
    }
    
    // Smoothing state
    let lastMatrix = new THREE.Matrix4();
    let currentMatrix = new THREE.Matrix4();
    let initialized = false;
    let isVisible = false;
    
    // Smoothing factor (lower = smoother but more lag)
    const smoothFactor = 0.05; // Very smooth
    
    // Tick handler for smoothing
    const tickHandler = () => {
        const targetObj = target.object3D;
        const wrapperObj = smoothedWrapper.object3D;
        
        if (targetObj && targetObj.visible) {
            isVisible = true;
            
            // Get target's world matrix
            targetObj.updateMatrixWorld(true);
            currentMatrix.copy(targetObj.matrixWorld);
            
            if (!initialized) {
                // First frame - snap to position
                lastMatrix.copy(currentMatrix);
                initialized = true;
            } else {
                // Interpolate each element of the matrix
                for (let i = 0; i < 16; i++) {
                    lastMatrix.elements[i] += (currentMatrix.elements[i] - lastMatrix.elements[i]) * smoothFactor;
                }
            }
            
            // Apply smoothed matrix to wrapper
            wrapperObj.matrix.copy(lastMatrix);
            wrapperObj.matrix.decompose(wrapperObj.position, wrapperObj.quaternion, wrapperObj.scale);
            wrapperObj.visible = true;
            
        } else if (isVisible) {
            // Target lost - hide wrapper
            wrapperObj.visible = false;
            initialized = false;
            isVisible = false;
        }
    };
    
    // Register tick handler
    scene.addEventListener('tick', tickHandler);
    
    console.log(' Custom matrix smoothing enabled (factor: ' + smoothFactor + ')');
}

// Initialize AR Scene (MindAR) - Dynamic single-poster loading
// HIDDEN SCANNER: Scene runs behind static camera feed until poster detected
function initializeARScene() {
    console.log(' Initializing MindAR scene (hidden scanner mode)...');
    
    if (!window.arMarkerPath || !window.arPosters) {
        console.error('❌ No AR marker path or posters available!');
        return;
    }
    
    // Get the current poster to display
    const currentPoster = window.arPosters[window.currentARPosterIndex || 0];
    console.log(' Loading AR for poster:', currentPoster.title);
    
    // Build layers HTML using helper function
    const layersHTML = buildLayersHTML(currentPoster);
    
    // Create scene with single target - faster warmup for rotation
    // Use blob URL if available for faster loading
    const mindSrc = mindBlobUrls.get(currentPoster.id) || window.arMarkerPath;
    
    const sceneHTML = `
        <a-scene
            id="ar-scene"
            mindar-image="imageTargetSrc: ${mindSrc}; filterMinCF: 0.0001; filterBeta: 0.001; warmupTolerance: 0; missTolerance: 2;"
            color-space="sRGB"
            renderer="colorManagement: true; physicallyCorrectLights: true;"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false">
            
            <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
            
            <a-entity id="ar-target-0" mindar-image-target="targetIndex: 0" data-poster-id="${currentPoster.id}">
                ${layersHTML}
            </a-entity>
        </a-scene>
    `;
    
    // Add scene to body
    document.body.insertAdjacentHTML('beforeend', sceneHTML);
    console.log(' Hidden AR scene added for poster:', currentPoster.title);
    
    // Get reference to scene
    const scene = document.getElementById('ar-scene');
    
    // Setup event listeners using helper function
    setupSceneEventListeners(scene, currentPoster);
    
    // Additional setup for first load
    scene.addEventListener('arReady', () => {
        console.log(' Hidden AR scanner ready');
        
        // Process exclusion filter layers
        setTimeout(() => {
            processExclusionFilters();
        }, 1000);
        
        // Hide loader
        const loader = document.getElementById('arjs-loader');
        if (loader) loader.classList.add('hidden');
        
        // Apply grayscale filter to AR scene videos
        setTimeout(() => {
            document.querySelectorAll('#ar-scene video').forEach((v) => {
                v.style.filter = 'grayscale(100%) contrast(2.5) brightness(1)';
            });
        }, 200);
    });
    
    // Setup swipe bar controls
    setupSwipeBarControls();
    
    // Setup gallery overlay
    setupGalleryOverlay();
    
    // Force gallery overlay styles
    injectGalleryStyles();
    
    console.log(' AR scene initialized (hidden behind static feed)');
}

// Process exclusion filter layers (black→red, white→black)
function processExclusionFilters() {
    const exclusionLayers = document.querySelectorAll('[data-exclusion="true"]');
    exclusionLayers.forEach(layer => {
        const imgSrc = layer.getAttribute('src');
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const factor = 1 - (luminance / 255);
                data[i] = Math.round(175 * factor);     // R
                data[i + 1] = Math.round(29 * factor);  // G
                data[i + 2] = Math.round(31 * factor);  // B
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            
            const material = layer.getObject3D('mesh')?.material;
            if (material) {
                material.map = texture;
                material.needsUpdate = true;
                console.log(' Exclusion filter applied to:', layer.id);
            }
        };
        img.src = imgSrc;
    });
}

// Inject gallery overlay styles
function injectGalleryStyles() {
    if (document.getElementById('gallery-main-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'gallery-main-styles';
    style.textContent = `
        #gallery-overlay { background: #af1d1f !important; }
        .overlay-header { background: #af1d1f !important; padding: 14px 20px !important; border-radius: 20px 20px 0 0 !important; }
        #gallery-overlay-grid { display: grid !important; grid-template-columns: 1fr !important; gap: 2rem !important; padding: 1.5rem !important; }
        .overlay-poster-card { display: block !important; background: transparent !important; cursor: pointer !important; transition: all 0.2s ease !important; }
        .overlay-poster-card:active { opacity: 0.7 !important; transform: scale(0.98) !important; }
        .overlay-poster-card img { width: 100% !important; height: auto !important; display: block !important; border: none !important; }
        .overlay-poster-card h3 { padding: 10px 0 0 0 !important; font-size: 0.95rem !important; font-weight: 400 !important; color: #000 !important; margin: 0 !important; }
        .overlay-title { font-size: 1rem !important; font-weight: 500 !important; color: #000 !important; text-transform: uppercase !important; }
        .close-overlay-btn { background: transparent !important; color: #000 !important; font-size: 1.8rem !important; width: 40px !important; height: 40px !important; }
    `;
    document.head.appendChild(style);
}

// Show detected poster state in footer
function showDetectedPosterState(poster) {
    const state1 = document.getElementById('swipe-state-1');
    const state2 = document.getElementById('swipe-state-2');
    const titleEl = document.getElementById('detected-poster-title');
    
    if (state1) state1.classList.remove('active');
    if (state2) state2.classList.add('active');
    if (titleEl) titleEl.textContent = poster.title || 'Poster';
}

// Hide detected poster state
function hideDetectedPosterState() {
    const state1 = document.getElementById('swipe-state-1');
    const state2 = document.getElementById('swipe-state-2');
    
    if (state1) state1.classList.add('active');
    if (state2) state2.classList.remove('active');
}

// Legacy function - no longer needed but keep for compatibility
function addLayersToTarget(target) {
    console.log('📋 addLayersToTarget called (layers now added in scene HTML)');
}

// ==================== SMART PARALLEL SCANNER SYSTEM ====================
// Uses multiple detection approaches for faster poster detection:
// 1. Rapid sequential switching (600ms intervals)
// 2. "Sticky detection" - when partial match found, stay longer
// 3. Smart prioritization based on recent detections
// 4. Pre-built scene HTML for instant loading

// Tracking for smart detection
let posterDetectionScores = new Map(); // posterIndex -> score (0-100)
let lastPartialDetection = -1;
let consecutiveNoDetection = 0;
const PARTIAL_DETECTION_THRESHOLD = 0.3; // 30% confidence = partial match

// Scan cycle management - scanner runs for limited cycles then stops
let currentScanCycle = 0;
let totalScanCycles = 10; // Number of full cycles through all posters
let isScanning = false; // Whether scan is active
let postersScannedInCycle = 0; // Track posters scanned in current cycle

// Pre-built scene HTML cache for each poster
let prebuiltSceneHTML = new Map(); // posterId -> sceneHTML string

// Pre-build all scene HTML at startup for instant switching
function prebuildAllSceneHTML() {
    if (!window.arPosters) return;
    
    console.log('🏗️ Pre-building scene HTML for all posters...');
    window.arPosters.forEach((poster, index) => {
        const mindSrc = mindBlobUrls.get(poster.id) || poster.mindPath;
        const layersHTML = buildLayersHTML(poster);
        
        const sceneHTML = `
            <a-scene
                id="ar-scene"
                mindar-image="imageTargetSrc: ${mindSrc}; filterMinCF: 0.0001; filterBeta: 0.001; warmupTolerance: 0; missTolerance: 2;"
                color-space="sRGB"
                renderer="colorManagement: true; physicallyCorrectLights: true;"
                vr-mode-ui="enabled: false"
                device-orientation-permission-ui="enabled: false">
                
                <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
                
                <a-entity id="ar-target-0" mindar-image-target="targetIndex: 0" data-poster-id="${poster.id}">
                    ${layersHTML}
                </a-entity>
            </a-scene>
        `;
        
        prebuiltSceneHTML.set(poster.id, sceneHTML);
    });
    console.log(`🏗️ Pre-built ${prebuiltSceneHTML.size} scene templates`);
}

// Start the rotating scanner
function startRotatingScanner() {
    if (scannerInterval) {
        console.log('⚠️ Scanner already running');
        return;
    }
    
    if (!window.arPosters || window.arPosters.length <= 1) {
        console.log('📌 Not enough posters for rotation');
        return;
    }
    
    // Initialize detection scores
    window.arPosters.forEach((_, i) => posterDetectionScores.set(i, 0));
    
    console.log(`� Starting SMART scanner for ${window.arPosters.length} posters (${SCANNER_ROTATE_INTERVAL}ms base interval)`);
    scannerPaused = false;
    
    // Use dynamic interval based on detection state
    const runScanner = async () => {
        if (scannerPaused) {
            scannerInterval = setTimeout(runScanner, SCANNER_ROTATE_INTERVAL);
            return;
        }
        
        // Get next poster index (simple round-robin)
        const nextIndex = (window.currentARPosterIndex + 1) % window.arPosters.length;
        await quickSwitchPoster(nextIndex);
        
        // Track cycle progress
        checkScanCycleComplete();
        
        // Stop if scanning ended
        if (!isScanning) return;
        
        scannerInterval = setTimeout(runScanner, SCANNER_ROTATE_INTERVAL);
    };
    
    scannerInterval = setTimeout(runScanner, SCANNER_ROTATE_INTERVAL);
}

// Smart poster selection - prioritizes posters with higher detection scores
function getSmartNextPosterIndex() {
    const totalPosters = window.arPosters.length;
    const currentIndex = window.currentARPosterIndex;
    
    // If we had a partial detection recently, check that one again
    if (lastPartialDetection >= 0 && lastPartialDetection !== currentIndex) {
        const lastScore = posterDetectionScores.get(lastPartialDetection) || 0;
        if (lastScore > 20) {
            return lastPartialDetection;
        }
    }
    
    // Otherwise, round-robin with slight preference for higher-scored posters
    let nextIndex = (currentIndex + 1) % totalPosters;
    
    // Check if any poster has a high score (recent partial detection)
    let highestScore = 0;
    let highestIndex = nextIndex;
    
    posterDetectionScores.forEach((score, index) => {
        if (score > highestScore && index !== currentIndex) {
            highestScore = score;
            highestIndex = index;
        }
    });
    
    // If there's a significantly higher scored poster, check that one
    if (highestScore > 30) {
        return highestIndex;
    }
    
    return nextIndex;
}

// Update detection score for a poster (called from MindAR tracking)
function updatePosterDetectionScore(posterIndex, confidence) {
    const currentScore = posterDetectionScores.get(posterIndex) || 0;
    
    if (confidence > PARTIAL_DETECTION_THRESHOLD) {
        // Boost score for partial detection
        posterDetectionScores.set(posterIndex, Math.min(100, currentScore + 30));
        lastPartialDetection = posterIndex;
        consecutiveNoDetection = 0;
    } else {
        // Decay score over time
        posterDetectionScores.set(posterIndex, Math.max(0, currentScore - 10));
        consecutiveNoDetection++;
    }
}

// Decay all scores periodically (prevents stale scores)
function decayAllScores() {
    posterDetectionScores.forEach((score, index) => {
        posterDetectionScores.set(index, Math.max(0, score - 5));
    });
}

// Stop the rotating scanner completely
function stopRotatingScanner() {
    if (scannerInterval) {
        clearTimeout(scannerInterval); // Changed from clearInterval
        scannerInterval = null;
        console.log(' Scanner stopped');
    }
}

// Pause the scanner (when poster detected)
function pauseRotatingScanner() {
    scannerPaused = true;
    hideScanningIndicator();
    console.log('⏸️ Scanner paused - poster found!');
}

// Resume the scanner (when poster lost)
function resumeRotatingScanner() {
    if (!scannerInterval) {
        // Scanner was stopped, restart it
        startRotatingScanner();
    } else {
        scannerPaused = false;
        // Show indicator again when resuming
        const currentPoster = window.arPosters[window.currentARPosterIndex];
        if (currentPoster) {
            updateScanningIndicator(currentPoster, window.currentARPosterIndex, window.arPosters.length);
        }
    }
}

// Update the scanning indicator UI - Simple: SCAN button or progress bar
function updateScanningIndicator(poster, index, total) {
    let indicator = document.getElementById('scanning-indicator');
    
    // Create indicator if it doesn't exist
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'scanning-indicator';
        indicator.innerHTML = `
            <button id="scan-button">Scan</button>
            <div class="scan-progress-container" style="display: none;">
                <div class="scan-progress-bar">
                    <div class="scan-progress-fill"></div>
                </div>
                <span class="scan-text">1/2</span>
            </div>
        `;
        indicator.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.id = 'scan-indicator-styles';
        style.textContent = `
            #scan-button {
                background: rgba(0, 0, 0, 0.6);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 11px;
                cursor: pointer;
            }
            .scan-progress-container {
                display: flex;
                align-items: center;
                gap: 10px;
                background: rgba(0, 0, 0, 0.6);
                padding: 8px 16px;
                border-radius: 20px;
            }
            .scan-progress-bar {
                width: 60px;
                height: 4px;
                background: rgba(255,255,255,0.3);
                border-radius: 2px;
                overflow: hidden;
            }
            .scan-progress-fill {
                height: 100%;
                background: white;
                border-radius: 2px;
                transition: width 0.1s ease;
            }
            .scan-text {
                color: white;
                font-size: 11px;
            }
        `;
        if (!document.getElementById('scan-indicator-styles')) {
            document.head.appendChild(style);
        }
        
        document.body.appendChild(indicator);
        
        // Add click handler
        document.getElementById('scan-button').addEventListener('click', startScanCycles);
    }
    
    // Only update progress if scanning
    if (!isScanning) return;
    
    const progressFill = indicator.querySelector('.scan-progress-fill');
    const scanText = indicator.querySelector('.scan-text');
    
    // Progress shows which poster in the cycle (index/total posters)
    if (progressFill) {
        const progress = ((index + 1) / total) * 100;
        progressFill.style.width = progress + '%';
    }
    if (scanText) {
        // Show poster progress within cycle: poster/total
        scanText.textContent = `${index + 1}/${total}`;
    }
}

// Hide progress, show SCAN button
function hideScanningIndicator() {
    const indicator = document.getElementById('scanning-indicator');
    if (indicator) {
        // Hide progress, show button
        const progressContainer = indicator.querySelector('.scan-progress-container');
        const scanBtn = document.getElementById('scan-button');
        if (progressContainer) progressContainer.style.display = 'none';
        if (scanBtn) scanBtn.style.display = 'block';
    }
}

// Start scan cycles (button click)
function startScanCycles() {
    if (window.useChunkSystem) {
        startChunkScan();
        return;
    }

    if (isScanning) return;
    
    console.log(' Starting scan...');
    isScanning = true;
    currentScanCycle = 0;
    postersScannedInCycle = 0;
    
    // Hide button, show progress
    const scanBtn = document.getElementById('scan-button');
    const progressContainer = document.querySelector('.scan-progress-container');
    if (scanBtn) scanBtn.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'flex';
    
    // Start scanner
    startRotatingScanner();
}

// Stop scan cycles
function stopScanCycles(reason = 'complete') {
    console.log(` Scan stopped: ${reason}`);
    isScanning = false;
    currentScanCycle = 0;
    postersScannedInCycle = 0;
    
    stopRotatingScanner();
    hideScanningIndicator();
}

// Check if scan cycles are complete
function checkScanCycleComplete() {
    if (!isScanning) return;
    
    postersScannedInCycle++;
    
    // Check if we completed a full cycle
    if (postersScannedInCycle >= window.arPosters.length) {
        currentScanCycle++;
        postersScannedInCycle = 0;
        console.log(` Completed cycle ${currentScanCycle}/${totalScanCycles}`);
        
        // Check if all cycles are done
        if (currentScanCycle >= totalScanCycles) {
            console.log(' All scan cycles complete!');
            stopScanCycles('complete');
        }
    }
}

// Quick switch to another poster's .mind file
// OPTIMIZED VERSION: Uses preloaded .mind data as Blob URLs for faster loading
let isSwitching = false; // Prevent concurrent switches
let mindBlobUrls = new Map(); // Cache blob URLs for preloaded .mind files

// Create blob URLs from preloaded data (called once after preloading)
function createMindBlobUrls() {
    preloadedMindData.forEach((data, posterId) => {
        if (data.data && !mindBlobUrls.has(posterId)) {
            const blob = new Blob([data.data], { type: 'application/octet-stream' });
            const blobUrl = URL.createObjectURL(blob);
            mindBlobUrls.set(posterId, blobUrl);
            console.log(`🔗 Created blob URL for poster ${posterId}`);
        }
    });
}

async function quickSwitchPoster(posterIndex) {
    // Prevent concurrent switches
    if (isSwitching) {
        return false;
    }
    
    if (!window.arPosters || posterIndex < 0 || posterIndex >= window.arPosters.length) {
        return false;
    }
    
    // Don't switch if paused (poster detected)
    if (scannerPaused) {
        return false;
    }
    
    isSwitching = true;
    
    const newPoster = window.arPosters[posterIndex];
    
    // Update scanning indicator
    updateScanningIndicator(newPoster, posterIndex, window.arPosters.length);
    
    // Update global state
    window.currentARPosterIndex = posterIndex;
    
    // Use blob URL if available (faster), otherwise fall back to file path
    const blobUrl = mindBlobUrls.get(newPoster.id);
    window.arMarkerPath = blobUrl || newPoster.mindPath;
    
    const existingScene = document.getElementById('ar-scene');
    
    if (!existingScene) {
        isSwitching = false;
        return false;
    }
    
    try {
        // FAST CLEANUP: Stop MindAR processing immediately
        const mindarSystem = existingScene.systems?.['mindar-image-system'];
        if (mindarSystem) {
            if (mindarSystem.controller) {
                mindarSystem.controller.processingVideo = false;
            }
            if (mindarSystem.video) {
                mindarSystem.video.pause();
            }
        }
        
        // Save WebGL context reference for cleanup
        const canvas = existingScene.querySelector('canvas');
        if (canvas) {
            lastWebGLContext = canvas.getContext('webgl') || canvas.getContext('webgl2');
        }
        
        // Quick wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 40));
        
        // Force WebGL cleanup before removing scene
        cleanupWebGLContexts();
        
        // Remove existing scene
        existingScene.remove();
        
        // Minimal DOM cleanup wait
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Use pre-built scene HTML if available (much faster!)
        const sceneHTML = prebuiltSceneHTML.get(newPoster.id);
        if (!sceneHTML) {
            console.warn(`⚠️ No prebuilt HTML for poster ${newPoster.id}, building on-the-fly`);
            // Fallback: build HTML on-the-fly
            const mindSrc = mindBlobUrls.get(newPoster.id) || newPoster.mindPath;
            const layersHTML = buildLayersHTML(newPoster);
            const fallbackHTML = `
                <a-scene
                    id="ar-scene"
                    mindar-image="imageTargetSrc: ${mindSrc}; filterMinCF: 0.0005; filterBeta: 0.003; warmupTolerance: 0; missTolerance: 2;"
                    color-space="sRGB"
                    renderer="colorManagement: true; physicallyCorrectLights: true;"
                    vr-mode-ui="enabled: false"
                    device-orientation-permission-ui="enabled: false">
                    
                    <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
                    
                    <a-entity id="ar-target-0" mindar-image-target="targetIndex: 0" data-poster-id="${newPoster.id}">
                        ${layersHTML}
                    </a-entity>
                </a-scene>
            `;
            document.body.insertAdjacentHTML('beforeend', fallbackHTML);
        } else {
            // Use prebuilt HTML for instant loading!
            document.body.insertAdjacentHTML('beforeend', sceneHTML);
        }
        
        // Setup event listeners
        const newScene = document.getElementById('ar-scene');
        setupSceneEventListeners(newScene, newPoster);
        
        // Apply video filter
        setTimeout(() => {
            document.querySelectorAll('#ar-scene video').forEach((v) => {
                v.style.filter = 'grayscale(100%) contrast(2.5) brightness(1)';
            });
        }, 100);
        
        isSwitching = false;
        return true;
        
    } catch (e) {
        console.warn('⚠️ Quick switch error:', e.message);
        isSwitching = false;
        return false;
    }
}

// Build layers HTML for a poster
function buildLayersHTML(poster) {
    let layersHTML = '';
    
    // Add black background layer - BEHIND all other layers (negative Z)
    // Make it larger than the poster to cover any gaps
    layersHTML += `
        <a-plane 
            id="ar-layer-0"
            position="0 0 -0.01" 
            height="2" 
            width="1.5" 
            rotation="0 0 0"
            material="color: #000000; transparent: false; side: double; shader: flat;"></a-plane>`;
    
    if (poster.layers) {
        for (let i = 1; i <= 8; i++) {
            const layerData = poster.layers[`layer_${i}`];
            
            // Define variables accessible to both image block and GLB block
            let animationStr = '';
            
            // Extract common spatial parameters (needed for both Image/Video and GLB)
            // Use 0.1 as safe default Z to avoid z-fighting with background plane
            const baseZ = Math.max(parseFloat(layerData ? layerData.z : 0) || 0, 0.1) + (i * 0.01); 
            const posX = parseFloat(layerData ? layerData.pos_x : 0) || 0;
            const posY = parseFloat(layerData ? layerData.pos_y : 0) || 0;
            const posZ = baseZ; // Image/Video uses baseZ directly
            
            const baseScale = parseFloat(layerData ? layerData.scale : 1.0) || 1.0;
            
            // Rotation
            const rotX = parseFloat(layerData ? layerData.rot_x : 0) || 0;
            const rotY = parseFloat(layerData ? layerData.rot_y : 0) || 0;
            const rotZ = parseFloat(layerData ? layerData.rot_z : 0) || 0;

            // Calculate animation string if layerData exists (common for both GLB and Image)
            if (layerData) {
                // Check of er animaties zijn met hun eigen durations
                const hasPositionAnim = (parseFloat(layerData.anim_x) || parseFloat(layerData.anim_y) || parseFloat(layerData.anim_z)) && parseInt(layerData.anim_pos_duration) > 0;
                const hasRotationAnim = (parseFloat(layerData.anim_rot_x) || parseFloat(layerData.anim_rot_y) || parseFloat(layerData.anim_rot_z)) && parseInt(layerData.anim_rot_duration) > 0;
                const hasScaleAnim = (parseFloat(layerData.anim_scale) !== 1.0 || parseFloat(layerData.anim_opacity) !== 1.0) && parseInt(layerData.anim_scale_duration) > 0;
                const hasAnimation = hasPositionAnim || hasRotationAnim || hasScaleAnim;
                let animAttrs = [];
                
                if (hasAnimation) {
                    const animX = parseFloat(layerData.anim_x) || 0;
                    const animY = parseFloat(layerData.anim_y) || 0;
                    const animZ = parseFloat(layerData.anim_z) || 0;
                    const posDur = parseInt(layerData.anim_pos_duration) || 1000;
                    
                    const animRotX = parseFloat(layerData.anim_rot_x) || 0;
                    const animRotY = parseFloat(layerData.anim_rot_y) || 0;
                    const animRotZ = parseFloat(layerData.anim_rot_z) || 0;
                    const rotDur = parseInt(layerData.anim_rot_duration) || 1000;
                    
                    const animScale = parseFloat(layerData.anim_scale) || 1.0;
                    const animOpacity = parseFloat(layerData.anim_opacity) || 1.0;
                    const scaleDur = parseInt(layerData.anim_scale_duration) || 1000;
                    
                    // Position animation
                    if (hasPositionAnim) {
                        const fromPos = `${posX} ${posY} ${posZ}`;
                        const toPos = `${posX + animX} ${posY + animY} ${posZ + animZ}`;
                        animAttrs.push(`animation="property: position; from: ${fromPos}; to: ${toPos}; dur: ${posDur}; easing: linear; loop: true; dir: alternate;"`);
                    }
                    
                    // Rotation animation  
                    if (hasRotationAnim) {
                        const fromRot = `${rotX} ${rotY} ${rotZ}`; // Use configured rotation as start
                        const toRot = `${rotX + animRotX} ${rotY + animRotY} ${rotZ + animRotZ}`;
                        animAttrs.push(`animation__rot="property: rotation; from: ${fromRot}; to: ${toRot}; dur: ${rotDur}; easing: linear; loop: true; dir: alternate;"`);
                    }
                    
                    // Scale animation
                    if (hasScaleAnim) {
                        // Use baseScale as start point
                        animAttrs.push(`animation__scale="property: scale; from: ${baseScale} ${baseScale} ${baseScale}; to: ${baseScale * animScale} ${baseScale * animScale} ${baseScale * animScale}; dur: ${scaleDur}; easing: linear; loop: true; dir: alternate;"`);
                        
                        // Opacity animation indien niet 1.0
                        if (animOpacity !== 1.0) {
                            animAttrs.push(`animation__opacity="property: material.opacity; from: 1; to: ${animOpacity}; dur: ${scaleDur}; easing: linear; loop: true; dir: alternate;"`);
                        }
                    }
                }
                animationStr = animAttrs.length > 0 ? animAttrs.join(' ') : '';
            }

            if (layerData && layerData.filename) {
                // (Variable extraction moved up)
                
                // (Animation logic moved up)
                
                const mediaPath = `uploads/ar-layers/${layerData.filename}`;
                const exclusionAttr = layerData.exclusion_filter ? `data-exclusion="true"` : '';
                const isTransparent = layerData.transparent === true;
                const bgColor = layerData.bg_color || '#000000';
                
                // Check if it's a video (MP4, WebM) or GIF or image
                const isGif = layerData.filename.endsWith('.gif');
                const isVideo = (layerData.is_video === true || 
                               layerData.filename.endsWith('.mp4') || 
                               layerData.filename.endsWith('.webm')) && !isGif;

                
                const customScaleAttr = `data-custom-scale="${baseScale}"`;

                // Dynamisch aspect ratio laden voor STATIC images (niet GIF)
                if (!isGif && !isVideo) {
                    const img = new Image();
                    img.onload = function() {
                        const aspectRatio = this.width / this.height;
                        
                        // Bereken width en height gebaseerd op aspect ratio
                        let width, height;
                        if (aspectRatio > 1) {
                            // Landscape
                            width = 1.4 * baseScale;
                            height = (1.4 * baseScale) / aspectRatio;
                        } else {
                            // Portrait
                            height = 1.4 * baseScale;
                            width = (1.4 * baseScale) * aspectRatio;
                        }
                        
                        // Update plane dimensies
                        const layer = document.getElementById(`ar-layer-${i}`);
                        if (layer) {
                            layer.setAttribute('width', width.toFixed(3));
                            layer.setAttribute('height', height.toFixed(3));
                        }
                    };
                    img.onerror = function() {
                        // Fallback naar vierkant als afbeelding niet laadt
                        const layer = document.getElementById(`ar-layer-${i}`);
                        if (layer) {
                            layer.setAttribute('width', (1.4 * baseScale).toFixed(3));
                            layer.setAttribute('height', (1.4 * baseScale).toFixed(3));
                        }
                    };
                    img.src = mediaPath;
                }

                if (isGif) {
                    // GIF: gebruik de gif component voor animatie
                    // De component captured browser's native GIF animatie naar WebGL texture
                    // isTransparent bepaalt of GIF transparantie moet behouden (checkbox in admin)
                    const gifSize = 1.4 * baseScale;
                    const materialSettings = isTransparent ? 'transparent: true; alphaTest: 0.5; side: double;' : `transparent: false; side: double; color: ${bgColor};`;
                    layersHTML += `
                        <a-plane 
                            id="ar-layer-${i}"
                            class="gif-layer"
                            gif="src: ${mediaPath}; autoplay: true; transparent: ${isTransparent}"
                            position="${posX} ${posY} ${posZ}" 
                            height="${gifSize.toFixed(3)}" 
                            width="${gifSize.toFixed(3)}" 
                            rotation="${rotX} ${rotY} ${rotZ}"
                            material="${materialSettings}"
                            data-preserve-aspect="true"
                            data-image-src="${mediaPath}"
                            ${customScaleAttr}
                            ${animationStr}
                            ${exclusionAttr}></a-plane>`;
                } else if (isVideo) {
                    // Use a-video for MP4/WebM layers
                    // Video: gebruik default aspect ratio 16:9
                    const videoWidth = 1.4 * baseScale;
                    const videoHeight = (1.4 * baseScale) / (16/9);
                    layersHTML += `
                        <a-video 
                            id="ar-layer-${i}"
                            src="${mediaPath}" 
                            position="${posX} ${posY} ${posZ}" 
                            height="${videoHeight.toFixed(3)}" 
                            width="${videoWidth.toFixed(3)}" 
                            rotation="${rotX} ${rotY} ${rotZ}"
                            autoplay="true"
                            loop="true"
                            muted="true"
                            playsinline="true"
                            webkit-playsinline="true"
                            crossorigin="anonymous"
                            ${customScaleAttr}
                            ${animationStr}
                            ${exclusionAttr}></a-video>`;
                } else {
                    // Use a-plane for static images
                    // Zet initial dimensions op placeholder, wordt dynamisch aangepast via Image loader
                    const materialSettings = isTransparent ? 'transparent: true; alphaTest: 0.1; side: double;' : `transparent: false; side: double; color: ${bgColor};`;
                    const materialAttr = `material="${materialSettings}"`;
                    
                    layersHTML += `
                        <a-plane 
                            id="ar-layer-${i}"
                            src="${mediaPath}" 
                            position="${posX} ${posY} ${posZ}" 
                            height="1.4" 
                            width="1.4" 
                            rotation="${rotX} ${rotY} ${rotZ}"
                            data-image-src="${mediaPath}"
                            data-preserve-aspect="true"
                            ${customScaleAttr}
                            ${materialAttr}
                            ${animationStr}
                            ${exclusionAttr}></a-plane>`;
                }
            }
            
            // Per-laag GLB 3D model toevoegen (indien aanwezig in layerData)
            if (layerData && layerData.glb_model) {
                const glbPath = `uploads/ar-layers/${layerData.glb_model}`;
                
                // Positioneer GLB exact volgens layer parameters
                const glbPosX = posX;
                const glbPosY = posY;
                const glbPosZ = baseZ; 
                
                // Rotatie voor GLB (+ extra -90 graden op X om model rechtop te zetten indien nodig)
                const glbRotX = rotX;
                const glbRotY = rotY;
                const glbRotZ = rotZ;
                
                // GLB modellen grootte berekening:
                // Scale waarde * 0.1 = grootte in meters:
                // - scale=1.0  → 10cm
                // - scale=5.0  → 50cm  
                // - scale=10.0 → 1m
                const glbScale = baseScale * 0.1;
                
                console.log(`[GLB] Laag ${i}: ${layerData.glb_model}`);
                console.log(`[GLB] Position: (${glbPosX.toFixed(3)}, ${glbPosY.toFixed(3)}, ${glbPosZ.toFixed(3)})`);
                console.log(`[GLB] Scale: ${baseScale} * 0.1 = ${glbScale.toFixed(3)}m`);
                console.log(`[GLB] Rotation: (${glbRotX}, ${glbRotY}, ${glbRotZ})`);
                
                layersHTML += `
                    <a-entity
                        id="ar-glb-model-${i}"
                        class="ar-model clickable"
                        gltf-model="${glbPath}"
                        position="${glbPosX} ${glbPosY} ${glbPosZ}"
                        scale="${glbScale} ${glbScale} ${glbScale}"
                        rotation="${glbRotX} ${glbRotY} ${glbRotZ}"
                        ${animationStr}
                        data-clickable="true"
                        data-layer="${i}"
                    ></a-entity>`;
                
                // Voeg event listeners toe om model loading te monitoren (na DOM insertion)
                // Dit wordt gedaan via een setTimeout om te wachten tot de entity bestaat
                setTimeout(() => {
                    const glbEntity = document.getElementById(`ar-glb-model-${i}`);
                    if (glbEntity) {
                        glbEntity.addEventListener('model-loaded', () => {
                            console.log(`[GLB] Model ${i} succesvol geladen:`, glbPath);
                        });
                        glbEntity.addEventListener('model-error', (e) => {
                            console.error(`[GLB] Model ${i} laden mislukt:`, glbPath, e.detail);
                        });
                    }
                }, 100);
            }
        }
    }
    
    // GLB 3D modellen worden nu per laag toegevoegd (zie layer loop hierboven)
    // Audio wordt afgespeeld vanuit layers_data tijdens targetFound
    
    if (!layersHTML.includes('ar-layer-1') && !layersHTML.includes('ar-glb-model')) {
        layersHTML += `<a-box position="0 0 0.1" color="#FF0000" width="0.2" height="0.2" depth="0.2"></a-box>`;
    }
    
    return layersHTML;
}

// Fix aspect ratios for each layer based on image dimensions
function fixLayerAspectRatios() {
    // For each layer that has data-preserve-aspect
    const layers = document.querySelectorAll('[data-preserve-aspect="true"]');
    
    layers.forEach(layer => {
        const imageSrc = layer.getAttribute('data-image-src');
        if (!imageSrc) return;

        const customScaleAttr = layer.getAttribute('data-custom-scale');
        const customScale = customScaleAttr ? parseFloat(customScaleAttr) : 1.0;
        
        // Create image to get dimensions
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            try {
                const imageRatio = img.width / img.height;
                // Base height is 1.4, multiplied by custom scale
                const maxHeight = 1.4 * (Number.isNaN(customScale) ? 1.0 : customScale);
                
                let newWidth = maxHeight * imageRatio;
                let newHeight = maxHeight;
                
                // Cap maximum width (relative to scale)
                const maxAllowedWidth = 2.0 * (Number.isNaN(customScale) ? 1.0 : customScale);
                
                if (newWidth > maxAllowedWidth) {
                    newWidth = maxAllowedWidth;
                    newHeight = maxAllowedWidth / imageRatio;
                }
                
                // Apply new dimensions
                layer.setAttribute('width', newWidth.toFixed(3));
                layer.setAttribute('height', newHeight.toFixed(3));
                
                console.log(`📐 Fixed ${layer.id}: ${newWidth.toFixed(2)}x${newHeight.toFixed(2)} (Ratio: ${imageRatio.toFixed(2)})`);
            } catch (e) {
                console.warn(`⚠️ Error fixing ${layer.id}:`, e);
            }
        };
        
        img.onerror = function() {
            console.warn(`⚠️ Could not load image for aspect ratio: ${imageSrc}`);
        };
        
        img.src = imageSrc;
    });
}



// Setup event listeners for AR scene
function setupSceneEventListeners(scene, currentPoster) {
    const target = document.getElementById('ar-target-0');
    
    scene.addEventListener('arReady', () => {
        console.log(' MindAR ready for:', currentPoster.title);
        
        // Hide loader
        const loader = document.getElementById('arjs-loader');
        if (loader) loader.classList.add('hidden');
        
        // Fix aspect ratios for all layers
        fixLayerAspectRatios();


        
        // Apply video filter to AR scene video (behind static feed)
        setTimeout(() => {
            document.querySelectorAll('#ar-scene video').forEach((v) => {
                v.style.filter = 'grayscale(100%) contrast(2.5) brightness(1)';
            });
        }, 200);
    });
    
    scene.addEventListener('arError', (event) => {
        console.error('❌ MindAR error:', event);
    });
    
    if (target) {
        target.addEventListener('targetFound', () => {
            console.log(` TARGET FOUND! ${currentPoster.title}`);
            
            // REVEAL AR SCENE - fade out static camera feed
            revealARScene();
            
            // Hide scan frame
            const scanFrame = document.getElementById('scan-frame');
            if (scanFrame) scanFrame.classList.add('hidden');
            
            // STOP scanner - we found a poster!
            stopScanCycles('found');
            lastDetectedPosterIndex = window.currentARPosterIndex;
            
            // Update UI
            currentTrackedPoster = currentPoster;
            showDetectedPosterState(currentPoster);
            
            // LAZY LOAD GIFs: Laad nu pas de GIFs voor deze target
            loadLazyGifsForTarget(target);
            
            // START AUDIO (indien beschikbaar in een van de layers)
            playPosterAudio(currentPoster);
            
            // Setup model interactiviteit (indien GLB aanwezig in een van de layers)
            if (hasGLBInLayers(currentPoster)) {
                setTimeout(() => setupModelInteractivity(), 500);
            }
        });
        
        target.addEventListener('targetLost', () => {
            console.log(` TARGET LOST! ${currentPoster.title}`);
            
            // HIDE AR SCENE - show static camera feed again
            hideARScene();
            
            // UNLOAD GIFs: Verwijder GIF shaders om geheugen vrij te maken
            unloadLazyGifsForTarget(target);
            
            // Show scan frame
            const scanFrame = document.getElementById('scan-frame');
            if (scanFrame) scanFrame.classList.remove('hidden');
            
            // STOP AUDIO
            stopPosterAudio();
            
            hideDetectedPosterState();
            currentTrackedPoster = null;
            
            // Show SCAN button with "scan andere poster" text and refresh icon
            showScanButton('↻ Scan een andere poster');
        });
    }
}

// Update the AR layers for a different poster (without recreating scene)
function updateLayersForPoster(poster) {
    const target = document.getElementById('ar-target-0');
    if (!target) return;
    
    // Update target's poster ID
    target.setAttribute('data-poster-id', poster.id);
    
    // Remove existing layers (except layer-0 black background)
    for (let i = 1; i <= 8; i++) {
        const existingLayer = document.getElementById(`ar-layer-${i}`);
        if (existingLayer) {
            existingLayer.remove();
        }
    }
    
    // Add new layers from poster data
    if (poster.layers) {
        for (let i = 1; i <= 8; i++) {
            const layerData = poster.layers[`layer_${i}`];
            
            if (layerData && layerData.filename) {
                const zPos = Math.max(parseFloat(layerData.z) || 0, 0.1) + (i * 0.01);
                const imagePath = `uploads/ar-layers/${layerData.filename}`;
                
                const layer = document.createElement('a-plane');
                layer.setAttribute('id', `ar-layer-${i}`);
                layer.setAttribute('src', imagePath);
                layer.setAttribute('position', `0 0 ${zPos}`);
                layer.setAttribute('height', '1.4');
                layer.setAttribute('width', '1');
                layer.setAttribute('rotation', '0 0 0');
                layer.setAttribute('material', 'transparent: true; alphaTest: 0.1; side: double;');
                
                if (layerData.exclusion_filter) {
                    layer.setAttribute('data-exclusion', 'true');
                }
                
                target.appendChild(layer);
            }
        }
    }
    
    console.log(`📋 Layers updated for: ${poster.title}`);
}

// Switch to a different poster's AR marker
// This destroys the current scene and creates a new one with the selected poster
async function switchToPoster(posterId) {
    console.log(' Switching to poster:', posterId);
    
    // Stop the rotating scanner during manual switch
    stopRotatingScanner();
    
    if (!window.arPosters) {
        console.error('❌ No AR posters available');
        return false;
    }
    
    // Find the poster by ID
    const posterIndex = window.arPosters.findIndex(p => p.id == posterId);
    if (posterIndex === -1) {
        console.warn('⚠️ Poster not found in AR posters:', posterId);
        return false;
    }
    
    const newPoster = window.arPosters[posterIndex];
    console.log(' Switching to:', newPoster.title, '→', newPoster.mindPath);
    
    // Remove existing AR scene
    const existingScene = document.getElementById('ar-scene');
    if (existingScene) {
        // Stop MindAR first
        try {
            const mindarSystem = existingScene.systems['mindar-image-system'];
            if (mindarSystem) {
                await mindarSystem.stop();
            }
        } catch (e) {
            console.warn('⚠️ Could not stop MindAR:', e);
        }
        existingScene.remove();
        console.log('🗑️ Removed existing AR scene');
    }
    
    // Update global state
    window.currentARPosterIndex = posterIndex;
    window.arMarkerPath = newPoster.mindPath;
    
    // Re-initialize AR scene with new poster
    initializeARScene();
    
    // Restart the rotating scanner (it will be paused when a target is found)
    if (window.arPosters && window.arPosters.length > 1) {
        startRotatingScanner();
    }
    
    // Collapse gallery/footer
    const swipeBar = document.getElementById('ar-footer-swipe-bar');
    if (swipeBar) {
        swipeBar.classList.remove('expanded');
    }
    
    console.log(' Switched to poster:', newPoster.title);
    return true;
}

// Request camera permission
async function requestCameraPermission() {
    console.log('📸 Requesting camera permission...');
    
    // Try different camera configurations
    // NOTE: Ultrawide (0.5x) causes MindAR anchor offset issues
    // Prioritize 1x standard lens for accurate AR tracking
    const cameraConfigs = [
        // Config 1: Standard 1x camera with high resolution (best for MindAR)
        {
            video: { 
                facingMode: { exact: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        },
        // Config 2: Standard back camera
        {
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        },
        // Config 3: Any back camera
        {
            video: { 
                facingMode: 'environment'
            }
        },
        // Config 4: Default camera
        {
            video: true
        }
    ];
    
    for (let i = 0; i < cameraConfigs.length; i++) {
        try {
            // console.log(`📸 Trying camera config ${i + 1}/${cameraConfigs.length}...`);
            const stream = await navigator.mediaDevices.getUserMedia(cameraConfigs[i]);
            // console.log(' Camera permission granted with config', i + 1);
            
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();
            
            // Store default zoom (1x standard lens)
            // Ultrawide causes MindAR positioning errors
            window.cameraZoomLevel = 1.0;
            console.log(` Using 1.0x standard lens (MindAR compatible)`);
            
            // Apply distortion compensation with standard lens (minimal)
            applyLensDistortionCompensation(1.0);
            
            return stream;
        } catch (error) {
            console.warn(`❌ Config ${i + 1} failed:`, error.message);
            if (i === cameraConfigs.length - 1) {
                console.error('❌ All camera configs failed');
                throw error;
            }
        }
    }
}

// Apply lens distortion compensation for ultrawide camera
function applyLensDistortionCompensation(zoomLevel) {
    console.log(`🔧 Applying lens distortion compensation for zoom level: ${zoomLevel}`);
    
    // For ultrawide (0.5x), we need to compensate for barrel distortion
    const isUltrawide = zoomLevel <= 0.6;
    
    if (isUltrawide) {
        console.log('📐 Detected ultrawide lens - applying barrel distortion compensation');
        
        // Apply CSS-based barrel distortion correction to video feed
        const videoElements = document.querySelectorAll('#camera-feed, video');
        videoElements.forEach(video => {
            // Slight pincushion effect to counter barrel distortion
            // This is a subtle correction - too much looks unnatural
            video.style.transform = 'perspective(1000px) translateZ(-10px)';
            video.style.transformOrigin = 'center center';
        });
        
        // Adjust Three.js camera FOV for ultrawide perspective
        setTimeout(() => {
            const scene = document.querySelector('a-scene');
            if (scene && scene.camera) {
                const camera = scene.camera;
                
                // Ultrawide lenses have ~120° FOV, but we want MindAR to match it
                // Standard camera FOV is ~60-70°, ultrawide is ~90-120°
                // We'll increase FOV significantly to compensate
                const originalFov = camera.fov || 70;
                const ultrawideCompensationFov = Math.min(originalFov * 2.0, 120); // Up to 120° max
                
                camera.fov = ultrawideCompensationFov;
                camera.updateProjectionMatrix();
                
                console.log(`📷 Adjusted camera FOV: ${originalFov}° → ${ultrawideCompensationFov}° for ultrawide`);
                
                // Store for reference
                window.cameraFovCompensation = ultrawideCompensationFov;
            }
        }, 500);
        
    } else {
        console.log('📐 Standard lens detected - no distortion compensation needed');
        window.cameraFovCompensation = null;
    }
}

// Debug camera elements
function debugCameraElements() {
    const video = document.querySelector('a-scene video');
    const canvas = document.querySelector('a-scene canvas');
    
    console.log(' Video element:', video ? `Found (${video.videoWidth}x${video.videoHeight})` : 'NOT FOUND');
    console.log(' Canvas element:', canvas ? `Found (${canvas.width}x${canvas.height})` : 'NOT FOUND');
    
    if (video) {
        console.log('📹 Video playing:', !video.paused);
        console.log('📹 Video readyState:', video.readyState);
        console.log('📹 Video srcObject:', video.srcObject);
        console.log('📹 Video style:', {
            display: video.style.display || getComputedStyle(video).display,
            visibility: video.style.visibility || getComputedStyle(video).visibility,
            opacity: video.style.opacity || getComputedStyle(video).opacity,
            zIndex: video.style.zIndex || getComputedStyle(video).zIndex,
            position: getComputedStyle(video).position
        });
        
        // Try to force video to be visible
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.style.opacity = '1';
    }
    
    if (canvas) {
        console.log(' Canvas style:', {
            display: canvas.style.display || getComputedStyle(canvas).display,
            visibility: canvas.style.visibility || getComputedStyle(canvas).visibility,
            opacity: canvas.style.opacity || getComputedStyle(canvas).opacity,
            zIndex: canvas.style.zIndex || getComputedStyle(canvas).zIndex,
            position: getComputedStyle(canvas).position
        });
    }
    
    // Check all video elements on page
    const allVideos = document.querySelectorAll('video');
    console.log(' Total video elements:', allVideos.length);
    allVideos.forEach((v, i) => {
        console.log(`Video ${i}:`, {
            width: v.videoWidth,
            height: v.videoHeight,
            playing: !v.paused,
            readyState: v.readyState,
            srcObject: !!v.srcObject
        });
    });
}

// Add MindAR image targets
function addMindARTargets(scene) {
    console.log('📌 Adding MindAR image target...');
    
    // Get the first poster to use its layers
    const poster = window.allPosters && window.allPosters.length > 0 ? window.allPosters[0] : null;
    console.log('📋 Using poster for AR layers:', poster ? poster.title : 'NONE');
    
    // Add lights to scene
    const ambientLight = document.createElement('a-light');
    ambientLight.setAttribute('type', 'ambient');
    ambientLight.setAttribute('color', '#FFFFFF');
    ambientLight.setAttribute('intensity', '1');
    scene.appendChild(ambientLight);
    
    const directionalLight = document.createElement('a-light');
    directionalLight.setAttribute('type', 'directional');
    directionalLight.setAttribute('color', '#FFFFFF');
    directionalLight.setAttribute('intensity', '0.5');
    directionalLight.setAttribute('position', '1 1 1');
    scene.appendChild(directionalLight);
    
    // Create MindAR target entity
    const target = document.createElement('a-entity');
    target.setAttribute('mindar-image-target', 'targetIndex: 0');
    target.setAttribute('id', 'ar-target-0');
    target.setAttribute('visible', 'true');
    
    // Determine layer positions based on zoom level
    // Ultrawide (0.5x) needs much closer positions because perspective is wider
    const isUltrawide = window.cameraZoomLevel <= 0.6;
    
    // Create layers dynamically from poster data
    let layerCount = 0;
    
    if (poster && poster.layers) {
        console.log(' Creating layers from poster data:', poster.layers);
        
        // Loop through all 8 possible layers
        for (let i = 1; i <= 8; i++) {
            const layerKey = `layer_${i}`;
            const layerData = poster.layers[layerKey];
            
            // Skip if no layer data or no filename
            if (!layerData || !layerData.filename) {
                console.log(`⏭️ Layer ${i}: skipped (no file)`);
                continue;
            }
            
            layerCount++;
            console.log(` Layer ${i}:`, layerData);
            
            // Calculate Z position - use poster data, scale for ultrawide if needed
            let zPos = parseFloat(layerData.z) || 0.001; // Very small Z to be just above poster
            if (isUltrawide) {
                zPos = zPos * 0.3; // Scale down Z for ultrawide
            }
            
            // Create layer plane
            // In MindAR, the image target is normalized to width=1
            // The layer should cover the entire detected target
            // We'll use a-image which automatically handles aspect ratio from the loaded image
            const layer = document.createElement('a-image');
            layer.setAttribute('id', `ar-layer-${i}`);
            layer.setAttribute('position', `0 0 ${zPos}`); // Centered on target, slightly in front
            layer.setAttribute('rotation', '0 0 0');
            // For a-image, we can set width and let height be auto-calculated
            // Width = 1 means full width of the detected target in MindAR
            layer.setAttribute('width', '1');
            layer.setAttribute('height', '1'); // Will be overridden when image loads
            
            // Build image path - layers are stored in uploads/ar-layers/
            const imagePath = `uploads/ar-layers/${layerData.filename}`;
            console.log(` Layer ${i} image path:`, imagePath);
            
            // Set the image source
            layer.setAttribute('src', imagePath);
            layer.setAttribute('transparent', 'true');
            layer.setAttribute('alpha-test', '0.5');
            
            // Apply exclusion filter if enabled
            if (layerData.exclusion_filter) {
                layer.setAttribute('material', 'blending: additive; transparent: true;');
            }
            layer.setAttribute('visible', 'true');
            
            // Add animation if configured (anim_x, anim_y, anim_z > 0)
            const animX = parseFloat(layerData.anim_x) || 0;
            const animY = parseFloat(layerData.anim_y) || 0;
            const animZ = parseFloat(layerData.anim_z) || 0;
            const animPosDuration = parseInt(layerData.anim_pos_duration) || 0;
            
            if ((animX > 0 || animY > 0 || animZ > 0) && animPosDuration > 0) {
                console.log(` Layer ${i}: Adding animation (X:${animX}, Y:${animY}, Z:${animZ}, dur:${animPosDuration}ms)`);
                
                // Scale animation for ultrawide
                const scaleFactor = isUltrawide ? 0.3 : 1.0;
                
                if (animX > 0) {
                    const range = animX * scaleFactor;
                    layer.setAttribute('animation__x', `property: position.x; from: ${-range}; to: ${range}; dur: ${animPosDuration}; dir: alternate; loop: true; easing: easeInOutQuad`);
                }
                if (animY > 0) {
                    const range = animY * scaleFactor;
                    layer.setAttribute('animation__y', `property: position.y; from: ${-range}; to: ${range}; dur: ${animPosDuration * 1.1}; dir: alternate; loop: true; easing: easeInOutQuad`);
                }
                if (animZ > 0) {
                    const range = animZ * scaleFactor;
                    layer.setAttribute('animation__z', `property: position.z; from: ${zPos - range}; to: ${zPos + range}; dur: ${animPosDuration * 1.2}; dir: alternate; loop: true; easing: easeInOutQuad`);
                }
            }
            
            target.appendChild(layer);
        }
    }
    
    // Fallback: if no layers found, show a warning
    if (layerCount === 0) {
        console.warn('⚠️ No AR layers found for poster! AR overlay will be empty.');
    } else {
        console.log(` Created ${layerCount} AR layers from poster data`);
    }
    
    scene.appendChild(target);
    
    console.log(` MindAR target with ${layerCount} image layers added`);
    
    // Fix camera and renderer after scene is ready
    setTimeout(() => {
        const camera = scene.camera;
        const renderer = scene.renderer;
        
        if (camera) {
            // Fix camera near clipping (was 10, now 0.01)
            camera.near = 0.01;
            camera.far = 10000;
            camera.updateProjectionMatrix();
            console.log(' Camera near/far fixed:', camera.near, camera.far);
        }
        
        if (renderer) {
            const size = renderer.getSize(new THREE.Vector2());
            if (size.x === 0 || size.y === 0) {
                const canvas = renderer.domElement;
                renderer.setSize(canvas.width || 393, canvas.height || 556, false);
                console.log(' Renderer size fixed');
            }
        }
        
        // Force target and all layers visibility (dynamic)
        if (target.object3D) {
            target.object3D.visible = true;
            // Make all layers visible (1-8)
            for (let i = 1; i <= 8; i++) {
                const layer = document.getElementById(`ar-layer-${i}`);
                if (layer && layer.object3D) {
                    layer.object3D.visible = true;
                }
            }
            console.log(' Forced all elements visible');
        }
    }, 500);
    
    // Event listeners
    target.addEventListener('targetFound', () => {
        console.log(' Poster detected!');
        
        // Get the marker path from scene attribute
        const mindarAttr = scene.getAttribute('mindar-image');
        const sceneMarker = mindarAttr?.imageTargetSrc || null;
        console.log(' Scene marker:', sceneMarker);
        
        // ULTRAWIDE LENS OFFSET COMPENSATION
        // MindAR anchors incorrectly with ultrawide - apply positional offset
        if (window.cameraZoomLevel <= 0.6) {
            console.log('🔧 Applying ultrawide anchor offset correction');
            // The offset varies based on how far off MindAR's detection is
            // We'll apply a center-bias correction
            target.object3D.position.x = 0;      // Center horizontally
            target.object3D.position.y = 0;      // Center vertically  
            // Z position is critical - MindAR often detects too deep or too shallow
            // Keep it at detected position but log it
            console.log('📍 Target position after correction:', target.object3D.position);
        }
        
        // Switch to state 2 (detected poster)
        showSwipeState(2);
        
        // Find matching poster based on ar_marker field
        if (window.allPosters && window.allPosters.length > 0) {
            console.log('📋 All posters:', window.allPosters.map(p => ({
                title: p.title, 
                ar_marker: p.ar_marker,
                id: p.id
            })));
            
            // Try to match based on ar_marker field
            let matchedPoster = null;
            
            if (sceneMarker) {
                // Match by comparing ar_marker paths
                matchedPoster = window.allPosters.find(p => {
                    const posterMarker = p.ar_marker;
                    console.log(`🔎 Comparing: scene="${sceneMarker}" vs poster="${posterMarker}" (${p.title})`);
                    return posterMarker && sceneMarker.includes(posterMarker);
                });
            }
            
            // Fallback to first poster if no match found
            if (!matchedPoster) {
                console.warn('⚠️ No marker match found, using first poster as fallback');
                matchedPoster = window.allPosters[0];
            } else {
                console.log(' Matched poster:', matchedPoster.title, 'via ar_marker:', matchedPoster.ar_marker);
            }
            
            currentTrackedPoster = matchedPoster;
            document.getElementById('detected-poster-title').textContent = matchedPoster.title;
            console.log('📝 Updated footer title to:', matchedPoster.title);
            
            // Set featured poster voor galerij weergave
            console.log('🔵 CALLING setFeaturedPoster with:', matchedPoster.title);
            setFeaturedPoster(matchedPoster);
            console.log('🔵 AFTER setFeaturedPoster - featuredPoster is now:', featuredPoster?.title || 'null');
        }
        
        // LAZY LOAD GIFs: Laad nu pas de GIFs voor deze target
        loadLazyGifsForTarget(target);
        
        // Make ALL layers visible (dynamic 1-8)
        target.object3D.visible = true;
        for (let i = 1; i <= 8; i++) {
            const layer = document.getElementById(`ar-layer-${i}`);
            if (layer && layer.object3D) {
                layer.object3D.visible = true;
                console.log(` Layer ${i} visible:`, layer.object3D.visible, 'Position:', layer.object3D.position);
            }
        }
        
        // Log target transform
        console.log(' Target transform:', {
            position: target.object3D.position,
            rotation: target.object3D.rotation,
            scale: target.object3D.scale,
            matrixAutoUpdate: target.object3D.matrixAutoUpdate
        });
    });
    
    target.addEventListener('targetLost', () => {
        console.log('❌ Image target lost');
        
        // Switch back to state 1 (gallery button)
        showSwipeState(1);
        
        // UNLOAD GIFs: Verwijder GIF shaders om geheugen vrij te maken
        unloadLazyGifsForTarget(target);
        
        // Reset featured poster ALLEEN als galerij niet geopend is
        if (!isFeaturedPosterOpen) {
            console.log('📋 Galerij gesloten: featured poster reset');
            featuredPoster = null;
        } else {
            console.log('📋 Galerij geopend: featured poster blijft getoond');
        }

        currentTrackedPoster = null;
    });
    
    console.log(' MindAR target added');
}

// Setup AR Event Listeners (legacy, kept for compatibility)

// ==================== FEATURED POSTER MANAGEMENT ====================
// Wanneer een poster wordt gescand, toont de galerij die poster in 1-kolom groot
// De galerij blijft deze poster tonen totdat gebruiker sluit of poster uit-scanned

function setFeaturedPoster(poster) {
    featuredPoster = poster;
    console.log('⭐ Featured poster set:', poster.title);
    
    // Clear any existing auto-reset timer
    if (autoResetFeaturedPosterTimer) {
        clearTimeout(autoResetFeaturedPosterTimer);
        autoResetFeaturedPosterTimer = null;
    }
}

function resetFeaturedPoster() {
    featuredPoster = null;
    isFeaturedPosterOpen = false;
    console.log(' Featured poster reset');
    
    // Clear timer
    if (autoResetFeaturedPosterTimer) {
        clearTimeout(autoResetFeaturedPosterTimer);
        autoResetFeaturedPosterTimer = null;
    }
}

// Setup AR Event Listeners (legacy, kept for compatibility)

// Setup Swipe Bar Controls
function setupSwipeBarControls() {
    const closeDetectionBtn = document.getElementById('close-detection-btn');
    const swipeBar = document.getElementById('ar-footer-swipe-bar');
    const footerHeader = document.querySelector('.footer-header');
    
    // Close detection button (state 2) - returns to state 1 and gallery
    if (closeDetectionBtn) {
        closeDetectionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('❌ Closing detected poster, showing gallery...');
            
            // Switch back to state 1 (gallery)
            showSwipeState(1);
            currentTrackedPoster = null;
            
            // Collapse footer first
            swipeBar.classList.remove('detected-mode');
            swipeBar.classList.remove('expanded');
            
            // Clean up
            setTimeout(() => {
                const galleryContent = document.getElementById('gallery-content');
                delete galleryContent.dataset.loaded;
                isFeaturedPosterOpen = false; // Galerij dicht
                // Reset featured poster als die niet meer gescanned is
                if (!currentTrackedPoster) {
                    resetFeaturedPoster();
                }
            }, 400);
        });
    }
    
    // Drag up to expand footer/gallery (single unified element)
    let touchStartY = 0;
    let touchCurrentY = 0;
    let touchStartTime = 0;
    let isDragging = false;
    let startHeight = 0;
    
    footerHeader.addEventListener('touchstart', (e) => {
        // Ignore if touching the close button
        if (e.target.closest('.close-btn')) return;
        
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        touchStartTime = Date.now();
        isDragging = true;
        
        // Get current height
        const currentHeightVh = swipeBar.classList.contains('expanded') ? 94 : 6;
        startHeight = (currentHeightVh / 100) * window.innerHeight;
        
        // Remove transition for smooth dragging
        swipeBar.style.transition = 'none';
    });
    
    footerHeader.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        // Prevent page scroll/refresh when dragging footer
        e.preventDefault();
        
        touchCurrentY = e.touches[0].clientY;
        const deltaY = touchStartY - touchCurrentY; // Positive = drag up
        
        // Calculate new height (footer expands upward)
        const newHeight = Math.min(Math.max(startHeight + deltaY, window.innerHeight * 0.06), window.innerHeight * 0.94);
        swipeBar.style.height = `${newHeight}px`;
        
        // Show gallery content when dragging up
        const galleryContent = document.getElementById('gallery-content');
        if (deltaY > 20 && !galleryContent.dataset.loaded) {
            loadGalleryOverlay();
            galleryContent.dataset.loaded = 'true';
            galleryContent.style.opacity = '1'; // Direct visible, geen fade
        }
        
    }, { passive: false });
    
    footerHeader.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        const touchDuration = Date.now() - touchStartTime;
        const dragDistance = touchStartY - touchCurrentY;
        const dragPercent = (dragDistance / window.innerHeight) * 100;
        
        // Restore transition
        swipeBar.style.transition = 'height 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
        swipeBar.style.height = ''; // Let CSS class handle it
        
        const galleryContent = document.getElementById('gallery-content');
        galleryContent.style.transition = 'opacity 0.3s ease';
        
        const state1Active = document.getElementById('swipe-state-1').classList.contains('active');
        const state2Active = document.getElementById('swipe-state-2').classList.contains('active');
        
        const isExpanded = swipeBar.classList.contains('expanded');
        
        // If dragged more than 20% OR quick tap, toggle
        if (dragPercent > 20 || (touchDuration < 200 && Math.abs(dragDistance) < 10)) {
            if (!isExpanded && state1Active) {
                // Expand footer to show gallery
                swipeBar.classList.add('expanded');
                swipeBar.classList.remove('detected-mode');
                loadGalleryOverlay();
                galleryContent.dataset.loaded = 'true';
                isFeaturedPosterOpen = true; // Mark galerij als geopend
            } else if (!isExpanded && state2Active && currentTrackedPoster) {
                // Expand footer to show gallery with featured poster (gescande poster in 1 kolom)
                swipeBar.classList.add('expanded');
                swipeBar.classList.remove('detected-mode');
                loadGalleryOverlay();
                galleryContent.dataset.loaded = 'true';
                isFeaturedPosterOpen = true; // Mark galerij als geopend
            } else if (isExpanded) {
                // Collapse footer
                swipeBar.classList.remove('expanded');
                swipeBar.classList.remove('detected-mode');
                isFeaturedPosterOpen = false; // Galerij dicht
                setTimeout(() => {
                    delete galleryContent.dataset.loaded;
                    // Reset featured poster wanneer galerij sluit
                    // TENZIJ poster nog steeds gescand is (currentTrackedPoster is ingesteld)
                    if (!currentTrackedPoster) {
                        featuredPoster = null;
                        console.log('📋 Galerij gesloten & poster niet gescand: featured poster reset');
                    } else {
                        console.log('📋 Galerij gesloten maar poster NOG gescand: featured poster bijgehouden voor volgende open');
                    }
                }, 400);
            }
        }
        // Dragged down while expanded - collapse
        else if (dragPercent < -10 && isExpanded) {
            swipeBar.classList.remove('expanded');
            isFeaturedPosterOpen = false; // Galerij dicht
            setTimeout(() => {
                delete galleryContent.dataset.loaded;
                // Reset featured poster als die niet meer gescanned is
                if (!currentTrackedPoster) {
                    resetFeaturedPoster();
                }
            }, 400);
        }
        // Didn't drag far enough - snap to current state
        else if (isExpanded) {
            swipeBar.classList.add('expanded');
        } else {
            swipeBar.classList.remove('expanded');
            delete galleryContent.dataset.loaded;
        }
    }, { passive: true });
}



// Load Gallery Overlay with all posters
function loadGalleryOverlay() {
    const grid = document.getElementById('gallery-overlay-grid');
    if (!grid || !window.allPosters) return;
    
    console.log(' loadGalleryOverlay() called');
    console.log('� featuredPoster global variable:', featuredPoster?.title || 'null', 'Object:', featuredPoster);
    console.log('🔵 currentTrackedPoster global variable:', currentTrackedPoster?.title || 'null', 'Object:', currentTrackedPoster);
    console.log('📋 Posters array length:', window.allPosters.length);
    
    // Remove old override styles if they exist
    const oldStyle = document.getElementById('gallery-override-styles');
    if (oldStyle) oldStyle.remove();
    
    // FEATURED POSTER MODE: Als een poster is gescand, toon die groot in 1 kolom
    if (featuredPoster) {
        console.log('⭐ FEATURED MODE ACTIVE - Rendering poster:', featuredPoster.title);
        const imageUrl = featuredPoster.thumbnail ? `${BASE_URL}${featuredPoster.thumbnail}` : 'img/placeholder.png';
        const hasAR = window.arPosters && window.arPosters.some(p => p.id == featuredPoster.id);
        const arBadge = hasAR ? '<span class="ar-badge">AR</span>' : '';
        
        // Featured poster in 1 kolom (groot)
        grid.innerHTML = `
        <div class="overlay-poster-card featured-mode" data-poster-id="${featuredPoster.id}" data-has-ar="${hasAR}">
            <img src="${imageUrl}" alt="${featuredPoster.title}" onerror="this.src='img/placeholder.png'">
            <div class="card-info featured-info">
                <h3>${featuredPoster.title} ${arBadge}</h3>
                <div class="card-meta">
                    <span>>> DOWNLOADS: ${featuredPoster.downloads || 0}</span>
                    <span>>> ID: ${featuredPoster.id.substring(0, 6)}</span>
                </div>
            </div>
        </div>
        `;
        console.log('📝 Featured HTML set. Grid innerHTML length:', grid.innerHTML.length);
        
        // Featured poster styles (1 kolom, groot) - VERWIJDERD, deze gaan nu in gallery-card-styles
        // Alle CSS is nu gecentraliseerd in gallery-card-styles
        
        // Add grid class
        grid.classList.add('featured-grid');
        console.log(' Added featured-grid class. Grid classes now:', grid.className);
        
    } else {
        // NORMAL GALLERY MODE: Toon alle posters in 2 kolommen
        console.log(' NORMAL MODE - Rendering all posters (featured=null)');
        grid.classList.remove('featured-grid');
        
        grid.innerHTML = window.allPosters.map(poster => {
            const imageUrl = poster.thumbnail ? `${BASE_URL}${poster.thumbnail}` : 'img/placeholder.png';
            const hasAR = window.arPosters && window.arPosters.some(p => p.id == poster.id);
            const arBadge = hasAR ? '<span class="ar-badge">AR</span>' : '';
            return `
            <div class="overlay-poster-card" data-poster-id="${poster.id}" data-has-ar="${hasAR}">
                <img src="${imageUrl}" alt="${poster.title}" onerror="this.src='img/placeholder.png'">
                <div class="card-info">
                    <h3>${poster.title} ${arBadge}</h3>
                    <div class="card-meta">
                        <span>>> DOWNLOADS: ${poster.downloads || 0}</span>
                        <span>>> ID: ${poster.id.substring(0, 6)}</span>
                    </div>
                </div>
            </div>
        `;
        }).join('');
        console.log('📝 Normal HTML set. Grid item count:', window.allPosters.length);
    }
    
    // FORCE gallery styles via JavaScript (CSS caching issue workaround)
    // Deze styles gelden voor BEIDE featured en normale modus
    if (!document.getElementById('gallery-card-styles')) {
        const galleryStyle = document.createElement('style');
        galleryStyle.id = 'gallery-card-styles';
        galleryStyle.textContent = `
                /* NORMALE GALERIJ MODE - 2 KOLOMMEN */
                #gallery-overlay-grid:not(.featured-grid) {
                    display: grid !important;
                    grid-template-columns: repeat(2, 1fr) !important;
                    gap: 2px !important;
                    padding: 8px !important;
                    padding-bottom: 1rem !important;
                    background: var(--black) !important;
                }
                
                /* FEATURED POSTER MODE - 1 KOLOM */
                #gallery-overlay-grid.featured-grid {
                    display: grid !important;
                    grid-template-columns: 1fr !important;
                    gap: 0 !important;
                    padding: 0 !important;
                    background: var(--black) !important;
                }
                
                .overlay-poster-card {
                    background: var(--black) !important;
                    overflow: hidden !important;
                    cursor: pointer !important;
                    position: relative !important;
                    aspect-ratio: 1 / 1.4142 !important;
                    border: 0.5px solid var(--white) !important;
                    transition: all 0.1s ease !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    display: block !important;
                }
                
                #gallery-overlay-grid.featured-grid .overlay-poster-card {
                    border: none !important;
                    max-height: 75vh !important;
                }
                
                .overlay-poster-card:active {
                    opacity: 0.7 !important;
                    border-color: var(--white) !important;
                }
                
                #gallery-overlay-grid.featured-grid .overlay-poster-card:active {
                    opacity: 0.9 !important;
                }
                
                .overlay-poster-card img {
                    width: 100% !important;
                    height: 100% !important;
                    display: block !important;
                    object-fit: cover !important;
                }
                
                .overlay-poster-card .card-info {
                    position: absolute !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    padding: 4px !important;
                    background: rgba(0, 0, 0, 0.85) !important;
                    border-top: 0.5px solid var(--dim) !important;
                }
                
                #gallery-overlay-grid.featured-grid .card-info {
                    padding: 8px !important;
                    background: rgba(0, 0, 0, 0.9) !important;
                }
                
                .overlay-poster-card h3 {
                    padding: 0 !important;
                    margin: 0 !important;
                    font-size: 0.6rem !important;
                    font-weight: 400 !important;
                    color: var(--white) !important;
                    letter-spacing: 0.05em !important;
                    text-transform: uppercase !important;
                    font-family: var(--font-data) !important;
                    line-height: 1.1 !important;
                }
                
                #gallery-overlay-grid.featured-grid .overlay-poster-card h3 {
                    font-size: 0.9rem !important;
                    margin: 0 0 4px 0 !important;
                }
                
                .card-meta {
                    display: none !important;
                }
                
                #gallery-overlay-grid.featured-grid .card-meta {
                    display: block !important;
                }
                
                #gallery-overlay-grid.featured-grid .card-meta span {
                    display: block !important;
                    font-size: 0.65rem !important;
                    color: var(--dim) !important;
                    line-height: 1.4 !important;
                    font-family: var(--font-data) !important;
                }
                
                @media (min-width: 768px) {
                    #gallery-overlay-grid:not(.featured-grid) {
                        grid-template-columns: repeat(3, 1fr) !important;
                        gap: 2px !important;
                        padding: 10px !important;
                    }
                }
        `;
        document.head.appendChild(galleryStyle);
        console.log(' Gallery card styles injected');
    }
    
    // Add AR badge styles (minimal)
    if (!document.getElementById('ar-badge-styles')) {
        const badgeStyle = document.createElement('style');
        badgeStyle.id = 'ar-badge-styles';
        badgeStyle.textContent = `
            .ar-badge { 
                background: var(--white); 
                color: var(--black); 
                padding: 2px 4px; 
                font-size: 0.55rem; 
                margin-left: 4px;
                vertical-align: text-top;
                font-family: var(--font-data);
                letter-spacing: 0.05em;
            }
            
            /* Poster window system (draggable popups) */
            .poster-window {
                position: fixed;
                background: var(--black);
                border: 0.5px solid var(--white);
                border-radius: 2px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
                min-width: 280px;
                max-width: 90vw;
                max-height: 85vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            .window-header {
                background: var(--black);
                border-bottom: 0.5px solid var(--white);
                padding: 8px 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: grab;
                user-select: none;
                font-family: var(--font-data);
                font-size: 0.75rem;
                font-weight: 400;
                color: var(--white);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            
            .window-header:active {
                cursor: grabbing;
            }
            
            .window-title {
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .window-close-btn {
                background: transparent;
                border: none;
                color: var(--white);
                font-family: var(--font-data);
                font-size: 0.9rem;
                cursor: pointer;
                padding: 0 4px;
                margin-left: 8px;
            }
            
            .window-close-btn:active {
                opacity: 0.7;
            }
            
            .window-content {
                flex: 1;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .window-image {
                width: 100%;
                aspect-ratio: 1 / 1.4142;
                overflow: hidden;
                border: 0.5px solid var(--white);
            }
            
            .window-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .window-info {
                font-size: 0.7rem;
                font-family: var(--font-data);
                color: var(--white);
                line-height: 1.6;
            }
            
            .window-info p {
                margin: 0 0 6px 0;
                color: var(--dim);
            }
            
            .window-info strong {
                color: var(--white);
                display: block;
                font-size: 0.65rem;
                letter-spacing: 0.05em;
                margin-bottom: 2px;
            }
        `;
        document.head.appendChild(badgeStyle);
    }

    
    // Add click handlers - Show popup dossier for ALL posters
    grid.querySelectorAll('.overlay-poster-card').forEach(card => {
        card.addEventListener('click', async () => {
            const posterId = card.dataset.posterId;
            console.log('🖱️ Poster clicked:', posterId, 'Total posters:', window.allPosters?.length);
            // Show as draggable popup window (like desktop dossier system)
            showPosterWindow(posterId);
        });
    });
}

// Mobile window system - draggable popup dossiers (like desktop file manager)
window.posterWindows = window.posterWindows || new Map(); // Store open windows
window.nextWindowZIndex = 1000;

async function showPosterWindow(posterId) {
    console.log('📍 showPosterWindow called with:', posterId);
    console.log(' window.allPosters:', window.allPosters?.length || 0);
    console.log('🪟 posterWindows already open:', window.posterWindows?.size || 0);
    
    // If window already open, bring to front
    if (window.posterWindows && window.posterWindows.has(posterId)) {
        const existing = document.getElementById(`poster-window-${posterId}`);
        if (existing) {
            existing.style.zIndex = window.nextWindowZIndex++;
            console.log('↑ Window already open, bringing to front');
            return;
        }
    }

    // Initialize poster windows map if needed
    if (!window.posterWindows) {
        window.posterWindows = new Map();
        window.nextWindowZIndex = 999999;
    }

    // Fetch poster data - try API first, fallback to window.allPosters
    let poster = null;
    try {
        const response = await fetch(`${API_URL}/posters/${posterId}`);
        if (response.ok) poster = await response.json();
        console.log(' API fetch successful');
    } catch (e) {
        console.log('❌ API fetch failed:', e.message);
    }
    
    // Fallback to cached posters
    if (!poster && window.allPosters && Array.isArray(window.allPosters)) {
        console.log(' Looking in cached posters array...');
        poster = window.allPosters.find(p => p.id === posterId);
        if (poster) console.log(' Found in cache:', poster.title);
    }
    
    if (!poster) {
        console.error('❌ Poster not found:', posterId, 'Available posters:', window.allPosters);
        return;
    }

    // Create popup window
    const windowEl = document.createElement('div');
    windowEl.id = `poster-window-${posterId}`;
    // NO CLASS - use only inline styles
    windowEl.style.position = 'fixed';
    windowEl.style.display = 'flex';
    windowEl.style.flexDirection = 'column';
    windowEl.style.background = '#000';
    windowEl.style.border = '0.5px solid #fff';
    windowEl.style.borderRadius = '2px';
    windowEl.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.8)';
    windowEl.style.minWidth = '240px';
    windowEl.style.maxWidth = '240px';
    windowEl.style.maxHeight = '80vh';
    windowEl.style.overflow = 'hidden';
    windowEl.style.fontFamily = 'Roboto Mono, monospace';
    windowEl.style.color = '#fff';
    windowEl.style.pointerEvents = 'auto'; // CRITICAL: Re-enable pointer events on the window itself
    
    // CRITICAL: Set z-index VERY high to be above AR scene and all other elements
    if (!window.nextWindowZIndex) window.nextWindowZIndex = 1000001;
    const zIdx = window.nextWindowZIndex++;
    windowEl.style.zIndex = zIdx;
    
    // Random position - BOUNDED so 95% of window is ALWAYS visible
    const windowWidth = 240;  // Match minWidth/maxWidth
    const windowHeight = 400; // Approximate window height
    
    // Safe bounds: ensure 95% of window is visible (5% margin)
    const minMargin = Math.min(windowWidth, windowHeight) * 0.05;
    const maxX = Math.max(0, window.innerWidth - (windowWidth * 0.95));
    const maxY = Math.max(0, window.innerHeight - (windowHeight * 0.95));
    
    const randomX = Math.max(minMargin, Math.floor(Math.random() * maxX));
    const randomY = Math.max(minMargin, Math.floor(Math.random() * maxY));
    
    windowEl.style.left = `${randomX}px`;
    windowEl.style.top = `${randomY}px`;
    
    console.log(`🪟 Creating window at (${randomX}, ${randomY}) with z-index ${zIdx}`);
    console.log(' Poster data:', poster);

    windowEl.innerHTML = `
        <div style="background: #000; border-bottom: 0.5px solid #fff; padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; cursor: grab; user-select: none; font-family: Roboto Mono; font-size: 0.65rem; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0;" class="window-header">
            <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.7rem;">${poster.title || 'Poster'}</span>
            <button style="background: transparent; border: none; color: #fff; font-family: Roboto Mono; font-size: 0.8rem; cursor: pointer; padding: 0 3px; margin-left: 4px; flex-shrink: 0;" class="window-close-btn">[X]</button>
        </div>
        <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 6px;">
            <!-- FOTO -->
            <div style="width: 100%; aspect-ratio: 1 / 1.4142; overflow: hidden; border: 0.5px solid #fff; flex-shrink: 0; background: #111;">
                <img src="${poster.jpeg_filename ? '/uploads/' + poster.jpeg_filename : 'img/placeholder.png'}" alt="${poster.title}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='img/placeholder.png'">
            </div>
            
            <!-- DATA: 2 KOLOMMEN GRID -->
            <div style="font-family: Roboto Mono; font-size: 0.6rem; color: #888; line-height: 1.4; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 6px;">
                ${poster.location_description ? `<div><span style="color: #fff; font-weight: bold; font-size: 0.58rem; letter-spacing: 0.05em;">LOCATIE</span><br><span style="color: #888; font-size: 0.58rem;">${poster.location_description}</span></div>` : ''}
                ${poster.downloads !== undefined && poster.downloads !== null ? `<div><span style="color: #fff; font-weight: bold; font-size: 0.58rem; letter-spacing: 0.05em;">DL</span><br><span style="color: #888; font-size: 0.58rem;">${poster.downloads}</span></div>` : ''}
                ${formatCredits(poster)}
                ${poster.artikel_link ? `<div><span style="color: #fff; font-weight: bold; font-size: 0.58rem; letter-spacing: 0.05em;">LINK</span><br><a href="${poster.artikel_link}" style="color: #fff; text-decoration: underline; font-size: 0.58rem;" target="_blank">artikel</a></div>` : ''}
                ${poster.description ? `<div style="grid-column: 1 / -1;"><span style="color: #fff; font-weight: bold; font-size: 0.58rem; letter-spacing: 0.05em;">DESC</span><br><span style="color: #888; font-size: 0.58rem;">${poster.description}</span></div>` : ''}
            </div>
            
            <!-- DOWNLOAD BUTTONS - 2 KOLOMMEN HORIZONTAAL -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-top: 2px;">
                <button onclick="window.location.href='/uploads/${poster.jpeg_filename}'" style="background: #000; color: #fff; border: 0.5px solid #fff; padding: 4px 2px; font-family: Roboto Mono; font-size: 0.58rem; cursor: pointer; text-align: center; font-weight: bold;">JPEG</button>
                <button onclick="window.location.href='/uploads/${poster.pdf_medium_filename}'" style="background: #000; color: #fff; border: 0.5px solid #fff; padding: 4px 2px; font-family: Roboto Mono; font-size: 0.58rem; cursor: pointer; text-align: center; font-weight: bold;">PDF</button>
            </div>
        </div>
    `;

    document.getElementById('popup-windows-container').appendChild(windowEl);
    window.posterWindows.set(posterId, windowEl);

    console.log(' Window added to popup container. Check for element:', document.getElementById(`poster-window-${posterId}`) ? 'FOUND ✓' : 'NOT FOUND ✗');

    // Close button
    windowEl.querySelector('.window-close-btn').addEventListener('click', () => {
        windowEl.remove();
        window.posterWindows.delete(posterId);
        console.log(' Poster window closed:', posterId);
    });

    // Drag functionality
    const header = windowEl.querySelector('div[style*="border-bottom"]'); // Find the header div by its unique style
    if (!header) {
        console.error('❌ Header div not found!');
        return;
    }
    
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0, windowStartX = 0, windowStartY = 0;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        windowStartX = windowEl.offsetLeft;
        windowStartY = windowEl.offsetTop;
        windowEl.style.zIndex = window.nextWindowZIndex++;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        windowEl.style.left = `${windowStartX + deltaX}px`;
        windowEl.style.top = `${windowStartY + deltaY}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch drag (mobile)
    let touchDragging = false;
    let touchStartX = 0, touchStartY = 0;
    header.addEventListener('touchstart', (e) => {
        touchDragging = true;
        windowEl.style.zIndex = window.nextWindowZIndex++;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        windowStartX = windowEl.offsetLeft;
        windowStartY = windowEl.offsetTop;
    });

    document.addEventListener('touchmove', (e) => {
        if (!touchDragging || windowEl !== document.getElementById(`poster-window-${posterId}`)) return;
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        windowEl.style.left = `${Math.max(0, windowStartX + deltaX)}px`;
        windowEl.style.top = `${Math.max(0, windowStartY + deltaY)}px`;
    }, { passive: true });

    document.addEventListener('touchend', () => {
        touchDragging = false;
    });
}

// Show detected poster details in expanded footer
function showDetectedPosterDetails(poster) {
    // In AR mode, we might not have the desktop UI elements.
    // Silently fail or log debug instead of error if container is missing.
    const detailsContainer = document.getElementById('detected-poster-details');
    if (!detailsContainer) {
        // console.log('ℹ️ No details container found (normal in AR mode)');
        return;
    }
    
    if (!poster) return;
    
    console.log(' showDetectedPosterDetails called with:', {
        title: poster?.title,
        ar_marker: poster?.ar_marker,
        id: poster?.id
    });
    
    const imageUrl = poster.thumbnail ? `${BASE_URL}${poster.thumbnail}` : 'img/placeholder.png';
    
    detailsContainer.innerHTML = `
        <img src="${imageUrl}" alt="${poster.title}" onerror="this.src='img/placeholder.png'">
        <h2>${poster.title}</h2>
        ${poster.description ? `<p><strong>Beschrijving:</strong> ${poster.description}</p>` : ''}
        ${poster.location ? `<p><strong>Locatie:</strong> ${poster.location}</p>` : ''}
        ${(() => {
            // Credits weergave
            let credits = [];
            if (poster.credits) {
                try {
                    credits = typeof poster.credits === 'string' ? JSON.parse(poster.credits) : poster.credits;
                } catch (e) {
                    credits = [{ item: 'Credit', owner: poster.credits }];
                }
            } else if (poster.photographer_credit || poster.photographer) {
                credits = [{ item: 'Foto', owner: poster.photographer_credit || poster.photographer }];
            }
            if (credits.length === 0) return '';
            return credits.filter(c => c.item || c.owner).map(c => 
                `<p><strong>${c.item || 'Credit'}:</strong> ${c.owner || '-'}</p>`
            ).join('');
        })()}
        ${poster.ar_marker ? `<p style="font-size: 0.8rem; color: #666;"><strong>AR Marker:</strong> ${poster.ar_marker}</p>` : ''}
    `;
    
    console.log(' Detected poster details loaded:', poster.title);
}

// Show swipe bar state
function showSwipeState(state) {
    const state1 = document.getElementById('swipe-state-1');
    const state2 = document.getElementById('swipe-state-2');
    
    if (state === 1) {
        state1.classList.add('active');
        state2.classList.remove('active');
    } else if (state === 2) {
        state1.classList.remove('active');
        state2.classList.add('active');
    }
}

// Show desktop view (fallback)
async function showDesktopView() {
    if (isMobileDevice) {
        // Mobile device without HTTPS - show mobile UI with gallery only
        document.getElementById('desktop-view').style.display = 'none';
        document.getElementById('mobile-ar-view').style.display = 'flex';
        
        // Hide AR scene, show footer for gallery access
        const arScene = document.querySelector('a-scene');
        if (arScene) arScene.style.display = 'none';
        
        const footer = document.getElementById('ar-footer-swipe-bar');
        if (footer) {
            footer.style.display = 'flex';
            showSwipeState(1); // Show gallery state
        }
        
        // Load posters for gallery
        try {
            const response = await fetch(`${API_URL}/posters`);
            if (response.ok) {
                window.allPosters = await response.json();
                console.log(' Loaded', window.allPosters.length, 'posters for gallery');
            }
        } catch (error) {
            console.error('Error loading posters:', error);
            window.allPosters = [];
        }
        
        // Setup swipe controls for footer
        setupSwipeBarControls();
        

        
    } else {
        // Desktop - show desktop view
        document.getElementById('desktop-view').style.display = 'block';
        document.getElementById('mobile-ar-view').style.display = 'none';
    }
}

let currentPoster = null;

// Loader State Management
const loadedGifs = new Set();

// Renamed to avoid conflict with new global loader logic
function showGifLoader() {
    // Re-using the same loader for GIF loading feedback
    const loader = document.getElementById('hacker-loader');
    if (loader) {
        loader.classList.add('visible');
        logToLoader('VISUALS_DECRYPTEN...', 'warning');
    }
}

function hideGifLoader() {
    // Only hide if we are not in init phase? 
    // Actually, init phase loader hides itself.
    const loader = document.getElementById('hacker-loader');
    if (loader) loader.classList.remove('visible');
}

// ==================== MAIN INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log(' DOM Content Loaded');
    
    // NOTE: Camera spacing is now handled in CSS (#ar-scene rules in style.css)
    // with top: 75px, left/right: 16px, bottom: 16px
    // No JavaScript workaround needed anymore!
    
    console.log(' Camera spacing ingesteld via CSS (16px op alle zijden)');
    
    // Listen for GIF loaded events van de gif-component
    window.addEventListener('gif-loaded', (e) => {
        console.log('🎞️ GIF geladen:', e.detail.src);
        if (e.detail && e.detail.src) {
            loadedGifs.add(e.detail.src);
            
            // Check of we de loader kunnen verbergen
            if (currentTrackedPoster) {
                checkAndHideLoader(currentTrackedPoster);
            }
        }
    });
    
    // Listen for GIF errors
    window.addEventListener('gif-error', (e) => {
        console.warn('🎞️ GIF fout:', e.detail.src);
        // Tel ook errors als "geladen" zodat we niet blijven wachten
        if (e.detail && e.detail.src) {
            loadedGifs.add(e.detail.src);
            if (currentTrackedPoster) {
                checkAndHideLoader(currentTrackedPoster);
            }
        }
    });

    try {
        // Detect device type
        isMobileDevice = detectMobileDevice();
        isARSupported = checkARSupport();
        
        console.log(' Detection Results:', {
            isMobileDevice,
            isARSupported,
            decision: (isMobileDevice && isARSupported) ? 'AR Mode' : 'Desktop Mode'
        });
        
        // Check if HTTPS or localhost
        const isHTTPS = window.location.protocol === 'https:';
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isMobileDevice && isARSupported) {
            if (isHTTPS || isLocalhost) {
                console.log(' Starting AR mode with dynamic MindAR scene...');
                
                // Initialize AR mode - this will fetch posters and create the scene
                initializeARMode().then(() => {
                    hideLoader();
                });
            } else {
                console.log('⚠️ Camera requires HTTPS - showing desktop mode');
                console.log('💡 Upload to HTTPS website to enable AR');
                showDesktopView();
                initFileManager();
                setupModal();
                hideLoader();
            }
        } else {
            console.log('🖥️ Initializing Desktop Mode...');
            showDesktopView();
            initFileManager();
            setupModal();
            hideLoader();
        }
    } catch (error) {
        console.error('❌ Critical error in DOMContentLoaded:', error);
        console.log('⤴️ Falling back to desktop mode');
        showDesktopView();
        initFileManager();
        setupModal();
    }
});

// ==================== DESKTOP GALLERY FUNCTIONS ====================
// (Keep all existing desktop functions from main.js)

// Laad posters van de server
async function loadPosters() {
    const grid = document.getElementById('poster-grid');
    
    // If no poster grid, this function shouldn't be called (should use initFileManager instead)
    if (!grid) {
        console.log('ℹ️ No poster-grid found - file-manager.js likely handles this');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/posters`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            try {
                const errorJson = JSON.parse(errorText);
                console.error('❌ API Error Details:', errorJson);
            } catch (e) {
                console.error('❌ Raw Error:', errorText);
            }
            throw new Error('Kan posters niet laden: ' + response.status);
        }
        
        const posters = await response.json();
        displayPosters(posters);
    } catch (error) {
        console.error('Error loading posters:', error);
        const grid = document.getElementById('poster-grid');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <p style="color: #7f8c8d; font-size: 1.2rem;">
                        Geen posters gevonden. Start de server om posters te laden.
                    </p>
                </div>
            `;
        }
    }
}

// Display posters in grid
function displayPosters(posters) {
    const grid = document.getElementById('poster-grid');
    if (!grid) {
        console.log('ℹ️ No poster-grid found - file-manager.js likely handles this');
        return;
    }
    
    grid.innerHTML = posters.map(poster => {
        const imageUrl = poster.thumbnail ? `${BASE_URL}${poster.thumbnail}` : 'img/placeholder.png';
        const uploadDate = poster.upload_date || poster.uploadDate || poster.created_at;
        return `
        <div class="poster-card" data-poster-id="${poster.id}">
            <img class="poster-image" src="${imageUrl}" alt="${poster.title}" onerror="this.src='img/placeholder.png'">
            <div class="poster-info">
                <h3 class="poster-title">${poster.title}</h3>
                <p class="poster-date">${uploadDate ? new Date(uploadDate).toLocaleDateString('nl-NL') : ''}</p>
                <p class="poster-downloads">Downloads: ${poster.downloads || 0}</p>
            </div>
        </div>
    `;
    }).join('');
    
    // Add click handlers
    grid.querySelectorAll('.poster-card').forEach(card => {
        card.addEventListener('click', () => {
            const posterId = card.dataset.posterId;
            showPosterModal(posterId);
        });
    });
}

// Show poster modal
async function showPosterModal(posterId) {
    try {
        const response = await fetch(`${API_URL}/posters/${posterId}`);
        if (!response.ok) throw new Error('Kan poster niet laden');
        
        const poster = await response.json();
        currentPoster = poster;
        
        // Update modal content
        const imageUrl = poster.thumbnail ? `${BASE_URL}${poster.thumbnail}` : (poster.jpeg_url ? `${BASE_URL}${poster.jpeg_url}` : 'img/placeholder.png');
        document.getElementById('modal-poster-img').src = imageUrl;
        document.getElementById('modal-poster-img').onerror = function() { this.src = 'img/placeholder.png'; };
        document.getElementById('modal-poster-title').textContent = poster.title;
        document.getElementById('modal-poster-description').textContent = poster.description || '';
        
        // Location info
        let locationText = '';
        if (poster.location_description) {
            locationText = poster.location_description;
        }
        if (poster.latitude && poster.longitude) {
            locationText += locationText ? ` (${poster.latitude}, ${poster.longitude})` : `${poster.latitude}, ${poster.longitude}`;
        }
        document.getElementById('modal-poster-location').textContent = locationText ? `Locatie: ${locationText}` : '';
        
        // Article link
        document.getElementById('modal-poster-article').innerHTML = poster.artikel_link ? `<a href="${poster.artikel_link}" target="_blank">Lees het originele artikel</a>` : '';
        
        // Credits weergave (meerdere credits)
        const creditsEl = document.getElementById('modal-poster-photographer');
        if (creditsEl) {
            let credits = [];
            // Parse credits
            if (poster.credits) {
                try {
                    credits = typeof poster.credits === 'string' ? JSON.parse(poster.credits) : poster.credits;
                } catch (e) {
                    credits = [{ item: 'Foto', owner: poster.credits }];
                }
            } else if (poster.photographer_credit) {
                credits = [{ item: 'Foto', owner: poster.photographer_credit }];
            }
            
            if (credits.length > 0) {
                const creditsText = credits
                    .filter(c => c.item || c.owner)
                    .map(c => `${c.item || 'Credit'}: ${c.owner || '-'}`)
                    .join(' | ');
                creditsEl.textContent = creditsText;
            } else {
                creditsEl.textContent = '';
            }
        }
        
        // Download count
        document.getElementById('modal-download-count').textContent = poster.downloads || 0;
        
        // Show modal
        document.getElementById('download-modal').style.display = 'block';
    } catch (error) {
        console.error('Error loading poster:', error);
    }
}

// Setup modal
function setupModal() {
    const modal = document.getElementById('download-modal');
    if (!modal) {
        console.log('ℹ️ No download-modal found');
        return;
    }
    
    const closeBtn = modal.querySelector('.close');
    if (!closeBtn) return;
    
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Download buttons
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const format = e.target.dataset.format;
            const size = e.target.dataset.size;
            
            if (!currentPoster) return;
            
            const url = `${API_URL}/download/${currentPoster.id}?format=${format}&size=${size}`;
            window.location.href = url;
        });
    });
}
