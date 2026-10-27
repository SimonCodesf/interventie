// Interventie — AR Posters & Web Platform (A-Frame + 8th Wall XR Engine)
// Multi-Chunk Engine: ondersteunt alle 237 Belgische verkeersborden + actieve posters.
//
// This product includes the XR Engine software developed by Niantic Spatial, Inc.
// Copyright © 2026 Niantic Spatial, Inc. All rights reserved.
// License: https://github.com/8thwall/engine/blob/main/LICENSE

// ==================== CONFIGURATIE & GLOBALS ====================

const BASE_URL = window.location.origin;
const API_URL = `${BASE_URL}/api.php`;
const LOST_GRACE_MS = 1200; // Grace-periode: voorkomt knipperen bij korte haperingen
const SCRIPT_TIMEOUT_MS = 45000;

let currentTrackedPoster = null;
let featuredPoster = null;
let currentPoster = null; // Voor download modal
let currentAudioElement = null; // Huidige poster audio
let audioVolume = 0.5;
let bootStarted = false;
let bootTime = 0;

// Chunk State & 8th Wall Controller
let xrControllerInstance = null;
let arChunks = [];
let currentChunkIndex = 0;
window.currentChunkIndex = 0;
window.chunkLocked = false;
let isChunkScanning = false;
let chunkScanTimeout = null;
let chunkScanInterval = null;

// Universal Simultaneous 237-Target Mode
let allUniversalTargets = [];
let isUniversalActive = false;
let isRadarScanning = false;
let radarInterval = null;
let radarTimeout = null;

let chunkQuickPickerOpen = false;
let chunkLongPressTimer = null;
let chunkLongPressTriggered = false;

// Metingen & Telemetrie
let foundCount = 0, lostCount = 0, firstFoundAt = 0;
let jitterSum = 0, jitterCount = 0, frameCount = 0;
const anchorState = {}; // targetName -> { visible, lastPos, hideTimer, foundAt }

// DOM helpers
const sceneBox = () => document.getElementById('ar-scene');

// ==================== HACKER LOADER LOGGER ====================

const logQueue = [];
let isProcessingQueue = false;
let queueTimeout = null;

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

    const randomDelay = Math.floor(Math.random() * 380) + 20;
    queueTimeout = setTimeout(processLogQueue, randomDelay);
}

function logToLoader(msg, type = 'info') {
    if (!msg || typeof msg !== 'string') return;

    // 1. Clean Emojis
    msg = msg.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();

    // 2. Translate & Simplify (Dutch)
    if (msg.includes('Fetching posters') || msg.includes('FETCHING_DATASETS')) { msg = 'POSTERS OPHALEN...'; }
    else if (msg.includes('Fetched') || msg.includes('DATA GELADEN')) { msg = 'DATA GELADEN'; }
    else if (msg.includes('Switching to AR') || msg.includes('INITIALIZING_XR')) { msg = 'AR STARTEN...'; }
    else if (msg.includes('CAMERA_PERMISSION_GRANTED') || msg.includes('AR view displayed')) { msg = 'CAMERA ACTIEF'; }
    else if (msg.includes('CHECKING_WEBGL') || msg.includes('WebGL available')) { msg = 'GPU GEREED'; }
    else if (msg.includes('8TH_WALL_XR_READY') || msg.includes('MindAR ready')) { msg = 'AR ENGINE GEREED'; }
    else if (msg.includes('Poster GEVONDEN') || msg.includes('Bord GEVONDEN') || msg.includes('TARGET FOUND')) {
        const parts = msg.split(':');
        const title = (parts[1] || '').trim();
        msg = 'GEVONDEN: ' + (title ? title.substring(0, 16) : 'TARGET');
    }
    else if (msg.includes('Poster lost') || msg.includes('Target lost') || msg.includes('verloren') || msg.includes('TARGET LOST')) { msg = 'ZOEKEN...'; }
    else if (msg.includes('Wisselen naar chunk') || msg.includes('Switching target')) { msg = 'DOEL WISSELEN'; }
    else if (msg.includes('Starting scan') || msg.includes('Start chunk scan')) { msg = 'SCAN STARTEN...'; }
    else if (msg.includes('Scan stopped')) { msg = 'SCAN GESTOPT'; }
    else if (msg.includes('Completed cycle')) { msg = 'CYCLUS VOLTOOID'; }
    else if (msg.includes('REQUESTING_CAMERA') || msg.includes('Requesting camera')) { msg = 'CAMERA TOEGANG VRAGEN...'; }
    else if (msg.includes('SYSTEM_READY') || msg.includes('SYSTEM_ONLINE')) { msg = 'SYSTEEM GEREED'; }
    else if (msg.includes('CONFIGURING_TARGETS')) { msg = 'TARGETS CONFIGUREREN...'; }
    else if (msg.includes('BUILDING_3D_SCENE')) { msg = '3D SCENE OPBOUWEN...'; }
    else if (msg.includes('GIF') || msg.includes('Visuals')) { msg = 'VISUALS LADEN...'; }

    if (msg.length < 2) return;
    
    logQueue.push(msg.toUpperCase());
    
    if (!isProcessingQueue) {
        processLogQueue();
    }
}

function appendLoaderLog(text) {
    logToLoader(text);
}

function hideLoader() {
    // Verberg de ticker nooit: houd actief als statusbalk onderaan
    logToLoader('SYSTEEM GEREED');
}

// Hook console.log om automatisch de loader ticker te voeden
const originalLog = console.log;
console.log = function(...args) {
    originalLog.apply(console, args);
    const msg = args.join(' ');
    const keywords = [
        'Fetching', 'Fetched', 'Switching', 'AR view', 'WebGL', 'Chunk', 'Starting', 
        'Poster', 'Target', 'GIF', 'SYSTEM_READY', 'Camera', 'API', 'Scan', 
        'TARGET', 'Layers', 'Requesting', 'Bord GEVONDEN', 'Poster GEVONDEN',
        'verloren', 'INITIALIZING', 'CONFIGURING', 'SYSTEM_ONLINE'
    ];
    if (keywords.some(k => msg.includes(k))) {
        logToLoader(msg);
    }
};

// ==================== SCRIPT LADEN / RESOLVEN ====================

const scriptPromises = {};
let scriptChain = Promise.resolve();

function loadScript(src, attrs) {
    const key = src + JSON.stringify(attrs || {});
    if (scriptPromises[key]) return scriptPromises[key].raw;

    let resolveRaw, rejectRaw;
    const raw = new Promise((resolve, reject) => { resolveRaw = resolve; rejectRaw = reject; });
    scriptPromises[key] = { raw };

    const p = scriptChain.then(() => {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            if (attrs) {
                Object.keys(attrs).forEach(k => s.setAttribute(k, attrs[k]));
            }
            const to = setTimeout(() => {
                reject(new Error('Timeout bij laden van ' + src.split('/').pop()));
            }, SCRIPT_TIMEOUT_MS);
            s.onload = () => { clearTimeout(to); resolve(); };
            s.onerror = () => {
                clearTimeout(to);
                reject(new Error('Script niet geladen: ' + src.split('/').pop()));
            };
            document.head.appendChild(s);
        });
    });

    p.then(resolveRaw, rejectRaw);
    scriptChain = p.catch(() => {});
    return raw;
}

