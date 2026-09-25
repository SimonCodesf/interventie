// Krant AR — Admin logica

import { Compiler, msgpack } from './vendor/mindar-compiler.bundle.js?v=2';

const API = '../api.php';

let editingWeek = null;
let compiledMind = null; // { blob, size } — .mind gegenereerd in de browser
let compiledMindMatchesPage = false; // marker hoort bij de geselecteerde pagina

// ---- ISO week voorstel ----

function isoWeek() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + '-' + String(week).padStart(2, '0');
}

// ---- Views ----

function showSetup() {
    document.getElementById('setup-view').style.display = 'flex';
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('panel-view').style.display = 'none';
}

function showLogin() {
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('login-view').style.display = 'flex';
    document.getElementById('panel-view').style.display = 'none';
}

function showPanel() {
    document.getElementById('setup-view').style.display = 'none';
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('panel-view').style.display = 'block';
    loadEssays();
}

// ---- First-run setup ----

document.getElementById('setup-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('setup-error');
    const p1 = document.getElementById('setup-password').value;
    const p2 = document.getElementById('setup-password2').value;
    errorEl.textContent = '';

    if (p1 !== p2) {
        errorEl.textContent = 'Wachtwoorden komen niet overeen';
        return;
    }

    try {
        const res = await fetch(API + '/admin/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: p1 }),
        });
        const data = await res.json();
        if (res.ok) {
            showPanel();
        } else {
            errorEl.textContent = data.message || 'Opslaan mislukt';
        }
    } catch (err) {
        errorEl.textContent = 'Geen verbinding met de server';
    }
});

// ---- Wachtwoord wijzigen ----

document.getElementById('password-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('pw-error');
    const okEl = document.getElementById('pw-ok');
    errorEl.textContent = '';
    okEl.textContent = '';

    try {
        const res = await fetch(API + '/admin/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current: document.getElementById('pw-current').value,
                new: document.getElementById('pw-new').value,
            }),
        });
        const data = await res.json();
        if (res.ok) {
            okEl.textContent = 'Wachtwoord gewijzigd.';
            this.reset();
        } else {
            errorEl.textContent = data.message || 'Wijzigen mislukt';
        }
    } catch (err) {
        errorEl.textContent = 'Geen verbinding met de server';
    }
});

// ---- Auth ----

document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    const btn = this.querySelector('button');
    btn.disabled = true;

    try {
        const res = await fetch(API + '/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: document.getElementById('login-password').value }),
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('login-password').value = '';
            showPanel();
        } else {
            errorEl.textContent = data.message || 'Fout wachtwoord';
        }
    } catch (err) {
        errorEl.textContent = 'Geen verbinding met de server';
    }
    btn.disabled = false;
});

document.getElementById('logout-button').addEventListener('click', async function () {
    await fetch(API + '/admin/logout', { method: 'POST' });
    showLogin();
});

// ---- Layer rijen ----

function layerDefaults(index) {
    return { z: (0.01 + index * 0.01).toFixed(2), w: '1', h: '1.414', anim_dur: '0', anim_dist: '0' };
}

function addLayerRow(values) {
    const rows = document.getElementById('layers-rows');
    const index = rows.children.length;
    const v = values || layerDefaults(index);

    const row = document.createElement('div');
    row.className = 'layer-row';
    row.innerHTML =
        '<label>PNG<input type="file" name="layer_file" accept=".png,.webp,.jpg,.jpeg"></label>' +
        '<label>Z (diepte)<input type="number" step="0.01" name="layer_z" value="' + v.z + '"></label>' +
        '<label>Breedte<input type="number" step="0.01" name="layer_w" value="' + v.w + '"></label>' +
        '<label>Hoogte<input type="number" step="0.01" name="layer_h" value="' + v.h + '"></label>' +
        '<label>Anim duur (s)<input type="number" step="0.1" min="0" name="layer_anim_dur" value="' + v.anim_dur + '"></label>' +
        '<label>Anim afstand<input type="number" step="0.01" name="layer_anim_dist" value="' + v.anim_dist + '"></label>' +
        '<button type="button" class="remove-layer" title="Verwijder laag">×</button>';

    row.querySelector('.remove-layer').addEventListener('click', function () {
        row.remove();
    });

    rows.appendChild(row);
}

document.getElementById('add-layer').addEventListener('click', function () {
    addLayerRow();
});

// ---- .mind generatie in de browser ----

const MAX_DIMENSION = 1600; // maximale zijde voor compilatie (sneller laden + detecteren, tracking blijft goed)

