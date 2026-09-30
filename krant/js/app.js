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
    // Lichte demping: mediaan (kort bij beweging, lang in rust) + OneEuro.
    // warmup 2 + missTolerance 30: laag verschijnt snel, blijft door dips.
    filterMinCF: 0.002,
    filterBeta: 20,
    warmupTolerance: 2,
    missTolerance: 6,
};

// ---- Vaste cameraresolutie ----
// iOS levert standaard maar 480x640 en past de stream-resolutie in de eerste
// seconde nog aan (de zichtbare "herschaling" bij het starten). Een vaste
// 1280x720 vanaf het begin voorkomt die sprong én geeft de tracker meer
// detail → stabielere pose en minder found/lost-geflikker op tekstpagina's.
const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia = function (constraints) {
    if (constraints && constraints.video && constraints.video.facingMode) {
        constraints.video.width = { ideal: 1280 };
        constraints.video.height = { ideal: 720 };
    }
    return realGetUserMedia(constraints);
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
let scriptChain = Promise.resolve();

// Scripts strikt sequentieel laden: dynamisch ingevoegde script-tags draaien
// normaal parallel, waardoor mindar-image-aframe (kleiner bestand) vóór
// A-Frame kan uitvoeren → "Can't find variable: AFRAME" en een dode camera.
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

async function fetchBlobUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' voor ' + url);
    return URL.createObjectURL(await res.blob());
}