function fetchTimeout(url, ms = 15000) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).then(
        res => { clearTimeout(to); return res; },
        err => { clearTimeout(to); throw err; }
    );
}

function bootStatus(msg) {
    // Geen tekst op het camerabeeld; alle statusupdates lopen via de hacker-loader ticker onderaan
    if (msg) logToLoader(msg);
}

// ==================== CAMERA & ENGINE CONTROLES ====================

async function ensureCameraPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { ok: false, reason: 'unsupported' };
    }
    const attempts = [
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: 'environment' } },
        { video: true }
    ];
    let lastErr = null;
    for (const constraints of attempts) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            stream.getTracks().forEach(t => t.stop());
            return { ok: true };
        } catch (err) {
            lastErr = err;
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                return { ok: false, reason: 'denied', error: err };
            }
        }
    }
    return { ok: false, reason: (lastErr && lastErr.name) || 'unknown', error: lastErr };
}

function webglSupported() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

function xrReady() {
    if (window.XR8) return Promise.resolve(window.XR8);
    return new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('8th Wall engine timeout')), 25000);
        window.addEventListener('xrloaded', () => {
            clearTimeout(to);
            resolve(window.XR8);
        }, { once: true });
    });
}

function xrControllerReady(XR8, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        (function poll() {
            if (XR8.XrController) return resolve(XR8.XrController);
            if (Date.now() - start > timeoutMs) {
                return reject(new Error('XrController niet gereed (timeout)'));
            }
            setTimeout(poll, 100);
        })();
    });
}

function fatalError(msg) {
    console.error('[AR Fatal]', msg);
    bootStatus('Fout: ' + msg);
    appendLoaderLog('FATAL: ' + msg);
}

// ==================== POSE SMOOTHING (ANTI-GLITCH FILTER) ====================

function registerAframeComponents() {
    if (!window.AFRAME || AFRAME.components['smooth-anchor']) return;

    AFRAME.registerComponent('smooth-anchor', {
        schema: {
            posFactor: { default: 0.32 },
            rotFactor: { default: 0.28 },
            snapThreshold: { default: 0.35 }
        },
        init: function () {
            this.rawPos = new THREE.Vector3();
            this.rawQuat = new THREE.Quaternion();
            this.smoothedPos = new THREE.Vector3();
            this.smoothedQuat = new THREE.Quaternion();
            this.first = true;
        },
        tock: function () {
            const obj = this.el.object3D;
            if (!obj || !obj.visible) {
                this.first = true;
                return;
            }
            this.rawPos.copy(obj.position);
            this.rawQuat.copy(obj.quaternion);

            if (this.first || this.smoothedPos.distanceTo(this.rawPos) > this.data.snapThreshold) {
                this.smoothedPos.copy(this.rawPos);
                this.smoothedQuat.copy(this.rawQuat);
                this.first = false;
            } else {
                this.smoothedPos.lerp(this.rawPos, this.data.posFactor);
                this.smoothedQuat.slerp(this.rawQuat, this.data.rotFactor);
                obj.position.copy(this.smoothedPos);
                obj.quaternion.copy(this.smoothedQuat);
            }
        }
    });
}

// ==================== PROPORTIE & AFMETING CALCULATOR ====================

function fitSignDimensions(target) {
    const p = target && target.properties;
    const ow = parseFloat(p && (p.originalWidth || p.width)) || 640;
    const oh = parseFloat(p && (p.originalHeight || p.height)) || 640;
    // In 8th Wall XR is de breedte van een planar target genormaliseerd naar 1.0 unit.
    // De hoogte is oh / ow (voor A4 poster: 1.414, voor vierkant bord: 1.0, etc.)
    const h = oh / ow;
    return {
        w: 1.0,
        h: Math.round(h * 1000) / 1000
    };
}

// ==================== POSTER LAGEN OPBOUWEN ====================

function buildLayersHTML(poster) {
    if (!poster || !poster.layers) return '';
    let layersHTML = '';

    // Zwarte achtergrond laag als ar_camera_feed niet geactiveerd is
    if (!poster.ar_camera_feed || !parseInt(poster.ar_camera_feed)) {
        layersHTML += `
            <a-plane position="0 0 -0.01" height="1.414" width="1.0" material="color: #000000; transparent: false; side: double; shader: flat;"></a-plane>`;
    }

    let layersList = [];
    let rawLayers = poster.layers;
    if (typeof rawLayers === 'string') {
        try { rawLayers = JSON.parse(rawLayers); } catch (e) {}
    }
    if (Array.isArray(rawLayers)) {
        layersList = rawLayers;
    } else if (typeof rawLayers === 'object' && rawLayers !== null) {
        for (let i = 1; i <= 8; i++) {
            if (rawLayers[`layer_${i}`]) {
                layersList.push({ layerIndex: i, ...rawLayers[`layer_${i}`] });
            }
        }
    }

    layersList.forEach((layerData, idx) => {
        const i = layerData.layerIndex || (idx + 1);
        const filename = layerData.filename || layerData.file;
        const baseZ = Math.max(parseFloat(layerData.z) || 0, 0.02) + (i * 0.015);
        const posX = parseFloat(layerData.pos_x) || parseFloat(layerData.x) || 0;
        const posY = parseFloat(layerData.pos_y) || parseFloat(layerData.y) || 0;
        const baseScale = parseFloat(layerData.scale) || 1.0;
        const rotX = parseFloat(layerData.rot_x) || parseFloat(layerData.rx) || 0;
        const rotY = parseFloat(layerData.rot_y) || parseFloat(layerData.ry) || 0;
        const rotZ = parseFloat(layerData.rot_z) || parseFloat(layerData.rz) || 0;

        let animStr = '';
        const hasPosAnim = (parseFloat(layerData.anim_x) || parseFloat(layerData.anim_y) || parseFloat(layerData.anim_z)) && parseInt(layerData.anim_pos_duration) > 0;
        if (hasPosAnim) {
            const animX = parseFloat(layerData.anim_x) || 0;
            const animY = parseFloat(layerData.anim_y) || 0;
            const animZ = parseFloat(layerData.anim_z) || 0;
            const dur = parseInt(layerData.anim_pos_duration) || 1000;
            animStr += ` animation="property: position; from: ${posX} ${posY} ${baseZ}; to: ${posX + animX} ${posY + animY} ${baseZ + animZ}; dur: ${dur}; easing: easeInOutSine; loop: true; dir: alternate;"`;
        }

        if (layerData.glb_model || (filename && /\.glb(\?|$)/i.test(filename))) {
            const glbFile = layerData.glb_model || filename;
            const modelUrl = glbFile.startsWith('http') ? glbFile : `${BASE_URL}/uploads/ar-layers/${glbFile}`;
            const sc = baseScale * 0.5;
            layersHTML += `
                <a-entity
                    id="ar-layer-${i}"
                    gltf-model="${modelUrl}"
                    position="${posX} ${posY} ${baseZ}"
                    rotation="${rotX} ${rotY} ${rotZ}"
                    scale="${sc} ${sc} ${sc}"
                    ${animStr}>
                </a-entity>`;
            return;
        }

        if (filename) {
            const mediaPath = filename.startsWith('http') ? filename : `${BASE_URL}/uploads/ar-layers/${filename}`;
            const isGif = /\.gif(\?|$)/i.test(filename);
            const isVideo = (layerData.is_video === true || /\.(mp4|webm)(\?|$)/i.test(filename)) && !isGif;
            const isTransparent = layerData.transparent !== false;

            // In 8th Wall, portrait poster target has width = 1.0, height = 1.414
            const planeW = 1.0 * baseScale;
            const planeH = 1.414 * baseScale;

            if (isGif) {
                layersHTML += `
                    <a-plane
                        id="ar-layer-${i}"
                        class="gif-layer"
                        gif="autoplay: true; transparent: ${isTransparent}"
                        src="${mediaPath}"
                        data-gif-src="${mediaPath}"
                        position="${posX} ${posY} ${baseZ}"
                        width="${planeW.toFixed(3)}"
                        height="${planeH.toFixed(3)}"
                        rotation="${rotX} ${rotY} ${rotZ}"
                        material="transparent: ${isTransparent}; side: double;"
                        ${animStr}>
                    </a-plane>`;
            } else if (isVideo) {
                layersHTML += `
                    <a-video
                        id="ar-layer-${i}"
                        src="${mediaPath}"
                        position="${posX} ${posY} ${baseZ}"
                        width="${planeW.toFixed(3)}"
                        height="${(planeW * 9 / 16).toFixed(3)}"
                        rotation="${rotX} ${rotY} ${rotZ}"
                        autoplay="true"
                        loop="true"
                        muted="true"
                        playsinline="true"
                        webkit-playsinline="true"
                        ${animStr}>
                    </a-video>`;
            } else {
                layersHTML += `
                    <a-plane
                        id="ar-layer-${i}"
                        src="${mediaPath}"
                        position="${posX} ${posY} ${baseZ}"
                        width="${planeW.toFixed(3)}"
                        height="${planeH.toFixed(3)}"
                        rotation="${rotX} ${rotY} ${rotZ}"
                        material="transparent: ${isTransparent}; side: double;"
                        ${animStr}>
                    </a-plane>`;
            }
        }
    });

    return layersHTML;
}

