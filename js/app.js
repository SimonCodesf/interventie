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
    const el = document.getElementById('scanning-indicator');
    if (el) el.textContent = msg || 'Richt je camera op een poster';
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
    const aspect = ow / oh;
    let w = 1.0, h = 1.0;
    if (aspect <= 1.0) {
        w = aspect;
        h = 1.0;
    } else {
        w = 1.0;
        h = 1.0 / aspect;
    }
    return {
        w: Math.round(w * 1000) / 1000,
        h: Math.round(h * 1000) / 1000
    };
}

// ==================== POSTER LAGEN OPBOUWEN ====================

function buildLayersHTML(poster) {
    if (!poster.layers) return '';
    let layersHTML = '';
    let layers = [];

    try {
        layers = typeof poster.layers === 'string' ? JSON.parse(poster.layers) : poster.layers;
    } catch (e) {
        console.error('Fout bij parsen layers:', e);
        return '';
    }

    if (!Array.isArray(layers)) return '';

    const fit = fitSignDimensions(poster.target8w || { properties: { width: 707, height: 1000 } });

    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const isGif = layer.file && /\.gif(\?|$)/i.test(layer.file);
        const isModel = layer.file && /\.glb(\?|$)/i.test(layer.file);
        const fileUrl = `${BASE_URL}/uploads/${poster.id}/${layer.file}`;
        const baseZ = (i + 1) * 0.02;

        let animationStr = '';
        if (layer.animation) {
            const anim = layer.animation;
            const fromX = anim.fromX || 0;
            const toX = anim.toX || 0;
            const fromY = anim.fromY || 0;
            const toY = anim.toY || 0;
            const fromZ = (anim.fromZ !== undefined) ? anim.fromZ : baseZ;
            const toZ = (anim.toZ !== undefined) ? anim.toZ : baseZ;
            const dur = (anim.duration || 2) * 1000;

            animationStr = `animation="property: position; from: ${fromX} ${fromY} ${fromZ}; to: ${toX} ${toY} ${toZ}; dir: alternate; loop: true; dur: ${dur}; easing: easeInOutQuad"`;
        }

        if (isModel) {
            layersHTML += `
                <a-entity
                    gltf-model="${fileUrl}"
                    position="0 0 ${baseZ}"
                    scale="0.5 0.5 0.5"
                    ${animationStr}>
                </a-entity>`;
        } else if (isGif) {
            layersHTML += `
                <a-plane
                    position="0 0 ${baseZ}"
                    width="${fit.w}"
                    height="${fit.h}"
                    gif="autoplay: true; transparent: true"
                    src="${fileUrl}"
                    ${animationStr}>
                </a-plane>`;
        } else {
            layersHTML += `
                <a-plane
                    position="0 0 ${baseZ}"
                    width="${fit.w}"
                    height="${fit.h}"
                    material="src: ${fileUrl}; transparent: true; alphaTest: 0.1"
                    ${animationStr}>
                </a-plane>`;
        }
    }

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

function updateSceneTargets(targets) {
    const box = sceneBox();
    if (!box) return;
    const scene = box.querySelector('a-scene');
    if (!scene) return;

    // Verwijder bestaande anchors
    scene.querySelectorAll('a-entity[xrextras-named-image-target]').forEach(el => el.remove());

    targets.forEach(item => {
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
                hideChunkCycleButton();

                document.querySelector('.scan-frame')?.classList.add('hidden');
                document.getElementById('scanning-indicator')?.classList.add('hidden');

                showSwipeState(2);
                const titleEl = document.getElementById('detected-poster-title');
                if (titleEl) titleEl.textContent = poster.title;

                currentPoster = poster;
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
                            document.getElementById('scanning-indicator')?.classList.remove('hidden');
                            showSwipeState(1);
                        }
                    }, 250);
                }
            });
        } else {
            // VERKEERSBORD TARGET
            anchor.setAttribute('data-sign-id', item.signId);
            anchor.setAttribute('data-sign-name', item.signName);
            anchor.setAttribute('data-search-query', item.searchQuery);
            anchor.setAttribute('data-memeborden', 'true');

            const dims = fitSignDimensions(item);

            // Rode border plane
            const borderPlane = document.createElement('a-plane');
            borderPlane.setAttribute('data-meme-border', item.signId);
            borderPlane.setAttribute('position', '0 0 0.005');
            borderPlane.setAttribute('width', (dims.w * 1.08).toFixed(3));
            borderPlane.setAttribute('height', (dims.h * 1.08).toFixed(3));
            borderPlane.setAttribute('color', '#CC0000');
            borderPlane.setAttribute('visible', 'false');
            anchor.appendChild(borderPlane);

            // GIF plane
            const gifPlane = document.createElement('a-plane');
            gifPlane.setAttribute('id', `meme-gif-plane-${item.signId}`);
            gifPlane.setAttribute('data-meme-sign', item.signId);
            gifPlane.setAttribute('position', '0 0 0.01');
            gifPlane.setAttribute('width', dims.w.toFixed(3));
            gifPlane.setAttribute('height', dims.h.toFixed(3));
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
                hideChunkCycleButton();

                document.querySelector('.scan-frame')?.classList.add('hidden');
                document.getElementById('scanning-indicator')?.classList.add('hidden');

                showSwipeState(2);
                const titleEl = document.getElementById('detected-poster-title');
                if (titleEl) titleEl.textContent = item.signName;

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
                            document.getElementById('scanning-indicator')?.classList.remove('hidden');
                            showSwipeState(1);
                        }
                    }, 250);
                }
            });
        }

        scene.appendChild(anchor);
    });

    console.log(`[AR] Anchors actief voor ${targets.length} targets`);
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
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        background: rgba(0, 0, 0, 0.9);
        color: #fff;
        border: 0.5px solid #fff;
        border-radius: 0;
        padding: 6px 12px;
        font-family: 'Roboto', sans-serif;
        font-size: 11px;
        letter-spacing: 2px;
        cursor: pointer;
        min-width: 70px;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.08);
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        touch-action: manipulation;
        transition: background 0.15s, color 0.15s;
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
        btn.style.background = 'rgba(0, 0, 0, 0.9)';
        btn.style.borderColor = '#fff';
        btn.style.color = '#fff';
        btn.style.display = 'block';
    }
}

