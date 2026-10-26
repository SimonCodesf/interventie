// Interventie — AR Posters & Web Platform (A-Frame + 8th Wall XR Engine)
// Multi-Chunk Engine: ondersteunt alle 237 Belgische verkeersborden + posters.
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
let permissionRetry = false;

// Chunk State & 8th Wall Controller
let xrControllerInstance = null;
let arChunks = [];
let currentChunkIndex = 0;
window.currentChunkIndex = 0;
window.chunkLocked = false;
let chunkQuickPickerOpen = false;
let chunkLongPressTimer = null;
let chunkLongPressTriggered = false;

// Metingen & Telemetrie
let foundCount = 0, lostCount = 0, firstFoundAt = 0;
let jitterSum = 0, jitterCount = 0, frameCount = 0;
const anchorState = {}; // targetName -> { visible, lastPos, hideTimer, scanRecorded, foundAt }

// DOM helpers
const sceneBox = () => document.getElementById('ar-scene');

// ==================== SEQUENTIEEL SCRIPT LADEN ====================

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
                reject(new Error('Timeout bij het laden van ' + src.split('/').pop()));
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

async function cameraBlocked() {
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const st = await navigator.permissions.query({ name: 'camera' });
            return st.state === 'denied';
        }
    } catch (e) {}
    return false;
}

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
        if (XR8.XrController) return resolve(XR8.XrController);
        const start = performance.now();
        const interval = setInterval(() => {
            if (XR8.XrController) {
                clearInterval(interval);
                return resolve(XR8.XrController);
            }
            if (performance.now() - start > timeoutMs) {
                clearInterval(interval);
                reject(new Error('XrController timeout'));
            }
        }, 50);
    });
}

function fatalError(msg) {
    console.error('[AR Fatal]', msg);
    bootStatus('Fout: ' + msg);
}

// ==================== POSE SMOOTHING COMPONENT ====================

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

// ==================== POSTER LAGEN OPBOUWEN ====================