const pageInput = document.getElementById('f-page');
const compileBox = document.getElementById('compile-box');
const compileButton = document.getElementById('compile-button');
const compileProgress = document.getElementById('compile-progress');

pageInput.addEventListener('change', function () {
    compiledMind = null;
    compiledMindMatchesPage = false;
    compileProgress.textContent = '';
    compileBox.style.display = pageInput.files.length ? 'block' : 'none';
});

compileButton.addEventListener('click', async function () {
    const file = pageInput.files[0];
    if (!file) return;

    compileButton.disabled = true;
    compileProgress.textContent = 'Afbeelding laden…';

    try {
        // Afbeelding laden en verkleinen naar max. 1600px (sneller compileren, even goede tracking)
        const img = await loadImageFile(file);
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        // Transparantie afvlakken op wit: een transparante PNG zou anders zwart
        // in de marker krijgen, terwijl de print wit papier toont (mismatch).
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const compiler = new Compiler();
        await compiler.compileImageTargets([canvas], function (percent) {
            compileProgress.textContent = 'Compileren: ' + Math.round(percent) + '%';
        });

        const data = compiler.exportData();
        compiledMind = {
            blob: new Blob([data], { type: 'application/octet-stream' }),
            size: data.length,
        };
        compiledMindMatchesPage = true;
        compileProgress.textContent = 'Klaar (' + (data.length / 1024).toFixed(0) + ' KB) — wordt meegestuurd bij opslaan.';
    } catch (err) {
        compileProgress.textContent = 'Compilatie mislukt: ' + (err.message || err) +
            '. Gebruik een recente browser (Chrome/Safari/Firefox) en probeer opnieuw.';
    }
    compileButton.disabled = false;
});

function loadImageFile(file) {
    return new Promise(function (resolve, reject) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            reject(new Error('afbeelding kon niet gelezen worden'));
        };
        img.src = url;
    });
}

// ---- Essay opslaan ----

document.getElementById('essay-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    const okEl = document.getElementById('form-ok');
    const btn = document.getElementById('save-button');
    errorEl.textContent = '';
    okEl.textContent = '';
    btn.disabled = true;

    const fd = new FormData();
    fd.append('week', document.getElementById('f-week').value.trim());
    fd.append('title', document.getElementById('f-title').value.trim());
    fd.append('text', document.getElementById('f-text').value);
    fd.append('published', document.getElementById('f-published').checked ? '1' : '0');

    const pageFile = document.getElementById('f-page').files[0];
    if (pageFile) fd.append('page_image', pageFile);

    // Bewaak dat de marker overeenkomt met de (nieuwe) pagina
    const manualMindFile = document.getElementById('f-mind').files[0];
    if (pageFile && !compiledMind && !compiledMindMatchesPage && !manualMindFile) {
        const doorgaan = confirm(
            'Je hebt een (nieuwe) pagina-afbeelding gekozen, maar er is geen .mind-marker ' +
            'voor gegenereerd. Zonder bijpassende marker kan de AR de pagina niet herkennen. ' +
            'Klik "ANNULEREN" en gebruik eerst "GENEREER .MIND", of "OK" om toch op te slaan.'
        );
        if (!doorgaan) {
            btn.disabled = false;
            return;
        }
    }

    if (compiledMind) {
        fd.append('mind_file', compiledMind.blob, 'target.mind');
    } else if (manualMindFile) {
        fd.append('mind_file', manualMindFile);
    }

    // Enkel rijen met een bestand meesturen (compact, index-consistent)
    let layerIndex = 0;
    document.querySelectorAll('#layers-rows .layer-row').forEach(function (row) {
        const file = row.querySelector('input[name="layer_file"]').files[0];
        if (!file) return;
        fd.append('layers[]', file);
        fd.append('layer_z[]', row.querySelector('input[name="layer_z"]').value || '0.01');
        fd.append('layer_w[]', row.querySelector('input[name="layer_w"]').value || '1');
        fd.append('layer_h[]', row.querySelector('input[name="layer_h"]').value || '1.414');
        fd.append('layer_anim_dur[]', row.querySelector('input[name="layer_anim_dur"]').value || '0');
        fd.append('layer_anim_dist[]', row.querySelector('input[name="layer_anim_dist"]').value || '0');
        layerIndex++;
    });

    try {
        const res = await fetch(API + '/admin/essays', { method: 'POST', body: fd });
        const data = await res.json();
        if (res.ok) {
            okEl.textContent = 'Opgeslagen: ' + data.essay.week + ' — ' + (data.essay.mind ? 'AR marker aanwezig' : 'LET OP: nog geen AR marker (.mind)');
            resetForm(data.essay.week);
            loadEssays();
            rebuildBundle();
        } else {
            errorEl.textContent = data.message || 'Opslaan mislukt';
        }
    } catch (err) {
        errorEl.textContent = 'Geen verbinding met de server';
    }
    btn.disabled = false;
});