// ---- Camera-handover ----
// De camera wordt door MindAR zelf opgevraagd in de tap-gesture (één enkele
// aanvraag, geen stream-handover — het meest robuuste pad, net als het
// originele Interventie-project).

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
    loadScript('js/vendor/mindar-image-aframe.prod.js?v=18');
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

    // Geen pixelRatio-verlaging: A-Frame cap'ed zelf al op 2, en verlagen naar 1
    // maakte tekstlagen op retina-schermen wazig én veroorzaakte een zichtbare
    // herschaling van het beeld vlak na het laden.

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
        retryOverlay();
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
        // Diagnose voor de "herschaling": log elke wijziging van de feed-box
        if (v && window.ResizeObserver) {
            new ResizeObserver(function (entries) {
                for (const e of entries) {
                    console.log('[AR] feed-box veranderd naar ' +
                        Math.round(e.contentRect.width) + 'x' + Math.round(e.contentRect.height));
                }
            }).observe(v);
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

    try {
        await Promise.all([
            loadScript('js/vendor/aframe.min.js'),
            loadScript('js/vendor/mindar-image-aframe.prod.js?v=18'),
            ensureCurrentChunk(),
        ]);
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
    preloadPrevious();
    monitorStream();
}

// ---- Diagnostiek: frame-box + stream-resolutie ----

if (window.ResizeObserver) {
    new ResizeObserver(function (entries) {
        for (const e of entries) {
            console.log('[AR] frame-box: ' + Math.round(e.contentRect.width) + 'x' + Math.round(e.contentRect.height));
        }
    }).observe(document.getElementById('ar-scene'));
}

function monitorStream() {
    let n = 0;
    const timer = setInterval(function () {
        const v = document.querySelector('#ar-scene video');
        console.log('[AR] stream ' + (n * 2) + 's: ' + (v ? v.videoWidth + 'x' + v.videoHeight : 'geen video'));
        if (++n >= 6) clearInterval(timer);
    }, 2000);
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


// ---- Dev-paneel (?dev=1): testmatrix + live-metrics + feedback ----
(function initDevPanel() {
    if (!new URLSearchParams(location.search).has('dev')) return;

    // Matrix v2: extremen staan naast elkaar (duidelijk A/B-verschil bij
    // opeenvolgende taps) + nieuwe assen: crop (detectievenster),
    // sstep (schaalstap matcher), detEvery (detectiefrequentie).
    const POS = [{ name: '0 BASELINE', p: {} }];
    function pair(lab, k, lo, hi) {
        const ol = {};
        ol[k] = lo;
        const oh = {};
        oh[k] = hi;
        POS.push({ name: POS.length + ' ' + lab + '=' + lo, p: ol });
        POS.push({ name: POS.length + ' ' + lab + '=' + hi, p: oh });
    }
    pair('sim', 'sim', 0.35, 0.85);
    pair('fmin', 'fmin', 0.0005, 0.02);
    pair('fbeta', 'fbeta', 5, 200);
    pair('winStatic', 'winStatic', 3, 15);
    pair('movePos', 'movePos', 0.01, 0.12);
    pair('miss', 'miss', 2, 14);
    pair('qfeats', 'qfeats', 60, 300);
    pair('search', 'search', 6, 24);
    pair('crop', 'crop', 0.5, 1.5);
    pair('sstep', 'sstep', 1, 3);
    pair('detEvery', 'detEvery', 1, 4);
    POS.push({ name: POS.length + ' STIL-max', p: { sim: 0.5, fmin: 0.001, winStatic: 11, movePos: 0.08, moveAng: 8 } });
    POS.push({ name: POS.length + ' SNEL-max', p: { sim: 0.65, fmin: 0.008, fbeta: 120, winStatic: 5, winMove: 2, movePos: 0.015, moveAng: 2, search: 18, miss: 4 } });

    function curPos() {
        try { return JSON.parse(localStorage.getItem('AR_TEST_POS') ?? 'null'); } catch (e) { return null; }
    }
    function prevPos() {
        try { return JSON.parse(localStorage.getItem('AR_TEST_PREV') ?? 'null'); } catch (e) { return null; }
    }
    function applyPos(idx) {
        const prev = curPos();
        try {
            localStorage.setItem('AR_TEST_PREV', JSON.stringify(prev));
            localStorage.setItem('AR_TEST_POS', JSON.stringify(idx));
            localStorage.setItem('AR_TUNE', JSON.stringify(POS[idx].p));
        } catch (e) {}
        location.reload();
    }

    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99999;background:rgba(10,10,10,.93);color:#ddd;font:11px/1.5 monospace;padding:8px;max-height:72vh;overflow:auto;width:248px;border:1px solid #555';

    const head = document.createElement('div');
    head.innerHTML = '<b style="color:#fff">DEV TESTPOSITIES</b> <span style="color:#888">' + POS.length + ' stuks</span>';
    el.appendChild(head);

    const stats = document.createElement('div');
    stats.style.cssText = 'color:#0f0;margin:4px 0;white-space:pre';
    stats.textContent = 'metrics\u2026';
    el.appendChild(stats);

    // ---- Compacte navigator: met pijltjes door de posities ----
    const nav = document.createElement('div');
    nav.style.cssText = 'margin-top:4px;border-top:1px solid #555;padding-top:6px';
    const navTitle = document.createElement('div');
    navTitle.style.cssText = 'color:#fc6;font-size:12px';
    nav.appendChild(navTitle);

    function showPos(idx) {
        navTitle.textContent = (idx === null || idx === undefined)
            ? '\u25c0 \u25b6 = positie kiezen'
            : ((idx + 1) + '/' + POS.length + ' \u00b7 ' + POS[idx].name);
    }
    showPos(curPos());

    function stepPos(dir) {
        let cur = curPos();
        if (cur === null || cur === undefined) cur = (dir > 0 ? -1 : 1);
        let nxt = cur + dir;
        if (nxt < 0) nxt = 0;
        if (nxt >= POS.length) nxt = POS.length - 1;
        applyPos(nxt);
    }
    function votePos(vote) {
        sendFeedback('', '', { pos: curPos(), vote: vote, vsPos: prevPos() });
    }

    const navRow = document.createElement('div');
    navRow.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap';
    function nbtn(label, bg, fn) {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'font:12px monospace;padding:6px 10px;background:' + bg + ';color:#eee;border:1px solid #666;cursor:pointer';
        b.addEventListener('click', fn);
        navRow.appendChild(b);
    }
    nbtn('\u25c0', '#333', function () { stepPos(-1); });
    nbtn('\u25b6', '#333', function () { stepPos(1); });
    nbtn('BETER', '#431', function () { votePos('better'); });
    nbtn('SLECHTER', '#431', function () { votePos('worse'); });
    nbtn('NEUTRAAL', '#333', function () { votePos('neutral'); });
    nav.appendChild(navRow);
    el.appendChild(nav);


    // ---- Feedback: ratings + vrije tekst -> console EN server ----
    const fb = document.createElement('div');
    fb.style.cssText = 'margin-top:6px;border-top:1px solid #555;padding-top:6px';
    const fbT = document.createElement('div');
    fbT.textContent = 'FEEDBACK';
    fbT.style.cssText = 'color:#fc6';
    fb.appendChild(fbT);
    const fbStatus = document.createElement('div');
    fbStatus.style.cssText = 'color:#0f0;min-height:14px';
    function sendFeedback(rating, text, extra) {
        const payload = {
            rating: rating || '',
            text: text || '',
            pos: (extra && extra.pos !== undefined) ? extra.pos : curPos(),
            vote: (extra && extra.vote) || '',
            vsPos: (extra && extra.vsPos !== undefined) ? extra.vsPos : null,
            settings: (function () { try { return JSON.parse(localStorage.getItem('AR_TUNE') || '{}'); } catch (e) { return {}; } })(),
            stats: window.__AR_STATS || null,
        };
        console.log('[AR-FEEDBACK] ' + JSON.stringify(payload));
        try {
            const hist = JSON.parse(localStorage.getItem('AR_FEEDBACK') || '[]');
            hist.push(payload);
            localStorage.setItem('AR_FEEDBACK', JSON.stringify(hist));
        } catch (e) {}
        fbStatus.textContent = '\u2713 verzonden (ook in console)';
        fetch('api.php/dev/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(function () {});
    }
    function fbBtn(label) {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'font:11px monospace;padding:3px 6px;margin:2px 3px 0 0;background:#553;color:#eee;border:1px solid #666;cursor:pointer';
        fb.appendChild(b);
        return b;
    }
    ['GOED', 'TRILT', 'TRAAG', 'SPRINGT', 'VALT WEG'].forEach(function (r) {
        fbBtn(r).addEventListener('click', function () { sendFeedback(r, ''); });
    });
    const fbInput = document.createElement('input');
    fbInput.type = 'text';
    fbInput.placeholder = 'opmerking\u2026';
    fbInput.style.cssText = 'width:150px;font:11px monospace;margin-top:4px;display:block';
    fb.appendChild(fbInput);
    fbBtn('STUUR').addEventListener('click', function () { sendFeedback('', fbInput.value); fbInput.value = ''; });
    fbBtn('EXPORT').addEventListener('click', function () {
        try {
            console.log('[AR-FEEDBACK-EXPORT] ' + (localStorage.getItem('AR_FEEDBACK') || '[]'));
        } catch (e) {}
        console.log('[AR-STATS-NU] ' + JSON.stringify(window.__AR_STATS || null));
    });
    fb.appendChild(fbStatus);
    el.appendChild(fb);

    document.body.appendChild(el);

    setInterval(function () {
        const s = window.__AR_STATS;
        if (!s) return;
        stats.textContent =
            'jit  ' + (s.jit === null ? '-' : s.jit.toFixed(1)) + '   good ' + (s.good === null ? '-' : s.good) + '\n' +
            'fps  ' + (s.fps === null ? '-' : s.fps) + '   lock ' + (s.lock === null ? '-' : s.lock) + 'ms\n' +
            'trackFails ' + s.trackFails + '   matches ' + s.matches + '\n' +
            'showing ' + (s.showing ? 'Y' : 'n') + '   tracking ' + (s.tracking ? 'Y' : 'n');
    }, 1000);
})();

// ---- Boot: essentials eerst, preload erna, popup pas na de tap ----

if (document.readyState === 'complete') {
    preloadAll();
} else {
    window.addEventListener('load', preloadAll);
}

document.getElementById('start-btn').addEventListener('click', bootAR);
