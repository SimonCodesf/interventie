// Interventie — AR krant
// Chunk 0: huidige essay (1 target, instant)
// Chunk 1: vorige essays (samengevoegde .mind, geladen via de knop)

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
const scanningOverlay = function () { return document.getElementById('scanning-overlay'); };

function showStatus(msg) {
    const el = document.getElementById('ar-status');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
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

function loadScript(src) {
    return new Promise(function (resolve, reject) {
        if (document.querySelector('script[src="' + src + '"]')) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function () { reject(new Error('Script niet geladen: ' + src)); };
        document.head.appendChild(s);
    });
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
        '; missTolerance: ' + AR_TUNING.missTolerance);
    scene.setAttribute('color-space', 'sRGB');
    scene.setAttribute('renderer', 'colorManagement: true');
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

        target.addEventListener('targetFound', function () {
            scanningOverlay().style.display = 'none';
        });
        target.addEventListener('targetLost', function () {
            scanningOverlay().style.display = 'flex';
        });

        scene.appendChild(target);
    });

    scene.addEventListener('arError', function (event) {
        showStatus('Camera niet beschikbaar: ' + (event.detail && event.detail.error || 'onbekende fout'));
    });

    sceneContainer().appendChild(scene);
    scanningOverlay().style.display = 'flex';
}

// ---- Start ----

async function startAR() {
    if (arStarted) return;
    arStarted = true;
    document.getElementById('start-overlay').style.display = 'none';
    showStatus('Laden…');

    if (!webglSupported()) {
        showStatus('AR wordt niet ondersteund door deze browser.');
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
        showStatus('Kon de app niet laden. Controleer je verbinding.');
        return;
    }

    if (!currentEssay || !currentEssay.mind) {
        showStatus('Nog geen essay gepubliceerd.');
        return;
    }

    buildScene(currentEssay.mind, [{ index: 0, layers: currentEssay.layers }]);
    showStatus('');
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

        const btn = document.getElementById('toggle-prev');
        btn.style.display = 'block';
    } catch (err) {
        /* knop blijft verborgen */
    }
}

// ---- Knop: wisselen tussen huidige en vorige essays ----

document.getElementById('toggle-prev').addEventListener('click', async function () {
    const btn = this;

    if (mode === 'previous') {
        buildScene(currentEssay.mind, [{ index: 0, layers: currentEssay.layers }]);
        mode = 'current';
        btn.textContent = 'SCAN VORIGE ESSAYS';
        return;
    }

    if (!previousBundle || !previousBuffer) {
        showStatus('Vorige essays nog aan het laden…');
        return;
    }

    const blob = new Blob([previousBuffer], { type: 'application/octet-stream' });
    activeBlobUrl = URL.createObjectURL(blob);

    const targets = previousBundle.essays.map(function (e) {
        return { index: e.targetIndex, layers: e.layers };
    });

    buildScene(activeBlobUrl, targets);
    mode = 'previous';
    btn.textContent = 'SCAN HUIDIG ESSAY';
    showStatus('');
});

document.getElementById('start-btn').addEventListener('click', startAR);
