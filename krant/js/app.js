// Interventie — AR krant (A-Frame + MindAR)
//
// Preload-strategie: bij het openen van de pagina worden meteen gedownload:
//   1. de vendor-bibliotheken (A-Frame + MindAR)
//   2. het .mind bestand van de huidige week
//   3. alle AR-lagen van de huidige week
// Alles staat dan in het geheugen (blob-URLs), zodat wanneer je de camera
// richt de scan al warmgedraaid is — de eerste detectie voelt als de tweede.
// De vorige-bundel wordt daarna stilletjes op de achtergrond opgehaald.

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
let gestureStarted = false;   // camera gestart via tap (iOS fallback)
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

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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

function showOverlay() {
    document.getElementById('start-btn').textContent = 'START CAMERA';
    document.getElementById('start-btn').disabled = false;
    overlay().style.display = 'flex';
}

async function fetchBlobUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' voor ' + url);
    return URL.createObjectURL(await res.blob());
}

// ---- Preload (start meteen bij paginaload) ----

async function preloadAll() {
    loadScript('js/vendor/aframe.min.js');
    loadScript('js/vendor/mindar-image-aframe.prod.js');

    try {
        const res = await fetch('api.php/essays/current');
        if (res.ok) currentEssay = await res.json();
    } catch (e) {
        console.error(e);
    }

    if (currentEssay && currentEssay.mind) {
        try {
            currentMindBlobUrl = await fetchBlobUrl(currentEssay.mind);
        } catch (e) {
            console.error(e);
        }
    }

    if (currentEssay && currentEssay.layers && currentEssay.layers.length) {
        // Lagen prefetchen: de volledige afbeelding wordt gedownload zodat
        // A-Frame ze later instant uit de browser-cache haalt (directe URL).
        await Promise.all(currentEssay.layers.map(async function (layer) {
            try {
                const res = await fetch(layer.file);
                if (res.ok) await res.arrayBuffer();
            } catch (e) {
                console.error(e);
            }
        }));
    }

    preloadPrevious();
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
        if (!gestureStarted && isIOS()) {
            // Automatische poging zonder tap mislukt: laat de startknop zien
            showOverlay();
        } else {
            fatalError('CAMERA GEBLOKKEERD');
        }
    });

    sceneBox().appendChild(scene);
}

// ---- Starten ----

async function bootAR(byGesture) {
    if (byGesture) gestureStarted = true;

    if (!webglSupported()) {
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    try {
        await preloadPromise; // wacht tot chunk + lagen in het geheugen staan
        await loadScript('js/vendor/aframe.min.js');
        await loadScript('js/vendor/mindar-image-aframe.prod.js');
    } catch (e) {
        console.error(e);
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    if (!currentEssay || !currentMindBlobUrl) {
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    overlay().style.display = 'none';
    buildScene(currentMindBlobUrl, [{ index: 0, layers: currentEssay.layers }]);
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

// ---- Boot: preload direct, camera daarna ----

const preloadPromise = preloadAll();

// Android, desktop én iOS: camera probeert automatisch te starten zodra de
// chunk klaar is. Op iOS verschijnt de permissie-prompt; werkt dat niet
// zonder tap, dan blijft de startknop als fallback staan.
bootAR(false);

document.getElementById('start-btn').addEventListener('click', function () {
    bootAR(true);
});
