// Krant AR - frontend logica
// - Laadt het actuele essay van de API
// - AR (A-Frame + MindAR) wordt pas geladen na de scan-tap (snel + iOS camera gesture)

const SITE = {
    paperName: 'DE KRANT',     // naam van de krant
    edition: 'Wekelijkse essays',
};

const AR_TUNING = {
    filterMinCF: 0.003,
    filterBeta: 0.025,
};

let essay = null;
let arActive = false;

document.getElementById('paper-name').textContent = SITE.paperName;
document.getElementById('paper-edition').textContent = SITE.edition;

// ---- Tekst opmaak (veilig escapen, **vet**, *cursief*, alinea's) ----

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatText(text) {
    return escapeHtml(text)
        .split(/\n\s*\n/)
        .map(function (block) {
            let html = block
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>');
            return '<p>' + html.replace(/\n/g, '<br>') + '</p>';
        })
        .join('');
}

function formatWeek(week) {
    const m = /^(\d{4})-(\d{2})$/.exec(week || '');
    return m ? 'Week ' + parseInt(m[2], 10) + ' · ' + m[1] : week;
}

// ---- Essay laden & renderen ----

async function loadEssay() {
    const titleEl = document.getElementById('essay-title');
    try {
        const res = await fetch('api.php/essays/current');
        if (!res.ok) throw new Error('http ' + res.status);
        essay = await res.json();
    } catch (err) {
        titleEl.textContent = 'Nog geen essay gepubliceerd.';
        document.getElementById('scan-cta').style.display = 'none';
        return;
    }

    document.getElementById('essay-week').textContent = formatWeek(essay.week);
    titleEl.textContent = essay.title;
    document.getElementById('essay-text').innerHTML = formatText(essay.text);

    if (essay.page_image) {
        const img = document.getElementById('essay-page');
        img.src = essay.page_image;
        img.style.display = 'block';
    }

    const scanButton = document.getElementById('scan-button');
    if (!essay.mind) {
        scanButton.disabled = true;
        document.getElementById('scan-hint').textContent =
            'AR voor dit essay is nog niet beschikbaar.';
    }
    scanButton.addEventListener('click', startAR);
}

// ---- AR ----

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

function showStatus(msg) {
    const el = document.getElementById('ar-status');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

async function startAR() {
    if (arActive || !essay || !essay.mind) return;

    if (!webglSupported()) {
        alert('AR wordt niet ondersteund door deze browser. Gebruik een recente versie van Chrome, Safari of Firefox.');
        return;
    }

    arActive = true;
    showStatus('AR laden…');

    try {
        await loadScript('js/vendor/aframe.min.js');
        await loadScript('js/vendor/mindar-image-aframe.prod.js');
    } catch (err) {
        arActive = false;
        showStatus('AR kon niet geladen worden. Controleer je verbinding.');
        setTimeout(function () { showStatus(''); }, 4000);
        return;
    }

    buildScene();
}

function buildScene() {
    const container = document.getElementById('ar-scene');
    container.innerHTML = '';

    const scene = document.createElement('a-scene');
    scene.setAttribute('mindar-image',
        'imageTargetSrc: ' + essay.mind +
        '; filterMinCF: ' + AR_TUNING.filterMinCF +
        '; filterBeta: ' + AR_TUNING.filterBeta);
    scene.setAttribute('color-space', 'sRGB');
    scene.setAttribute('renderer', 'colorManagement: true');
    scene.setAttribute('vr-mode-ui', 'enabled: false');
    scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
    scene.setAttribute('embedded', '');

    const camera = document.createElement('a-camera');
    camera.setAttribute('position', '0 0 0');
    camera.setAttribute('look-controls', 'enabled: false');
    scene.appendChild(camera);

    const target = document.createElement('a-entity');
    target.setAttribute('mindar-image-target', 'targetIndex: 0');

    essay.layers.forEach(function (layer) {
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
        document.getElementById('scanning-overlay').style.display = 'none';
        showStatus('AR actief — beweeg rond de pagina');
        setTimeout(function () { showStatus(''); }, 2500);
    });

    target.addEventListener('targetLost', function () {
        document.getElementById('scanning-overlay').style.display = 'flex';
    });

    scene.addEventListener('arError', function (event) {
        showStatus('Camera niet beschikbaar: ' + (event.detail && event.detail.error || 'onbekende fout'));
    });

    scene.appendChild(target);
    container.appendChild(scene);

    document.getElementById('scanning-overlay').style.display = 'flex';
    document.getElementById('ar-view').style.display = 'block';
    document.body.classList.add('ar-active');
}

function closeAR() {
    if (!arActive) return;
    arActive = false;

    const scene = document.querySelector('#ar-scene a-scene');
    try {
        if (scene && scene.components['mindar-image-system']) {
            scene.components['mindar-image-system'].stop();
        }
    } catch (e) { /* scene was al afgebroken */ }

    document.getElementById('ar-scene').innerHTML = '';
    document.getElementById('ar-view').style.display = 'none';
    document.body.classList.remove('ar-active');
    showStatus('');
}

document.getElementById('ar-close').addEventListener('click', closeAR);

loadEssay();
