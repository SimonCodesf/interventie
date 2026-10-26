// Interventie — AR Posters & Web Platform (A-Frame + 8th Wall XR Engine)
// Alle targets staan tegelijk geregistreerd; elke poster toont zijn lagen
// zodra hij in beeld is (geen chunks, geen knop- of chunk-wissel nodig).
//
// This product includes the XR Engine software developed by Niantic Spatial, Inc.
// Copyright © 2026 Niantic Spatial, Inc. All rights reserved.
// License: https://github.com/8thwall/engine/blob/main/LICENSE

// ==================== CONFIGURATIE & GLOBALS ====================

const BASE_URL = window.location.origin;
const API_URL = `${BASE_URL}/api.php`;
const LOST_GRACE_MS = 1200; // Grace-periode: voorkomt knipperen/glitch bij korte haperingen
const SCRIPT_TIMEOUT_MS = 45000;

let currentTrackedPoster = null;
let featuredPoster = null;
let currentPoster = null; // Voor download modal
let bootStarted = false;
let bootTime = 0;
let permissionRetry = false;

// Metingen & Telemetrie
let foundCount = 0, lostCount = 0, firstFoundAt = 0;
let jitterSum = 0, jitterCount = 0, frameCount = 0;
const anchorState = {}; // targetName -> { visible, lastPos, hideTimer, scanRecorded, foundAt }

// DOM helpers
const sceneBox = () => document.getElementById('ar-scene');
const overlay = () => document.getElementById('start-overlay');

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
    const el = document.getElementById('boot-status');
    if (el) el.textContent = msg || '';
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
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false }
    ];
    let lastErr = null;
    for (let i = 0; i < attempts.length; i++) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(attempts[i]);
            stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
            return { ok: true };
        } catch (e) {
            lastErr = e;
            if (!e || e.name !== 'OverconstrainedError') break;
        }
    }
    return { ok: false, reason: (lastErr && lastErr.name) || 'error' };
}

function webglSupported() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext &&
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

function xrReady() {
    return new Promise((resolve, reject) => {
        if (window.XR8) return resolve(window.XR8);
        const to = setTimeout(() => reject(new Error('XR8 niet geladen (timeout)')), 20000);
        window.addEventListener('xrloaded', function onXr() {
            window.removeEventListener('xrloaded', onXr);
            clearTimeout(to);
            resolve(window.XR8);
        });
    });
}

function xrControllerReady(XR8, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        (function poll() {
            if (XR8.XrController) return resolve(XR8.XrController);
            if (Date.now() - start > timeoutMs) {
                reject(new Error('XrController niet beschikbaar (timeout)'));
                return;
            }
            setTimeout(poll, 200);
        })();
    });
}

function fatalError(msg) {
    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.textContent = msg;
        btn.disabled = true;
    }
    if (overlay()) overlay().style.display = 'flex';
}

function retryOverlay() {
    bootStarted = false;
    bootStatus('');
    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.textContent = 'OPNIEUW PROBEREN';
        btn.disabled = false;
    }
    if (overlay()) overlay().style.display = 'flex';
}

// ==================== LAAG OPBOUW & METADATA ====================

function fitPosterSize(targetData) {
    let w = 0.707, h = 1; // Standaard A4/A3 verhouding
    const p = targetData && targetData.properties;
    const ow = parseFloat(p && (p.originalWidth || p.width));
    const oh = parseFloat(p && (p.originalHeight || p.height));
    if (ow > 0 && oh > 0) {
        const a = ow / oh;
        if (a <= 1) { w = a; h = 1; } else { w = 1; h = 1 / a; }
    }
    return { w: Math.round(w * 1000) / 1000, h: Math.round(h * 1000) / 1000 };
}