// ==================== SCENE OPBOUW (8TH WALL ANCHORS) ====================

function buildScene(targets) {
    registerAframeComponents();
    const box = sceneBox();
    if (!box) return;

    const oldScene = box.querySelector('a-scene');
    if (oldScene) oldScene.remove();

    const scene = document.createElement('a-scene');
    scene.setAttribute('xrweb', 'disableWorldTracking: true');
    scene.setAttribute('color-space', 'sRGB');
    scene.setAttribute('renderer', 'colorManagement: true; antialias: false');
    scene.setAttribute('vr-mode-ui', 'enabled: false');
    scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
    scene.setAttribute('embedded', '');

    const camera = document.createElement('a-camera');
    camera.setAttribute('position', '0 0 0');
    camera.setAttribute('look-controls', 'enabled: false');
    scene.appendChild(camera);

    const ambient = document.createElement('a-light');
    ambient.setAttribute('type', 'ambient');
    ambient.setAttribute('color', '#FFF');
    ambient.setAttribute('intensity', '1.2');
    scene.appendChild(ambient);

    const directional = document.createElement('a-light');
    directional.setAttribute('type', 'directional');
    directional.setAttribute('color', '#FFF');
    directional.setAttribute('intensity', '0.8');
    directional.setAttribute('position', '-0.5 1 1');
    scene.appendChild(directional);

    scene.addEventListener('realityerror', (e) => {
        const d = (e && e.detail) || {};
        console.error('[AR] realityerror', d);
        if (firstFoundAt) return;
        const reason = (d.error && d.error.message) || 'Camera kon niet gestart worden';
        bootStatus('Fout: ' + reason);
    });

    box.appendChild(scene);
    updateSceneTargets(targets);
}

