// Interventie — AR krant (A-Frame + 8th Wall, spike)
// Zelfde UX als de MindAR-versie: preload, START CAMERA tap, current essay
// direct zichtbaar, vorige essays via de knop. Verschil: ALLE targets staan
// tegelijk geregistreerd (geen chunk-wissel meer nodig); de knop schakelt
// alleen de zichtbaarheid van oudere essays.
//
// This product includes the XR Engine software developed by Niantic Spatial, Inc.
// Copyright © 2026 Niantic Spatial, Inc. All rights reserved.
// License: https://github.com/8thwall/engine/blob/main/LICENSE

let currentEssay = null;      // {week, title, target8w, layers}
let previousEssays = [];      // [{week, title, target8w, layers}]
let prevVisible = false;
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
const toggleBtn = function () { return document.getElementById('toggle-prev'); };

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

// ---- Scene bouwen (8th Wall anchors) ----

function buildScene(entries) {
    const oldScene = sceneBox().querySelector('a-scene');
    if (oldScene) oldScene.remove();

    sceneBox().classList.remove('feed-ready');

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

        const content = document.createElement('a-entity');
        content.setAttribute('class', 'essay-content');
        content.setAttribute('data-week', entry.week);
        buildLayers(content, entry);
        anchor.appendChild(content);

        anchorState[entry.name] = { visible: false, lastPos: null, hideTimer: 0 };

        anchor.addEventListener('xrextrasfound', function () {
            const st = anchorState[entry.name];
            if (st.hideTimer) { clearTimeout(st.hideTimer); st.hideTimer = 0; }
            foundCount++;
            if (!firstFoundAt) firstFoundAt = performance.now();
            st.visible = true;
            console.log('[AR] target ' + entry.name + ' GEVONDEN');
            document.getElementById('feed-loader').style.display = 'none';
            applyPrevVisibility();
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
                if (anchorObj && !anchorState[entry.name].visible) anchorObj.visible = false;
            }, LOST_GRACE_MS);
        });

        scene.appendChild(anchor);
    });

    sceneBox().appendChild(scene);
    console.log('[AR] scene gebouwd, targets: ' + entries.length);
    applyPrevVisibility();

    // Watchdog: zonder draaiende pipeline na 15s -> retry aanbieden
    setTimeout(function () {
        const canvas = sceneBox().querySelector('canvas');
        const alive = canvas && canvas.width > 0;
        if (!alive && !firstFoundAt) {
            console.warn('[AR] watchdog: geen actieve pipeline');
            retryOverlay();
        }
    }, 15000);

    startJitterLoop();
}

function applyPrevVisibility() {
    document.querySelectorAll('#ar-scene .essay-content').forEach(function (el) {
        const isCurrent = el.getAttribute('data-week') === (currentEssay && currentEssay.week);
        el.setAttribute('visible', isCurrent || prevVisible);
    });
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
        }
    }, 100);
}

// ---- Start na de tap ----

async function bootAR() {
    if (bootStarted) return;
    bootStarted = true;
    bootTime = performance.now();

    if (!webglSupported()) {
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    const btn = document.getElementById('start-btn');
    btn.textContent = 'LADEN…';
    btn.disabled = true;

    if (await cameraBlocked()) {
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
            counted(loadScript('js/vendor/gif-component.js?v=1')),
        ]);
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
            // Fallback voor de spike: statische test-targets (echte krantenpagina)
            // zodat er zonder admin-setup toch gemeten kan worden.
            // krant-test = via image-target-cli; krant-direct = direct naar de
            // pagina-afbeelding (test of de CLI-stap overgeslagen kan worden).
            console.log('[AR] geen essays met targets — statische test-targets gebruiken');
            const tRes = await fetch('targets/krant-test.json');
            if (!tRes.ok) throw new Error('Geen 8th Wall targets beschikbaar');
            const tData = await tRes.json();
            entries.push({ name: 'krant-test', week: 'krant-test', targetData: tData, layers: [], isPrev: false });
            try {
                const dRes = await fetch('targets/krant-direct.json');
                if (dRes.ok) {
                    const dData = await dRes.json();
                    entries.push({ name: 'krant-direct', week: 'krant-direct', targetData: dData, layers: [], isPrev: false });
                    console.log('[AR] direct-image test-target toegevoegd');
                }
            } catch (e) { console.warn('[AR] direct-image target overgeslagen:', e.message); }
        }

        XrController.configure({ imageTargetData: entries.map(function (e) { return e.targetData; }) });
        console.log('[AR] XR8 geconfigureerd met ' + entries.length + ' target(s)');
        bootStatus('Camera starten…');
    } catch (e) {
        console.error(e);
        btn.textContent = 'OPNIEUW PROBEREN';
        bootStatus('Starten mislukt: ' + (e && e.message ? e.message : e) + '. Controleer je verbinding en probeer opnieuw.');
        bootStarted = false;
        btn.disabled = false;
        return;
    }

    overlay().style.display = 'none';
    bootStatus('');
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

// ---- Knop: vorige essays tonen/verbergen ----

toggleBtn().addEventListener('click', function () {
    prevVisible = !prevVisible;
    this.textContent = prevVisible ? 'SCAN HUIDIG ESSAY' : 'SCAN VORIGE ESSAYS';
    applyPrevVisibility();
    console.log('[AR] vorige essays ' + (prevVisible ? 'zichtbaar' : 'verborgen'));
});

// ---- Boot: essentials eerst, preload erna, popup pas na de tap ----

if (document.readyState === 'complete') {
    preloadAll();
} else {
    window.addEventListener('load', preloadAll);
}

function preloadAll() {
    loadScript('js/vendor/aframe.min.js');
    loadScript('js/vendor/xr.js?v=1', { 'data-preload-chunks': 'slam', 'crossorigin': 'anonymous' });
    loadScript('js/vendor/xrextras.js?v=1');
    loadScript('js/vendor/gif-component.js?v=1');
}

document.getElementById('start-btn').addEventListener('click', bootAR);