function buildLayersHTML(poster) {
    let layersHTML = '';
    const fit = fitPosterSize(poster.target8w);

    // Zwarte achtergrondlaag tenzij expliciet camera feed ingeschakeld
    if (!poster.ar_camera_feed || !parseInt(poster.ar_camera_feed)) {
        layersHTML += `
            <a-plane 
                id="ar-layer-bg-${poster.id}"
                position="0 0 -0.01" 
                height="${fit.h * 1.1}" 
                width="${fit.w * 1.1}" 
                rotation="0 0 0"
                material="color: #000000; transparent: false; side: double; shader: flat;">
            </a-plane>`;
    }

    if (poster.layers) {
        for (let i = 1; i <= 8; i++) {
            const layerData = poster.layers[`layer_${i}`];
            if (!layerData) continue;

            const baseZ = Math.max(parseFloat(layerData.z) || 0, 0.05) + (i * 0.01);
            const posX = parseFloat(layerData.pos_x) || 0;
            const posY = parseFloat(layerData.pos_y) || 0;
            const baseScale = parseFloat(layerData.scale) || 1.0;
            const rotX = parseFloat(layerData.rot_x) || 0;
            const rotY = parseFloat(layerData.rot_y) || 0;
            const rotZ = parseFloat(layerData.rot_z) || 0;

            // Animaties
            let animAttrs = [];
            const hasPositionAnim = (parseFloat(layerData.anim_x) || parseFloat(layerData.anim_y) || parseFloat(layerData.anim_z)) && parseInt(layerData.anim_pos_duration) > 0;
            const hasRotationAnim = (parseFloat(layerData.anim_rot_x) || parseFloat(layerData.anim_rot_y) || parseFloat(layerData.anim_rot_z)) && parseInt(layerData.anim_rot_duration) > 0;
            const hasScaleAnim = (parseFloat(layerData.anim_scale) !== 1.0 || parseFloat(layerData.anim_opacity) !== 1.0) && parseInt(layerData.anim_scale_duration) > 0;

            if (hasPositionAnim) {
                const animX = parseFloat(layerData.anim_x) || 0;
                const animY = parseFloat(layerData.anim_y) || 0;
                const animZ = parseFloat(layerData.anim_z) || 0;
                const posDur = parseInt(layerData.anim_pos_duration) || 1000;
                animAttrs.push(`animation="property: position; from: ${posX} ${posY} ${baseZ}; to: ${posX + animX} ${posY + animY} ${baseZ + animZ}; dur: ${posDur}; easing: linear; loop: true; dir: alternate;"`);
            }
            if (hasRotationAnim) {
                const animRotX = parseFloat(layerData.anim_rot_x) || 0;
                const animRotY = parseFloat(layerData.anim_rot_y) || 0;
                const animRotZ = parseFloat(layerData.anim_rot_z) || 0;
                const rotDur = parseInt(layerData.anim_rot_duration) || 1000;
                animAttrs.push(`animation__rot="property: rotation; from: ${rotX} ${rotY} ${rotZ}; to: ${rotX + animRotX} ${rotY + animRotY} ${rotZ + animRotZ}; dur: ${rotDur}; easing: linear; loop: true; dir: alternate;"`);
            }
            if (hasScaleAnim) {
                const animScale = parseFloat(layerData.anim_scale) || 1.0;
                const scaleDur = parseInt(layerData.anim_scale_duration) || 1000;
                animAttrs.push(`animation__scale="property: scale; from: ${baseScale} ${baseScale} ${baseScale}; to: ${baseScale * animScale} ${baseScale * animScale} ${baseScale * animScale}; dur: ${scaleDur}; easing: linear; loop: true; dir: alternate;"`);
            }
            const animationStr = animAttrs.join(' ');

            // 1. Live Klipy API GIF
            if (layerData.api_mode === 'gif_url' && layerData.api_url) {
                const gifSize = 1.2 * baseScale;
                const gifUrl = `${API_URL}/verkeersborden/gif-proxy?url=${encodeURIComponent(layerData.api_url)}`;
                layersHTML += `
                    <a-plane
                        id="ar-layer-${poster.id}-${i}"
                        class="gif-layer api-gif-layer"
                        gif="autoplay: true; transparent: false; speed: 1;"
                        data-gif-src="${gifUrl}"
                        position="${posX} ${posY} ${baseZ}"
                        rotation="${rotX} ${rotY} ${rotZ}"
                        height="${gifSize.toFixed(3)}"
                        width="${gifSize.toFixed(3)}"
                        material="transparent: false; side: double;"
                        ${animationStr}>
                    </a-plane>`;
                continue;
            }

            // 2. Sketchfab 3D Model
            if ((layerData.api_mode === '3d_model' || layerData.api_source === 'sketchfab') && layerData.api_query) {
                const glbScale = baseScale * 0.1;
                const modelUrl = `${API_URL}/api-search/3d/model?uid=${encodeURIComponent(layerData.api_query)}`;
                layersHTML += `
                    <a-entity
                        id="ar-layer-${poster.id}-${i}"
                        class="ar-model api-3d-layer"
                        gltf-model="${modelUrl}"
                        position="${posX} ${posY} ${baseZ}"
                        rotation="${rotX} ${rotY} ${rotZ}"
                        scale="${glbScale} ${glbScale} ${glbScale}"
                        ${animationStr}>
                    </a-entity>`;
                continue;
            }

            // 3. Tekstlaag
            if (layerData.text_enabled && layerData.text_content) {
                const textPosY = posY + (parseFloat(layerData.text_offset_y) || 0.85);
                const textEncoded = encodeURIComponent(layerData.text_content);
                const fontEncoded = encodeURIComponent(layerData.text_font_family || '"Bebas Neue", sans-serif');
                layersHTML += `
                    <a-plane
                        id="ar-text-layer-${poster.id}-${i}"
                        data-ar-text-layer="1"
                        data-text-content="${textEncoded}"
                        data-text-font="${fontEncoded}"
                        data-text-color="${layerData.text_color || '#ffffff'}"
                        data-text-outline-color="${layerData.text_outline_color || '#000000'}"
                        position="${posX} ${textPosY} ${baseZ + 0.03}"
                        rotation="${rotX} ${rotY} ${rotZ}"
                        width="${fit.w * baseScale}"
                        height="0.3"
                        material="transparent: true; alphaTest: 0.02; side: double;"
                        ${animationStr}>
                    </a-plane>`;
            }

            // 4. Standaard Bestandslaag (Afbeelding, GIF of 3D GLB)
            if (layerData.filename) {
                const mediaPath = `uploads/ar-layers/${layerData.filename}`;
                const isModel = /\.glb(\?|$)/i.test(layerData.filename);
                const isGif = /\.gif(\?|$)/i.test(layerData.filename);
                const isTransparent = layerData.transparent !== false;

                if (isModel) {
                    const glbScale = baseScale * 0.1;
                    layersHTML += `
                        <a-entity
                            id="ar-layer-${poster.id}-${i}"
                            class="ar-model"
                            gltf-model="${mediaPath}"
                            position="${posX} ${posY} ${baseZ}"
                            rotation="${rotX} ${rotY} ${rotZ}"
                            scale="${glbScale} ${glbScale} ${glbScale}"
                            ${animationStr}>
                        </a-entity>`;
                } else if (isGif) {
                    const planeW = fit.w * baseScale;
                    const planeH = fit.h * baseScale;
                    layersHTML += `
                        <a-plane
                            id="ar-layer-${poster.id}-${i}"
                            class="gif-layer"
                            gif="src: ${mediaPath}; autoplay: true; transparent: ${isTransparent};"
                            position="${posX} ${posY} ${baseZ}"
                            rotation="${rotX} ${rotY} ${rotZ}"
                            width="${planeW.toFixed(3)}"
                            height="${planeH.toFixed(3)}"
                            material="transparent: ${isTransparent}; side: double;"
                            ${animationStr}>
                        </a-plane>`;
                } else {
                    const planeW = fit.w * baseScale;
                    const planeH = fit.h * baseScale;
                    layersHTML += `
                        <a-plane
                            id="ar-layer-${poster.id}-${i}"
                            src="${mediaPath}"
                            position="${posX} ${posY} ${baseZ}"
                            rotation="${rotX} ${rotY} ${rotZ}"
                            width="${planeW.toFixed(3)}"
                            height="${planeH.toFixed(3)}"
                            material="transparent: ${isTransparent}; side: double; shader: flat;"
                            ${animationStr}>
                        </a-plane>`;
                }
            }
        }
    }

    return layersHTML;
}