function updateSceneTargets(targets, clearExisting = false) {
    const box = sceneBox();
    if (!box) return;
    const scene = box.querySelector('a-scene');
    if (!scene) return;

    // Verwijder bestaande anchors alleen als expliciet gevraagd (bv. filter naar specifieke chunk)
    if (clearExisting) {
        scene.querySelectorAll('a-entity[xrextras-named-image-target]').forEach(el => el.remove());
    }

    // Verzamel bestaande anchors zodat we die niet opnieuw aanmaken (geen DOM churn / tracking loss)
    const existingNames = new Set();
    scene.querySelectorAll('a-entity[xrextras-named-image-target]').forEach(el => {
        const val = el.getAttribute('xrextras-named-image-target') || '';
        const name = val.replace('name:', '').trim();
        if (name) existingNames.add(name);
    });

    targets.forEach(item => {
        if (existingNames.has(item.name)) return;
        existingNames.add(item.name);

        const anchor = document.createElement('a-entity');
        anchor.setAttribute('xrextras-named-image-target', 'name: ' + item.name);
        anchor.setAttribute('smooth-anchor', '');

        if (item.isPoster) {
            // POSTER TARGET
            const poster = item.poster;
            anchor.setAttribute('data-poster-id', poster.id);

            const content = document.createElement('a-entity');
            content.setAttribute('class', 'poster-content');
            content.setAttribute('data-poster-id', poster.id);
            content.innerHTML = buildLayersHTML(poster);
            anchor.appendChild(content);

            anchorState[item.name] = { visible: false, lastPos: null, hideTimer: 0, foundAt: 0 };

            anchor.addEventListener('xrextrasfound', () => {
                const st = anchorState[item.name];
                if (st && st.hideTimer) { clearTimeout(st.hideTimer); st.hideTimer = 0; }
                foundCount++;
                if (!firstFoundAt) firstFoundAt = performance.now();
                if (st) st.visible = true;

                console.log(`[AR] Poster GEVONDEN: ${poster.title}`);
                window.chunkLocked = true;
                stopChunkScan();
                stopRadarScan();
                hideChunkCycleButton();

                document.querySelector('.scan-frame')?.classList.add('hidden');

                showSwipeState(2);
                const titleEl = document.getElementById('detected-poster-title');
                if (titleEl) titleEl.textContent = poster.title;

                currentPoster = poster;
                setFeaturedPoster(poster);
                playPosterAudio(poster);
                logToLoader(`GEVONDEN: ${poster.title}`);
            });

            anchor.addEventListener('xrextraslost', () => {
                const st = anchorState[item.name];
                lostCount++;
                if (st) st.visible = false;

                if (st && st.hideTimer) clearTimeout(st.hideTimer);
                if (st) {
                    st.hideTimer = setTimeout(() => {
                        st.hideTimer = 0;
                        if (!anchorState[item.name]?.visible) {
                            window.chunkLocked = false;
                            showChunkCycleButtonAgain();
                            document.querySelector('.scan-frame')?.classList.remove('hidden');
                            showSwipeState(1);
                            stopPosterAudio();
                            logToLoader('ZOEKEN...');
                        }
                    }, LOST_GRACE_MS);
                }
            });
        } else {
            // VERKEERSBORD TARGET
            anchor.setAttribute('data-sign-id', item.signId);
            anchor.setAttribute('data-sign-name', item.signName);
            anchor.setAttribute('data-search-query', item.searchQuery);
            anchor.setAttribute('data-memeborden', 'true');

            const dims = fitSignDimensions(item);
            const gifW = 1.05;
            const gifH = dims.h * 1.05;
            const borderPad = 0.16;

            // Rode border plane
            const borderPlane = document.createElement('a-plane');
            borderPlane.setAttribute('data-meme-border', item.signId);
            borderPlane.setAttribute('position', '0 0 0.005');
            borderPlane.setAttribute('width', (gifW + borderPad).toFixed(3));
            borderPlane.setAttribute('height', (gifH + borderPad).toFixed(3));
            borderPlane.setAttribute('color', '#CC0000');
            borderPlane.setAttribute('visible', 'false');
            anchor.appendChild(borderPlane);

            // GIF plane
            const gifPlane = document.createElement('a-plane');
            gifPlane.setAttribute('id', `meme-gif-plane-${item.signId}`);
            gifPlane.setAttribute('data-meme-sign', item.signId);
            gifPlane.setAttribute('position', '0 0 0.01');
            gifPlane.setAttribute('width', gifW.toFixed(3));
            gifPlane.setAttribute('height', gifH.toFixed(3));
            gifPlane.setAttribute('visible', 'false');
            gifPlane.setAttribute('gif', 'autoplay: true; transparent: false');
            anchor.appendChild(gifPlane);

            anchorState[item.name] = { visible: false, lastPos: null, hideTimer: 0 };

            anchor.addEventListener('xrextrasfound', () => {
                const st = anchorState[item.name];
                if (st && st.hideTimer) { clearTimeout(st.hideTimer); st.hideTimer = 0; }
                if (st) st.visible = true;

                console.log(`[Memeborden] Bord GEVONDEN: ${item.signName}`);
                window.chunkLocked = true;
                stopChunkScan();
                stopRadarScan();
                hideChunkCycleButton();

                document.querySelector('.scan-frame')?.classList.add('hidden');

                showSwipeState(2);
                const titleEl = document.getElementById('detected-poster-title');
                if (titleEl) titleEl.textContent = item.signName;
                logToLoader(`GEVONDEN: ${item.signName}`);

                borderPlane.setAttribute('visible', 'true');
                if (typeof window.fetchAndDisplayGif === 'function') {
                    window.fetchAndDisplayGif(item.signId, item.searchQuery, anchor);
                }
            });

            anchor.addEventListener('xrextraslost', () => {
                const st = anchorState[item.name];
                if (st) st.visible = false;

                if (st && st.hideTimer) clearTimeout(st.hideTimer);
                if (st) {
                    st.hideTimer = setTimeout(() => {
                        st.hideTimer = 0;
                        if (!anchorState[item.name]?.visible) {
                            borderPlane.setAttribute('visible', 'false');
                            gifPlane.setAttribute('visible', 'false');
                            window.chunkLocked = false;
                            showChunkCycleButtonAgain();
                            document.querySelector('.scan-frame')?.classList.remove('hidden');
                            showSwipeState(1);
                            logToLoader('ZOEKEN...');
                        }
                    }, LOST_GRACE_MS);
                }
            });
        }

        scene.appendChild(anchor);
    });

    console.log(`[AR] Anchors in scene geüpdatet (totaal ${existingNames.size} actief)`);
}

// ==================== SCAN KNOP & MULTI-CHUNK SCANNER ====================

function injectChunkPickerCSS() {
    if (document.getElementById('chunk-picker-css')) return;
    const style = document.createElement('style');
    style.id = 'chunk-picker-css';
    style.textContent = `
        #chunk-quick-picker {
            position: fixed;
            left: 50%;
            bottom: 175px;
            transform: translateX(-50%) translateY(10px);
            width: min(92vw, 320px);
            max-height: 48vh;
            background: rgba(0, 0, 0, 0.96);
            border: 0.5px solid rgba(255, 255, 255, 0.85);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.7);
            z-index: 10001;
            display: none;
            pointer-events: auto;
            color: #fff;
            font-family: var(--font-data, 'Roboto Mono', monospace);
            user-select: none;
            -webkit-user-select: none;
        }
        #chunk-quick-picker.open {
            display: block;
            transform: translateX(-50%) translateY(0);
        }
        .chunk-picker-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.55rem 0.75rem;
            border-bottom: 0.5px solid rgba(255,255,255,0.25);
            font-size: 0.68rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .chunk-picker-close {
            background: transparent;
            border: 0.5px solid rgba(255,255,255,0.4);
            color: #fff;
            font-family: inherit;
            font-size: 0.68rem;
            padding: 0.15rem 0.4rem;
            cursor: pointer;
        }
        .chunk-picker-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.35rem;
            padding: 0.6rem;
            overflow-y: auto;
            max-height: calc(48vh - 2.5rem);
        }
        .chunk-picker-btn {
            background: rgba(255,255,255,0.06);
            color: #fff;
            border: 0.5px solid rgba(255,255,255,0.35);
            font-family: inherit;
            font-size: 0.66rem;
            padding: 0.45rem 0.5rem;
            text-align: left;
            cursor: pointer;
            user-select: none;
            touch-action: manipulation;
        }
        .chunk-picker-btn.active {
            background: #fff;
            color: #000;
            border-color: #fff;
        }
    `;
    document.head.appendChild(style);
}