function buildLayersHTML(poster) {
    if (!poster.layers) return '';
    let layersHTML = '';
    let layers = [];

    try {
        layers = typeof poster.layers === 'string' ? JSON.parse(poster.layers) : poster.layers;
    } catch(e) {
        console.error('Fout bij parsen layers:', e);
        return '';
    }

    if (!Array.isArray(layers)) return '';

    for (let index = 0; index < layers.length; index++) {
        const layer = layers[index];
        const fileUrl = layer.file.startsWith('http') ? layer.file : `uploads/${layer.file}`;
        const fileExt = layer.file.split('.').pop().toLowerCase();
        const baseZ = (index + 1) * 0.02;

        let animationStr = '';
        if (layer.anim_type && layer.anim_type !== 'none') {
            const dur = (layer.anim_duration || 2) * 1000;
            const loop = layer.anim_loop !== false ? 'dir: alternate; loop: true;' : 'loop: false;';

            if (layer.anim_type === 'float') {
                const amount = layer.anim_amount || 0.1;
                animationStr = `animation="property: position; to: 0 ${amount} ${baseZ}; dur: ${dur}; easing: easeInOutSine; ${loop}"`;
            } else if (layer.anim_type === 'rotate') {
                const amount = layer.anim_amount || 360;
                animationStr = `animation="property: rotation; to: 0 0 ${amount}; dur: ${dur}; easing: linear; loop: true;"`;
            } else if (layer.anim_type === 'pulse') {
                const amount = layer.anim_amount || 1.1;
                animationStr = `animation="property: scale; to: ${amount} ${amount} ${amount}; dur: ${dur}; easing: easeInOutSine; ${loop}"`;
            } else if (layer.anim_type === 'fade') {
                animationStr = `animation="property: material.opacity; to: 0.2; dur: ${dur}; easing: easeInOutSine; ${loop}"`;
            }
        }

        if (fileExt === 'glb') {
            layersHTML += `
                <a-entity
                    gltf-model="${fileUrl}"
                    position="0 0 ${baseZ}"
                    scale="0.5 0.5 0.5"
                    ${animationStr}>
                </a-entity>`;
        } else if (fileExt === 'gif') {
            layersHTML += `
                <a-plane
                    position="0 0 ${baseZ}"
                    width="1"
                    height="1.414"
                    gif="autoplay: true; transparent: true"
                    src="${fileUrl}"
                    ${animationStr}>
                </a-plane>`;
        } else {
            layersHTML += `
                <a-plane
                    position="0 0 ${baseZ}"
                    width="1"
                    height="1.414"
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
    const oldScene = sceneBox().querySelector('a-scene');
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

    // Licht
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

    // Engine foutopvang
    scene.addEventListener('realityerror', (e) => {
        const d = (e && e.detail) || {};
        console.error('[AR] realityerror', d);
        if (firstFoundAt) return;
        const reason = (d.error && d.error.message) || 'Camera kon niet gestart worden';
        bootStatus('Fout: ' + reason);
    });

    sceneBox().appendChild(scene);
    updateSceneTargets(targets);

    startJitterLoop();
}

function updateSceneTargets(targets) {
    const scene = sceneBox().querySelector('a-scene');
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

            anchorState[item.name] = { visible: false, lastPos: null, hideTimer: 0, scanRecorded: false, foundAt: 0 };

            anchor.addEventListener('xrextrasfound', () => {
                const st = anchorState[item.name];
                if (st && st.hideTimer) { clearTimeout(st.hideTimer); st.hideTimer = 0; }
                foundCount++;
                if (!firstFoundAt) firstFoundAt = performance.now();
                if (st) {
                    if (!st.visible) st.foundAt = Date.now();
                    st.visible = true;
                }

                console.log(`[AR] Poster GEVONDEN: ${poster.title} (${poster.id})`);
                window.chunkLocked = true;
                hideChunkCycleButton();

                const scanGuide = document.getElementById('scanning-overlay');
                if (scanGuide) scanGuide.style.display = 'none';

                showSwipeState(2);
                const titleEl = document.getElementById('detected-poster-title');
                if (titleEl) titleEl.textContent = poster.title;

                currentTrackedPoster = poster;
                featuredPoster = poster;
                currentPoster = poster;

                if (poster.audio_file) playPosterAudio(poster.audio_file);

                if (st && !st.scanRecorded) {
                    st.scanRecorded = true;
                    fetch(`${API_URL}/posters/${encodeURIComponent(poster.id)}/scan`, { method: 'POST' }).catch(() => {});
                }
            });

            anchor.addEventListener('xrextraslost', () => {
                const st = anchorState[item.name];
                lostCount++;
                if (st) st.visible = false;
                const anchorObj = anchor.object3D;
                if (anchorObj) anchorObj.visible = true;

                if (st && st.hideTimer) clearTimeout(st.hideTimer);
                if (st) {
                    st.hideTimer = setTimeout(() => {
                        st.hideTimer = 0;
                        if (anchorObj && !anchorState[item.name]?.visible) {
                            anchorObj.visible = false;
                            window.chunkLocked = false;
                            showChunkCycleButtonAgain();
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

            // Rode border plane
            const borderPlane = document.createElement('a-plane');
            borderPlane.setAttribute('data-meme-border', item.signId);
            borderPlane.setAttribute('position', '0 0 0.005');
            borderPlane.setAttribute('width', '1.3');
            borderPlane.setAttribute('height', '1.3');
            borderPlane.setAttribute('color', '#CC0000');
            borderPlane.setAttribute('visible', 'false');
            anchor.appendChild(borderPlane);

            // GIF plane
            const gifPlane = document.createElement('a-plane');
            gifPlane.setAttribute('id', `meme-gif-plane-${item.signId}`);
            gifPlane.setAttribute('data-meme-sign', item.signId);
            gifPlane.setAttribute('position', '0 0 0.01');
            gifPlane.setAttribute('width', '1.1');
            gifPlane.setAttribute('height', '1.1');
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
                hideChunkCycleButton();

                const scanGuide = document.getElementById('scanning-overlay');
                if (scanGuide) scanGuide.style.display = 'none';

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
                const anchorObj = anchor.object3D;
                if (anchorObj) anchorObj.visible = true;

                if (st && st.hideTimer) clearTimeout(st.hideTimer);
                if (st) {
                    st.hideTimer = setTimeout(() => {
                        st.hideTimer = 0;
                        if (anchorObj && !anchorState[item.name]?.visible) {
                            anchorObj.visible = false;
                            borderPlane.setAttribute('visible', 'false');
                            gifPlane.setAttribute('visible', 'false');
                            window.chunkLocked = false;
                            showChunkCycleButtonAgain();
                        }
                    }, LOST_GRACE_MS);
                }
            });
        }

        scene.appendChild(anchor);
    });

    console.log(`[AR] Anchors actief voor ${targets.length} targets`);
}

// Jitter & Telemetrie
function startJitterLoop() {
    setInterval(() => {
        const anchors = sceneBox().querySelectorAll('a-entity[xrextras-named-image-target]');
        anchors.forEach(a => {
            const nm = a.getAttribute('xrextras-named-image-target');
            const key = (nm && nm.name) || '';
            const st = anchorState[key];
            if (!st || !st.visible || !a.object3D) return;
            const p = a.object3D.position;
            if (st.lastPos) {
                const dx = p.x - st.lastPos.x, dy = p.y - st.lastPos.y, dz = p.z - st.lastPos.z;
                jitterSum += Math.sqrt(dx * dx + dy * dy + dz * dz);
                jitterCount++;
            }
            st.lastPos = { x: p.x, y: p.y, z: p.z };
        });
        frameCount++;
        if (frameCount % 30 === 0 && jitterCount > 0) {
            const jit = jitterSum / jitterCount;
            window.__AR_STATS = { jit, found: foundCount, lost: lostCount };
        }
    }, 100);
}

// ==================== AUDIO AFSPELEN ====================

let activeAudio = null;
function playPosterAudio(audioFilename) {
    if (!audioFilename) return;
    try {
        if (activeAudio) {
            activeAudio.pause();
            activeAudio = null;
        }
        const audioUrl = audioFilename.startsWith('http') ? audioFilename : `uploads/audio/${audioFilename}`;
        activeAudio = new Audio(audioUrl);
        activeAudio.play().catch(e => console.log('Audio autoplay prevented:', e));
    } catch(e) {}
}

// ==================== CHUNK ENGINE & CHUNK KNOP ====================

function injectSpinnerCSS() {
    if (document.getElementById('scan-spinner-css')) return;
    const style = document.createElement('style');
    style.id = 'scan-spinner-css';
    style.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        .scan-spinner {
            display: inline-block;
            width: 8px;
            height: 8px;
            border: 1.5px solid transparent;
            border-top-color: #fff;
            border-right-color: #fff;
            border-bottom-color: #fff;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
            margin-left: 6px;
            vertical-align: middle;
        }
    `;
    document.head.appendChild(style);
}

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
            background: rgba(0, 0, 0, 0.95);
            border: 0.5px solid rgba(255, 255, 255, 0.85);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.65);
            z-index: 10001;
            display: none;
            pointer-events: auto;
            color: #fff;
            font-family: var(--font-data, 'Courier New', monospace);
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
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
            font-size: 0.68rem;
            line-height: 1;
            padding: 0.15rem 0.4rem;
            cursor: pointer;
        }
        .chunk-picker-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.35rem;
            padding: 0.6rem;
            overflow-y: auto;
            max-height: calc(48vh - 2rem);
        }
        .chunk-picker-btn {
            background: rgba(255,255,255,0.04);
            color: #fff;
            border: 0.5px solid rgba(255,255,255,0.35);
            font-size: 0.68rem;
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
        .chunk-picker-subtle-toggle {
            position: fixed;
            left: calc(50% + 54px);
            bottom: 124px;
            transform: translateX(-50%);
            z-index: 10000;
            background: rgba(0,0,0,0.72);
            color: #fff;
            border: 0.5px solid rgba(255,255,255,0.45);
            padding: 4px 8px;
            font-size: 0.58rem;
            letter-spacing: 0.08em;
            cursor: pointer;
            opacity: 0.75;
        }
    `;
    document.head.appendChild(style);
}

function showChunkCycleButton() {
    injectSpinnerCSS();
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
    `;

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

    btn.addEventListener('pointerup', () => {
        clearLongPress();
        if (!chunkLongPressTriggered) {
            chunkLongPressTriggered = true;
            cycleNextChunk();
            setTimeout(() => { chunkLongPressTriggered = false; }, 400);
        }
    });

    btn.addEventListener('pointercancel', clearLongPress);
    btn.addEventListener('click', (e) => { e.preventDefault(); });

    document.body.appendChild(btn);

    // Subtiele toggle knop naast SCAN voor snel openen van de picker
    let toggleBtn = document.getElementById('chunk-picker-toggle-btn');
    if (!toggleBtn) {
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'chunk-picker-toggle-btn';
        toggleBtn.className = 'chunk-picker-subtle-toggle';
        toggleBtn.textContent = 'CHUNKS';
        toggleBtn.addEventListener('click', () => {
            if (chunkQuickPickerOpen) closeChunkQuickPicker();
            else openChunkQuickPicker();
        });
        document.body.appendChild(toggleBtn);
    }
}