// ==================== SCENE OPBOUW (8TH WALL ANCHORS) ====================

function buildScene(posterEntries, signEntries = []) {
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
        retryOverlay();
        bootStatus('Fout: ' + reason);
    });

    // 1. Posters Anchors toevoegen
    posterEntries.forEach(poster => {
        const anchor = document.createElement('a-entity');
        anchor.setAttribute('xrextras-named-image-target', 'name: ' + poster.id);

        const content = document.createElement('a-entity');
        content.setAttribute('class', 'poster-content');
        content.setAttribute('data-poster-id', poster.id);
        content.innerHTML = buildLayersHTML(poster);
        anchor.appendChild(content);

        anchorState[poster.id] = { visible: false, lastPos: null, hideTimer: 0, scanRecorded: false, foundAt: 0 };

        anchor.addEventListener('xrextrasfound', () => {
            const st = anchorState[poster.id];
            if (st && st.hideTimer) { clearTimeout(st.hideTimer); st.hideTimer = 0; }
            foundCount++;
            if (!firstFoundAt) firstFoundAt = performance.now();
            if (st) {
                if (!st.visible) st.foundAt = Date.now();
                st.visible = true;
            }

            console.log(`[AR] Poster GEVONDEN: ${poster.title} (${poster.id})`);

            // UI updates
            const scanGuide = document.getElementById('scanning-overlay');
            if (scanGuide) scanGuide.style.display = 'none';

            showSwipeState(2);
            const titleEl = document.getElementById('detected-poster-title');
            if (titleEl) titleEl.textContent = poster.title;

            currentTrackedPoster = poster;
            featuredPoster = poster;
            currentPoster = poster;

            // Audio afspelen indien aanwezig
            if (poster.audio_file) {
                playPosterAudio(poster.audio_file);
            }

            // Scan registreren
            if (st && !st.scanRecorded) {
                st.scanRecorded = true;
                try {
                    fetch(`${API_URL}/posters/${encodeURIComponent(poster.id)}/scan`, { method: 'POST' }).catch(() => {});
                } catch(e) {}
            }
        });

        anchor.addEventListener('xrextraslost', () => {
            const st = anchorState[poster.id];
            lostCount++;
            if (st) st.visible = false;
            console.log(`[AR] Poster verloren (grace ${LOST_GRACE_MS}ms): ${poster.title}`);

            // Houd pose tijdelijk vast tegen jitter
            const anchorObj = anchor.object3D;
            if (anchorObj) anchorObj.visible = true;

            if (st && st.hideTimer) clearTimeout(st.hideTimer);
            if (st) {
                st.hideTimer = setTimeout(() => {
                    st.hideTimer = 0;
                    if (anchorObj && !anchorState[poster.id]?.visible) {
                        anchorObj.visible = false;
                    }
                }, LOST_GRACE_MS);
            }
        });

        scene.appendChild(anchor);
    });

    // 2. Verkeersborden Anchors toevoegen (Memeborden)
    signEntries.forEach(sign => {
        const anchor = document.createElement('a-entity');
        anchor.setAttribute('xrextras-named-image-target', 'name: ' + sign.name);
        anchor.setAttribute('data-sign-id', sign.signId);
        anchor.setAttribute('data-sign-name', sign.signName);
        anchor.setAttribute('data-search-query', sign.searchQuery);
        anchor.setAttribute('data-memeborden', 'true');

        // Rode border plane
        const borderPlane = document.createElement('a-plane');
        borderPlane.setAttribute('position', '0 0 0.005');
        borderPlane.setAttribute('width', '1.3');
        borderPlane.setAttribute('height', '1.3');
        borderPlane.setAttribute('color', '#CC0000');
        borderPlane.setAttribute('visible', 'false');
        anchor.appendChild(borderPlane);

        // GIF plane
        const gifPlane = document.createElement('a-plane');
        gifPlane.setAttribute('data-meme-sign', sign.signId);
        gifPlane.setAttribute('position', '0 0 0.01');
        gifPlane.setAttribute('width', '1.1');
        gifPlane.setAttribute('height', '1.1');
        gifPlane.setAttribute('visible', 'false');
        gifPlane.setAttribute('gif', 'autoplay: true; transparent: false');
        anchor.appendChild(gifPlane);

        anchorState[sign.name] = { visible: false, lastPos: null, hideTimer: 0 };

        anchor.addEventListener('xrextrasfound', () => {
            const st = anchorState[sign.name];
            if (st && st.hideTimer) { clearTimeout(st.hideTimer); st.hideTimer = 0; }
            if (st) st.visible = true;
            console.log(`[Memeborden] Bord GEVONDEN: ${sign.signName}`);

            const scanGuide = document.getElementById('scanning-overlay');
            if (scanGuide) scanGuide.style.display = 'none';

            showSwipeState(2);
            const titleEl = document.getElementById('detected-poster-title');
            if (titleEl) titleEl.textContent = sign.signName;

            borderPlane.setAttribute('visible', 'true');
            if (typeof window.fetchAndDisplayGif === 'function') {
                window.fetchAndDisplayGif(sign.signId, sign.searchQuery, anchor);
            }
        });

        anchor.addEventListener('xrextraslost', () => {
            const st = anchorState[sign.name];
            if (st) st.visible = false;
            const anchorObj = anchor.object3D;
            if (anchorObj) anchorObj.visible = true;

            if (st && st.hideTimer) clearTimeout(st.hideTimer);
            if (st) {
                st.hideTimer = setTimeout(() => {
                    st.hideTimer = 0;
                    if (anchorObj && !anchorState[sign.name]?.visible) {
                        anchorObj.visible = false;
                        borderPlane.setAttribute('visible', 'false');
                        gifPlane.setAttribute('visible', 'false');
                    }
                }, LOST_GRACE_MS);
            }
        });

        scene.appendChild(anchor);
    });

    sceneBox().appendChild(scene);
    console.log(`[AR] 8th Wall scene gebouwd met ${posterEntries.length} posters en ${signEntries.length} verkeersborden`);

    startJitterLoop();
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

