/* ==========================================================================
   DE KRANT — STUDIO ADMIN & ANALYTICS CONTROLLER
   Vanilla JS (ES2020+)
   ========================================================================== */

const API_BASE = '../api.php';

// State
let allEssays = [];
let editingWeek = null;
let existingPagePath = null;
let currentPageRatio = 0.7071; // A-series default
let activeMediaSearchLayerRow = null;
let activeMediaTab = 'memes';
let currentStatsDays = 30;
let currentStatsData = null;
let showAllTopPages = false;

// Undo / Redo history for layer configurations
let layerHistory = [];
let layerHistoryIndex = -1;
let isRestoringHistory = false;

// DOM Elements
const setupView = document.getElementById('setup-view');
const loginView = document.getElementById('login-view');
const panelView = document.getElementById('panel-view');

const setupForm = document.getElementById('setup-form');
const setupPassword = document.getElementById('setup-password');
const setupError = document.getElementById('setup-error');

const loginForm = document.getElementById('login-form');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

const sidebarPosLink = document.getElementById('sidebar-pos-link');
const resetFormBtn = document.getElementById('reset-form');
const analyticsBtn = document.getElementById('analytics-btn');
const settingsBtn = document.getElementById('settings-btn');
const logoutBtn = document.getElementById('logout-button');
const sidebarEssayCount = document.getElementById('sidebar-essay-count');
const sidebarSearch = document.getElementById('sidebar-search');
const sidebarEssayList = document.getElementById('sidebar-essay-list');

const editorModeBadge = document.getElementById('editor-mode-badge');
const formHeading = document.getElementById('form-heading');
const headerPositionLink = document.getElementById('header-position-link');
const duplicateEssayBtn = document.getElementById('duplicate-essay-btn');
const deleteCurrentBtn = document.getElementById('delete-current-btn');

const essayForm = document.getElementById('essay-form');
const fWeek = document.getElementById('f-week');
const weekHint = document.getElementById('week-hint');
const fPublished = document.getElementById('f-published');
const fTitle = document.getElementById('f-title');
const fPage = document.getElementById('f-page');
const pageFileInfo = document.getElementById('page-file-info');
const pagePreviewWrap = document.getElementById('page-preview-wrap');
const pagePreviewImg = document.getElementById('page-preview-img');
const pageDimensionsInfo = document.getElementById('page-dimensions-info');
const target8wBadge = document.getElementById('target8w-badge');
const target8wStatus = document.getElementById('target8w-status');

const summaryBundleBadge = document.getElementById('summary-bundle-badge');
const sumWeek = document.getElementById('sum-week');
const sumTitle = document.getElementById('sum-title');
const sumPage = document.getElementById('sum-page');
const sumTarget = document.getElementById('sum-target');
const sumLayers = document.getElementById('sum-layers');

const uploadProgressWrap = document.getElementById('upload-progress-wrap');
const uploadProgressFill = document.getElementById('upload-progress-fill');
const uploadProgressText = document.getElementById('upload-progress-text');
const uploadProgressPct = document.getElementById('upload-progress-pct');

const formError = document.getElementById('form-error');
const formOk = document.getElementById('form-ok');
const saveButton = document.getElementById('save-button');
const essaysTableBody = document.querySelector('#essays-table tbody');

// 2D Stage & Layers
const stageCoordsReadout = document.getElementById('stage-coords-readout');
const toggleStageBtn = document.getElementById('toggle-stage-btn');
const stageBody = document.getElementById('stage-body');
const ar2dPaper = document.getElementById('ar-2d-paper');
const ar2dLayers = document.getElementById('ar-2d-layers');
const layerUndoBtn = document.getElementById('layer-undo-btn');
const layerRedoBtn = document.getElementById('layer-redo-btn');
const openMemeSearchBtn = document.getElementById('open-meme-search-btn');
const open3dSearchBtn = document.getElementById('open-3d-search-btn');
const addLayerBtn = document.getElementById('add-layer');
const layersRows = document.getElementById('layers-rows');

// Modals
const mediaSearchModal = document.getElementById('media-search-modal');
const mediaSearchQuery = document.getElementById('media-search-query');
const mediaSearchSub = document.getElementById('media-search-sub');
const mediaSearchSubmit = document.getElementById('media-search-submit');
const mediaSearchStatus = document.getElementById('media-search-status');
const mediaSearchResults = document.getElementById('media-search-results');

const settingsModal = document.getElementById('settings-modal');
const rebuildTargetsBtn = document.getElementById('rebuild-targets-btn');
const rebuildTargetsStatus = document.getElementById('rebuild-targets-status');
const exportEssaysJsonBtn = document.getElementById('export-essays-json-btn');
const exportEssaysStatus = document.getElementById('export-essays-status');
const sketchfabApiKeyInput = document.getElementById('sketchfab-api-key');
const saveSketchfabKeyBtn = document.getElementById('save-sketchfab-key-btn');
const sketchfabKeyStatus = document.getElementById('sketchfab-key-status');
const passwordForm = document.getElementById('password-form');
const pwCurrent = document.getElementById('pw-current');
const pwNew = document.getElementById('pw-new');
const pwError = document.getElementById('pw-error');
const pwOk = document.getElementById('pw-ok');
const wipeAllBtn = document.getElementById('wipe-all');

const analyticsModal = document.getElementById('analytics-modal');
const analyticsContent = document.getElementById('analytics-content');

/* ==========================================================================
   HELPERS & API FETCH
   ========================================================================== */

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(sec) {
  const s = Math.round(Number(sec) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

async function apiJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function resolveAssetUrl(relPath) {
  if (!relPath) return '';
  if (/^(https?:|blob:|data:)/i.test(relPath)) return relPath;
  return `../${String(relPath).replace(/^\/+/, '')}`;
}

/* ==========================================================================
   AUTH & INITIALIZATION
   ========================================================================== */

async function checkAuthState() {
  try {
    const state = await apiJson('/admin/state');
    setupView.classList.add('hidden');
    loginView.classList.add('hidden');
    panelView.classList.add('hidden');

    if (!state.setupComplete) {
      setupView.classList.remove('hidden');
    } else if (!state.authenticated) {
      loginView.classList.remove('hidden');
    } else {
      panelView.classList.remove('hidden');
      await initStudioPanel();
    }
  } catch (err) {
    loginView.classList.remove('hidden');
    loginError.textContent = err.message || 'Kan status niet ophalen.';
    loginError.classList.remove('hidden');
  }
}

setupForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setupError.classList.add('hidden');
  try {
    await apiJson('/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ password: setupPassword.value }),
    });
    setupPassword.value = '';
    await checkAuthState();
  } catch (err) {
    setupError.textContent = err.message;
    setupError.classList.remove('hidden');
  }
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');
  try {
    await apiJson('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: loginPassword.value }),
    });
    loginPassword.value = '';
    await checkAuthState();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

logoutBtn?.addEventListener('click', async () => {
  try {
    await apiJson('/admin/logout', { method: 'POST' });
  } catch (_) {}
  await checkAuthState();
});

async function initStudioPanel() {
  if (!fPublished.value) {
    fPublished.value = new Date().toISOString().slice(0, 10);
  }
  await loadEssays();
  if (layersRows.children.length === 0) {
    addLayerRow();
    recordLayerHistory();
  }
  updateSummaryChecklist();
  render2dStage();
}

/* ==========================================================================
   LOAD & RENDER ESSAYS (SIDEBAR + TABLE)
   ========================================================================== */

async function loadEssays() {
  try {
    const data = await apiJson('/admin/essays');
    allEssays = Array.isArray(data.essays) ? data.essays : [];
    sidebarEssayCount.textContent = String(allEssays.length);
    renderSidebarEssays();
    renderEssaysTable();
  } catch (err) {
    console.error('Failed to load essays:', err);
  }
}

function renderSidebarEssays() {
  const q = (sidebarSearch?.value || '').trim().toLowerCase();
  const filtered = allEssays.filter((e) => {
    if (!q) return true;
    return (
      String(e.week).includes(q) ||
      (e.title || '').toLowerCase().includes(q) ||
      (e.published_at || '').toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    sidebarEssayList.innerHTML = `<div class="muted small" style="padding:12px;">Geen edities gevonden.</div>`;
    return;
  }

  sidebarEssayList.innerHTML = filtered
    .map((e) => {
      const isActive = Number(editingWeek) === Number(e.week);
      const hasTarget = Boolean(e.hasTarget8w);
      const thumbUrl = resolveAssetUrl(e.page);
      const layerCount = Array.isArray(e.layers) ? e.layers.length : 0;
      const scanCount = Number(e.scans) || 0;
      return `
        <button type="button" class="sidebar-essay-item ${isActive ? 'active' : ''}" data-week="${e.week}">
          <img class="sidebar-essay-thumb" src="${escHtml(thumbUrl)}" alt="W${e.week}" loading="lazy" />
          <div class="sidebar-essay-meta">
            <div class="sidebar-essay-top">
              <span class="sidebar-essay-week">WEEK ${e.week}</span>
              <span>${escHtml(e.published_at || '—')}</span>
            </div>
            <div class="sidebar-essay-title">${escHtml(e.title || `Editie ${e.week}`)}</div>
            <div class="sidebar-essay-stats">
              <span><i class="${hasTarget ? 'dot-ready' : 'dot-missing'}"></i> ${hasTarget ? '8W klaar' : 'Geen 8W'}</span>
              <span>• ${layerCount} lagen</span>
              <span>• ${scanCount} scans</span>
            </div>
          </div>
        </button>
      `;
    })
    .join('');

  sidebarEssayList.querySelectorAll('.sidebar-essay-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wk = Number(btn.dataset.week);
      const found = allEssays.find((x) => Number(x.week) === wk);
      if (found) startEditEssay(found);
    });
  });
}

