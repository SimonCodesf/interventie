// Interventie — Positioneer-tool (smartphone)
// Laad een essay, bekijk de lagen live in AR en schuif ze op hun plek.
// Vereist admin-login (zelfde sessie als /krant/admin/).

const API = '../api.php';

// Vaste cameraresolutie (zelfde als hoofdpagina): voorkomt de iOS-480p
// start en geeft de tracker meer detail -> stabielere pose, zelfde crop.
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !navigator.mediaDevices.__posPatched) {
    navigator.mediaDevices.__posPatched = true;
    const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function (constraints) {
        if (constraints && constraints.video && constraints.video.facingMode) {
            constraints.video.width = { ideal: 1280 };
            constraints.video.height = { ideal: 720 };
        }
        return realGUM(constraints);
    };
}

let week = null;
let essay = null;          // volledige essay-JSON (met URL's)
let layers = [];           // werk-kopie (file = volledige URL voor de scene)
let entities = [];         // a-entity referenties per laag
let selected = -1;
let sceneStarted = false;
let hiddenLayers = {};     // index -> true: verborgen in preview (wordt NIET opgeslagen)
let animPreviewOn = false; // test-animatie actief op de live laag

const scriptPromises = {};
let scriptChain = Promise.resolve();

// Strikt sequentieel (zie hoofdpagina): mindar-image-aframe mag nooit
// vóór A-Frame uitvoeren, anders registreert het component niet -> zwart beeld.
function loadScript(src) {
    if (scriptPromises[src]) return scriptPromises[src];
    const p = scriptChain.then(function () {
        return new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error(src)); };
            document.head.appendChild(s);
        });
    });
    scriptPromises[src] = p.catch(function () {});
    scriptChain = scriptPromises[src];
    return p;
}