// ---- Overzicht ----

async function loadEssays() {
    try {
        const res = await fetch(API + '/admin/essays');
        if (res.status === 401) { showLogin(); return; }
        const data = await res.json();
        const tbody = document.querySelector('#essays-table tbody');
        tbody.innerHTML = '';

        data.essays.forEach(function (essay) {
            const tr = document.createElement('tr');

            const weekTd = document.createElement('td');
            weekTd.textContent = essay.week;

            const titleTd = document.createElement('td');
            titleTd.textContent = essay.title;

            const statusTd = document.createElement('td');
            statusTd.innerHTML = '<span class="badge ' + (essay.published ? 'live' : 'draft') + '">' +
                (essay.published ? 'live' : 'draft') + '</span>';

            const actionsTd = document.createElement('td');
            actionsTd.className = 'actions';

            const pubBtn = document.createElement('button');
            pubBtn.className = 'ghost';
            pubBtn.textContent = essay.published ? 'OFFLINE' : 'PUBLICEER';
            pubBtn.addEventListener('click', function () { togglePublish(essay.week, essay.published ? 0 : 1); });

            const editBtn = document.createElement('button');
            editBtn.className = 'ghost';
            editBtn.textContent = 'BEWERK';
            editBtn.addEventListener('click', function () { loadIntoForm(essay.week); });

            const delBtn = document.createElement('button');
            delBtn.className = 'danger';
            delBtn.textContent = 'VERWIJDER';
            delBtn.addEventListener('click', function () { deleteEssay(essay.week); });

            actionsTd.append(pubBtn, editBtn, delBtn);
            tr.append(weekTd, titleTd, statusTd, actionsTd);
            tbody.appendChild(tr);
        });

        if (data.essays.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="color:#777">Nog geen essays.</td></tr>';
        }
        refreshBundleInfo();
    } catch (err) {
        /* geen verbinding */
    }
}

// Toont hoe de chunks verdeeld zijn: 1 week = 1 essay, vorige-bundel = alle
// gepubliceerde essays behalve de nieuwste week.
async function refreshBundleInfo() {
    try {
        const res = await fetch(API + '/admin/bundle-sources');
        const data = await res.json();
        const n = data.published || 0;
        const prev = (data.essays || []).length;
        if (n < 2) {
            bundleStatus.textContent = n + ' gepubliceerd essay — er zijn minstens 2 nodig (elk met een ANDERE week) voor een vorige-bundel';
        } else {
            bundleStatus.textContent = n + ' gepubliceerd: nieuwste week = huidige chunk, ' + prev + ' oudere week(s) = vorige-bundel';
        }
    } catch (e) {
        /* geen verbinding */
    }
}

// Waarschuw als een week al bestaat (opslaan = overschrijven van dat essay)
document.getElementById('f-week').addEventListener('change', async function () {
    const week = this.value.trim();
    const hint = document.getElementById('week-hint');
    if (!week) { hint.textContent = ''; return; }
    try {
        const res = await fetch(API + '/admin/essays/' + encodeURIComponent(week));
        if (res.ok) {
            hint.textContent = 'Deze week bestaat al — opslaan OVERSCHRIJFT dat essay. Gebruik een andere week voor een nieuw essay.';
        } else if (res.status === 404) {
            hint.textContent = 'Nieuwe week — wordt een nieuw essay.';
        } else {
            hint.textContent = '';
        }
    } catch (e) {
        hint.textContent = '';
    }
});

async function togglePublish(week, published) {
    await fetch(API + '/admin/essays/' + encodeURIComponent(week) + '/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: published }),
    });
    loadEssays();
    rebuildBundle();
}

async function deleteEssay(week) {
    if (!confirm('Essay "' + week + '" definitief verwijderen?')) return;
    await fetch(API + '/admin/essays/' + encodeURIComponent(week), { method: 'DELETE' });
    if (editingWeek === week) resetForm();
    loadEssays();
    rebuildBundle();
}

// ---- Vorige-bundel (chunk 2) ----

const bundleStatus = document.getElementById('bundle-status');
const bundleProgress = document.getElementById('bundle-progress');