sidebarSearch?.addEventListener('input', renderSidebarEssays);

function renderEssaysTable() {
  if (!essaysTableBody) return;
  if (allEssays.length === 0) {
    essaysTableBody.innerHTML = `<tr><td colspan="6" class="muted">Nog geen edities gepubliceerd.</td></tr>`;
    return;
  }

  essaysTableBody.innerHTML = allEssays
    .map((e) => {
      const layerCount = Array.isArray(e.layers) ? e.layers.length : 0;
      const hasTarget = Boolean(e.hasTarget8w);
      const scans = Number(e.scans) || 0;
      return `
        <tr>
          <td><strong>#${e.week}</strong></td>
          <td>
            <div><strong>${escHtml(e.title || '—')}</strong></div>
            <div class="muted small">${escHtml(e.published_at || '')}</div>
          </td>
          <td>${layerCount}</td>
          <td>${scans}</td>
          <td>
            <span class="card-badge ${hasTarget ? 'badge-ok' : 'badge-warn'}">
              ${hasTarget ? '✓ 8W Target' : '⚠ Geen target'}
            </span>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-sm edit-row-btn" data-week="${e.week}">Bewerk</button>
              <a class="btn btn-sm" href="../position/?week=${e.week}" target="_blank" rel="noopener">3D</a>
              <button type="button" class="btn btn-sm btn-danger del-row-btn" data-week="${e.week}">✕</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  essaysTableBody.querySelectorAll('.edit-row-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const found = allEssays.find((x) => Number(x.week) === Number(btn.dataset.week));
      if (found) startEditEssay(found);
    });
  });

  essaysTableBody.querySelectorAll('.del-row-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteEssayByWeek(Number(btn.dataset.week)));
  });
}

/* ==========================================================================
   FORM EDIT / RESET / DUPLICATE / DELETE
   ========================================================================== */

function resetEditorForm() {
  editingWeek = null;
  existingPagePath = null;
  currentPageRatio = 0.7071;

  essayForm.reset();
  fWeek.disabled = false;
  fPublished.value = new Date().toISOString().slice(0, 10);

  // Suggest next available week number
  const maxWeek = allEssays.reduce((m, e) => Math.max(m, Number(e.week) || 0), 0);
  fWeek.value = String(maxWeek + 1);
  weekHint.textContent = `Suggestie: week ${maxWeek + 1}`;

  editorModeBadge.textContent = 'NIEUWE EDITIE';
  editorModeBadge.classList.remove('editing');
  formHeading.textContent = 'Nieuwe krant-editie aanmaken';
  saveButton.textContent = 'Opslaan & AR-bundel bouwen';

  headerPositionLink.classList.add('hidden');
  duplicateEssayBtn.classList.add('hidden');
  deleteCurrentBtn.classList.add('hidden');
  if (sidebarPosLink) sidebarPosLink.href = '../position/';

  pagePreviewWrap.classList.add('hidden');
  pagePreviewImg.src = '';
  pageFileInfo.textContent = 'Sleep een krantenpagina hierheen of klik om te bladeren';
  target8wBadge.textContent = 'Nog niet gegenereerd';
  target8wBadge.className = 'card-badge';
  target8wStatus.textContent = 'Bij het opslaan wordt automatisch een 8th Wall image target (.jpg) opgebouwd.';

  ar2dPaper.style.backgroundImage = 'none';
  ar2dPaper.style.aspectRatio = '0.7071';

  layersRows.innerHTML = '';
  addLayerRow();
  layerHistory = [];
  layerHistoryIndex = -1;
  recordLayerHistory();

  formError.classList.add('hidden');
  formOk.classList.add('hidden');
  renderSidebarEssays();
  updateSummaryChecklist();
  render2dStage();
}

function startEditEssay(essay) {
  editingWeek = Number(essay.week);
  existingPagePath = essay.page || null;
  currentPageRatio = Number(essay.pageRatio) > 0 ? Number(essay.pageRatio) : 0.7071;

  fWeek.value = String(essay.week);
  fWeek.disabled = true;
  weekHint.textContent = `Bewerken van bestaande week #${essay.week}`;
  fPublished.value = essay.published_at || '';
  fTitle.value = essay.title || '';
  fPage.value = '';

  editorModeBadge.textContent = `BEWERK WEEK #${essay.week}`;
  editorModeBadge.classList.add('editing');
  formHeading.textContent = `Week ${essay.week}: ${essay.title || 'Zonder titel'}`;
  saveButton.textContent = `Wijzigingen voor Week #${essay.week} opslaan`;

  const posUrl = `../position/?week=${essay.week}`;
  headerPositionLink.href = posUrl;
  headerPositionLink.classList.remove('hidden');
  if (sidebarPosLink) sidebarPosLink.href = posUrl;
  duplicateEssayBtn.classList.remove('hidden');
  deleteCurrentBtn.classList.remove('hidden');

  if (existingPagePath) {
    const resolved = resolveAssetUrl(existingPagePath);
    pagePreviewImg.src = resolved;
    pagePreviewWrap.classList.remove('hidden');
    pageFileInfo.textContent = `Huidig bestand: ${existingPagePath} (kies nieuw bestand om te vervangen)`;
    ar2dPaper.style.backgroundImage = `url("${resolved}")`;
    ar2dPaper.style.aspectRatio = String(currentPageRatio);
    pageDimensionsInfo.textContent = `Verhouding B/H: ${currentPageRatio.toFixed(3)}`;
  } else {
    pagePreviewWrap.classList.add('hidden');
  }

  if (essay.hasTarget8w) {
    target8wBadge.textContent = '✓ 8W Target actief';
    target8wBadge.className = 'card-badge badge-ok';
    target8wStatus.textContent = `8th Wall target gereed (${essay.target8w || 'target8w.jpg'}).`;
  } else {
    target8wBadge.textContent = '⚠ Ontbreekt';
    target8wBadge.className = 'card-badge badge-warn';
    target8wStatus.textContent = 'Geen 8th Wall target gevonden. Sla opnieuw op of gebruik "Herbouw 8th Wall Targets" in Instellingen.';
  }

  layersRows.innerHTML = '';
  const layers = Array.isArray(essay.layers) ? essay.layers : [];
  if (layers.length === 0) {
    addLayerRow();
  } else {
    layers.forEach((l) => addLayerRow(l));
  }

  layerHistory = [];
  layerHistoryIndex = -1;
  recordLayerHistory();

  formError.classList.add('hidden');
  formOk.classList.add('hidden');
  renderSidebarEssays();
  updateSummaryChecklist();
  render2dStage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

resetFormBtn?.addEventListener('click', resetEditorForm);

duplicateEssayBtn?.addEventListener('click', async () => {
  if (!editingWeek) return;
  const maxWeek = allEssays.reduce((m, e) => Math.max(m, Number(e.week) || 0), 0);
  const targetWeekStr = prompt(
    `Naar welk weeknummer wil je Week #${editingWeek} dupliceren?`,
    String(maxWeek + 1)
  );
  if (!targetWeekStr) return;
  const targetWeek = Number(targetWeekStr);
  if (!Number.isInteger(targetWeek) || targetWeek < 1) {
    alert('Ongeldig weeknummer.');
    return;
  }

  try {
    const res = await apiJson(`/admin/essays/${editingWeek}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ target_week: targetWeek }),
    });
    await loadEssays();
    if (res.essay) {
      startEditEssay(res.essay);
      formOk.textContent = `Week #${editingWeek} gedupliceerd naar Week #${targetWeek}.`;
      formOk.classList.remove('hidden');
    }
  } catch (err) {
    alert(`Dupliceren mislukt: ${err.message}`);
  }
});

deleteCurrentBtn?.addEventListener('click', () => {
  if (editingWeek) deleteEssayByWeek(editingWeek);
});

async function deleteEssayByWeek(week) {
  if (!confirm(`Weet je zeker dat je Week #${week} inclusief alle AR-lagen wilt verwijderen?`)) {
    return;
  }
  try {
    await apiJson(`/admin/essays/${week}`, { method: 'DELETE' });
    await loadEssays();
    if (Number(editingWeek) === Number(week)) {
      resetEditorForm();
    }
  } catch (err) {
    alert(`Verwijderen mislukt: ${err.message}`);
  }
}

/* ==========================================================================
   PAGE UPLOAD PREVIEW & CHECKLIST SUMMARY
   ========================================================================== */

fPage?.addEventListener('change', () => {
  const file = fPage.files?.[0];
  if (!file) return;
  pageFileInfo.textContent = `${file.name} (${formatBytes(file.size)})`;

  const url = URL.createObjectURL(file);
  pagePreviewImg.onload = () => {
    if (pagePreviewImg.naturalWidth && pagePreviewImg.naturalHeight) {
      currentPageRatio = pagePreviewImg.naturalWidth / pagePreviewImg.naturalHeight;
      pageDimensionsInfo.textContent = `${pagePreviewImg.naturalWidth} × ${pagePreviewImg.naturalHeight} px (ratio ${currentPageRatio.toFixed(3)})`;
      ar2dPaper.style.aspectRatio = String(currentPageRatio);
      render2dStage();
    }
  };
  pagePreviewImg.src = url;
  pagePreviewWrap.classList.remove('hidden');
  ar2dPaper.style.backgroundImage = `url("${url}")`;
  updateSummaryChecklist();
});

fWeek?.addEventListener('input', updateSummaryChecklist);
fTitle?.addEventListener('input', updateSummaryChecklist);

function updateSummaryChecklist() {
  const wk = fWeek?.value?.trim() || '';
  const title = fTitle?.value?.trim() || '';
  const hasNewPage = Boolean(fPage?.files?.[0]);
  const hasPage = hasNewPage || Boolean(existingPagePath);

  const rows = Array.from(layersRows.querySelectorAll('.layer-card'));
  const validLayers = rows.filter((r) => {
    const hasFile = Boolean(r.querySelector('.layer-file-input')?.files?.[0]);
    const hasExisting = Boolean(r.dataset.existingPath);
    return hasFile || hasExisting;
  });

  sumWeek.textContent = wk ? `Week #${wk}` : '—';
  sumTitle.textContent = title || '—';
  sumPage.textContent = hasNewPage
    ? `Nieuw (${fPage.files[0].name})`
    : existingPagePath
    ? 'Bestaand bestand'
    : 'Ontbreekt';
  sumTarget.textContent = hasPage ? 'Wordt automatisch gebouwd' : 'Wacht op pagina';
  sumLayers.textContent = `${validLayers.length} / ${rows.length} gereed`;

  const allReady = Boolean(wk && title && hasPage && validLayers.length > 0);
  summaryBundleBadge.textContent = allReady ? '✓ Klaar voor publicatie' : 'Incompleet';
  summaryBundleBadge.className = `card-badge ${allReady ? 'badge-ok' : 'badge-warn'}`;
}

/* ==========================================================================
   AR LAYERS MANAGEMENT & UNDO/REDO
   ========================================================================== */

function getLayersSnapshot() {
  return Array.from(layersRows.querySelectorAll('.layer-card')).map((row) => ({
    type: row.querySelector('.layer-type').value,
    existingPath: row.dataset.existingPath || '',
    previewUrl: row.dataset.previewUrl || '',
    hiddenOnStage: row.classList.contains('layer-hidden'),
    x: Number(row.querySelector('.layer-x').value) || 0,
    y: Number(row.querySelector('.layer-y').value) || 0,
    z: Number(row.querySelector('.layer-z').value) || 0,
    scale: Number(row.querySelector('.layer-scale').value) || 1,
    rotZ: Number(row.querySelector('.layer-rotz').value) || 0,
  }));
}

function recordLayerHistory() {
  if (isRestoringHistory) return;
  const snap = JSON.stringify(getLayersSnapshot());
  if (layerHistoryIndex >= 0 && layerHistory[layerHistoryIndex] === snap) return;
  layerHistory = layerHistory.slice(0, layerHistoryIndex + 1);
  layerHistory.push(snap);
  if (layerHistory.length > 40) layerHistory.shift();
  layerHistoryIndex = layerHistory.length - 1;
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  if (layerUndoBtn) layerUndoBtn.disabled = layerHistoryIndex <= 0;
  if (layerRedoBtn) layerRedoBtn.disabled = layerHistoryIndex >= layerHistory.length - 1;
}

function restoreLayerSnapshot(snapJson) {
  isRestoringHistory = true;
  try {
    const items = JSON.parse(snapJson);
    layersRows.innerHTML = '';
    items.forEach((item) => addLayerRow(item));
    updateSummaryChecklist();
    render2dStage();
  } finally {
    isRestoringHistory = false;
    updateUndoRedoButtons();
  }
}

layerUndoBtn?.addEventListener('click', () => {
  if (layerHistoryIndex > 0) {
    layerHistoryIndex--;
    restoreLayerSnapshot(layerHistory[layerHistoryIndex]);
  }
});

layerRedoBtn?.addEventListener('click', () => {
  if (layerHistoryIndex < layerHistory.length - 1) {
    layerHistoryIndex++;
    restoreLayerSnapshot(layerHistory[layerHistoryIndex]);
  }
});

function addLayerRow(initial = {}) {
  const type = initial.type || 'image';
  const existingPath = initial.path || initial.existingPath || '';
  const pos = initial.position || {};
  const rot = initial.rotation || {};
  const x = initial.x ?? pos.x ?? 0;
  const y = initial.y ?? pos.y ?? 0;
  const z = initial.z ?? pos.z ?? 0.02;
  const scale = initial.scale ?? 1;
  const rotZ = initial.rotZ ?? rot.z ?? 0;
  const previewUrl = initial.previewUrl || (existingPath ? resolveAssetUrl(existingPath) : '');

  const card = document.createElement('div');
  card.className = `layer-card ${initial.hiddenOnStage ? 'layer-hidden' : ''}`;
  if (existingPath) card.dataset.existingPath = existingPath;
  if (previewUrl) card.dataset.previewUrl = previewUrl;

  card.innerHTML = `
    <div class="layer-card-header">
      <div class="layer-card-title">
        <span class="layer-index-pill">#1</span>
        <span class="layer-type-badge">${escHtml(type.toUpperCase())}</span>
        <span class="layer-filename muted small">${existingPath ? escHtml(existingPath.split('/').pop()) : 'Nieuwe laag'}</span>
      </div>
      <div class="layer-card-controls">
        <button type="button" class="icon-btn layer-vis-btn" title="Toon/verberg op 2D canvas">${initial.hiddenOnStage ? '👁‍🗨' : '👁'}</button>
        <button type="button" class="icon-btn layer-up-btn" title="Omhoog">↑</button>
        <button type="button" class="icon-btn layer-down-btn" title="Omlaag">↓</button>
        <button type="button" class="icon-btn layer-dup-btn" title="Dupliceer laag">⧉</button>
        <button type="button" class="icon-btn danger layer-del-btn" title="Verwijder laag">✕</button>
      </div>
    </div>
    <div class="layer-card-body">
      <div class="layer-thumb-box">
        ${renderLayerThumbHtml(type, previewUrl)}
      </div>
      <div class="layer-fields">
        <div class="layer-row-top">
          <select class="layer-type">
            <option value="image" ${type === 'image' ? 'selected' : ''}>Afbeelding</option>
            <option value="gif" ${type === 'gif' ? 'selected' : ''}>GIF / Meme</option>
            <option value="video" ${type === 'video' ? 'selected' : ''}>Video (MP4/WebM)</option>
            <option value="model" ${type === 'model' ? 'selected' : ''}>3D Model (GLB)</option>
          </select>
          <input type="file" class="layer-file-input" accept="image/*,video/*,.glb,.gltf" />
          <button type="button" class="btn btn-sm btn-secondary layer-search-media-btn" title="Zoek online meme, GIF of 3D model">Zoek media…</button>
        </div>
        <div class="layer-coords-grid">
          <label class="coord-field">
            <span>Pos X</span>
            <input type="number" class="layer-x" step="0.01" value="${Number(x).toFixed(2)}" />
          </label>
          <label class="coord-field">
            <span>Pos Y</span>
            <input type="number" class="layer-y" step="0.01" value="${Number(y).toFixed(2)}" />
          </label>
          <label class="coord-field">
            <span>Diepte Z</span>
            <input type="number" class="layer-z" step="0.01" value="${Number(z).toFixed(2)}" />
          </label>
          <label class="coord-field">
            <span>Schaal</span>
            <input type="number" class="layer-scale" step="0.05" min="0.05" value="${Number(scale).toFixed(2)}" />
          </label>
          <label class="coord-field">
            <span>Rot Z (°)</span>
            <input type="number" class="layer-rotz" step="1" value="${Math.round(Number(rotZ))}" />
          </label>
        </div>
      </div>
    </div>
  `;

  const typeSelect = card.querySelector('.layer-type');
  const typeBadge = card.querySelector('.layer-type-badge');
  const fileInput = card.querySelector('.layer-file-input');
  const filenameLabel = card.querySelector('.layer-filename');
  const thumbBox = card.querySelector('.layer-thumb-box');

  typeSelect.addEventListener('change', () => {
    typeBadge.textContent = typeSelect.value.toUpperCase();
    thumbBox.innerHTML = renderLayerThumbHtml(typeSelect.value, card.dataset.previewUrl || '');
    recordLayerHistory();
    render2dStage();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    filenameLabel.textContent = `${file.name} (${formatBytes(file.size)})`;

    // Auto-detect type from extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'glb' || ext === 'gltf') typeSelect.value = 'model';
    else if (ext === 'gif') typeSelect.value = 'gif';
    else if (['mp4', 'webm', 'mov'].includes(ext)) typeSelect.value = 'video';
    else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) typeSelect.value = 'image';
    typeBadge.textContent = typeSelect.value.toUpperCase();

    const blobUrl = URL.createObjectURL(file);
    card.dataset.previewUrl = blobUrl;
    thumbBox.innerHTML = renderLayerThumbHtml(typeSelect.value, blobUrl);
    updateSummaryChecklist();
    recordLayerHistory();
    render2dStage();
  });

  card.querySelectorAll('.layer-coords-grid input').forEach((inp) => {
    inp.addEventListener('input', () => {
      render2dStage();
    });
    inp.addEventListener('change', () => {
      recordLayerHistory();
    });
  });

  card.querySelector('.layer-vis-btn').addEventListener('click', (e) => {
    card.classList.toggle('layer-hidden');
    e.currentTarget.textContent = card.classList.contains('layer-hidden') ? '👁‍🗨' : '👁';
    recordLayerHistory();
    render2dStage();
  });

  card.querySelector('.layer-up-btn').addEventListener('click', () => {
    const prev = card.previousElementSibling;
    if (prev) {
      layersRows.insertBefore(card, prev);
      renumberLayerCards();
      recordLayerHistory();
      render2dStage();
    }
  });

  card.querySelector('.layer-down-btn').addEventListener('click', () => {
    const next = card.nextElementSibling;
    if (next) {
      layersRows.insertBefore(next, card);
      renumberLayerCards();
      recordLayerHistory();
      render2dStage();
    }
  });

  card.querySelector('.layer-dup-btn').addEventListener('click', () => {
    const cloneData = {
      type: typeSelect.value,
      existingPath: card.dataset.existingPath || '',
      previewUrl: card.dataset.previewUrl || '',
      x: (Number(card.querySelector('.layer-x').value) || 0) + 0.08,
      y: (Number(card.querySelector('.layer-y').value) || 0) - 0.08,
      z: (Number(card.querySelector('.layer-z').value) || 0) + 0.02,
      scale: Number(card.querySelector('.layer-scale').value) || 1,
      rotZ: Number(card.querySelector('.layer-rotz').value) || 0,
    };
    const newCard = addLayerRow(cloneData);
    if (fileInput.files?.[0]) {
      const dt = new DataTransfer();
      dt.items.add(fileInput.files[0]);
      newCard.querySelector('.layer-file-input').files = dt.files;
      newCard.querySelector('.layer-filename').textContent = fileInput.files[0].name;
    }
    recordLayerHistory();
    updateSummaryChecklist();
    render2dStage();
  });

  card.querySelector('.layer-del-btn').addEventListener('click', () => {
    card.remove();
    if (layersRows.children.length === 0) addLayerRow();
    renumberLayerCards();
    recordLayerHistory();
    updateSummaryChecklist();
    render2dStage();
  });

  card.querySelector('.layer-search-media-btn').addEventListener('click', () => {
    const wantedTab = typeSelect.value === 'model' ? '3d' : 'memes';
    openMediaSearchModal(card, wantedTab);
  });

  layersRows.appendChild(card);
  renumberLayerCards();
  updateSummaryChecklist();
  render2dStage();
  return card;
}

function renderLayerThumbHtml(type, url) {
  if (!url) {
    return `<span>${type === 'model' ? '🧊 3D' : 'Geen media'}</span>`;
  }
  if (type === 'model') {
    return `<span>🧊 3D GLB</span>`;
  }
  if (type === 'video') {
    return `<video src="${escHtml(url)}" muted loop playsinline></video>`;
  }
  return `<img src="${escHtml(url)}" alt="Layer preview" />`;
}

function renumberLayerCards() {
  Array.from(layersRows.querySelectorAll('.layer-card')).forEach((card, i) => {
    const pill = card.querySelector('.layer-index-pill');
    if (pill) pill.textContent = `#${i + 1}`;
  });
}

addLayerBtn?.addEventListener('click', () => {
  addLayerRow({ z: (layersRows.children.length + 1) * 0.02 });
  recordLayerHistory();
});

/* ==========================================================================
   INTERACTIVE 2D AR COMPOSITION STAGE (DRAG TO POSITION)
   ========================================================================== */

toggleStageBtn?.addEventListener('click', () => {
  const hidden = stageBody.classList.toggle('hidden');
  toggleStageBtn.textContent = hidden ? 'Toon' : 'Inklappen';
});

function render2dStage() {
  if (!ar2dLayers) return;
  ar2dLayers.innerHTML = '';

  const cards = Array.from(layersRows.querySelectorAll('.layer-card'));
  cards.forEach((card, idx) => {
    if (card.classList.contains('layer-hidden')) return;

    const type = card.querySelector('.layer-type')?.value || 'image';
    const x = Number(card.querySelector('.layer-x')?.value) || 0;
    const y = Number(card.querySelector('.layer-y')?.value) || 0;
    const scale = Math.max(0.15, Number(card.querySelector('.layer-scale')?.value) || 1);
    const rotZ = Number(card.querySelector('.layer-rotz')?.value) || 0;
    const previewUrl = card.dataset.previewUrl || '';

    // Map 8th Wall image target space:
    // X in [-0.5 * ratio, +0.5 * ratio] -> [0%, 100%]
    // Y in [+0.5, -0.5] -> [0%, 100%]
    const halfW = Math.max(0.25, currentPageRatio * 0.5);
    const leftPct = 50 + (x / (halfW * 2)) * 100;
    const topPct = 50 - y * 100;

    const marker = document.createElement('div');
    marker.className = 'ar-2d-marker';
    marker.style.left = `${leftPct}%`;
    marker.style.top = `${topPct}%`;
    const baseSize = Math.min(130, Math.max(34, 52 * scale));
    marker.style.width = `${baseSize}px`;
    marker.style.height = `${baseSize}px`;
    marker.style.transform = `translate(-50%, -50%) rotate(${-rotZ}deg)`;

    let inner = `<span class="ar-2d-marker-label">#${idx + 1} ${escHtml(type.toUpperCase())}</span>`;
    if (previewUrl && (type === 'image' || type === 'gif')) {
      inner += `<img class="ar-2d-marker-thumb" src="${escHtml(previewUrl)}" alt="" />`;
    } else {
      inner += `<span style="font-size:10px;font-weight:700;">#${idx + 1}</span>`;
    }
    marker.innerHTML = inner;

    // Mouse / Pointer Dragging on 2D stage
    marker.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      marker.setPointerCapture(ev.pointerId);
      marker.classList.add('dragging');

      const rect = ar2dPaper.getBoundingClientRect();
      const onMove = (moveEv) => {
        const relX = (moveEv.clientX - rect.left) / rect.width - 0.5;
        const relY = 0.5 - (moveEv.clientY - rect.top) / rect.height;
        const worldX = Number((relX * currentPageRatio).toFixed(2));
        const worldY = Number(relY.toFixed(2));

        card.querySelector('.layer-x').value = worldX.toFixed(2);
        card.querySelector('.layer-y').value = worldY.toFixed(2);
        marker.style.left = `${(relX + 0.5) * 100}%`;
        marker.style.top = `${(0.5 - relY) * 100}%`;
        stageCoordsReadout.textContent = `Laag #${idx + 1} → X: ${worldX.toFixed(2)} · Y: ${worldY.toFixed(2)}`;
      };

      const onUp = (upEv) => {
        marker.releasePointerCapture(upEv.pointerId);
        marker.classList.remove('dragging');
        marker.removeEventListener('pointermove', onMove);
        marker.removeEventListener('pointerup', onUp);
        recordLayerHistory();
      };

      marker.addEventListener('pointermove', onMove);
      marker.addEventListener('pointerup', onUp);
    });

    ar2dLayers.appendChild(marker);
  });
}

