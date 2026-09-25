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
    // OneEuro-filter (bewegingsafvlakking): tekstrijke pagina's geven een
    // glitcherige pose; minCutOff 0.002 + beta 40 dempt de jitter in rust
    // maar laat snelle beweging nog volledig door (geen achterlopen).
    filterMinCF: 0.002,
    filterBeta: 40,
    warmupTolerance: 0,
    missTolerance: 5, // korte detectie-dips niet meteen als "verloren" tellen (anti-flicker)
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

// ---- Camera-handover ----
// We vragen de camera bij de tap (popup binnen de gesture). In plaats van
// die stream te stoppen en MindAR een tweede aanvraag te laten doen (dat kan
// op Safari eindigen in een dode stream), dragen we onze stream over via een
// shim op getUserMedia.

const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
let heldStream = null;

navigator.mediaDevices.getUserMedia = function (constraints) {
    if (heldStream) {
        const s = heldStream;
        heldStream = null;
        return Promise.resolve(s);
    }
    return realGetUserMedia(constraints);
};

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
    scene.setAttribute('renderer', 'colorManagement: true; antialias: false');
    scene.setAttribute('vr-mode-ui', 'enabled: false');
    scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
    scene.setAttribute('embedded', '');

    // pixelRatio 1 via de renderer zelf (A-Frame 1.4.2 kent geen pixelRatio-prop)
    scene.addEventListener('loaded', function () {
        if (scene.renderer && scene.renderer.setPixelRatio) {
            scene.renderer.setPixelRatio(1);
        }
    });

    const camera = document.createElement('a-camera');
    camera.setAttribute('position', '0 0 0');
    camera.setAttribute('look-controls', 'enabled: false');
    scene.appendChild(camera);

    targets.forEach(function (t) {
        const target = document.createElement('a-entity');
        target.setAttribute('mindar-image-target', 'targetIndex: ' + t.index);

        target.addEventListener('targetFound', function () {
            console.log('[AR] target ' + t.index + ' GEVONDEN');
        });
        target.addEventListener('targetLost', function () {
            console.log('[AR] target ' + t.index + ' verloren');
        });

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
        console.error('[AR] camera-fout');
        fatalError('CAMERA GEBLOKKEERD');
    });

    scene.addEventListener('arReady', function () {
        console.log('[AR] marker GELADEN (arReady)');
        // MindAR vertrouwt op autoplay; bij een overgedragen stream kan het
        // video-element op iOS gepauzeerd blijven — expliciet afspelen.
        const v = sceneBox().querySelector('video');
        console.log('[AR] video: ' + (v
            ? 'readyState=' + v.readyState + ' paused=' + v.paused + ' ' + v.videoWidth + 'x' + v.videoHeight
            : 'GEEN video-element'));
        if (v && v.paused) {
            v.play().then(function () {
                console.log('[AR] video.play() gelukt');
            }).catch(function (e) {
                console.error('[AR] video.play() mislukt:', e);
            });
        }
    });

    console.log('[AR] scene gebouwd, targets: ' + targets.length);

    sceneBox().appendChild(scene);

    lastScene = { mindSrc: mindSrc, targets: targets };
    armWatchdog();
}

// ---- Watchdog: stille auto-retry als de feed op Safari dood blijft ----

let lastScene = null;
let watchdogTimer = null;
let watchdogRetried = false;

function armWatchdog() {
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(function () {
        const video = sceneBox().querySelector('video');
        const live = video && video.videoWidth > 0 && video.readyState >= 2;
        if (live) return; // feed leeft

        console.warn('[AR] watchdog: feed lijkt dood (' + (video
            ? 'readyState=' + video.readyState + ' paused=' + video.paused + ' w=' + video.videoWidth
            : 'geen video') + ')');

        if (!watchdogRetried && lastScene) {
            watchdogRetried = true;
            buildScene(lastScene.mindSrc, lastScene.targets);
            armWatchdog();
        }
    }, 6000);
}

// ---- Start na de tap ----

async function bootAR() {
    if (bootStarted) return;
    bootStarted = true;
    watchdogRetried = false;

    if (!webglSupported()) {
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    const btn = document.getElementById('start-btn');
    btn.textContent = 'LADEN…';
    btn.disabled = true;

    // Camera-toestemming meteen vragen (binnen de tap-gesture). De stream
    // wordt later aan MindAR overgedragen i.p.v. gestopt en opnieuw gevraagd.
    try {
        heldStream = await realGetUserMedia({
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
        heldStream = null;
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    if (!currentEssay || !currentMindBlobUrl) {
        heldStream.getTracks().forEach(function (t) { t.stop(); });
        heldStream = null;
        fatalError('NIET BESCHIKBAAR');
        return;
    }

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