// Asset-URL's uit de API zijn relatief t.o.v. /krant/ — vanaf /krant/position/
// moeten ze één niveau omhoog.
function absUrl(u) {
    u = String(u || '');
    if (/^(https?:)?\/\//.test(u) || u.charAt(0) === '/') return u;
    return '../' + u;
}

function status(msg, cls) {
    const el = document.getElementById('pos-status');
    el.textContent = msg;
    el.className = cls || '';
}

function layerKind(layer) {
    const f = (layer.file || '').toLowerCase();
    if (/\.glb(\?|$)/.test(f)) return '3d';
    if (/\.gif(\?|$)/.test(f)) return 'gif';
    return 'img';
}

function baseName(url) {
    return String(url).split('/').pop().split('?')[0];
}

// ---- Auth + essay kiezen ----

async function init() {
    try {
        const res = await fetch(API + '/admin/status');
        const data = await res.json();
        if (!data.logged_in) {
            document.getElementById('pos-auth').style.display = 'block';
            return;
        }
    } catch (e) {
        document.getElementById('pos-auth').style.display = 'block';
        return;
    }

    document.getElementById('pos-app').style.display = 'block';

    const listRes = await fetch(API + '/admin/essays');
    const listData = await listRes.json();
    const sel = document.getElementById('pos-week');
    (listData.essays || []).forEach(function (e) {
        const opt = document.createElement('option');
        opt.value = e.week;
        opt.textContent = e.week + ' — ' + e.title + (e.published ? '' : ' (draft)');
        sel.appendChild(opt);
    });
    sel.addEventListener('change', function () { loadWeek(sel.value); });

    if (sel.options.length) loadWeek(sel.value);
    else status('Nog geen essays. Maak er eerst een in de admin.', 'err');
}

async function loadWeek(w) {
    week = w;
    selected = -1;
    entities = [];
    layers = [];
    hiddenLayers = {};
    animPreviewOn = false;
    document.getElementById('pos-layers').innerHTML = '';
    document.getElementById('pos-controls').innerHTML = '';

    const res = await fetch(API + '/admin/essays/' + encodeURIComponent(w));
    if (!res.ok) {
        status('Essay niet gevonden', 'err');
        return;
    }
    const data = await res.json();
    essay = data.essay;
    // Werk-kopie (animatie-velden blijven behouden bij opslaan).
    // Veilige defaults zoals de API: zonder w/h/z wordt een plane onzichtbaar.
    layers = (essay.layers || []).map(function (l) {
        return {
            file: l.file, x: l.x || 0, y: l.y || 0,
            z: (l.z !== undefined && l.z !== null) ? l.z : 0.01,
            w: (l.w > 0) ? l.w : 1, h: (l.h > 0) ? l.h : 1.414,
            opacity: l.opacity !== undefined ? l.opacity : 1,
            rx: l.rx || 0, ry: l.ry || 0, rz: l.rz || 0, scale: l.scale || 1,
            anim_dur: l.anim_dur || 0, anim_x: l.anim_x || 0,
            anim_y: l.anim_y || 0, anim_z: l.anim_z !== undefined ? l.anim_z : l.z,
        };
    });
    console.log('[pos] week ' + w + ': mind=' + essay.mind + ', lagen=' + layers.length);
    layers.forEach(function (l, i) {
        console.log('[pos] laag ' + i + ': ' + l.file + ' x=' + l.x + ' y=' + l.y + ' z=' + l.z + ' w=' + l.w + ' h=' + l.h + ' op=' + l.opacity);
    });

    renderLayerButtons();
    if (sceneStarted) buildScene();
    else if (!layers.length) status('Geen lagen voor deze week — voeg eerst lagen toe in de admin.');
    else status('Tik START CAMERA en richt op de pagina.');
}

// ---- Scene (zonder animatie, zodat positioneren stabiel is) ----

function buildScene() {
    const box = document.getElementById('ar-scene');
    const old = box.querySelector('a-scene');
    if (old) {
        try {
            // Let op: mindar-image-system is een SYSTEM (geen component):
            // via systems, anders wordt de oude camera/loop nooit gestopt.
            if (old.systems && old.systems['mindar-image-system']) {
                old.systems['mindar-image-system'].stop();
            }
        } catch (e) {}
        old.remove();
    }
    entities = [];
    if (!essay || !essay.mind) {
        status('Geen AR marker voor dit essay', 'err');
        return;
    }

    const scene = document.createElement('a-scene');
    scene.setAttribute('mindar-image',
        'imageTargetSrc: ' + absUrl(essay.mind) +
        // Zelfde afstelling als de hoofdpagina (app.js AR_TUNING):
        // warmup 2 + miss 6: laag verschijnt snel, blijft door dips.
        '; filterMinCF: 0.001; filterBeta: 20' +
        '; warmupTolerance: 2; missTolerance: 6' +
        '; uiLoading: no; uiScanning: no; uiError: no');
    scene.setAttribute('color-space', 'sRGB');
    scene.setAttribute('renderer', 'colorManagement: true');
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

    const target = document.createElement('a-entity');
    target.setAttribute('mindar-image-target', 'targetIndex: 0');
    target.addEventListener('targetFound', function () {
        console.log('[pos] marker GEVONDEN');
        status('Marker gevonden ✓ — ' + layers.length + ' laag/lagen zichtbaar.', 'ok');
    });
    target.addEventListener('targetLost', function () {
        console.log('[pos] marker verloren');
        status('Marker kwijt — richt op de pagina.');
    });

    layers.forEach(function (layer, i) {
        const kind = layerKind(layer);
        let obj;
        if (kind === '3d') {
            obj = document.createElement('a-entity');
            obj.setAttribute('gltf-model', absUrl(layer.file));
            // Diagnose: 3D laadt asynchroon — log succes/fout per laag.
            (function (idx, url) {
                obj.addEventListener('model-loaded', function () {
                    console.log('[pos] 3D geladen, laag ' + idx + ': ' + url);
                });
                obj.addEventListener('model-error', function (e) {
                    console.error('[pos] 3D FOUT, laag ' + idx + ': ' + url, e && e.detail);
                    status('3D-model laag ' + (idx + 1) + ' laadt niet', 'err');
                });
            })(i, absUrl(layer.file));
        } else {
            obj = document.createElement('a-plane');
            if (kind !== 'gif') obj.setAttribute('src', absUrl(layer.file));
            obj.setAttribute('width', layer.w);
            obj.setAttribute('height', layer.h);
            obj.setAttribute('transparent', 'true');
            if (kind === 'gif') obj.setAttribute('gif', 'src: ' + absUrl(layer.file) + '; transparent: false');
        }
        applyTransform(obj, layer, kind);
        target.appendChild(obj);
        entities[i] = obj;
        if (hiddenLayers[i]) obj.setAttribute('visible', false);
    });
    animPreviewOn = false; // nieuwe objecten: test-animatie altijd uit
    scene.appendChild(target);

    scene.addEventListener('arError', function (e) {
        console.error('[pos] arError', e);
        status('Camera niet beschikbaar', 'err');
    });

    scene.addEventListener('arReady', function () {
        status('Camera live — richt op de pagina.');
        // iOS kan het MindAR-video-element gepauzeerd laten staan -> expliciet afspelen.
        const v = box.querySelector('video');
        if (v && v.paused) {
            v.play().catch(function (err) { console.error('[pos] video.play() mislukt:', err); });
        }
    });

    box.appendChild(scene);

    // Diagnose: ontbrekende bestanden (404) leveren onzichtbare lagen.
    // Blokkeert de scene niet; meldt alleen.
    checkAssets();
}

// Bestaan .mind + laagbestanden echt? (relatief t.o.v. /krant/position/)
async function checkAssets() {
    if (!essay) return;
    try {
        const mindRes = await fetch(absUrl(essay.mind), { method: 'HEAD' });
        console.log('[pos] mind ' + mindRes.status + ' ' + absUrl(essay.mind));
        if (!mindRes.ok) status('Markerbestand niet gevonden (' + mindRes.status + ')', 'err');
    } catch (e) { console.error('[pos] mind-check mislukt:', e); }
    for (let i = 0; i < layers.length; i++) {
        try {
            const r = await fetch(absUrl(layers[i].file), { method: 'HEAD' });
            console.log('[pos] laag ' + i + ' ' + r.status + ' ' + absUrl(layers[i].file));
            if (!r.ok) status('Laag ' + (i + 1) + ' niet gevonden (' + r.status + '): ' + baseName(layers[i].file), 'err');
        } catch (e) { console.error('[pos] laag-check ' + i + ' mislukt:', e); }
    }
}

function applyTransform(obj, layer, kind) {
    const sc = layer.scale > 0 ? layer.scale : 1;
    obj.setAttribute('position', layer.x + ' ' + layer.y + ' ' + layer.z);
    obj.setAttribute('rotation', layer.rx + ' ' + layer.ry + ' ' + layer.rz);
    obj.setAttribute('scale', sc + ' ' + sc + ' ' + sc);
    if (kind !== '3d') {
        obj.setAttribute('opacity', layer.opacity);
        obj.setAttribute('width', layer.w);
        obj.setAttribute('height', layer.h);
    }
}

// ---- Laag kiezen + sliders ----

function renderLayerButtons() {
    const wrap = document.getElementById('pos-layers');
    wrap.innerHTML = '';
    layers.forEach(function (layer, i) {
        const b = document.createElement('button');
        b.textContent = (i + 1) + ' · ' + layerKind(layer).toUpperCase() + ' · ' + baseName(layer.file);
        if (i === selected) b.className = 'active';
        b.addEventListener('click', function () { selectLayer(i); });
        wrap.appendChild(b);
    });
    if (layers.length && selected < 0) selectLayer(0);
}

function selectLayer(i) {
    selected = i;
    renderLayerButtons();
    renderControls();
}

function slider(parent, label, min, max, step, get, set) {
    const row = document.createElement('div');
    row.className = 'ctl';
    const lab = document.createElement('label');
    lab.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = min; inp.max = max; inp.step = step;
    inp.value = get();
    const out = document.createElement('output');
    out.textContent = get();
    inp.addEventListener('input', function () {
        set(parseFloat(inp.value));
        out.textContent = inp.value;
    });
    row.appendChild(lab);
    row.appendChild(inp);
    row.appendChild(out);
    parent.appendChild(row);
}

function groupTitle(parent, text) {
    const t = document.createElement('div');
    t.className = 'ctl-group';
    t.textContent = text;
    parent.appendChild(t);
}

function renderControls() {
    const wrap = document.getElementById('pos-controls');
    wrap.innerHTML = '';
    if (selected < 0 || !layers[selected]) {
        wrap.textContent = 'Kies een laag hierboven.';
        return;
    }
    const layer = layers[selected];
    const kind = layerKind(layer);

    // Belangrijk: entities[selected] pas OP HET MOMENT van schuiven opzoeken.
    // renderControls() draait al vóór START CAMERA (entities dan nog leeg) en
    // buildScene() vervangt de array — een vastgelegde referentie wordt dan
    // oud en de schuiven lijken niets te doen.
    function live() {
        const o = entities[selected];
        if (o) applyTransform(o, layer, kind);
    }

    groupTitle(wrap, 'Positie');
    slider(wrap, 'X', -2, 2, 0.005, function () { return layer.x; }, function (v) { layer.x = v; live(); });
    slider(wrap, 'Y', -2, 2, 0.005, function () { return layer.y; }, function (v) { layer.y = v; live(); });
    slider(wrap, 'Z', -0.5, 1, 0.005, function () { return layer.z; }, function (v) { layer.z = v; live(); });

    if (kind !== '3d') {
        groupTitle(wrap, 'Formaat');
        slider(wrap, 'Breedte', 0.1, 3, 0.01, function () { return layer.w; }, function (v) { layer.w = v; live(); });
        slider(wrap, 'Hoogte', 0.1, 3, 0.01, function () { return layer.h; }, function (v) { layer.h = v; live(); });
        slider(wrap, 'Dekking', 0, 1, 0.05, function () { return layer.opacity; }, function (v) { layer.opacity = v; live(); });
    }

    groupTitle(wrap, 'Rotatie + schaal');
    slider(wrap, 'Rot X', -180, 180, 1, function () { return layer.rx; }, function (v) { layer.rx = v; live(); });
    slider(wrap, 'Rot Y', -180, 180, 1, function () { return layer.ry; }, function (v) { layer.ry = v; live(); });
    slider(wrap, 'Rot Z', -180, 180, 1, function () { return layer.rz; }, function (v) { layer.rz = v; live(); });
    slider(wrap, 'Schaal', 0.01, 5, 0.01, function () { return layer.scale; }, function (v) { layer.scale = v; live(); });

    groupTitle(wrap, 'Animatie (wordt opgeslagen)');
    slider(wrap, 'Duur (s)', 0, 10, 0.1, function () { return layer.anim_dur; }, function (v) { layer.anim_dur = v; });
    slider(wrap, 'Eind X', -2, 2, 0.005, function () { return layer.anim_x; }, function (v) { layer.anim_x = v; });
    slider(wrap, 'Eind Y', -2, 2, 0.005, function () { return layer.anim_y; }, function (v) { layer.anim_y = v; });
    slider(wrap, 'Eind Z', -0.5, 1, 0.005, function () { return layer.anim_z; }, function (v) { layer.anim_z = v; });
    animPreviewOn = false;
    const animBtn = document.createElement('button');
    animBtn.className = 'wide-btn';
    function paintAnimBtn() {
        animBtn.textContent = animPreviewOn ? 'STOP TEST-ANIMATIE' : 'TEST ANIMATIE';
        if (animPreviewOn) animBtn.classList.add('active');
        else animBtn.classList.remove('active');
    }
    paintAnimBtn();
    animBtn.addEventListener('click', function () {
        const o = entities[selected];
        if (!animPreviewOn && o && layer.anim_dur > 0) {
            animPreviewOn = true;
            o.setAttribute('animation',
                'property: position;' +
                'from: ' + layer.x + ' ' + layer.y + ' ' + layer.z + ';' +
                'to: ' + layer.anim_x + ' ' + layer.anim_y + ' ' + layer.anim_z + ';' +
                'dur: ' + Math.round(layer.anim_dur * 1000) + ';' +
                'dir: alternate; loop: true; easing: easeInOutSine');
        } else {
            animPreviewOn = false;
            if (!o) status('Start eerst de camera', 'err');
            else if (!(layer.anim_dur > 0)) status('Zet eerst een duur > 0', 'err');
            if (o) { o.removeAttribute('animation'); applyTransform(o, layer, kind); }
        }
        paintAnimBtn();
    });
    wrap.appendChild(animBtn);

    groupTitle(wrap, 'Weergave (alleen preview)');
    const visBtn = document.createElement('button');
    visBtn.className = 'wide-btn';
    function paintVisBtn() {
        const hidden = !!hiddenLayers[selected];
        visBtn.textContent = hidden ? 'TOON LAAG IN PREVIEW' : 'VERBERG LAAG IN PREVIEW';
        if (hidden) visBtn.classList.add('active');
        else visBtn.classList.remove('active');
    }
    paintVisBtn();
    visBtn.addEventListener('click', function () {
        const o = entities[selected];
        if (hiddenLayers[selected]) {
            delete hiddenLayers[selected];
            if (o) o.setAttribute('visible', true);
        } else {
            hiddenLayers[selected] = true;
            if (o) o.setAttribute('visible', false);
        }
        paintVisBtn();
    });
    wrap.appendChild(visBtn);
}

// ---- Opslaan ----

document.getElementById('pos-save').addEventListener('click', async function () {
    if (!week) return;
    status('Opslaan…');
    const payload = layers.map(function (l) {
        return {
            file: baseName(l.file),
            x: l.x, y: l.y, z: l.z, w: l.w, h: l.h, opacity: l.opacity,
            rx: l.rx, ry: l.ry, rz: l.rz, scale: l.scale,
            anim_dur: l.anim_dur, anim_x: l.anim_x, anim_y: l.anim_y, anim_z: l.anim_z,
        };
    });
    try {
        const res = await fetch(API + '/admin/essays/' + encodeURIComponent(week) + '/layers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layers: payload }),
        });
        const data = await res.json();
        if (res.ok) status('Opgeslagen ✓', 'ok');
        else status(data.message || 'Opslaan mislukt', 'err');
    } catch (e) {
        status('Geen verbinding', 'err');
    }
});

// ---- Start ----

document.getElementById('pos-start-btn').addEventListener('click', async function () {
    document.getElementById('pos-start').style.display = 'none';
    try {
        await loadScript('../js/vendor/aframe.min.js');
        await loadScript('../js/vendor/mindar-image-aframe.prod.js?v=23');
        await loadScript('../js/vendor/gif-component.js');
    } catch (e) {
        status('AR-bibliotheken konden niet laden', 'err');
        document.getElementById('pos-start').style.display = 'flex';
        return;
    }
    sceneStarted = true;
    if (essay) buildScene();
});

init();