/* ==========================================================================
   SAVE ESSAY WITH XHR PROGRESS BAR
   ========================================================================== */

essayForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.add('hidden');
  formOk.classList.add('hidden');

  const weekVal = Number(fWeek.value);
  if (!Number.isInteger(weekVal) || weekVal < 1) {
    formError.textContent = 'Geef een geldig weeknummer op (>= 1).';
    formError.classList.remove('hidden');
    return;
  }

  const fd = new FormData();
  fd.append('week', String(weekVal));
  fd.append('title', fTitle.value.trim());
  fd.append('published_at', fPublished.value.trim());

  if (fPage.files?.[0]) {
    fd.append('page', fPage.files[0]);
  } else if (existingPagePath) {
    fd.append('existing_page', existingPagePath);
  } else {
    formError.textContent = 'Selecteer een krantenpagina-afbeelding.';
    formError.classList.remove('hidden');
    return;
  }

  const cards = Array.from(layersRows.querySelectorAll('.layer-card'));
  const layersPayload = [];

  cards.forEach((card, i) => {
    const fileInput = card.querySelector('.layer-file-input');
    const file = fileInput?.files?.[0];
    const existing = card.dataset.existingPath || '';
    if (!file && !existing) return;

    const layerMeta = {
      type: card.querySelector('.layer-type').value,
      position: {
        x: Number(card.querySelector('.layer-x').value) || 0,
        y: Number(card.querySelector('.layer-y').value) || 0,
        z: Number(card.querySelector('.layer-z').value) || 0,
      },
      scale: Number(card.querySelector('.layer-scale').value) || 1,
      rotation: {
        x: 0,
        y: 0,
        z: Number(card.querySelector('.layer-rotz').value) || 0,
      },
    };

    if (file) {
      const fieldName = `layer_file_${i}`;
      fd.append(fieldName, file);
      layerMeta.uploadField = fieldName;
    } else {
      layerMeta.path = existing;
    }

    layersPayload.push(layerMeta);
  });

  if (layersPayload.length === 0) {
    formError.textContent = 'Voeg ten minste één geldige AR-laag met mediabestand toe.';
    formError.classList.remove('hidden');
    return;
  }

  fd.append('layers', JSON.stringify(layersPayload));

  // Upload with XHR for real-time progress bar
  saveButton.disabled = true;
  uploadProgressWrap.classList.remove('hidden');
  uploadProgressFill.style.width = '0%';
  uploadProgressPct.textContent = '0%';
  uploadProgressText.textContent = 'Uploaden naar server…';

  try {
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/admin/essays`, true);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          uploadProgressFill.style.width = `${pct}%`;
          uploadProgressPct.textContent = `${pct}%`;
          if (pct >= 100) {
            uploadProgressText.textContent = '8th Wall target & AR-bundel verwerken…';
          }
        }
      };

      xhr.onload = () => {
        let parsed = {};
        try {
          parsed = JSON.parse(xhr.responseText || '{}');
        } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(parsed);
        } else {
          reject(new Error(parsed.error || `HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Netwerkfout tijdens uploaden.'));
      xhr.send(fd);
    });

    await loadEssays();
    if (result.essay) {
      startEditEssay(result.essay);
    }
    formOk.textContent = `Week #${weekVal} succesvol opgeslagen en 8th Wall target bijgewerkt!`;
    formOk.classList.remove('hidden');
  } catch (err) {
    formError.textContent = err.message;
    formError.classList.remove('hidden');
  } finally {
    saveButton.disabled = false;
    setTimeout(() => {
      uploadProgressWrap.classList.add('hidden');
    }, 900);
  }
});