// ==================== BOOT AR (MOBIELE START) ====================

async function bootAR() {
    if (bootStarted) return;
    bootStarted = true;
    bootTime = performance.now();

    if (!webglSupported()) {
        fatalError('WEBGL NIET BESCHIKBAAR');
        return;
    }

    const btn = document.getElementById('start-btn');
    if (btn) {
        btn.textContent = 'LADEN…';
        btn.disabled = true;
    }

    if (await cameraBlocked()) {
        btn.textContent = 'CAMERA TOESTAAN';
        bootStatus('Geen cameratoegang. Controleer app-machtigingen in je browser.');
        bootStarted = false;
        btn.disabled = false;
        permissionRetry = true;
        return;
    }

    if (permissionRetry) {
        permissionRetry = false;
        bootStatus('Camera toestemming vragen…');
        const perm = await ensureCameraPermission();
        if (!perm.ok) {
            btn.textContent = 'CAMERA TOESTAAN';
            bootStatus('Cameratoegang geweigerd (' + perm.reason + '). Herlaad de pagina na het verlenen.');
            bootStarted = false;
            btn.disabled = false;
            permissionRetry = true;
            return;
        }
    }

    try {
        bootStatus('Bibliotheken laden…');
        await Promise.all([
            loadScript('js/vendor/aframe.min.js'),
            loadScript('js/vendor/xr.js?v=1', { 'data-preload-chunks': 'slam', 'crossorigin': 'anonymous' }),
            loadScript('js/vendor/xrextras.js?v=1'),
            loadScript('js/gif-component.js?v=2')
        ]);

        bootStatus('Engine starten…');
        const XR8 = await xrReady();
        const XrController = await xrControllerReady(XR8, 20000);

        bootStatus('Posters ophalen…');
        const postersResp = await fetchTimeout(`${API_URL}/posters`);
        const posters = postersResp.ok ? await postersResp.json() : [];
        window.allPosters = posters;

        // Laad ook verkeersborden targets indien beschikbaar
        let signTargets = [];
        try {
            const signsResp = await fetchTimeout('verkeersborden/data/targets8w.json', 5000);
            if (signsResp.ok) {
                signTargets = await signsResp.json();
            }
        } catch (e) {}

        // Filter geldige 8th Wall poster targets
        const validPosters = posters.filter(p => p.target8w && p.target8w.imagePath);
        const imageTargetData = [
            ...validPosters.map(p => p.target8w),
            ...signTargets
        ];

        if (imageTargetData.length === 0) {
            throw new Error('Geen AR targets beschikbaar. Upload eerst posters in het admin dashboard.');
        }

        bootStatus('Targets configureren…');
        XrController.configure({ imageTargetData });
        console.log(`[AR] 8th Wall geconfigureerd met ${imageTargetData.length} targets`);

        bootStatus('Camera starten…');
        buildScene(validPosters, signTargets);

        if (overlay()) overlay().style.display = 'none';
        bootStatus('');
    } catch (e) {
        console.error('[AR Boot Fout]', e);
        if (btn) {
            btn.textContent = 'OPNIEUW PROBEREN';
            btn.disabled = false;
        }
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

window.toggleFooter = function() {
    const swipeBar = document.getElementById('ar-footer-swipe-bar');
    if (!swipeBar) return;
    const isExpanded = swipeBar.classList.contains('expanded');
    if (isExpanded) {
        swipeBar.classList.remove('expanded');
    } else {
        swipeBar.classList.add('expanded');
        loadGalleryOverlay();
    }
};

function setupSwipeBarControls() {
    const swipeBar = document.getElementById('ar-footer-swipe-bar');
    const footerHeader = document.querySelector('.footer-header');
    if (!footerHeader || !swipeBar) return;

    let touchStartY = 0;
    footerHeader.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    footerHeader.addEventListener('touchend', (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const deltaY = touchStartY - touchEndY;
        if (deltaY > 30) {
            // Drag omhoog: open galerij
            swipeBar.classList.add('expanded');
            loadGalleryOverlay();
        } else if (deltaY < -30) {
            // Drag omlaag: sluit galerij
            swipeBar.classList.remove('expanded');
        } else {
            // Tik: toggle
            window.toggleFooter();
        }
    }, { passive: true });
}

function loadGalleryOverlay() {
    const grid = document.getElementById('gallery-overlay-grid');
    if (!grid || !window.allPosters) return;

    grid.innerHTML = window.allPosters.map(poster => {
        const imageUrl = poster.thumbnail ? `${BASE_URL}${poster.thumbnail}` : 'img/placeholder.png';
        const hasAR = Boolean(poster.target8w || poster.ar_marker);
        const arBadge = hasAR ? '<span class="ar-badge" style="background:#4ade80; color:#000; font-size:9px; padding:2px 4px; border-radius:2px; margin-left:4px;">AR</span>' : '';

        return `
            <div class="overlay-poster-card" data-poster-id="${poster.id}" style="cursor: pointer; background: rgba(255,255,255,0.05); padding: 8px; border: 1px solid rgba(255,255,255,0.1);">
                <img src="${imageUrl}" alt="${poster.title}" style="width: 100%; aspect-ratio: 1/1.4; object-fit: cover; display: block;" onerror="this.src='img/placeholder.png'">
                <div class="card-info" style="margin-top: 6px;">
                    <h3 style="font-size: 11px; margin: 0; color: #fff; font-family: monospace;">${poster.title} ${arBadge}</h3>
                </div>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.overlay-poster-card').forEach(card => {
        card.addEventListener('click', () => {
            const posterId = card.getAttribute('data-poster-id');
            const poster = window.allPosters.find(p => p.id === posterId);
            if (poster) openModal(poster);
        });
    });
}

// ==================== MODAL & DOWNLOAD BEHEER ====================

function openModal(poster) {
    currentPoster = poster;
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
    console.log('Interventie Platform — 8th Wall XR Initialisatie...');

    // Device detectie
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth <= 850 && ('ontouchstart' in window));

    // Start-button listener
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', bootAR);
    }

    if (isMobile) {
        console.log('[Mode] Mobiel toestel gedetecteerd — AR modus gereed');
        document.getElementById('desktop-view').style.display = 'none';
        document.getElementById('mobile-ar-view').style.display = 'block';
        if (overlay()) overlay().style.display = 'flex';

        setupSwipeBarControls();
        setupModal();
        hideLoader();
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
