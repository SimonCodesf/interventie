// Interventie — AR krant (A-Frame + MindAR)
//
// Boot-flow:
//   1. Pagina laadt enkel de essentials (laadbalk van de browser is snel klaar).
//   2. Meteen daarna (window load) downloaden de bibliotheken, de .mind van
//      deze week én alle AR-lagen op de achtergrond.
//   3. Tap op START CAMERA → camera-permissie-popup (nooit vanzelf);
//      alles staat al in het geheugen, dus de scan start warm en instant.
//   4. De vorige-bundel laadt daarna stilletjes op de achtergrond.

const AR_TUNING = {
    filterMinCF: 0.0015,
    filterBeta: 0.008,
    warmupTolerance: 0,
    missTolerance: 2,
};

let currentEssay = null;
let currentMindBlobUrl = null;
let previousBundle = null;
let previousBuffer = null;    // ArrayBuffer van previous.mind
let mode = 'current';
let bootStarted = false;
let activeBlobUrl = null;

const sceneBox = function () { return document.getElementById('ar-scene'); };
const overlay = function () { return document.getElementById('start-overlay'); };
const toggleBtn = function () { return document.getElementById('toggle-prev'); };

const scriptPromises = {};

function loadScript(src) {
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = function () { resolve(); };
        s.onerror = function () {
            delete scriptPromises[src];
            reject(new Error('Script niet geladen: ' + src));
        };
        document.head.appendChild(s);
    });
    return scriptPromises[src];
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

async function fetchBlobUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' voor ' + url);
    return URL.createObjectURL(await res.blob());
}

// ---- Chunk van deze week + lagen downloaden (na de tap) ----

async function loadCurrentChunk() {
    const res = await fetch('api.php/essays/current');
    if (!res.ok) throw new Error('Huidig essay niet gevonden');
    currentEssay = await res.json();

    if (!currentEssay.mind) throw new Error('Geen AR marker voor huidig essay');
    currentMindBlobUrl = await fetchBlobUrl(currentEssay.mind);

    if (currentEssay.layers && currentEssay.layers.length) {
        await Promise.all(currentEssay.layers.map(async function (layer) {
            try {
                const r = await fetch(layer.file);
                if (r.ok) await r.arrayBuffer();
            } catch (e) {
                console.error(e);
            }
        }));
    }
}

// ---- Chunk van deze week + lagen downloaden (één keer, gedeeld) ----

let currentChunkPromise = null;

function ensureCurrentChunk() {
    if (!currentChunkPromise) {
        currentChunkPromise = loadCurrentChunk();
    }
    return currentChunkPromise;
}

// ---- Preload: direct ná de pagina-essentials (laadbalk compleet) ----

function preloadAll() {
    loadScript('js/vendor/aframe.min.js');
    loadScript('js/vendor/mindar-image-aframe.prod.js');
    ensureCurrentChunk()
        .then(function () { preloadPrevious(); })
        .catch(function () {});
}

async function preloadPrevious() {
    try {
        const res = await fetch('api.php/essays/previous');
        if (!res.ok) return;
        previousBundle = await res.json();
        if (!previousBundle.mind || !previousBundle.essays || !previousBundle.essays.length) return;

        const mindRes = await fetch(previousBundle.mind);
        previousBuffer = await mindRes.arrayBuffer();
    } catch (e) {
        console.error(e);
    }
}

// ---- Scene bouwen (A-Frame + MindAR) ----