/* ==========================================================================
   MEDIA SEARCH MODAL (MEMES / GIFS / SKETCHFAB 3D)
   ========================================================================== */

function openMediaSearchModal(targetLayerCard = null, tab = 'memes') {
  activeMediaSearchLayerRow =
    targetLayerCard ||
    layersRows.querySelector('.layer-card:last-child') ||
    addLayerRow();

  setMediaSearchTab(tab);
  mediaSearchModal.classList.remove('hidden');
  mediaSearchQuery.focus();
}

function setMediaSearchTab(tab) {
  activeMediaTab = tab;
  document.querySelectorAll('.media-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mediaTab === tab);
  });
  if (tab === '3d') {
    mediaSearchSub.classList.add('hidden');
    mediaSearchQuery.placeholder = 'Zoek downloadbare 3D modellen op Sketchfab (bv. chair, newspaper, statue)…';
  } else {
    mediaSearchSub.classList.remove('hidden');
    mediaSearchQuery.placeholder = 'Zoek memes of GIFs op Reddit (bv. cat, art, surreal)…';
  }
}

document.querySelectorAll('.media-tab').forEach((btn) => {
  btn.addEventListener('click', () => setMediaSearchTab(btn.dataset.mediaTab));
});

openMemeSearchBtn?.addEventListener('click', () => openMediaSearchModal(null, 'memes'));
open3dSearchBtn?.addEventListener('click', () => openMediaSearchModal(null, '3d'));