function showChunkCycleButton() {
    injectChunkPickerCSS();

    let btn = document.getElementById('chunk-cycle-btn');
    if (btn) btn.remove();

    btn = document.createElement('button');
    btn.id = 'chunk-cycle-btn';
    btn.type = 'button';
    btn.innerHTML = 'SCAN';
    btn.style.cssText = `
        position: fixed;
        bottom: 96px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        background: rgba(0, 0, 0, 0.85);
        color: #ffffff;
        border: 1px solid #ffffff;
        outline: none;
        box-shadow: none;
        border-radius: 0;
        padding: 7px 16px;
        font-family: var(--font-data, 'Roboto Mono', monospace);
        font-size: 11px;
        letter-spacing: 2px;
        cursor: pointer;
        min-width: 74px;
        text-align: center;
        -webkit-appearance: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        touch-action: manipulation;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
    `;

    // Long-press: open de Quick Picker (450ms)
    btn.addEventListener('pointerdown', () => {
        chunkLongPressTriggered = false;
        clearTimeout(chunkLongPressTimer);
        chunkLongPressTimer = setTimeout(() => {
            chunkLongPressTriggered = true;
            openChunkQuickPicker();
        }, 450);
    });

    const clearLongPress = () => {
        clearTimeout(chunkLongPressTimer);
        chunkLongPressTimer = null;
    };

    // Tik: start automatische chunk scan loop
    btn.addEventListener('pointerup', () => {
        clearLongPress();
        if (!chunkLongPressTriggered) {
            chunkLongPressTriggered = true;
            startChunkScan();
            setTimeout(() => { chunkLongPressTriggered = false; }, 300);
        }
    });

    btn.addEventListener('pointercancel', clearLongPress);
    btn.addEventListener('click', (e) => { e.preventDefault(); });

    document.body.appendChild(btn);
}

function hideChunkCycleButton() {
    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) btn.style.display = 'none';
    closeChunkQuickPicker();
}

function showChunkCycleButtonAgain() {
    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) {
        btn.innerHTML = 'SCAN';
        btn.style.background = 'rgba(0, 0, 0, 0.85)';
        btn.style.borderColor = '#ffffff';
        btn.style.color = '#ffffff';
        btn.style.boxShadow = 'none';
        btn.style.outline = 'none';
        btn.style.display = 'block';
    }
}

// Start automatische chunk cycle scanner (zoals in originele masterproef)
// Start automatische chunk cycle scanner of simultane radar scan
function startChunkScan() {
    if (window.chunkLocked) return;
    const btn = document.getElementById('chunk-cycle-btn');
    if (!btn) return;

    // Als simultane detectie al actief is: trigger direct een actieve radar pulse
    if (isUniversalActive) {
        triggerUniversalRadarScan();
        return;
    }

    // Als universals beschikbaar zijn maar nog niet geactiveerd: activeer nu direct
    if (allUniversalTargets && allUniversalTargets.length) {
        expandToUniversalTargets();
        triggerUniversalRadarScan();
        return;
    }

    if (!arChunks.length) return;

    if (isChunkScanning) {
        stopChunkScan();
        return;
    }

    isChunkScanning = true;
    let dots = 0;
    const total = arChunks.length;

    // Direct groene scan styling activeren
    btn.style.background = 'rgba(0, 255, 0, 0.12)';
    btn.style.borderColor = '#00ff00';
    btn.style.color = '#00ff00';
    btn.style.boxShadow = 'none';
    btn.style.outline = 'none';

    const updateBtn = () => {
        if (!btn || !isChunkScanning) return;
        dots = (dots + 1) % 4;
        btn.innerHTML = `${currentChunkIndex + 1}/${total}` + '.'.repeat(dots);
    };

    updateBtn();
    clearInterval(chunkScanInterval);
    chunkScanInterval = setInterval(updateBtn, 300);

    const stepCycle = async () => {
        if (!isChunkScanning || window.chunkLocked) return;
        const nextIndex = (currentChunkIndex + 1) % total;
        await switchChunk(nextIndex, true);
        if (isChunkScanning && !window.chunkLocked) {
            chunkScanTimeout = setTimeout(stepCycle, 1800);
        }
    };

    chunkScanTimeout = setTimeout(stepCycle, 1800);
}

function triggerUniversalRadarScan() {
    const btn = document.getElementById('chunk-cycle-btn');
    if (!btn || window.chunkLocked) return;

    if (isRadarScanning) {
        stopRadarScan();
        return;
    }

    isRadarScanning = true;
    btn.style.background = 'rgba(0, 255, 0, 0.12)';
    btn.style.borderColor = '#00ff00';
    btn.style.color = '#00ff00';
    btn.style.boxShadow = 'none';
    btn.style.outline = 'none';

    logToLoader('RADAR SCAN: 237 BORDEN SIMULTAAN...');
    let dots = 0;
    btn.innerHTML = 'SCAN' + '.'.repeat(dots);

    clearInterval(radarInterval);
    radarInterval = setInterval(() => {
        if (!isRadarScanning || window.chunkLocked) return;
        dots = (dots + 1) % 4;
        btn.innerHTML = 'SCAN' + '.'.repeat(dots);
    }, 300);

    clearTimeout(radarTimeout);
    radarTimeout = setTimeout(() => {
        stopRadarScan();
    }, 7000);
}

function stopRadarScan() {
    isRadarScanning = false;
    if (radarInterval) { clearInterval(radarInterval); radarInterval = null; }
    if (radarTimeout) { clearTimeout(radarTimeout); radarTimeout = null; }
    const btn = document.getElementById('chunk-cycle-btn');
    if (btn && !window.chunkLocked) {
        btn.innerHTML = 'SCAN';
        btn.style.background = 'rgba(0, 0, 0, 0.85)';
        btn.style.borderColor = '#ffffff';
        btn.style.color = '#ffffff';
        btn.style.boxShadow = 'none';
        btn.style.outline = 'none';
    }
}

function stopChunkScan() {
    isChunkScanning = false;
    if (chunkScanTimeout) { clearTimeout(chunkScanTimeout); chunkScanTimeout = null; }
    if (chunkScanInterval) { clearInterval(chunkScanInterval); chunkScanInterval = null; }
    stopRadarScan();
    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) {
        btn.innerHTML = 'SCAN';
        btn.style.background = 'rgba(0, 0, 0, 0.85)';
        btn.style.borderColor = '#ffffff';
        btn.style.color = '#ffffff';
        btn.style.boxShadow = 'none';
        btn.style.outline = 'none';
    }
}

async function switchToUniversal() {
    if (!xrControllerInstance || !allUniversalTargets || !allUniversalTargets.length) return;
    isUniversalActive = true;
    window.isUniversalActive = true;
    currentChunkIndex = -1;
    window.currentChunkIndex = -1;
    window.chunkLocked = false;

    console.log(`[AR] Handmatige selectie: Alle ${allUniversalTargets.length} targets simultaan actief`);
    bootStatus('Alle borden actief (237 simultaan)');
    logToLoader('237 BORDEN SIMULTAAN ACTIEF');

    xrControllerInstance.configure({ imageTargetData: allUniversalTargets });
    updateSceneTargets(allUniversalTargets, false);
    renderChunkQuickPicker();

    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) {
        btn.innerHTML = 'ALLE BORDEN';
        setTimeout(() => {
            if (btn && !window.chunkLocked && !isChunkScanning && !isRadarScanning) {
                btn.innerHTML = 'SCAN';
                btn.style.background = 'rgba(0, 0, 0, 0.85)';
                btn.style.borderColor = '#ffffff';
                btn.style.color = '#ffffff';
                btn.style.boxShadow = 'none';
                btn.style.outline = 'none';
            }
        }, 1200);
    }
}