function buildScene(mindSrc, targets) {
    const oldScene = sceneBox().querySelector('a-scene');
    if (oldScene) {
        try {
            if (oldScene.components && oldScene.components['mindar-image-system']) {
                oldScene.components['mindar-image-system'].stop();
            }
        } catch (e) { /* scene was al afgebroken */ }
        oldScene.remove();
    }

    if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
        activeBlobUrl = null;
    }

    const scene = document.createElement('a-scene');
    scene.setAttribute('mindar-image',
        'imageTargetSrc: ' + mindSrc +
        '; filterMinCF: ' + AR_TUNING.filterMinCF +
        '; filterBeta: ' + AR_TUNING.filterBeta +
        '; warmupTolerance: ' + AR_TUNING.warmupTolerance +
        '; missTolerance: ' + AR_TUNING.missTolerance +
        '; uiLoading: no; uiScanning: no; uiError: no');
    scene.setAttribute('color-space', 'sRGB');
    scene.setAttribute('renderer', 'colorManagement: true; pixelRatio: 1; antialias: false');
    scene.setAttribute('vr-mode-ui', 'enabled: false');
    scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
    scene.setAttribute('embedded', '');

    const camera = document.createElement('a-camera');
    camera.setAttribute('position', '0 0 0');
    camera.setAttribute('look-controls', 'enabled: false');
    scene.appendChild(camera);

    targets.forEach(function (t) {
        const target = document.createElement('a-entity');
        target.setAttribute('mindar-image-target', 'targetIndex: ' + t.index);

        (t.layers || []).forEach(function (layer) {
            const plane = document.createElement('a-plane');
            plane.setAttribute('src', layer.file);
            plane.setAttribute('position', '0 0 ' + layer.z);
            plane.setAttribute('width', layer.w);
            plane.setAttribute('height', layer.h);
            plane.setAttribute('transparent', 'true');
            plane.setAttribute('opacity', '1');

            if (layer.anim_dur > 0) {
                plane.setAttribute('animation',
                    'property: position;' +
                    'from: 0 0 ' + layer.z + ';' +
                    'to: 0 0 ' + (layer.z + layer.anim_dist) + ';' +
                    'dur: ' + layer.anim_dur + ';' +
                    'dir: alternate; loop: true; easing: easeInOutSine');
            }
            target.appendChild(plane);
        });

        scene.appendChild(target);
    });

    scene.addEventListener('arError', function () {
        fatalError('CAMERA GEBLOKKEERD');
    });

    sceneBox().appendChild(scene);
}

// ---- Start na de tap ----

async function bootAR() {
    if (bootStarted) return;
    bootStarted = true;

    if (!webglSupported()) {
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    const btn = document.getElementById('start-btn');
    btn.textContent = 'LADEN…';
    btn.disabled = true;

    // Camera-toestemming meteen vragen (binnen de tap-gesture) — de popup
    // verschijnt dus direct, terwijl hieronder alles gedownload wordt.
    let heldStream = null;
    try {
        heldStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: 'environment' },
        });
    } catch (err) {
        console.error(err);
        fatalError('CAMERA GEBLOKKEERD');
        return;
    }

    try {
        await Promise.all([
            loadScript('js/vendor/aframe.min.js'),
            loadScript('js/vendor/mindar-image-aframe.prod.js'),
            ensureCurrentChunk(),
        ]);
    } catch (e) {
        console.error(e);
        heldStream.getTracks().forEach(function (t) { t.stop(); });
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    if (!currentEssay || !currentMindBlobUrl) {
        heldStream.getTracks().forEach(function (t) { t.stop(); });
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    // Onze eigen stream stoppen; MindAR vraagt de camera opnieuw aan maar
    // de toestemming is al gegeven, dus zonder tweede popup.
    heldStream.getTracks().forEach(function (t) { t.stop(); });

    overlay().style.display = 'none';
    buildScene(currentMindBlobUrl, [{ index: 0, layers: currentEssay.layers }]);
    preloadPrevious();
}

// ---- Knop: wisselen tussen huidige en vorige essays ----

toggleBtn().addEventListener('click', function () {
    if (mode === 'previous') {
        if (!currentEssay || !currentMindBlobUrl) return;
        mode = 'current';
        this.textContent = 'SCAN VORIGE ESSAYS';
        buildScene(currentMindBlobUrl, [{ index: 0, layers: currentEssay.layers }]);
        return;
    }

    if (!previousBuffer || !previousBundle) return;

    const blob = new Blob([previousBuffer], { type: 'application/octet-stream' });
    activeBlobUrl = URL.createObjectURL(blob);

    mode = 'previous';
    this.textContent = 'SCAN HUIDIG ESSAY';
    buildScene(activeBlobUrl, previousBundle.essays.map(function (e) {
        return { index: e.targetIndex, layers: e.layers };
    }));
});

// ---- Boot: essentials eerst, preload erna, popup pas na de tap ----

if (document.readyState === 'complete') {
    preloadAll();
} else {
    window.addEventListener('load', preloadAll);
}

document.getElementById('start-btn').addEventListener('click', bootAR);
