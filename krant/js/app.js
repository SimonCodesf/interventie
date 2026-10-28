// Interventie — AR krant (A-Frame + 8th Wall)
// Alle targets staan tegelijk geregistreerd; elk essay toont zijn lagen
// zodra de eigen pagina in beeld is (geen knop of chunk-wissel nodig).
//
// This product includes the XR Engine software developed by Niantic Spatial, Inc.
// Copyright © 2026 Niantic Spatial, Inc. All rights reserved.
// License: https://github.com/8thwall/engine/blob/main/LICENSE

let currentEssay = null;      // {week, title, target8w, layers}
let previousEssays = [];      // [{week, title, target8w, layers}] — altijd zichtbaar bij hun marker
let bootStarted = false;
let bootTime = 0;

// Metingen (vergelijkbaar met de MindAR-spike)
let foundCount = 0, lostCount = 0, firstFoundAt = 0;
let jitterSum = 0, jitterCount = 0, frameCount = 0;
// Grace na 'lost': houd de laatste pose nog even zichtbaar i.p.v. direct
// verbergen — voorkomt knipperen bij korte haperingen.
const LOST_GRACE_MS = 1200;
const anchorState = {};       // name -> {visible, lastPos: {x,y,z}, hideTimer}

const sceneBox = function () { return document.getElementById('ar-scene'); };
const overlay = function () { return document.getElementById('start-overlay'); };

const scriptPromises = {};
let scriptChain = Promise.resolve();
// Max per script: op een trage mobiele verbinding kan ~6MB aan engine
// lang onderweg zijn — maar oneindig wachten (eeuwig LADEN) mag nooit.
const SCRIPT_TIMEOUT_MS = 45000;

// Strikt sequentieel laden: xrextras heeft AFRAME nodig, de app heeft alles nodig.
// Fouten worden DOORGEGEVEN aan de aanroeper (geen stil wegslikken); de keten
// zelf gaat wel altijd verder zodat latere loads niet blokkeren.
function loadScript(src, attrs) {
    const key = src + JSON.stringify(attrs || {});
    if (scriptPromises[key]) return scriptPromises[key].raw;

    let resolveRaw, rejectRaw;
    const raw = new Promise(function (resolve, reject) { resolveRaw = resolve; rejectRaw = reject; });
    scriptPromises[key] = { raw: raw };

    const p = scriptChain.then(function () {
        return new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = src;
            s.async = false; // extra zekerheid: volgorde behouden
            if (attrs) {
                Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
            }
            const to = setTimeout(function () {
                reject(new Error('Timeout bij het laden van ' + src.split('/').pop()));
            }, SCRIPT_TIMEOUT_MS);
            s.onload = function () { clearTimeout(to); resolve(); };
            s.onerror = function () {
                clearTimeout(to);
                reject(new Error('Script niet geladen: ' + src.split('/').pop()));
            };
            document.head.appendChild(s);
        });
    });

    p.then(resolveRaw, rejectRaw);
    scriptChain = p.catch(function () {}); // keten altijd voortzetten
    return raw;
}

function fetchTimeout(url, ms) {
    const ctrl = new AbortController();
    const to = setTimeout(function () { ctrl.abort(); }, ms || 15000);
    return fetch(url, { signal: ctrl.signal }).then(
        function (res) { clearTimeout(to); return res; },
        function (err) { clearTimeout(to); throw err; }
    );
}

function bootStatus(msg) {
    const el = document.getElementById('boot-status');
    if (el) el.textContent = msg || '';
}

// Zonder bijwerking checken of de camera geblokkeerd is (eerder geweigerd).
// Dan heeft starten geen zin — eerst toestemming herstellen in Chrome.
async function cameraBlocked() {
    try {
        if (navigator.permissions && navigator.permissions.query) {
            const st = await navigator.permissions.query({ name: 'camera' });
            return st.state === 'denied';
        }
    } catch (e) { /* Permissions API niet beschikbaar */ }
    return false;
}