mediaSearchSubmit?.addEventListener('click', runMediaSearch);
mediaSearchQuery?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    runMediaSearch();
  }
});

async function runMediaSearch() {
  const q = mediaSearchQuery.value.trim();
  const sub = mediaSearchSub.value.trim() || 'memes';
  mediaSearchResults.innerHTML = '';
  mediaSearchStatus.textContent = 'Zoeken…';
  mediaSearchStatus.classList.remove('hidden');

  try {
    if (activeMediaTab === 'memes') {
      const data = await apiJson(
        `/admin/search/memes?q=${encodeURIComponent(q)}&sub=${encodeURIComponent(sub)}`
      );
      const items = data.items || [];
      if (items.length === 0) {
        mediaSearchStatus.textContent = 'Geen memes/GIFs gevonden.';
        return;
      }
      mediaSearchStatus.classList.add('hidden');
      mediaSearchResults.innerHTML = items
        .map(
          (item) => `
          <div class="media-result-card">
            <img class="media-result-thumb" src="${escHtml(item.preview || item.url)}" alt="" loading="lazy" />
            <div class="media-result-info">
              <div class="media-result-title" title="${escHtml(item.title)}">${escHtml(item.title)}</div>
              <button type="button" class="btn btn-sm btn-primary import-media-btn"
                data-kind="meme"
                data-url="${escHtml(item.url)}"
                data-title="${escHtml(item.title)}">
                Gebruik in laag
              </button>
            </div>
          </div>
        `
        )
        .join('');
    } else {
      const data = await apiJson(`/admin/search/3d?q=${encodeURIComponent(q || 'sculpture')}`);
      const items = data.items || [];
      if (items.length === 0) {
        mediaSearchStatus.textContent = 'Geen downloadbare 3D modellen gevonden.';
        return;
      }
      mediaSearchStatus.classList.add('hidden');
      mediaSearchResults.innerHTML = items
        .map(
          (item) => `
          <div class="media-result-card">
            <img class="media-result-thumb" src="${escHtml(item.thumb)}" alt="" loading="lazy" />
            <div class="media-result-info">
              <div class="media-result-title" title="${escHtml(item.name)}">${escHtml(item.name)}</div>
              <button type="button" class="btn btn-sm btn-primary import-media-btn"
                data-kind="sketchfab"
                data-uid="${escHtml(item.uid)}"
                data-title="${escHtml(item.name)}">
                Importeer GLB
              </button>
            </div>
          </div>
        `
        )
        .join('');
    }

    mediaSearchResults.querySelectorAll('.import-media-btn').forEach((btn) => {
      btn.addEventListener('click', () => importRemoteMediaIntoLayer(btn));
    });
  } catch (err) {
    mediaSearchStatus.textContent = `Fout: ${err.message}`;
  }
}