function hideChunkCycleButton() {
    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) btn.style.display = 'none';
    const toggle = document.getElementById('chunk-picker-toggle-btn');
    if (toggle) toggle.style.display = 'none';
    closeChunkQuickPicker();
}

function showChunkCycleButtonAgain() {
    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) {
        btn.innerHTML = 'SCAN';
        btn.style.display = 'block';
    }
    const toggle = document.getElementById('chunk-picker-toggle-btn');
    if (toggle) toggle.style.display = 'block';
}

async function cycleNextChunk() {
    if (!arChunks.length) return;
    const nextIndex = (currentChunkIndex + 1) % arChunks.length;
    await switchChunk(nextIndex);
}

async function switchChunk(index) {
    if (!xrControllerInstance || !arChunks || !arChunks[index]) return;
    currentChunkIndex = index;
    window.currentChunkIndex = index;
    window.chunkLocked = false;

    const chunk = arChunks[index];
    console.log(`[Chunk] Wisselen naar chunk ${index}: ${chunk.label} (${chunk.targets.length} targets)`);

    const btn = document.getElementById('chunk-cycle-btn');
    if (btn) {
        btn.innerHTML = `${chunk.label.toUpperCase()}<span class="scan-spinner"></span>`;
    }

    bootStatus(`Scannen: ${chunk.name}`);

    // Update 8th Wall targets
    xrControllerInstance.configure({ imageTargetData: chunk.targets });

    // Update A-Frame anchors
    updateSceneTargets(chunk.targets);

    renderChunkQuickPicker();

    setTimeout(() => {
        if (btn && !window.chunkLocked) btn.innerHTML = 'SCAN';
    }, 1500);
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

    grid.innerHTML = arChunks.map((chunk, index) => {
        const active = index === currentChunkIndex ? ' active' : '';
        return `<button type="button" class="chunk-picker-btn${active}" data-chunk-index="${index}">${chunk.label}</button>`;
    }).join('');

    grid.querySelectorAll('.chunk-picker-btn').forEach(b => {
        b.addEventListener('click', async () => {
            const idx = parseInt(b.dataset.chunkIndex, 10);
            closeChunkQuickPicker();
            await switchChunk(idx);
        });
    });
}