// De toestemmingsvraag actief stellen. Geeft {ok, reason} terug — reason is
// de DOMException-naam (NotAllowedError = geblokkeerd, NotReadableError =
// camera bezet/defect, …). Stream wordt meteen weer vrijgegeven, XR8 neemt
// de camera daarna over. Bij een harde blokkade weigert Chrome direct (false).
async function ensureCameraPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { ok: false, reason: 'unsupported' };
    }
    const attempts = [
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        { video: true, audio: false }, // zonder wensen, voor aparte toestellen
    ];
    let lastErr = null;
    for (let i = 0; i < attempts.length; i++) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(attempts[i]);
            stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
            return { ok: true };
        } catch (e) {
            lastErr = e;
            if (!e || e.name !== 'OverconstrainedError') break;
        }
    }
    return { ok: false, reason: (lastErr && lastErr.name) || 'error' };
}

// Na een blokkade eerst opnieuw toestemming proberen bij de volgende tap.
let permissionRetry = false;

function webglSupported() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext &&
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

function fatalError(msg) {
    const btn = document.getElementById('start-btn');
    btn.textContent = msg;
    btn.disabled = true;
    overlay().style.display = 'flex';
}

function retryOverlay() {
    bootStarted = false;
    bootStatus('');
    const btn = document.getElementById('start-btn');
    btn.textContent = 'OPNIEUW PROBEREN';
    btn.disabled = false;
    overlay().style.display = 'flex';
}

function xrReady() {
    return new Promise(function (resolve, reject) {
        if (window.XR8) return resolve(window.XR8);
        const to = setTimeout(function () {
            reject(new Error('XR8 niet geladen (timeout)'));
        }, 20000);
        window.addEventListener('xrloaded', function onXr() {
            window.removeEventListener('xrloaded', onXr);
            clearTimeout(to);
            resolve(window.XR8);
        });
    });
}

