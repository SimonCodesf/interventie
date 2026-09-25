// Interventie — AR krant
// Chunk 0: huidige essay (1 target, instant)
// Chunk 1: vorige essays (samengevoegde .mind, geladen via de knop)
//
// Optimalisaties:
// - vendor-bibliotheken laden direct bij paginaload (scan start instant)
// - camera start automatisch op Android/desktop (iOS vereist een tap)
// - pixelRatio 1 + antialias uit voor vloeiendheid op gsm
// - camerafout toont "CAMERA GEBLOKKEERD" i.p.v. stil beeld

const AR_TUNING = {
    filterMinCF: 0.0001,
    filterBeta: 0.001,
    warmupTolerance: 0,
    missTolerance: 2,
};

let currentEssay = null;      // { week, mind, layers, ... }
let previousBundle = null;    // { mind, essays: [{week, title, targetIndex, layers}] }
let previousBuffer = null;    // ArrayBuffer van previous.mind
let mode = 'current';         // 'current' | 'previous'
let arStarted = false;
let activeBlobUrl = null;

const sceneContainer = function () { return document.getElementById('ar-scene'); };

function webglSupported() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext &&
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

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

function fatalError(msg) {
    const overlay = document.getElementById('start-overlay');
    const btn = document.getElementById('start-btn');
    btn.textContent = msg;
    btn.disabled = true;
    overlay.style.display = 'flex';
}

// ---- Scene bouwen (wisselt van chunk) ----

function buildScene(mindUrl, targets) {
    // Oude scene verwijderen (camera wordt opnieuw opgestart door MindAR)
    const oldScene = sceneContainer().querySelector('a-scene');
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
        'imageTargetSrc: ' + mindUrl +
        '; filterMinCF: ' + AR_TUNING.filterMinCF +
        '; filterBeta: ' + AR_TUNING.filterBeta +
        '; warmupTolerance: ' + AR_TUNING.warmupTolerance +
        '; missTolerance: ' + AR_TUNING.missTolerance +
        '; uiLoading: no; uiScanning: no; uiError: no');
    scene.setAttribute('color-space', 'sRGB');
    scene.setAttribute('renderer', 'colorManagement: true; pixelRatio: 1; antialias: false; highRefreshRate: true');
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
        console.error('AR fout: camera niet beschikbaar of geblokkeerd');
        fatalError('CAMERA GEBLOKKEERD');
    });

    sceneContainer().appendChild(scene);
}

// ---- Start ----

async function startAR() {
    if (arStarted) return;
    arStarted = true;

    if (!webglSupported()) {
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    try {
        await loadScript('js/vendor/aframe.min.js');
        await loadScript('js/vendor/mindar-image-aframe.prod.js');

        const res = await fetch('api.php/essays/current');
        if (res.ok) {
            currentEssay = await res.json();
        }
    } catch (err) {
        console.error(err);
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    if (!currentEssay || !currentEssay.mind) {
        fatalError('NIET BESCHIKBAAR');
        return;
    }

    document.getElementById('start-overlay').style.display = 'none';
    buildScene(currentEssay.mind, [{ index: 0, layers: currentEssay.layers }]);
    preloadPrevious();
}

// ---- Vorige essays (chunk 1) op de achtergrond ophalen ----

async function preloadPrevious() {
    try {
        const res = await fetch('api.php/essays/previous');
        if (!res.ok) return;
        previousBundle = await res.json();
        if (!previousBundle.mind || !previousBundle.essays || !previousBundle.essays.length) return;

        const mindRes = await fetch(previousBundle.mind);
        previousBuffer = await mindRes.arrayBuffer();
    } catch (err) {
        /* bundel nog niet beschikbaar */
    }
}

// ---- Knop: wisselen tussen huidige en vorige essays ----

document.getElementById('toggle-prev').addEventListener('click', function () {
    if (mode === 'previous') {
        buildScene(currentEssay.mind, [{ index: 0, layers: currentEssay.layers }]);
        mode = 'current';
        this.textContent = 'SCAN VORIGE ESSAYS';
        return;
    }

    if (!previousBundle || !previousBuffer) return;

    const blob = new Blob([previousBuffer], { type: 'application/octet-stream' });
    activeBlobUrl = URL.createObjectURL(blob);

    const targets = previousBundle.essays.map(function (e) {
        return { index: e.targetIndex, layers: e.layers };
    });

    buildScene(activeBlobUrl, targets);
    mode = 'previous';
    this.textContent = 'SCAN HUIDIG ESSAY';
});

// Vendor-bibliotheken direct laden bij paginaload
loadScript('js/vendor/aframe.min.js');
loadScript('js/vendor/mindar-image-aframe.prod.js');

if (!isIOS()) {
    // Android en desktop: camera start automatisch
    document.getElementById('start-overlay').style.display = 'none';
    startAR();
} else {
    // iOS: camera vereist een gebruikerstap
    document.getElementById('start-btn').addEventListener('click', startAR);
}