async function switchChunk(index, keepScanRunning = false) {
    if (!xrControllerInstance || !arChunks || !arChunks[index]) return;
    isUniversalActive = false;
    window.isUniversalActive = false;
    currentChunkIndex = index;
    window.currentChunkIndex = index;
    window.chunkLocked = false;

    const chunk = arChunks[index];
    console.log(`[Chunk] Wisselen naar chunk ${index}: ${chunk.label} (${chunk.targets.length} targets)`);

    bootStatus(`Scannen: ${chunk.name}`);

    // Update 8th Wall targets via WASM configure
    xrControllerInstance.configure({ imageTargetData: chunk.targets });

    // Update A-Frame anchors (clearExisting = true bij specifieke selectie)
    updateSceneTargets(chunk.targets, true);

    renderChunkQuickPicker();

    if (!keepScanRunning) {
        const btn = document.getElementById('chunk-cycle-btn');
        if (btn) {
            btn.innerHTML = chunk.label.toUpperCase();
            setTimeout(() => {
                if (btn && !window.chunkLocked && !isChunkScanning && !isRadarScanning) {
                    btn.innerHTML = 'SCAN';
                    btn.style.background = 'rgba(0, 0, 0, 0.85)';
                    btn.style.borderColor = '#ffffff';
                    btn.style.color = '#ffffff';
                    btn.style.boxShadow = 'none';
                    btn.style.outline = 'none';
                }
            }, 1200);
        }
    }
}

async function expandToUniversalTargets() {
    if (!xrControllerInstance || !allUniversalTargets || !allUniversalTargets.length) return;
    if (isUniversalActive) return;

    console.log(`[AR] Achtergrond: Uitbreiden naar alle ${allUniversalTargets.length} targets simultaan...`);
    logToLoader('ALLE BORDEN ACTIVEREN...');

    // 1. Configureer alle 237 borden + posters simultaan in 8th Wall XR
    xrControllerInstance.configure({ imageTargetData: allUniversalTargets });

    // 2. Voeg ontbrekende anchors toe aan de scene zonder bestaande te verstoren
    updateSceneTargets(allUniversalTargets, false);

    isUniversalActive = true;
    window.isUniversalActive = true;
    currentChunkIndex = -1;
    window.currentChunkIndex = -1;

    console.log(`[AR] Alle ${allUniversalTargets.length} targets actief (simultaan)!`);
    logToLoader('237 BORDEN SIMULTAAN ACTIEF');

    // 3. Update quick picker
    renderChunkQuickPicker();

    // 4. Start rustig met het prefetchen van de meest frequente borden GIFs
    if (typeof window.prefetchCommonGifs === 'function') {
        window.prefetchCommonGifs();
    }
}

function ensureChunkQuickPicker() {
    if (document.getElementById('chunk-quick-picker')) return;
    injectChunkPickerCSS();

    const picker = document.createElement('div');
    picker.id = 'chunk-quick-picker';
    picker.innerHTML = `
        <div class="chunk-picker-head">
            <span>Kies Verkeersborden Serie</span>
            <button type="button" class="chunk-picker-close">✕</button>
        </div>
        <div class="chunk-picker-grid"></div>
    `;

    picker.querySelector('.chunk-picker-close').addEventListener('click', closeChunkQuickPicker);
    document.body.appendChild(picker);
}

function renderChunkQuickPicker() {
    ensureChunkQuickPicker();
    const picker = document.getElementById('chunk-quick-picker');
    if (!picker || !arChunks.length) return;

    const grid = picker.querySelector('.chunk-picker-grid');
    if (!grid) return;

    const universalCount = allUniversalTargets ? allUniversalTargets.length : 237;
    const universalBtn = `
        <button type="button" class="chunk-picker-btn ${isUniversalActive ? 'active' : ''}" data-chunk-index="-1" style="grid-column: 1 / -1; font-weight: bold; text-align: center; border-color: ${isUniversalActive ? '#00ff00' : 'rgba(255,255,255,0.6)'};">
            ★ ALLE BORDEN (${universalCount} SIMULTAAN)
        </button>
    `;

    grid.innerHTML = universalBtn + arChunks.map((c, i) => `
        <button type="button" class="chunk-picker-btn ${(!isUniversalActive && i === currentChunkIndex) ? 'active' : ''}" data-chunk-index="${i}">
            ${c.label} (${c.targets.length})
        </button>
    `).join('');

    grid.querySelectorAll('.chunk-picker-btn').forEach(b => {
        b.addEventListener('click', async () => {
            const idx = parseInt(b.dataset.chunkIndex, 10);
            stopChunkScan();
            stopRadarScan();
            closeChunkQuickPicker();
            if (idx === -1) {
                await switchToUniversal();
            } else {
                await switchChunk(idx);
            }
        });
    });
}

function openChunkQuickPicker() {
    ensureChunkQuickPicker();
    const picker = document.getElementById('chunk-quick-picker');
    if (!picker) return;
    renderChunkQuickPicker();
    picker.classList.add('open');
    chunkQuickPickerOpen = true;
}

function closeChunkQuickPicker() {
    const picker = document.getElementById('chunk-quick-picker');
    if (picker) picker.classList.remove('open');
    chunkQuickPickerOpen = false;
}

// ==================== BOOT AR (ULTRA FAST DIRECT INITIALISATIE) ====================