// Wacht tot de XrController-module (xr-tracking.js chunk) geladen is.
// Zonder deze chunk is XR8.XrController null en faalt configure().
function xrControllerReady(XR8, timeoutMs) {
    return new Promise(function (resolve, reject) {
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

// ---- Laag-bouwer (zelfde model als MindAR-versie: planes/gif/gltf/anim) ----

// Passend formaat binnen een 1×1-box uit de target-verhouding. In de
// anchor-ruimte is een staande pagina aspect-breed × 1 hoog (zie engine:
// scaledWidth = w/h, scaledHeight = 1); een w=1-plane is dus breder dan
// de marker. Zonder expliciete w/h vullen we dit in.
function fitSize(targetData) {
    let w = 1, h = 1;
    const p = targetData && targetData.properties;
    const ow = parseFloat(p && (p.originalWidth || p.width));
    const oh = parseFloat(p && (p.originalHeight || p.height));
    if (ow > 0 && oh > 0) {
        const a = ow / oh;
        if (a <= 1) { w = a; h = 1; } else { w = 1; h = 1 / a; }
    }
    return { w: Math.round(w * 1000) / 1000, h: Math.round(h * 1000) / 1000 };
}

// Licht per laag: lit=1 = standaard (met schaduw), anders vlak/unlit
// (als print). GLB-modellen hebben eigen materialen en blijven altijd lit.
function applyLit(obj, layer, isModel) {
    if (isModel) return;
    obj.setAttribute('material', 'shader', layer.lit ? 'standard' : 'flat');
}

function buildLayers(target, entry) {
    const fit = fitSize(entry && entry.targetData);
    ((entry && entry.layers) || []).forEach(function (layer) {
        const lx = layer.x || 0, ly = layer.y || 0, lz = layer.z;
        const rx = layer.rx || 0, ry = layer.ry || 0, rz = layer.rz || 0;
        const sc = layer.scale > 0 ? layer.scale : 1;
        const lw = layer.w > 0 ? layer.w : fit.w;
        const lh = layer.h > 0 ? layer.h : fit.h;
        const isModel = /\.glb(\?|$)/i.test(layer.file);
        const isGif = /\.gif(\?|$)/i.test(layer.file);

        let obj;
        if (isModel) {
            obj = document.createElement('a-entity');
            obj.setAttribute('gltf-model', layer.file);
            obj.setAttribute('scale', sc + ' ' + sc + ' ' + sc);
        } else {
            obj = document.createElement('a-plane');
            if (!isGif) obj.setAttribute('src', layer.file);
            obj.setAttribute('width', lw);
            obj.setAttribute('height', lh);
            obj.setAttribute('transparent', 'true');
            obj.setAttribute('opacity', layer.opacity !== undefined ? layer.opacity : 1);
            obj.setAttribute('scale', sc + ' ' + sc + ' ' + sc);
            if (isGif) obj.setAttribute('gif', 'src: ' + layer.file + '; transparent: false');
            applyLit(obj, layer, false);
        }

        obj.setAttribute('position', lx + ' ' + ly + ' ' + lz);
        obj.setAttribute('rotation', rx + ' ' + ry + ' ' + rz);

        const animDur = layer.anim_dur > 0 ? layer.anim_dur * 1000 : 0;
        if (animDur > 0) {
            obj.setAttribute('animation',
                'property: position;' +
                'from: ' + lx + ' ' + ly + ' ' + lz + ';' +
                'to: ' + (layer.anim_x || 0) + ' ' + (layer.anim_y || 0) + ' ' + (layer.anim_z !== undefined ? layer.anim_z : lz) + ';' +
                'dur: ' + animDur + ';' +
                'dir: alternate; loop: true; easing: easeInOutSine');
        }
        target.appendChild(obj);
    });
}

// ---- Subtiel richtkader: enkel 4 haarfijne hoekjes bij de eerste start ----
let hasLockedOnce = false;

function showScanGuide() {
    if (hasLockedOnce) return;
    const guide = document.getElementById('scan-guide');
    if (!guide) return;
    guide.classList.add('active');
}

function dismissScanGuide() {
    hasLockedOnce = true;
    const guide = document.getElementById('scan-guide');
    if (!guide) return;
    guide.style.opacity = '0';
    setTimeout(function () {
        guide.classList.remove('active');
        guide.style.display = 'none';
    }, 450);
}

// ---- Pose Smoothing Component (reductie van tracking jitter) ----
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

            // 8th Wall xrextras update stelt obj.position en obj.quaternion in
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

// ---- Scene bouwen (8th Wall anchors) ----

function buildScene(entries) {
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

    // Engine-fouten (bv. camera start niet, toestel/browser niet ondersteund)
    // zijn anders onzichtbaar. Alleen escaleren als er nog nooit beeld was —
    // midden in een sessie zou de overlay storend oppoppen.
    scene.addEventListener('realityerror', function (e) {
        const d = (e && e.detail) || {};
        console.error('[AR] realityerror', d);
        if (firstFoundAt) return;
        const reason = (d.error && d.error.message) ||
            (d.isDeviceBrowserSupported === false ? 'deze browser of dit toestel wordt niet ondersteund' : 'de camera kon niet gestart worden');
        if (typeof window.trackKrantCameraDenied === 'function') {
            window.trackKrantCameraDenied(reason);
        }
        if (typeof window.trackKrantArError === 'function') {
            window.trackKrantArError({
                category: 'realityerror',
                message: reason,
                details: (d.error && (d.error.stack || d.error.name)) || '',
                stage: 'reality'
            });
        }
        overlay().style.display = 'flex';
        const btn = document.getElementById('start-btn');
        btn.textContent = 'OPNIEUW PROBEREN';
        btn.disabled = false;
        bootStatus('Fout: ' + reason + '. Bij een geblokkeerde camera: slotje in de adresbalk → Camera toestaan.');
        bootStarted = false;
    });

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

    entries.forEach(function (entry) {
        const anchor = document.createElement('a-entity');
        anchor.setAttribute('xrextras-named-image-target', 'name: ' + entry.name);
        anchor.setAttribute('smooth-anchor', '');

        const content = document.createElement('a-entity');
        content.setAttribute('class', 'essay-content');
        content.setAttribute('data-week', entry.week);
        buildLayers(content, entry);
        anchor.appendChild(content);

        anchorState[entry.name] = { visible: false, lastPos: null, hideTimer: 0, scanRecorded: false, foundAt: 0 };

        function flushAnchorDwell() {
            const st = anchorState[entry.name];
            if (!st || !st.foundAt) return;
            const sec = Math.round((Date.now() - st.foundAt) / 1000);
            st.foundAt = 0;
            if (sec >= 1 && entry.week && typeof window.trackKrantEssayDwell === 'function') {
                window.trackKrantEssayDwell(entry.week, sec);
            }
        }

        anchor.addEventListener('xrextrasfound', function () {
            const st = anchorState[entry.name];
            if (st.hideTimer) { clearTimeout(st.hideTimer); st.hideTimer = 0; }
            foundCount++;
            if (!firstFoundAt) {
                firstFoundAt = performance.now();
                if (typeof window.trackKrantArPerf === 'function') {
                    window.trackKrantArPerf({
                        t_engine: window.__arEngineLoadMs || 0,
                        t_cam: window.__arCameraReadyMs || 0,
                        t_lock: Math.round(firstFoundAt - bootTime),
                        found: 1,
                        lost: 0
                    });
                }
            }
            if (!st.visible) st.foundAt = Date.now();
            st.visible = true;
            console.log('[AR] target ' + entry.name + ' GEVONDEN');
            dismissScanGuide();
            if (!st.scanRecorded && entry.week) {
                st.scanRecorded = true;
                try {
                    fetch('api.php/essays/' + encodeURIComponent(entry.week) + '/scan', { method: 'POST' }).catch(function () {});
                } catch (e) {}
                if (typeof window.trackKrantEssayScan === 'function') {
                    window.trackKrantEssayScan(entry.week);
                }
            }
        });
        anchor.addEventListener('xrextraslost', function () {
            const st = anchorState[entry.name];
            lostCount++;
            st.visible = false;
            console.log('[AR] target ' + entry.name + ' verloren (grace ' + LOST_GRACE_MS + 'ms)');
            // De engine verbergt de anchor direct; wij houden de laatste pose
            // nog even zichtbaar zodat het beeld niet bij elke hapering
            // wegvalt (ook als de marker nog grotendeels in beeld is).
            const anchorObj = anchor.object3D;
            if (anchorObj) anchorObj.visible = true;
            if (st.hideTimer) clearTimeout(st.hideTimer);
            st.hideTimer = setTimeout(function () {
                st.hideTimer = 0;
                if (anchorObj && !anchorState[entry.name].visible) {
                    anchorObj.visible = false;
                    flushAnchorDwell();
                }
            }, LOST_GRACE_MS);
        });
        window.addEventListener('pagehide', flushAnchorDwell);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') flushAnchorDwell();
        });

        scene.appendChild(anchor);
    });

    sceneBox().appendChild(scene);
    console.log('[AR] scene gebouwd, targets: ' + entries.length);

    // Watchdog: zonder draaiende pipeline na 15s -> retry aanbieden
    setTimeout(function () {
        const canvas = sceneBox().querySelector('canvas');
        const alive = canvas && canvas.width > 0;
        if (!alive && !firstFoundAt) {
            console.warn('[AR] watchdog: geen actieve pipeline');
            if (typeof window.trackKrantArError === 'function') {
                window.trackKrantArError({
                    category: 'watchdog',
                    message: 'Watchdog: geen actieve XR-pipeline / canvas na 15s',
                    stage: 'pipeline'
                });
            }
            retryOverlay();
        }
    }, 15000);

    startJitterLoop();
}

// Jitter-meting: translatie-delta per 100ms van zichtbare anchors
function startJitterLoop() {
    setInterval(function () {
        const anchors = sceneBox().querySelectorAll('a-entity[xrextras-named-image-target]');
        anchors.forEach(function (a) {
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
            console.log('[AR] jit ' + jit.toFixed(3) + ' found ' + foundCount + ' lost ' + lostCount +
                ' lock ' + (firstFoundAt ? Math.round(firstFoundAt - bootTime) + 'ms' : '-'));
            window.__AR_STATS = {
                jit: jit, found: foundCount, lost: lostCount,
                lock: firstFoundAt ? Math.round(firstFoundAt - bootTime) : null,
            };
            if (frameCount % 120 === 0 && typeof window.trackKrantArPerf === 'function') {
                window.trackKrantArPerf({
                    jit: jit,
                    found: foundCount,
                    lost: lostCount,
                    fps: Math.round(1000 / (jit > 0 ? jit * 100 : 16))
                });
            }
        }
    }, 100);
}

// ---- Start na de tap ----

async function bootAR() {
    if (bootStarted) return;
    bootStarted = true;
    bootTime = performance.now();

    if (!webglSupported()) {
        if (typeof window.trackKrantArError === 'function') {
            window.trackKrantArError({
                category: 'webgl',
                message: 'WebGL niet ondersteund door browser of toestel',
                stage: 'boot'
            });
        }
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    const btn = document.getElementById('start-btn');
    btn.textContent = 'LADEN…';
    btn.disabled = true;

    if (await cameraBlocked()) {
        if (typeof window.trackKrantCameraDenied === 'function') {
            window.trackKrantCameraDenied('Camera geblokkeerd via browser permissies');
        }
        // Site staat op blokkeren: Chrome toont uit zichzelf geen vraag meer.
        // De knop stelt de vraag alsnog — bij een zachte blokkade komt de
        // prompt terug en start alles direct. Bij een harde blokkade volgt
        // de handleiding voor het slotje in de adresbalk.
        btn.textContent = 'CAMERA TOESTAAN';
        bootStatus('Geen cameratoegang. Check eerst Android zelf: Instellingen → Apps → Chrome → Machtigingen → Camera → Toestaan. Daarna hier op CAMERA TOESTAAN tikken.');
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
            if (typeof window.trackKrantCameraDenied === 'function') {
                window.trackKrantCameraDenied(perm.reason || 'Camera permissie geweigerd');
            }
            if (perm.reason === 'NotReadableError' || perm.reason === 'NotFoundError') {
                bootStatus('Camera is bezet of niet gevonden (' + perm.reason + '). Sluit andere camera-apps en probeer opnieuw.');
            } else if (perm.reason === 'unsupported') {
                bootStatus('Deze browser ondersteunt geen camera-toegang. Update Chrome en probeer opnieuw.');
            } else {
                bootStatus('Geblokkeerd (' + perm.reason + '). Tik op het tune-icoon links van het adres → Machtigingen → Camera → Toestaan. Of: Chrome-menu → Instellingen → Site-instellingen → Camera → Geblokkeerd → interventie.org → Toestaan. Daarna herladen.');
            }
            bootStarted = false;
            btn.disabled = false;
            permissionRetry = true;
            return;
        }
        bootStatus('');
    }

    let XR8, XrController;
    const entries = [];
    const engineStart = performance.now();
    try {
        bootStatus('Bibliotheken laden…');
        let loadedCount = 0;
        const counted = function (p) {
            return p.then(function () {
                loadedCount++;
                bootStatus('Bibliotheken laden… ' + loadedCount + '/4');
            });
        };
        await Promise.all([
            counted(loadScript('js/vendor/aframe.min.js')),
            counted(loadScript('js/vendor/xr.js?v=1', { 'data-preload-chunks': 'slam', 'crossorigin': 'anonymous' })),
            counted(loadScript('js/vendor/xrextras.js?v=1')),
            counted(loadScript('js/vendor/gif-component.js?v=2')),
        ]);
        registerAframeComponents();
        bootStatus('Engine starten…');
        XR8 = await xrReady();
        XrController = await xrControllerReady(XR8, 20000);
        console.log('[AR] XR8 + XrController klaar');

        bootStatus('Essays ophalen…');
        const [curRes, prevRes] = await Promise.all([
            fetchTimeout('api.php/essays/current'),
            fetchTimeout('api.php/essays/previous'),
        ]);
        if (curRes.ok) currentEssay = await curRes.json();
        let prevEssays = [];
        if (prevRes.ok) {
            const prevData = await prevRes.json();
            prevEssays = prevData.essays || [];
        }

        if (currentEssay && currentEssay.target8w) {
            entries.push({ name: currentEssay.week, week: currentEssay.week, targetData: currentEssay.target8w, layers: currentEssay.layers || [], isPrev: false });
        }
        prevEssays.forEach(function (e) {
            if (e.target8w) entries.push({ name: e.week, week: e.week, targetData: e.target8w, layers: e.layers || [], isPrev: true });
            else console.warn('[AR] essay zonder 8th Wall target overgeslagen: ' + e.week);
        });
        if (!entries.length) {
            throw new Error('Nog geen essays met AR-targets — publiceer eerst een essay in de admin.');
        }

        XrController.configure({ imageTargetData: entries.map(function (e) { return e.targetData; }) });
        window.__arEngineLoadMs = Math.round(performance.now() - engineStart);
        window.__arCameraReadyMs = Math.round(performance.now() - bootTime);
        console.log('[AR] XR8 geconfigureerd met ' + entries.length + ' target(s) in ' + window.__arEngineLoadMs + 'ms');
        bootStatus('Camera starten…');
    } catch (e) {
        console.error(e);
        if (typeof window.trackKrantArError === 'function') {
            window.trackKrantArError({
                category: 'engine',
                message: (e && e.message) || String(e),
                details: (e && e.stack) || '',
                stage: 'engine_init'
            });
        }
        btn.textContent = 'OPNIEUW PROBEREN';
        bootStatus('Starten mislukt: ' + (e && e.message ? e.message : e) + '. Controleer je verbinding en probeer opnieuw.');
        bootStarted = false;
        btn.disabled = false;
        return;
    }

    overlay().style.display = 'none';
    bootStatus('');
    showScanGuide();
    if (typeof window.trackKrantCameraStart === 'function') {
        window.trackKrantCameraStart();
    }
    buildScene(entries);
}

// ---- Diagnostiek: frame-box ----

if (window.ResizeObserver) {
    new ResizeObserver(function (entries) {
        for (const e of entries) {
            console.log('[AR] frame-box: ' + Math.round(e.contentRect.width) + 'x' + Math.round(e.contentRect.height));
        }
    }).observe(document.getElementById('ar-scene'));
}

// ---- Desktop detectie & fallback QR code (voorkomt realityerror op PC) ----

function isDesktopDevice() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('desktop') === '1') return true;
    if (params.get('mobile') === '1') return false;

    const ua = navigator.userAgent || '';
    const isMobileUa = /mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua);
    const isIPad = /ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isMobileUa || isIPad) {
        return false;
    }
    return true;
}

