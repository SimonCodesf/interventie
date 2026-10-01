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
const anchorState = {};       // name -> {visible, lastPos: {x,y,z}}

const sceneBox = function () { return document.getElementById('ar-scene'); };
const overlay = function () { return document.getElementById('start-overlay'); };
const toggleBtn = function () { return document.getElementById('toggle-prev'); };

const scriptPromises = {};
let scriptChain = Promise.resolve();

// Strikt sequentieel laden: xrextras heeft AFRAME nodig, de app heeft alles nodig.
function loadScript(src) {
    if (scriptPromises[src]) return scriptPromises[src];

    const p = scriptChain.then(function () {
        return new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = src;
            s.async = false; // extra zekerheid: volgorde behouden
            s.onload = function () { resolve(); };
            s.onerror = function () {
                reject(new Error('Script niet geladen: ' + src));
            };
            document.head.appendChild(s);
        });
    });

    scriptPromises[src] = p.catch(function () {}); // geregistreerd blijven
    scriptChain = scriptPromises[src];
    return p;
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

function fatalError(msg) {
    const btn = document.getElementById('start-btn');
    btn.textContent = msg;
    btn.disabled = true;
    overlay().style.display = 'flex';
}

function retryOverlay() {
    bootStarted = false;
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

// ---- Laag-bouwer (zelfde model als MindAR-versie: planes/gif/gltf/anim) ----

function buildLayers(target, layers) {
    (layers || []).forEach(function (layer) {
        const lx = layer.x || 0, ly = layer.y || 0, lz = layer.z;
        const rx = layer.rx || 0, ry = layer.ry || 0, rz = layer.rz || 0;
        const sc = layer.scale > 0 ? layer.scale : 1;
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
            obj.setAttribute('width', layer.w);
            obj.setAttribute('height', layer.h);
            obj.setAttribute('transparent', 'true');
            obj.setAttribute('opacity', layer.opacity !== undefined ? layer.opacity : 1);
            obj.setAttribute('scale', sc + ' ' + sc + ' ' + sc);
            if (isGif) obj.setAttribute('gif', 'src: ' + layer.file + '; transparent: false');
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
        buildLayers(content, entry.layers);
        anchor.appendChild(content);

        anchorState[entry.name] = { visible: false, lastPos: null };

        anchor.addEventListener('xrextrasfound', function () {
            foundCount++;
            if (!firstFoundAt) firstFoundAt = performance.now();
            anchorState[entry.name].visible = true;
            console.log('[AR] target ' + entry.name + ' GEVONDEN');
            document.getElementById('feed-loader').style.display = 'none';
            applyPrevVisibility();
        });
        anchor.addEventListener('xrextraslost', function () {
            lostCount++;
            anchorState[entry.name].visible = false;
            console.log('[AR] target ' + entry.name + ' verloren');
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

    let XR8;
    try {
        await Promise.all([
            loadScript('js/vendor/aframe.min.js'),
            loadScript('js/vendor/xr.js?v=1'),
            loadScript('js/vendor/xrextras.js?v=1'),
            loadScript('js/vendor/gif-component.js?v=1'),
        ]);
        XR8 = await xrReady();

        const [curRes, prevRes] = await Promise.all([
            fetch('api.php/essays/current'),
            fetch('api.php/essays/previous'),
        ]);
        if (curRes.ok) currentEssay = await curRes.json();
        let prevEssays = [];
        if (prevRes.ok) {
            const prevData = await prevRes.json();
            prevEssays = prevData.essays || [];
        }

        const entries = [];
        if (currentEssay && currentEssay.target8w) {
            entries.push({ name: currentEssay.week, week: currentEssay.week, targetData: currentEssay.target8w, layers: currentEssay.layers || [], isPrev: false });
        }
        prevEssays.forEach(function (e) {
            if (e.target8w) entries.push({ name: e.week, week: e.week, targetData: e.target8w, layers: e.layers || [], isPrev: true });
            else console.warn('[AR] essay zonder 8th Wall target overgeslagen: ' + e.week);
        });
        if (!entries.length) {
            // Fallback voor de spike: statisch test-target (echte krantenpagina)
            // zodat er zonder admin-setup toch gemeten kan worden.
            console.log('[AR] geen essays met targets — statische test-target gebruiken');
            const tRes = await fetch('targets/krant-test.json');
            if (!tRes.ok) throw new Error('Geen 8th Wall targets beschikbaar');
            const tData = await tRes.json();
            entries.push({ name: 'krant-test', week: 'krant-test', targetData: tData, layers: [], isPrev: false });
        }

        XR8.XrController.configure({ imageTargetData: entries.map(function (e) { return e.targetData; }) });
        console.log('[AR] XR8 geconfigureerd met ' + entries.length + ' target(s)');
    } catch (e) {
        console.error(e);
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    overlay().style.display = 'none';
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
    loadScript('js/vendor/xr.js?v=1');
    loadScript('js/vendor/xrextras.js?v=1');
    loadScript('js/vendor/gif-component.js?v=1');
}

document.getElementById('start-btn').addEventListener('click', bootAR);