async function bootAR() {
    if (bootStarted) return;
    bootStarted = true;
    bootTime = performance.now();

    appendLoaderLog('CHECKING_WEBGL_SUPPORT...');
    if (!webglSupported()) {
        fatalError('WEBGL NIET BESCHIKBAAR');
        return;
    }

    appendLoaderLog('REQUESTING_CAMERA_PERMISSION...');
    bootStatus('Cameratoegang controleren…');
    const perm = await ensureCameraPermission();
    if (!perm.ok) {
        bootStatus('Cameratoegang geweigerd. Geef toestemming in instellingen en herlaad.');
        appendLoaderLog('PERMISSION_DENIED.');
        bootStarted = false;
        return;
    }
    appendLoaderLog('CAMERA_PERMISSION_GRANTED.');

    try {
        appendLoaderLog('INITIALIZING_XR_ENGINE...');
        bootStatus('XR Engine starten…');
        const XR8 = await xrReady();
        xrControllerInstance = await xrControllerReady(XR8, 20000);
        appendLoaderLog('8TH_WALL_XR_READY.');

        appendLoaderLog('FETCHING_DATASETS...');
        bootStatus('Targets ophalen…');
        const [postersResp, chunksResp] = await Promise.all([
            fetchTimeout(`${API_URL}/posters`).catch(() => ({ ok: false })),
            fetchTimeout('verkeersborden/data/chunks8w.json?v=' + Date.now()).catch(() => ({ ok: false }))
        ]);

        const posters = postersResp.ok ? await postersResp.json() : [];
        window.allPosters = posters;

        let signsChunksData = null;
        if (chunksResp.ok) {
            signsChunksData = await chunksResp.json();
        }

        // Bouw de 8th Wall Chunks
        const validPosters = posters.filter(p => p.target8w && p.target8w.imagePath);
        const posterTargets = validPosters.map(p => ({
            ...p.target8w,
            isPoster: true,
            poster: p
        }));

        arChunks = [];

        // Chunk 0: Posters + Top Verkeersborden (Standaard actief)
        const topSigns = (signsChunksData?.chunks?.[0]?.targets || []).map(t => ({ ...t, isPoster: false }));
        arChunks.push({
            id: 'chunk_top',
            name: 'Posters & Top Borden',
            label: 'Top Borden',
            targets: [...posterTargets, ...topSigns]
        });

        // Chunks 1..N: De gebalanceerde series uit chunks8w.json
        if (signsChunksData && Array.isArray(signsChunksData.chunks)) {
            signsChunksData.chunks.slice(1).forEach(c => {
                arChunks.push({
                    id: c.id,
                    name: c.name,
                    label: c.label,
                    targets: c.targets.map(t => ({ ...t, isPoster: false }))
                });
            });
        }

        window.arChunks = arChunks;
        currentChunkIndex = 0;
        window.currentChunkIndex = 0;

        // Bouw universele lijst met ALLE 237 unieke verkeersborden + actieve posters voor simultaan scannen
        const uniqueSignsMap = new Map();
        if (signsChunksData && Array.isArray(signsChunksData.chunks)) {
            signsChunksData.chunks.forEach(c => {
                (c.targets || []).forEach(t => {
                    if (!uniqueSignsMap.has(t.name)) {
                        uniqueSignsMap.set(t.name, { ...t, isPoster: false });
                    }
                });
            });
        }
        const allSigns = Array.from(uniqueSignsMap.values());
        allUniversalTargets = [...posterTargets, ...allSigns];
        window.allUniversalTargets = allUniversalTargets;

        const initialTargets = arChunks[0].targets;
        if (!initialTargets.length) {
            throw new Error('Geen geldige targets gevonden.');
        }

        appendLoaderLog(`CONFIGURING_TARGETS [${initialTargets.length}_TARGETS]...`);
        bootStatus('Targets configureren…');
        xrControllerInstance.configure({ imageTargetData: initialTargets });

        appendLoaderLog('BUILDING_3D_SCENE...');
        buildScene(initialTargets);

        appendLoaderLog('SYSTEM_ONLINE.');
        bootStatus('Richt je camera op een poster of bord');

        showChunkCycleButton();

        // Systeem gereed: ticker blijft permanent actief onderaan
        hideLoader();

        // Start achtergrond expansie: activeer alle 237 borden simultaan na 800ms
        setTimeout(() => {
            expandToUniversalTargets();
        }, 800);

    } catch (e) {
        console.error('[AR Boot Fout]', e);
        bootStatus('Starten mislukt: ' + (e.message || e));
        appendLoaderLog('ERROR: ' + (e.message || e));
        bootStarted = false;
    }
}

// ==================== UI & SWIPE BAR CONTROLES ====================

function showSwipeState(state) {
    const s1 = document.getElementById('swipe-state-1');
    const s2 = document.getElementById('swipe-state-2');
    if (state === 1) {
        if (s1) s1.classList.add('active');
        if (s2) s2.classList.remove('active');
    } else if (state === 2) {
        if (s1) s1.classList.remove('active');
        if (s2) s2.classList.add('active');
    }
}

function setupSwipeBarControls() {
    const footer = document.getElementById('ar-footer-swipe-bar');
    if (!footer) return;

    let startY = 0, currentY = 0;

    footer.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        currentY = startY;
    }, { passive: true });

    footer.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
        const diff = startY - currentY;
        if (diff > 50 && !footer.classList.contains('expanded')) {
            expandFooter();
        } else if (diff < -50 && footer.classList.contains('expanded')) {
            collapseFooter();
        }
    }, { passive: true });

    window.toggleFooter = () => {
        if (footer.classList.contains('expanded')) collapseFooter();
        else expandFooter();
    };
}

function setFeaturedPoster(poster) {
    featuredPoster = poster;
}

function resetFeaturedPoster() {
    featuredPoster = null;
}

// ==================== POSTER AUDIO ONDERSTEUNING ====================

function playPosterAudio(poster) {
    stopPosterAudio();
    if (!poster) return;

    let audioFile = null;
    if (poster.layers) {
        for (let i = 1; i <= 8; i++) {
            const layerData = poster.layers[`layer_${i}`];
            if (layerData && layerData.audio_file) {
                audioFile = layerData.audio_file;
                break;
            }
        }
    }
    if (!audioFile && poster.audio_file) {
        audioFile = poster.audio_file;
    }
    if (!audioFile) return;

    const audioPath = `uploads/ar-layers/${audioFile}`;
    console.log('[AR] Audio starten:', audioPath);

    currentAudioElement = new Audio(audioPath);
    currentAudioElement.volume = audioVolume;
    currentAudioElement.loop = true;

    currentAudioElement.play().then(() => {
        logToLoader('AUDIO GESTART');
    }).catch(err => {
        console.warn('[AR] Audio autoplay geblokkeerd:', err);
        showAudioPlayButton(poster);
    });
}

function stopPosterAudio() {
    if (currentAudioElement) {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
        currentAudioElement = null;
        console.log('[AR] Audio gestopt');
    }
    hideAudioPlayButton();
}

function showAudioPlayButton(poster) {
    let btn = document.getElementById('ar-audio-play-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'ar-audio-play-btn';
        btn.type = 'button';
        btn.innerHTML = '🔊 SPEEL AUDIO';
        btn.style.cssText = `
            position: fixed;
            bottom: 140px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10001;
            background: rgba(0, 0, 0, 0.9);
            color: #ffffff;
            border: 1px solid #ffffff;
            padding: 8px 16px;
            font-family: var(--font-data, 'Roboto Mono', monospace);
            font-size: 11px;
            letter-spacing: 0.1em;
            cursor: pointer;
            outline: none;
            box-shadow: none;
            -webkit-appearance: none;
            user-select: none;
            touch-action: manipulation;
        `;
        document.body.appendChild(btn);
    }
    btn.style.display = 'block';
    btn.onclick = () => {
        if (currentAudioElement) {
            currentAudioElement.play().then(() => {
                hideAudioPlayButton();
            }).catch(console.error);
        }
    };
}

function hideAudioPlayButton() {
    const btn = document.getElementById('ar-audio-play-btn');
    if (btn) btn.style.display = 'none';
}

function expandFooter() {
    const footer = document.getElementById('ar-footer-swipe-bar');
    if (footer) {
        footer.classList.add('expanded');
        renderGalleryGrid();
    }
}

function collapseFooter() {
    const footer = document.getElementById('ar-footer-swipe-bar');
    if (footer) footer.classList.remove('expanded');
}