function openChunkQuickPicker() {
    renderChunkQuickPicker();
    const picker = document.getElementById('chunk-quick-picker');
    if (picker) {
        picker.classList.add('open');
        chunkQuickPickerOpen = true;
    }
}

function closeChunkQuickPicker() {
    const picker = document.getElementById('chunk-quick-picker');
    if (picker) {
        picker.classList.remove('open');
        chunkQuickPickerOpen = false;
    }
}

// ==================== BOOT AR (MOBIELE START) ====================

async function bootAR() {
    if (bootStarted) return;
    bootStarted = true;
    bootTime = performance.now();

    if (!webglSupported()) {
        fatalError('WEBGL NIET BESCHIKBAAR');
        return;
    }

    bootStatus('Cameratoegang controleren…');
    const perm = await ensureCameraPermission();
    if (!perm.ok) {
        bootStatus('Cameratoegang geweigerd. Geef toestemming in browserinstellingen en herlaad.');
        bootStarted = false;
        return;
    }

    try {
        bootStatus('Bibliotheken laden…');
        await Promise.all([
            loadScript('js/vendor/aframe.min.js'),
            loadScript('js/vendor/xr.js?v=1', { 'data-preload-chunks': 'slam', 'crossorigin': 'anonymous' }),
            loadScript('js/vendor/xrextras.js?v=1'),
            loadScript('js/gif-component.js?v=2')
        ]);

        bootStatus('XR Engine starten…');
        const XR8 = await xrReady();
        xrControllerInstance = await xrControllerReady(XR8, 20000);

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
            label: 'Posters + Top',
            targets: [...posterTargets, ...topSigns]
        });

        // Chunks 1..N: De specifieke series uit chunks8w.json
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

        bootStatus('Targets configureren…');
        xrControllerInstance.configure({ imageTargetData: initialTargets });
        console.log(`[AR] 8th Wall geconfigureerd met chunk 0: ${initialTargets.length} targets`);

        bootStatus('Richt je camera op een poster of bord');
        buildScene(initialTargets);

        showChunkCycleButton();

    } catch (e) {
        console.error('[AR Boot Fout]', e);
        bootStatus('Starten mislukt: ' + (e.message || e));
        bootStarted = false;
    }
}

// ==================== PRELOAD VOORBEREIDING ====================

function preloadAll() {
    loadScript('js/vendor/aframe.min.js');
    loadScript('js/vendor/xr.js?v=1', { 'data-preload-chunks': 'slam', 'crossorigin': 'anonymous' });
    loadScript('js/vendor/xrextras.js?v=1');
    loadScript('js/gif-component.js?v=2');
}

if (document.readyState === 'complete') {
    preloadAll();
} else {
    window.addEventListener('load', preloadAll);
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

// ==================== HACKER LOADER ====================

function hideLoader() {
    const loader = document.getElementById('hacker-loader');
    if (loader) {
        loader.classList.remove('visible');
        setTimeout(() => { loader.style.display = 'none'; }, 400);
    }
}

// ==================== APP INITIALISATIE ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Interventie Platform — 8th Wall XR Initialisatie (Multi-Chunk)...');

    // Device detectie
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth <= 850 && ('ontouchstart' in window));

    if (isMobile) {
        console.log('[Mode] Mobiel toestel gedetecteerd — AR camera start automatisch');
        document.getElementById('desktop-view').style.display = 'none';
        document.getElementById('mobile-ar-view').style.display = 'block';

        setupSwipeBarControls();
        setupModal();
        hideLoader();

        // Start AR direct zoals in de originele app
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