// Start automatische chunk cycle scanner (zoals in originele masterproef)
function startChunkScan() {
    if (window.chunkLocked) return;
    const btn = document.getElementById('chunk-cycle-btn');
    if (!btn || !arChunks.length) return;

    if (isChunkScanning) {
        stopChunkScan();
        return;
    }

    isChunkScanning = true;
    let dots = 0;
    const total = arChunks.length;

    // Direct groene scan styling activeren
    btn.style.background = 'rgba(255, 255, 255, 0.15)';
    btn.style.borderColor = '#0f0';
    btn.style.color = '#0f0';

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

function stopChunkScan() {
    isChunkScanning = false;
    if (chunkScanTimeout) { clearTimeout(chunkScanTimeout); chunkScanTimeout = null; }
    if (chunkScanInterval) { clearInterval(chunkScanInterval); chunkScanInterval = null; }
    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) {
        btn.innerHTML = 'SCAN';
        btn.style.background = 'rgba(0, 0, 0, 0.9)';
        btn.style.borderColor = '#fff';
        btn.style.color = '#fff';
    }
}

async function switchChunk(index, keepScanRunning = false) {
    if (!xrControllerInstance || !arChunks || !arChunks[index]) return;
    currentChunkIndex = index;
    window.currentChunkIndex = index;
    window.chunkLocked = false;

    const chunk = arChunks[index];
    console.log(`[Chunk] Wisselen naar chunk ${index}: ${chunk.label} (${chunk.targets.length} targets)`);

    bootStatus(`Scannen: ${chunk.name}`);

    // Update 8th Wall targets via WASM configure
    xrControllerInstance.configure({ imageTargetData: chunk.targets });

    // Update A-Frame anchors
    updateSceneTargets(chunk.targets);

    renderChunkQuickPicker();

    if (!keepScanRunning) {
        const btn = document.getElementById('chunk-cycle-btn');
        if (btn) {
            btn.innerHTML = chunk.label.toUpperCase();
            setTimeout(() => {
                if (btn && !window.chunkLocked && !isChunkScanning) btn.innerHTML = 'SCAN';
            }, 1200);
        }
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

    grid.innerHTML = arChunks.map((c, i) => `
        <button type="button" class="chunk-picker-btn ${i === currentChunkIndex ? 'active' : ''}" data-chunk-index="${i}">
            ${c.label} (${c.targets.length})
        </button>
    `).join('');

    grid.querySelectorAll('.chunk-picker-btn').forEach(b => {
        b.addEventListener('click', async () => {
            const idx = parseInt(b.dataset.chunkIndex, 10);
            stopChunkScan();
            closeChunkQuickPicker();
            await switchChunk(idx);
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

    grid.innerHTML = window.allPosters.map(p => {
        const thumb = p.thumbnail ? `${BASE_URL}${p.thumbnail}` : (p.jpeg_filename ? `uploads/${p.jpeg_filename}` : 'img/placeholder.png');
        return `
            <div class="gallery-item" onclick="window.openPosterModal && window.openPosterModal('${p.id}')">
                <img src="${thumb}" alt="${p.title || ''}" loading="lazy">
                <span class="gallery-item-title">${p.title || 'Poster'}</span>
            </div>
        `;
    }).join('');
}

window.openPosterModal = (posterId) => {
    const poster = (window.allPosters || []).find(p => p.id === posterId);
    if (!poster) return;
    currentPoster = poster;
    showDownloadModal(poster);
};

// ==================== DOWNLOAD MODAL ====================

function showDownloadModal(poster) {
    const modal = document.getElementById('download-modal');
    if (!modal) return;

    const img = document.getElementById('modal-poster-img');
    const title = document.getElementById('modal-poster-title');
    const desc = document.getElementById('modal-poster-description');
    const loc = document.getElementById('modal-poster-location');
    const art = document.getElementById('modal-poster-article');
    const phot = document.getElementById('modal-poster-photographer');

    if (img) img.src = poster.thumbnail ? `${BASE_URL}${poster.thumbnail}` : (poster.jpeg_filename ? `uploads/${poster.jpeg_filename}` : 'img/placeholder.png');
    if (title) title.textContent = poster.title || 'Zonder titel';
    if (desc) desc.textContent = poster.description || '';
    if (loc) loc.textContent = poster.location_description ? `Locatie: ${poster.location_description}` : '';
    if (art) art.innerHTML = poster.artikel_link ? `<a href="${poster.artikel_link}" target="_blank" rel="noopener">Lees artikel ↗</a>` : '';
    if (phot) phot.textContent = poster.credits ? `Credits: ${poster.credits}` : '';

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