function renderGalleryGrid() {
    const grid = document.getElementById('gallery-overlay-grid');
    if (!grid || !window.allPosters) return;

    if (featuredPoster) {
        // FEATURED POSTER MODE: Gescande poster groot in 1 kolom
        const thumb = featuredPoster.thumbnail ? `${BASE_URL}${featuredPoster.thumbnail}` : (featuredPoster.jpeg_filename ? `uploads/${featuredPoster.jpeg_filename}` : 'img/placeholder.png');
        const hasAR = window.arPosters && window.arPosters.some(p => p.id == featuredPoster.id);
        const arBadge = hasAR ? '<span class="ar-badge">AR</span>' : '';
        const shortId = featuredPoster.id ? featuredPoster.id.substring(0, 6) : '';

        grid.classList.add('featured-grid');
        grid.innerHTML = `
            <div class="overlay-poster-card featured-mode" onclick="window.openPosterModal && window.openPosterModal('${featuredPoster.id}')">
                <img src="${thumb}" alt="${featuredPoster.title || ''}" onerror="this.src='img/placeholder.png'">
                <div class="card-info featured-info">
                    <h3>${featuredPoster.title || 'Poster'} ${arBadge}</h3>
                    <div class="card-meta">
                        <span>&gt;&gt; ID: ${shortId}</span>
                    </div>
                </div>
            </div>
            <div class="featured-actions" style="grid-column: 1 / -1; text-align: center; padding: 12px 0;">
                <button type="button" id="show-all-posters-btn" style="background: transparent; border: 1px solid var(--white, #ffffff); color: var(--white, #ffffff); font-family: var(--font-data, 'Roboto Mono', monospace); font-size: 11px; padding: 8px 16px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em; -webkit-appearance: none; outline: none;">
                    ALLE POSTERS BEKIJKEN
                </button>
            </div>
        `;

        const showAllBtn = document.getElementById('show-all-posters-btn');
        if (showAllBtn) {
            showAllBtn.onclick = (e) => {
                e.stopPropagation();
                resetFeaturedPoster();
                renderGalleryGrid();
            };
        }
    } else {
        // NORMALE GALERIJ MODUS: Alle posters in 2 kolommen
        grid.classList.remove('featured-grid');
        grid.innerHTML = window.allPosters.map(p => {
            const thumb = p.thumbnail ? `${BASE_URL}${p.thumbnail}` : (p.jpeg_filename ? `uploads/${p.jpeg_filename}` : 'img/placeholder.png');
            const hasAR = window.arPosters && window.arPosters.some(x => x.id == p.id);
            const arBadge = hasAR ? '<span class="ar-badge">AR</span>' : '';
            return `
                <div class="overlay-poster-card" onclick="window.openPosterModal && window.openPosterModal('${p.id}')">
                    <img src="${thumb}" alt="${p.title || ''}" loading="lazy" onerror="this.src='img/placeholder.png'">
                    <div class="card-info">
                        <h3>${p.title || 'Poster'} ${arBadge}</h3>
                    </div>
                </div>
            `;
        }).join('');
    }
}

window.openPosterModal = (posterId) => {
    const poster = (window.allPosters || []).find(p => p.id === posterId);
    if (!poster) return;
    currentPoster = poster;
    showDownloadModal(poster);
};

// ==================== DOWNLOAD MODAL ====================

function formatCredits(poster) {
    if (!poster) return '';
    let creditItems = [];

    if (poster.credits) {
        try {
            let creditsArray = poster.credits;
            if (typeof creditsArray === 'string') {
                creditsArray = JSON.parse(creditsArray);
            }
            if (Array.isArray(creditsArray) && creditsArray.length > 0) {
                creditItems = creditsArray.filter(c => c && c.item && c.owner && c.item !== 'None' && c.owner !== 'None');
            }
        } catch (e) {
            console.warn('[Modal] Kon credits niet parsen:', e);
        }
    }

    if (creditItems.length === 0 && poster.photographer_credit && poster.photographer_credit !== 'None') {
        creditItems = [{ item: 'Foto', owner: poster.photographer_credit }];
    }

    if (creditItems.length === 0) return '';
    return creditItems.map(c => `${c.item || 'Credit'}: ${c.owner || '-'}`).join(' | ');
}

function showDownloadModal(poster) {
    const modal = document.getElementById('download-modal');
    if (!modal || !poster) return;

    const img = document.getElementById('modal-poster-img');
    const title = document.getElementById('modal-poster-title');
    const desc = document.getElementById('modal-poster-description');
    const loc = document.getElementById('modal-poster-location');
    const art = document.getElementById('modal-poster-article');
    const phot = document.getElementById('modal-poster-photographer');

    if (img) img.src = poster.thumbnail ? `${BASE_URL}${poster.thumbnail}` : (poster.jpeg_filename ? `uploads/${poster.jpeg_filename}` : 'img/placeholder.png');
    if (title) title.textContent = poster.title || 'Zonder titel';
    if (desc) desc.textContent = (poster.description && poster.description !== 'None') ? poster.description : '';

    let locationText = '';
    if (poster.location_description && poster.location_description !== 'None') {
        locationText = poster.location_description;
    }
    if (poster.latitude && poster.longitude) {
        locationText += locationText ? ` (${poster.latitude}, ${poster.longitude})` : `${poster.latitude}, ${poster.longitude}`;
    }
    if (loc) loc.textContent = locationText ? `Locatie: ${locationText}` : '';

    if (art) {
        art.innerHTML = (poster.artikel_link && poster.artikel_link !== 'None')
            ? `<a href="${poster.artikel_link}" target="_blank" rel="noopener">Lees het originele artikel ↗</a>`
            : '';
    }

    const creds = formatCredits(poster);
    if (phot) phot.textContent = creds ? `Credits: ${creds}` : '';

    modal.style.display = 'block';
}

function setupModal() {
    const modal = document.getElementById('download-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = () => { modal.style.display = 'none'; };
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const format = e.target.dataset.format || 'jpeg';
            const size = e.target.dataset.size || 'original';
            if (!currentPoster) return;
            const url = `${API_URL}/download/${currentPoster.id}?format=${format}&size=${size}`;
            window.location.href = url;
        });
    });
}

// ==================== APP INITIALISATIE ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Interventie Platform — 8th Wall XR Initialisatie (Multi-Chunk)...');

    // Device detectie
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth <= 850 && ('ontouchstart' in window));

    if (isMobile) {
        console.log('[Mode] Mobiel toestel gedetecteerd — AR camera start direct');
        document.getElementById('desktop-view').style.display = 'none';
        document.getElementById('mobile-ar-view').style.display = 'block';

        setupSwipeBarControls();
        setupModal();

        // Start AR direct met feedback in de hacker loader
        bootAR();
    } else {
        console.log('[Mode] Desktop browser gedetecteerd — File Manager modus actief');
        document.getElementById('desktop-view').style.display = 'block';
        document.getElementById('mobile-ar-view').style.display = 'none';

        if (typeof window.initFileManager === 'function') {
            window.initFileManager();
        }
        setupModal();
        hideLoader();
    }
});