let desktopEssaysList = [];
let activeDesktopEssay = null;

async function initDesktopGuard() {
    if (!isDesktopDevice()) return;
    const overlayEl = overlay();
    if (!overlayEl) return;

    document.body.classList.add('is-desktop');
    overlayEl.classList.add('desktop-overlay');

    // Mobiele doel-URL voor de QR-code
    let targetUrl = window.location.href;
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname) || window.location.protocol === 'file:') {
        targetUrl = 'https://interventie.org/krant/';
    }
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=' + encodeURIComponent(targetUrl);

    // Standaard fallback pagina (Offline AI)
    const fallbackImage = 'img/page-fallback.jpg';
    let initialImage = fallbackImage;
    let initialTitle = 'Offline AI';
    let initialWeek = '2026-40';

    overlayEl.innerHTML = `
        <div class="desktop-screen">
            <header class="desktop-header">
                <div class="desktop-brand">
                    <span class="desktop-badge">De Standaard &times; Interventie</span>
                    <h1 class="desktop-title">De Krant in Augmented Reality</h1>
                </div>
                <div class="desktop-header-meta">
                    <span class="desktop-edition-pill" id="desktop-edition-tag">Editie: ${initialTitle} (${initialWeek})</span>
                </div>
            </header>

            <div class="desktop-body">
                <aside class="desktop-sidebar">
                    <div class="desktop-card">
                        <div class="desktop-step">
                            <span class="step-num">1</span>
                            <div class="step-content">
                                <h3>Scan de QR-code</h3>
                                <p>Open de camera op je smartphone (iOS of Android) en richt op de QR-code om de AR-kijker te openen.</p>
                            </div>
                        </div>

                        <div class="desktop-qr-wrap">
                            <div class="desktop-qr-card">
                                <img src="${qrUrl}" alt="Scan QR-code met smartphone" class="desktop-qr-img" width="175" height="175">
                            </div>
                            <span class="desktop-qr-note">Geen app-download vereist &bull; WebAR in browser</span>
                        </div>

                        <div class="desktop-step">
                            <span class="step-num">2</span>
                            <div class="step-content">
                                <h3>Richt op de krantenpagina</h3>
                                <p>Druk op je smartphone op <strong>Start camera</strong> en richt je lens op de krantenpagina hiernaast op je beeldscherm.</p>
                            </div>
                        </div>

                        <div class="desktop-notice">
                            <span class="notice-icon">&#9658;</span>
                            <p><strong>Geen printer vereist:</strong> De AR-lagen verschijnen direct zodra je smartphone op dit beeldscherm gericht wordt.</p>
                        </div>

                        <div id="desktop-edition-wrap" class="desktop-edition-wrap" style="display: none;">
                            <label for="desktop-edition-select">Kies krantenpagina:</label>
                            <select id="desktop-edition-select" class="desktop-select"></select>
                        </div>

                        <div class="desktop-actions">
                            <button type="button" class="desktop-action-btn primary" id="desktop-expand-btn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                                <span>Volledig scherm</span>
                            </button>
                            <a href="${initialImage}" download id="desktop-download-btn" class="desktop-action-btn secondary" target="_blank" rel="noopener">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                <span>Download print (A3)</span>
                            </a>
                        </div>

                        <button id="force-desktop-btn" class="desktop-force-link" type="button">
                            Toch met computer-webcam proberen &rarr;
                        </button>
                    </div>
                </aside>

                <main class="desktop-viewer">
                    <div class="desktop-target-badge">
                        <span class="target-dot"></span>
                        <span>Richt je smartphonecamera op deze pagina</span>
                    </div>

                    <div class="desktop-newspaper-frame" id="desktop-newspaper-click-target" title="Klik om schermvullend te bekijken">
                        <div class="desktop-newspaper-paper">
                            <img src="${initialImage}" alt="Krantenpagina doelwit" id="desktop-newspaper-img" class="desktop-newspaper-img" loading="eager" decoding="async">
                            <div class="desktop-zoom-overlay">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                                <span>Klik om te vergroten</span>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <div id="desktop-lightbox" class="desktop-lightbox" style="display: none;" aria-hidden="true">
                <div class="desktop-lightbox-backdrop" id="desktop-lightbox-backdrop"></div>
                <div class="desktop-lightbox-content">
                    <div class="desktop-lightbox-header">
                        <div class="lightbox-hint">
                            <span class="target-dot"></span>
                            <span>Scanbaar doelwit &mdash; Richt je smartphonecamera op het scherm</span>
                        </div>
                        <button type="button" class="desktop-lightbox-close" id="desktop-lightbox-close" aria-label="Sluiten">&times; Sluiten (Esc)</button>
                    </div>
                    <div class="desktop-lightbox-img-wrap">
                        <img src="${initialImage}" alt="Krantenpagina volledig scherm" id="desktop-lightbox-img" class="desktop-lightbox-img">
                    </div>
                </div>
            </div>
        </div>
    `;

    // Lightbox modal interactie
    function openLightbox() {
        const lb = document.getElementById('desktop-lightbox');
        if (lb) lb.style.display = 'flex';
    }

    function closeLightbox() {
        const lb = document.getElementById('desktop-lightbox');
        if (lb) lb.style.display = 'none';
    }

    document.getElementById('desktop-expand-btn')?.addEventListener('click', openLightbox);
    document.getElementById('desktop-newspaper-click-target')?.addEventListener('click', openLightbox);
    document.getElementById('desktop-lightbox-close')?.addEventListener('click', closeLightbox);
    document.getElementById('desktop-lightbox-backdrop')?.addEventListener('click', closeLightbox);
    window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLightbox();
    });

    // Webcam force fallback
    document.getElementById('force-desktop-btn')?.addEventListener('click', function () {
        closeLightbox();
        document.body.classList.remove('is-desktop');
        overlayEl.classList.remove('desktop-overlay');
        overlayEl.innerHTML = `
            <button id="start-btn">START CAMERA</button>
            <div id="boot-status" aria-live="polite"></div>
        `;
        document.getElementById('start-btn')?.addEventListener('click', bootAR);
        preloadAll();
        bootAR();
    });

    // Actieve essay pagina instellen in viewer en lightbox
    function renderSelectedEssay(essay) {
        if (!essay) return;
        activeDesktopEssay = essay;

        const imgUrl = essay.page_image || (essay.target8w && essay.target8w.imagePath) || fallbackImage;
        const title = essay.title || 'Editie ' + (essay.week || '');
        const week = essay.week || '';

        const imgEl = document.getElementById('desktop-newspaper-img');
        const lbImgEl = document.getElementById('desktop-lightbox-img');
        const tagEl = document.getElementById('desktop-edition-tag');
        const downloadBtn = document.getElementById('desktop-download-btn');

        if (imgEl) {
            imgEl.src = imgUrl;
            imgEl.alt = 'Krantenpagina ' + title;
        }
        if (lbImgEl) {
            lbImgEl.src = imgUrl;
            lbImgEl.alt = 'Krantenpagina ' + title;
        }
        if (tagEl) {
            tagEl.textContent = 'Editie: ' + title + (week ? ' (' + week + ')' : '');
        }
        if (downloadBtn) {
            downloadBtn.href = imgUrl;
        }
    }

    // Essays ophalen via API (current + previous)
    try {
        const [curRes, prevRes] = await Promise.all([
            fetchTimeout('api.php/essays/current', 6000),
            fetchTimeout('api.php/essays/previous', 6000),
        ]);

        desktopEssaysList = [];
        if (curRes && curRes.ok) {
            const curData = await curRes.json();
            if (curData && (curData.page_image || (curData.target8w && curData.target8w.imagePath))) {
                desktopEssaysList.push(curData);
            }
        }
        if (prevRes && prevRes.ok) {
            const prevData = await prevRes.json();
            if (prevData && Array.isArray(prevData.essays)) {
                prevData.essays.forEach(function (e) {
                    if (e && (e.page_image || (e.target8w && e.target8w.imagePath))) {
                        if (!desktopEssaysList.some(function (d) { return d.week === e.week; })) {
                            desktopEssaysList.push(e);
                        }
                    }
                });
            }
        }

        if (desktopEssaysList.length > 0) {
            renderSelectedEssay(desktopEssaysList[0]);

            if (desktopEssaysList.length > 1) {
                const wrap = document.getElementById('desktop-edition-wrap');
                const sel = document.getElementById('desktop-edition-select');
                if (wrap && sel) {
                    sel.innerHTML = '';
                    desktopEssaysList.forEach(function (ess, idx) {
                        const opt = document.createElement('option');
                        opt.value = String(idx);
                        opt.textContent = (ess.title || 'Editie ' + ess.week) + (ess.week ? ' (' + ess.week + ')' : '');
                        sel.appendChild(opt);
                    });
                    sel.addEventListener('change', function () {
                        const chosen = desktopEssaysList[parseInt(sel.value, 10)];
                        renderSelectedEssay(chosen);
                    });
                    wrap.style.display = 'flex';
                }
            }
        }
    } catch (err) {
        console.log('[Desktop] API ophalen mislukt, actieve fallback behouden:', err);
    }
}

// ---- Boot: essentials eerst, preload erna (op mobiel direct, op desktop bij actie) ----

if (document.readyState === 'complete') {
    if (!isDesktopDevice()) preloadAll();
} else {
    window.addEventListener('load', function () {
        if (!isDesktopDevice()) preloadAll();
    });
}

function preloadAll() {
    loadScript('js/vendor/aframe.min.js').then(registerAframeComponents);
    loadScript('js/vendor/xr.js?v=1', { 'data-preload-chunks': 'slam', 'crossorigin': 'anonymous' });
    loadScript('js/vendor/xrextras.js?v=1');
    loadScript('js/vendor/gif-component.js?v=2');
}

document.getElementById('start-btn')?.addEventListener('click', bootAR);
initDesktopGuard();