async function rebuildBundle() {
    const btn = document.getElementById('bundle-button');
    btn.disabled = true;
    bundleProgress.textContent = 'Bezig…';

    try {
        const res = await fetch(API + '/admin/bundle-sources');
        const data = await res.json();
        const essays = (data.essays || []).filter(function (e) { return e.mind; });

        if (essays.length === 0) {
            const fd = new FormData();
            fd.append('weeks', '[]');
            await fetch(API + '/admin/bundle', { method: 'POST', body: fd });
            bundleStatus.textContent = 'geen vorige essays — knop verborgen op de gsm';
            bundleProgress.textContent = '';
            btn.disabled = false;
            return;
        }

        const dataList = [];
        const weeks = [];
        for (let i = 0; i < essays.length; i++) {
            bundleProgress.textContent = 'Downloaden ' + (i + 1) + '/' + essays.length + '…';
            const mindRes = await fetch(essays[i].mind);
            if (!mindRes.ok) throw new Error('kon marker van ' + essays[i].week + ' niet ophalen');
            const decoded = msgpack.decode(new Uint8Array(await mindRes.arrayBuffer()));
            if (!decoded.dataList || !decoded.dataList.length) {
                throw new Error('ongeldige marker ' + essays[i].week);
            }
            dataList.push(decoded.dataList[0]);
            weeks.push(essays[i].week);
        }

        bundleProgress.textContent = 'Samenvoegen…';
        const merged = msgpack.encode({ v: decoded && decoded.v ? decoded.v : 2, dataList });

        const fd = new FormData();
        fd.append('weeks', JSON.stringify(weeks));
        fd.append('bundle_file', new Blob([merged], { type: 'application/octet-stream' }), 'previous.mind');

        const upRes = await fetch(API + '/admin/bundle', { method: 'POST', body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.message || 'upload mislukt');

        bundleStatus.textContent = 'up-to-date (' + weeks.length + ' vorige essays)';
        bundleProgress.textContent = 'Klaar (' + (merged.length / 1024).toFixed(0) + ' KB)';
    } catch (err) {
        bundleStatus.textContent = 'NIET up-to-date — herbouw nodig';
        bundleProgress.textContent = 'Mislukt: ' + (err.message || err);
    }
    btn.disabled = false;
}

document.getElementById('bundle-button').addEventListener('click', rebuildBundle);

// ---- Formulier vullen voor bewerking ----

async function loadIntoForm(week) {
    try {
        const res = await fetch(API + '/admin/essays/' + encodeURIComponent(week));
        if (!res.ok) return;
        const data = await res.json();
        const essay = data.essay;

        editingWeek = week;
        document.getElementById('form-heading').textContent = 'Bewerken: ' + week;
        document.getElementById('f-week').value = essay.week;
        document.getElementById('f-title').value = essay.title;
        document.getElementById('f-text').value = essay.text;
        document.getElementById('f-published').checked = true;

        // Layers tonen (bestanden zelf kunnen niet herladen worden — die blijven staan als je geen nieuw bestand kiest)
        const rows = document.getElementById('layers-rows');
        rows.innerHTML = '';
        essay.layers.forEach(function (layer) {
            addLayerRow({
                z: layer.z, w: layer.w, h: layer.h,
                anim_dur: layer.anim_dur, anim_dist: layer.anim_dist,
            });
        });
        if (essay.layers.length === 0) addLayerRow();
        document.getElementById('form-error').textContent = '';
        document.getElementById('form-ok').textContent =
            'Bestaande bestanden (pagina/marker/layers) blijven behouden als je geen nieuw bestand kiest.';
    } catch (err) {
        /* negeer */
    }
}

function resetForm(keepWeek) {
    editingWeek = null;
    compiledMind = null;
    compiledMindMatchesPage = false;
    compileProgress.textContent = '';
    compileBox.style.display = 'none';
    document.getElementById('form-heading').textContent = 'Nieuw essay';
    document.getElementById('f-week').value = keepWeek || isoWeek();
    document.getElementById('f-title').value = '';
    document.getElementById('f-text').value = '';
    document.getElementById('f-page').value = '';
    document.getElementById('f-mind').value = '';
    document.getElementById('f-published').checked = true;
    document.getElementById('layers-rows').innerHTML = '';
    addLayerRow();
    document.getElementById('form-ok').textContent = '';
}

document.getElementById('reset-form').addEventListener('click', function () { resetForm(); });

// ---- Init ----

(async function init() {
    resetForm();
    try {
        const res = await fetch(API + '/admin/status');
        const data = await res.json();
        if (data.needs_setup) {
            showSetup();
        } else if (data.logged_in) {
            showPanel();
        } else {
            showLogin();
        }
    } catch (err) {
        showLogin();
    }
})();