async function importRemoteMediaIntoLayer(btn) {
  const kind = btn.dataset.kind;
  const title = btn.dataset.title || 'asset';
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Downloaden…';

  try {
    const query =
      kind === 'sketchfab'
        ? `kind=sketchfab&uid=${encodeURIComponent(btn.dataset.uid)}`
        : `kind=url&url=${encodeURIComponent(btn.dataset.url)}`;

    const res = await fetch(`${API_BASE}/admin/fetch-remote-asset?${query}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const filenameHeader = res.headers.get('X-Asset-Filename');
    const safeName =
      filenameHeader ||
      `${title.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 32)}.${kind === 'sketchfab' ? 'glb' : 'jpg'}`;

    const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' });
    const targetCard = activeMediaSearchLayerRow || addLayerRow();
    const fileInput = targetCard.querySelector('.layer-file-input');

    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));

    mediaSearchModal.classList.add('hidden');
  } catch (err) {
    alert(`Importeren mislukt: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

/* ==========================================================================
   SETTINGS MODAL (8W TARGET REBUILD, EXPORT, SKETCHFAB, PASSWORD, WIPE)
   ========================================================================== */

settingsBtn?.addEventListener('click', async () => {
  settingsModal.classList.remove('hidden');
  try {
    const data = await apiJson('/admin/settings');
    sketchfabKeyStatus.textContent = data.hasSketchfabKey
      ? `Actieve sleutel: ${data.sketchfabKeyPreview}`
      : 'Nog geen Sketchfab API-sleutel ingesteld.';
  } catch (_) {}
});

rebuildTargetsBtn?.addEventListener('click', async () => {
  rebuildTargetsBtn.disabled = true;
  rebuildTargetsStatus.textContent = 'Bezig met controleren en herbouwen van 8th Wall targets…';
  try {
    const res = await apiJson('/admin/rebuild-targets', { method: 'POST' });
    rebuildTargetsStatus.textContent = `Klaar! ${res.rebuilt} van ${res.checked} edities herbouwd.`;
    await loadEssays();
  } catch (err) {
    rebuildTargetsStatus.textContent = `Fout: ${err.message}`;
  } finally {
    rebuildTargetsBtn.disabled = false;
  }
});

exportEssaysJsonBtn?.addEventListener('click', async () => {
  exportEssaysStatus.textContent = 'Backup voorbereiden…';
  try {
    const data = await apiJson('/admin/export/essays-json');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `krant-essays-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    exportEssaysStatus.textContent = `Backup gedownload (${data.count || 0} edities).`;
  } catch (err) {
    exportEssaysStatus.textContent = `Fout: ${err.message}`;
  }
});

saveSketchfabKeyBtn?.addEventListener('click', async () => {
  try {
    const res = await apiJson('/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ sketchfab_api_key: sketchfabApiKeyInput.value.trim() }),
    });
    sketchfabApiKeyInput.value = '';
    sketchfabKeyStatus.textContent = res.hasSketchfabKey
      ? '✓ Sketchfab API-sleutel opgeslagen.'
      : 'Sleutel gewist.';
  } catch (err) {
    sketchfabKeyStatus.textContent = `Fout: ${err.message}`;
  }
});

passwordForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  pwError.classList.add('hidden');
  pwOk.classList.add('hidden');
  try {
    await apiJson('/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: pwCurrent.value,
        newPassword: pwNew.value,
      }),
    });
    pwCurrent.value = '';
    pwNew.value = '';
    pwOk.textContent = 'Wachtwoord succesvol gewijzigd.';
    pwOk.classList.remove('hidden');
  } catch (err) {
    pwError.textContent = err.message;
    pwError.classList.remove('hidden');
  }
});

wipeAllBtn?.addEventListener('click', async () => {
  if (
    !confirm(
      'WAARSCHUWING: Dit verwijdert ALLE krant-edities en geüploade bestanden definitief! Doorgaan?'
    )
  ) {
    return;
  }
  try {
    await apiJson('/admin/wipe', { method: 'POST' });
    settingsModal.classList.add('hidden');
    await loadEssays();
    resetEditorForm();
  } catch (err) {
    alert(`Wissen mislukt: ${err.message}`);
  }
});

/* ==========================================================================
   MODAL CLOSE HANDLERS
   ========================================================================== */

document.querySelectorAll('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.closeModal;
    document.getElementById(id)?.classList.add('hidden');
  });
});

[mediaSearchModal, settingsModal, analyticsModal].forEach((modal) => {
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });
});

/* ==========================================================================
   ANALYTICS DASHBOARD MODAL (COOKIE-FREE JSONL + AR SCANS)
   ========================================================================== */

analyticsBtn?.addEventListener('click', () => {
  analyticsModal.classList.remove('hidden');
  loadKrantAnalytics(currentStatsDays);
});

async function loadKrantAnalytics(days = 30) {
  currentStatsDays = days;
  analyticsContent.innerHTML = `<div class="muted" style="padding:24px;">Statistieken voor de afgelopen ${days} dagen laden…</div>`;
  try {
    const data = await apiJson(`/admin/stats?days=${days}`);
    currentStatsData = data;
    renderKrantAnalytics(data);
  } catch (err) {
    analyticsContent.innerHTML = `<div class="error">Kon statistieken niet laden: ${escHtml(err.message)}</div>`;
  }
}

function renderTrendBadge(val, invertColors = false) {
  if (val === null || val === undefined) {
    return `<span class="krant-kpi-trend neutral">—</span>`;
  }
  const n = Number(val);
  if (n === 0) {
    return `<span class="krant-kpi-trend neutral">0%</span>`;
  }
  const isUp = n > 0;
  const good = invertColors ? !isUp : isUp;
  const cls = good ? 'up' : 'down';
  const arrow = isUp ? '↑' : '↓';
  return `<span class="krant-kpi-trend ${cls}">${arrow} ${isUp ? '+' : ''}${n}%</span>`;
}

function renderKrantAnalytics(data) {
  const kpis = data.kpis || {};
  const trends = kpis.trends || {};
  const daily = Array.isArray(data.daily) ? data.daily : [];
  const hourly = Array.isArray(data.hourly) ? data.hourly : new Array(24).fill(0);
  const topPages = Array.isArray(data.top_pages) ? data.top_pages : [];
  const referrers = Array.isArray(data.referrers) ? data.referrers : [];
  const devices = data.devices || {};
  const browsers = data.browsers || {};
  const languages = data.languages || {};
  const errors404 = Array.isArray(data.errors_404) ? data.errors_404 : [];
  const blockedScans = Array.isArray(data.blocked_scans) ? data.blocked_scans : [];
  const essayScans = Array.isArray(data.essay_scans) ? data.essay_scans : [];

  // Peak day
  let peakDay = null;
  let maxDailyViews = 1;
  daily.forEach((d) => {
    if (d.views > maxDailyViews) maxDailyViews = d.views;
    if (!peakDay || d.views > peakDay.views) peakDay = d;
  });

  const maxHourly = Math.max(1, ...hourly);

  analyticsContent.innerHTML = `
    <!-- Toolbar -->
    <div class="krant-stats-toolbar">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div class="krant-stats-live">
          <span class="krant-stats-live-dot"></span>
          <span>Nu online: ${Number(data.live_visitors) || 0} bezoekers</span>
        </div>
        <span class="muted small">Cookie-vrij · AVG/GDPR-proof · ${Number(kpis.ar_scans) || 0} AR-scans in periode</span>
      </div>
      <div class="krant-stats-controls">
        ${[
          { d: 1, label: '24u' },
          { d: 7, label: '7 dagen' },
          { d: 30, label: '30 dagen' },
          { d: 90, label: '90 dagen' },
          { d: 365, label: '365 dagen' },
        ]
          .map(
            (p) => `
          <button type="button" class="period-pill ${Number(data.period_days) === p.d ? 'active' : ''}" data-days="${p.d}">
            ${p.label}
          </button>
        `
          )
          .join('')}
        <button type="button" class="btn btn-sm btn-secondary" id="krant-export-csv-btn">⬇ CSV Export</button>
        <button type="button" class="btn btn-sm" id="krant-refresh-stats-btn">↻ Ververs</button>
      </div>
    </div>

    <!-- 6 KPI Cards -->
    <div class="krant-kpi-grid">
      <div class="krant-kpi-card">
        <span class="krant-kpi-label">Paginaweergaven</span>
        <div class="krant-kpi-value-row">
          <span class="krant-kpi-value">${Number(kpis.pageviews) || 0}</span>
          ${renderTrendBadge(trends.pageviews)}
        </div>
        <span class="krant-kpi-sub">Vorige periode: ${Number(kpis.prev?.pageviews) || 0}</span>
      </div>

      <div class="krant-kpi-card">
        <span class="krant-kpi-label">Unieke bezoekers</span>
        <div class="krant-kpi-value-row">
          <span class="krant-kpi-value">${Number(kpis.unique_visitors) || 0}</span>
          ${renderTrendBadge(trends.unique_visitors)}
        </div>
        <span class="krant-kpi-sub">Anonieme dag-hashes</span>
      </div>

      <div class="krant-kpi-card">
        <span class="krant-kpi-label">Sessies</span>
        <div class="krant-kpi-value-row">
          <span class="krant-kpi-value">${Number(kpis.sessions) || 0}</span>
          ${renderTrendBadge(trends.sessions)}
        </div>
        <span class="krant-kpi-sub">${Number(kpis.pages_per_session) || 0} pagina's / sessie</span>
      </div>

      <div class="krant-kpi-card">
        <span class="krant-kpi-label">Gem. leestijd</span>
        <div class="krant-kpi-value-row">
          <span class="krant-kpi-value">${formatDuration(kpis.avg_duration_sec)}</span>
          ${renderTrendBadge(trends.avg_duration_sec)}
        </div>
        <span class="krant-kpi-sub">Enkel actieve tabbladtijd</span>
      </div>

      <div class="krant-kpi-card">
        <span class="krant-kpi-label">Engaged Bounce Rate</span>
        <div class="krant-kpi-value-row">
          <span class="krant-kpi-value">${Number(kpis.bounce_rate) || 0}%</span>
          ${renderTrendBadge(trends.bounce_rate, true)}
        </div>
        <span class="krant-kpi-sub">1 pagina &lt; 15s leestijd</span>
      </div>

      <div class="krant-kpi-card">
        <span class="krant-kpi-label">Gefilterde Bots</span>
        <div class="krant-kpi-value-row">
          <span class="krant-kpi-value">${Number(kpis.bot_hits) || 0}</span>
          <span class="krant-kpi-trend neutral">Ratio ${Number(kpis.bot_ratio) || 0}%</span>
        </div>
        <span class="krant-kpi-sub">Crawlers &amp; scanners genegeerd</span>
      </div>
    </div>

    <!-- Daily & 24h Charts -->
    <div class="krant-charts-grid">
      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <h4>Dagelijkse weergaven &amp; bezoekers</h4>
          <span class="muted small" id="krant-daily-hover-readout">
            ${peakDay && peakDay.views > 0 ? `Piekdag: ${peakDay.label} (${peakDay.views} views, ${peakDay.visitors} bezoekers)` : 'Beweeg over een kolom voor details'}
          </span>
        </div>
        <div class="krant-vchart">
          ${daily
            .map((d, idx) => {
              const viewsH = Math.max(d.views > 0 ? 4 : 1, Math.round((d.views / maxDailyViews) * 100));
              const visH = Math.max(d.visitors > 0 ? 3 : 0, Math.round((d.visitors / maxDailyViews) * 100));
              const showLabel =
                daily.length <= 14 || idx === 0 || idx === daily.length - 1 || idx % Math.ceil(daily.length / 8) === 0;
              return `
                <div class="krant-vbar-col" data-label="${escHtml(d.label)}" data-views="${d.views}" data-visitors="${d.visitors}" data-sessions="${d.sessions}">
                  <div class="krant-vbar-stack">
                    <div class="krant-vbar-views" style="height:${viewsH}%;"></div>
                    <div class="krant-vbar-visitors" style="height:${visH}%;"></div>
                  </div>
                  <span class="krant-vbar-label">${showLabel ? escHtml(d.label) : ''}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>

      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <h4>Verkeer per uur (24u)</h4>
          <span class="muted small" id="krant-hourly-hover-readout">00:00 – 23:00</span>
        </div>
        <div class="krant-vchart">
          ${hourly
            .map((count, h) => {
              const hPct = Math.max(count > 0 ? 4 : 1, Math.round((count / maxHourly) * 100));
              const lbl = String(h).padStart(2, '0');
              return `
                <div class="krant-vbar-col krant-hour-col" data-hour="${lbl}:00" data-count="${count}">
                  <div class="krant-vbar-stack">
                    <div class="krant-vbar-views" style="height:${hPct}%;"></div>
                  </div>
                  <span class="krant-vbar-label">${h % 4 === 0 ? lbl : ''}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>

    <!-- Top Pages & Traffic Sources -->
    <div class="krant-panels-grid">
      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <h4>Top pagina's (${topPages.length})</h4>
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="search" id="krant-pages-filter" placeholder="Filter pagina…" style="width:150px;padding:4px 8px;font-size:11px;" />
            ${
              topPages.length > 8
                ? `<button type="button" class="btn btn-sm" id="krant-toggle-all-pages">${showAllTopPages ? 'Toon top 8' : `Toon alles (${topPages.length})`}</button>`
                : ''
            }
          </div>
        </div>
        <div class="table-scroll">
          <table class="studio-table" id="krant-top-pages-table">
            <thead>
              <tr>
                <th>Pagina</th>
                <th>Weergaven</th>
                <th>Bezoekers</th>
                <th>Gem. tijd</th>
              </tr>
            </thead>
            <tbody>
              ${renderTopPagesRows(topPages)}
            </tbody>
          </table>
        </div>
      </div>

      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <h4>Verkeersbronnen &amp; Acquisitie</h4>
          <span class="muted small">Eerste externe referrer</span>
        </div>
        <div class="table-scroll">
          <table class="studio-table">
            <thead>
              <tr>
                <th>Bron / Kanaal</th>
                <th>Sessies</th>
                <th>Aandeel</th>
              </tr>
            </thead>
            <tbody>
              ${
                referrers.length === 0
                  ? `<tr><td colspan="3" class="muted">Nog geen sessies geregistreerd.</td></tr>`
                  : referrers
                      .map(
                        (r) => `
                    <tr>
                      <td><strong>${escHtml(r.source)}</strong></td>
                      <td>${r.count}</td>
                      <td>
                        <div>${r.pct}%</div>
                        <div class="krant-share-bar"><div class="krant-share-fill" style="width:${r.pct}%;"></div></div>
                      </td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Krant Editions AR Scans & Technical Breakdown -->
    <div class="krant-panels-grid">
      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <h4>AR Krant-edities: Scans &amp; Weergaven</h4>
          <span class="muted small">8th Wall Image Target triggers</span>
        </div>
        <div class="table-scroll">
          <table class="studio-table">
            <thead>
              <tr>
                <th>Editie</th>
                <th>Titel</th>
                <th>AR Scans (Periode / Totaal)</th>
                <th>Views (Totaal)</th>
              </tr>
            </thead>
            <tbody>
              ${
                essayScans.length === 0
                  ? `<tr><td colspan="4" class="muted">Geen edities gevonden.</td></tr>`
                  : essayScans
                      .map(
                        (es) => `
                    <tr>
                      <td><strong>Week #${es.week}</strong></td>
                      <td>${escHtml(es.title)}</td>
                      <td><strong>${es.period_scans}</strong> <span class="muted small">/ ${es.total_scans} totaal</span></td>
                      <td>${es.total_views}</td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <h4>Apparaten, Browsers &amp; Talen</h4>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:11px;">
          <div>
            <strong>Apparaten</strong>
            <ul style="list-style:none;padding:0;margin:6px 0 0;">
              ${Object.entries(devices)
                .map(([k, v]) => `<li style="display:flex;justify-content:space-between;padding:2px 0;"><span>${escHtml(k)}</span><strong>${v}</strong></li>`)
                .join('')}
            </ul>
          </div>
          <div>
            <strong>Browsers</strong>
            <ul style="list-style:none;padding:0;margin:6px 0 0;">
              ${Object.entries(browsers)
                .map(([k, v]) => `<li style="display:flex;justify-content:space-between;padding:2px 0;"><span>${escHtml(k)}</span><strong>${v}</strong></li>`)
                .join('')}
            </ul>
          </div>
          <div>
            <strong>Talen</strong>
            <ul style="list-style:none;padding:0;margin:6px 0 0;">
              ${
                Object.keys(languages).length === 0
                  ? `<li class="muted">—</li>`
                  : Object.entries(languages)
                      .map(([k, v]) => `<li style="display:flex;justify-content:space-between;padding:2px 0;"><span>${escHtml(k.toUpperCase())}</span><strong>${v}</strong></li>`)
                      .join('')
              }
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Real 404 Errors vs Blocked Vulnerability Scans -->
    <div class="krant-panels-grid">
      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <h4>Echte Bezoekers-404's (${errors404.length})</h4>
          ${
            errors404.length > 0
              ? `<button type="button" class="btn btn-sm btn-danger" id="krant-dismiss-all-404">Wis alles</button>`
              : ''
          }
        </div>
        <div class="table-scroll">
          <table class="studio-table">
            <thead>
              <tr>
                <th>Pad</th>
                <th>Hits</th>
                <th>Herkomst</th>
                <th>Actie</th>
              </tr>
            </thead>
            <tbody>
              ${
                errors404.length === 0
                  ? `<tr><td colspan="4" class="muted">Geen onopgeloste 404-meldingen van echte bezoekers.</td></tr>`
                  : errors404
                      .map(
                        (err) => `
                    <tr>
                      <td><code>${escHtml(err.page)}</code></td>
                      <td><strong>${err.count}</strong></td>
                      <td class="muted small">${escHtml(err.last_ref || 'Direct')}</td>
                      <td>
                        <button type="button" class="icon-btn danger dismiss-404-btn" data-page="${escHtml(err.page)}" title="Markeer als opgelost">✕</button>
                      </td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <h4>Geblokkeerde Bot- &amp; Kwetsbaarheidsscans (${blockedScans.length})</h4>
          <span class="muted small">Automatisch gefilterd</span>
        </div>
        <div class="table-scroll">
          <table class="studio-table">
            <thead>
              <tr>
                <th>Gezocht pad</th>
                <th>Pogingen</th>
              </tr>
            </thead>
            <tbody>
              ${
                blockedScans.length === 0
                  ? `<tr><td colspan="2" class="muted">Geen kwetsbaarheidsscans gedetecteerd in deze periode.</td></tr>`
                  : blockedScans
                      .map(
                        (s) => `
                    <tr>
                      <td><code class="muted">${escHtml(s.page)}</code></td>
                      <td>${s.count}</td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Wire up analytics interactions
  analyticsContent.querySelectorAll('.period-pill').forEach((btn) => {
    btn.addEventListener('click', () => loadKrantAnalytics(Number(btn.dataset.days)));
  });

  document.getElementById('krant-refresh-stats-btn')?.addEventListener('click', () => {
    loadKrantAnalytics(currentStatsDays);
  });

  document.getElementById('krant-export-csv-btn')?.addEventListener('click', () => {
    exportKrantAnalyticsCsv(data);
  });

  // Hover readouts for daily & hourly charts
  const dailyReadout = document.getElementById('krant-daily-hover-readout');
  analyticsContent.querySelectorAll('.krant-vbar-col[data-views]').forEach((col) => {
    col.addEventListener('mouseenter', () => {
      if (dailyReadout) {
        dailyReadout.textContent = `${col.dataset.label}: ${col.dataset.views} weergaven · ${col.dataset.visitors} unieke bezoekers · ${col.dataset.sessions} sessies`;
      }
    });
  });

  const hourlyReadout = document.getElementById('krant-hourly-hover-readout');
  analyticsContent.querySelectorAll('.krant-hour-col').forEach((col) => {
    col.addEventListener('mouseenter', () => {
      if (hourlyReadout) {
        hourlyReadout.textContent = `${col.dataset.hour} — ${col.dataset.count} weergaven`;
      }
    });
  });

  // Top pages search & show-all
  const pagesFilter = document.getElementById('krant-pages-filter');
  const pagesTbody = document.querySelector('#krant-top-pages-table tbody');
  pagesFilter?.addEventListener('input', () => {
    const q = pagesFilter.value.trim().toLowerCase();
    const filtered = topPages.filter(
      (p) => p.page.toLowerCase().includes(q) || (p.title || '').toLowerCase().includes(q)
    );
    if (pagesTbody) pagesTbody.innerHTML = renderTopPagesRows(filtered, true);
  });

  document.getElementById('krant-toggle-all-pages')?.addEventListener('click', () => {
    showAllTopPages = !showAllTopPages;
    renderKrantAnalytics(currentStatsData);
  });

  // Dismiss 404s
  analyticsContent.querySelectorAll('.dismiss-404-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await apiJson('/admin/stats/dismiss-404', {
        method: 'POST',
        body: JSON.stringify({ page: btn.dataset.page }),
      });
      await loadKrantAnalytics(currentStatsDays);
    });
  });

  document.getElementById('krant-dismiss-all-404')?.addEventListener('click', async () => {
    await apiJson('/admin/stats/dismiss-404', {
      method: 'POST',
      body: JSON.stringify({ page: '__ALL__' }),
    });
    await loadKrantAnalytics(currentStatsDays);
  });
}

function renderTopPagesRows(pages, forceAll = false) {
  if (!pages || pages.length === 0) {
    return `<tr><td colspan="4" class="muted">Nog geen paginaweergaven.</td></tr>`;
  }
  const list = forceAll || showAllTopPages ? pages : pages.slice(0, 8);
  return list
    .map(
      (p) => `
      <tr>
        <td>
          <div><a href="${escHtml(p.page)}" target="_blank" rel="noopener"><strong>${escHtml(p.title || p.page)}</strong></a></div>
          <div class="muted small">${escHtml(p.page)}</div>
          <div class="krant-share-bar"><div class="krant-share-fill" style="width:${p.pct}%;"></div></div>
        </td>
        <td><strong>${p.views}</strong> <span class="muted small">(${p.pct}%)</span></td>
        <td>${p.visitors}</td>
        <td>${formatDuration(p.avg_dwell_sec)}</td>
      </tr>
    `
    )
    .join('');
}

function exportKrantAnalyticsCsv(data) {
  const lines = [
    ['Type', 'Datum/Pad', 'Titel', 'Weergaven', 'Unieke Bezoekers', 'Sessies/GemTijdSec'].join(','),
  ];
  (data.daily || []).forEach((d) => {
    lines.push(['DAG', d.date, d.label, d.views, d.visitors, d.sessions].join(','));
  });
  (data.top_pages || []).forEach((p) => {
    const cleanTitle = `"${String(p.title || '').replace(/"/g, '""')}"`;
    lines.push(['PAGINA', `"${p.page}"`, cleanTitle, p.views, p.visitors, p.avg_dwell_sec].join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `krant-analytics-${data.period_days}d-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Start
checkAuthState();
