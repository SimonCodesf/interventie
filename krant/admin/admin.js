/* ==========================================================================
   DE KRANT — STUDIO ADMIN & ANALYTICS CONTROLLER
   Vanilla JS (ES2020+) — Geen emoji's, ingebouwde pagina's, 1:1 AR-schaal
   ========================================================================== */

const API = '../api.php';

// State
let allEssays = [];
let editingWeek = null;
let existingPageUrl = '';
let pageAspect = 0.7071;
let selectedStageLayerIdx = -1; // -1 = alle lagen interactief, >= 0 = specifieke laag actief
let activeMediaSearchLayerRow = null;
let activeMediaTab = 'memes';
let currentStatsDays = 30;
let currentStatsData = null;
let showAllTopPages = false;
let currentMainView = 'editor'; // 'editor' | 'analytics' | 'settings'

// Undo / Redo history for layer configurations
let layerHistory = [];
let layerHistoryIndex = -1;
let isRestoringHistory = false;

// DOM Elements — Auth & Shell
const setupView = document.getElementById('setup-view');
const loginView = document.getElementById('login-view');
const panelView = document.getElementById('panel-view');

const setupForm = document.getElementById('setup-form');
const setupPassword = document.getElementById('setup-password');
const setupPassword2 = document.getElementById('setup-password2');
const setupError = document.getElementById('setup-error');

const loginForm = document.getElementById('login-form');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

// Sidebar & Built-in Page Views
const sidebarPosLink = document.getElementById('sidebar-pos-link');
const resetFormBtn = document.getElementById('reset-form');
const navEditorBtn = document.getElementById('nav-editor-btn');
const analyticsBtn = document.getElementById('analytics-btn');
const settingsBtn = document.getElementById('settings-btn');
const logoutBtn = document.getElementById('logout-button');
const sidebarEssayCount = document.getElementById('sidebar-essay-count');
const sidebarSearch = document.getElementById('sidebar-search');
const sidebarEssayList = document.getElementById('sidebar-essay-list');

const viewEditor = document.getElementById('view-editor');
const viewAnalytics = document.getElementById('view-analytics');
const viewSettings = document.getElementById('view-settings');
const backFromAnalyticsBtn = document.getElementById('back-to-editor-from-analytics');
const backFromSettingsBtn = document.getElementById('back-to-editor-from-settings');

// Editor DOM
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
const stageLayerSelect = document.getElementById('stage-layer-select');
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

// Media Search Modal
const mediaSearchModal = document.getElementById('media-search-modal');
const mediaSearchQuery = document.getElementById('media-search-query');
const mediaSearchSub = document.getElementById('media-search-sub');
const mediaSearchSubmit = document.getElementById('media-search-submit');
const mediaSearchStatus = document.getElementById('media-search-status');
const mediaSearchResults = document.getElementById('media-search-results');

// Settings Page Elements
const rebuildTargetsBtn = document.getElementById('rebuild-targets-btn');
const rebuildTargetsStatus = document.getElementById('rebuild-targets-status');
const exportEssaysJsonBtn = document.getElementById('export-essays-json-btn');
const exportEssaysStatus = document.getElementById('export-essays-status');
const sketchfabApiKeyInput = document.getElementById('sketchfab-api-key');
const saveSketchfabKeyBtn = document.getElementById('save-sketchfab-key-btn');
const sketchfabKeyStatus = document.getElementById('sketchfab-key-status');
const optoutStatusBadge = document.getElementById('optout-status-badge');
const optoutToggleBtn = document.getElementById('optout-toggle-btn');
const optoutCurrentHint = document.getElementById('optout-current-hint');
const optoutUrlInput = document.getElementById('optout-url-input');
const optoutCopyUrlBtn = document.getElementById('optout-copy-url-btn');
const optoutQrImg = document.getElementById('optout-qr-img');
const passwordForm = document.getElementById('password-form');
const pwCurrent = document.getElementById('pw-current');
const pwNew = document.getElementById('pw-new');
const pwError = document.getElementById('pw-error');
const pwOk = document.getElementById('pw-ok');
const wipeAllBtn = document.getElementById('wipe-all');

// Analytics Page Container
const analyticsContent = document.getElementById('analytics-content');

/* ==========================================================================
   HELPERS & API FETCH
   ========================================================================== */

function isoWeek() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-' + String(week).padStart(2, '0');
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseName(url) {
  return String(url || '')
    .split('/')
    .pop()
    .split('?')[0];
}

function fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(sec) {
  const s = Math.round(Number(sec) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function resolveAssetUrl(relPath) {
  if (!relPath) return '';
  if (/^(https?:|blob:|data:|\.\.\/)/i.test(relPath)) return relPath;
  return `../${String(relPath).replace(/^\/+/, '')}`;
}

async function apiJson(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch (_) {}
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

/* ==========================================================================
   BUILT-IN PAGE NAVIGATION (EDITOR / ANALYTICS / SETTINGS)
   ========================================================================== */

function switchMainView(viewName) {
  currentMainView = viewName;

  viewEditor?.classList.toggle('hidden', viewName !== 'editor');
  viewAnalytics?.classList.toggle('hidden', viewName !== 'analytics');
  viewSettings?.classList.toggle('hidden', viewName !== 'settings');

  navEditorBtn?.classList.toggle('active-view', viewName === 'editor');
  analyticsBtn?.classList.toggle('active-view', viewName === 'analytics');
  settingsBtn?.classList.toggle('active-view', viewName === 'settings');

  if (viewName === 'analytics') {
    loadKrantAnalytics(currentStatsDays);
  } else if (viewName === 'settings') {
    loadSettingsStatus();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navEditorBtn?.addEventListener('click', () => switchMainView('editor'));
analyticsBtn?.addEventListener('click', () => switchMainView('analytics'));
settingsBtn?.addEventListener('click', () => switchMainView('settings'));
backFromAnalyticsBtn?.addEventListener('click', () => switchMainView('editor'));
backFromSettingsBtn?.addEventListener('click', () => switchMainView('editor'));

/* ==========================================================================
   VIEWS & AUTHENTICATION
   ========================================================================== */

function showSetup() {
  setupView.style.display = 'flex';
  loginView.style.display = 'none';
  panelView.style.display = 'none';
}

function showLogin() {
  setupView.style.display = 'none';
  loginView.style.display = 'flex';
  panelView.style.display = 'none';
}

function showPanel() {
  setupView.style.display = 'none';
  loginView.style.display = 'none';
  panelView.style.display = 'grid';
  loadEssays();
}

setupForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setupError.textContent = '';
  const p1 = setupPassword.value;
  const p2 = setupPassword2 ? setupPassword2.value : p1;

  if (p1 !== p2) {
    setupError.textContent = 'Wachtwoorden komen niet overeen';
    return;
  }

  try {
    await apiJson('/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ password: p1 }),
    });
    setupPassword.value = '';
    if (setupPassword2) setupPassword2.value = '';
    showPanel();
  } catch (err) {
    setupError.textContent = err.message || 'Opslaan mislukt';
  }
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const btn = loginForm.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    await apiJson('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: loginPassword.value }),
    });
    loginPassword.value = '';
    setAnalyticsIgnored(true); // Sluit admin-browser automatisch uit van statistieken
    showPanel();
  } catch (err) {
    loginError.textContent = err.message || 'Fout wachtwoord';
  } finally {
    if (btn) btn.disabled = false;
  }
});

logoutBtn?.addEventListener('click', async () => {
  try {
    await apiJson('/admin/logout', { method: 'POST' });
  } catch (_) {}
  showLogin();
});

/* ==========================================================================
   LOAD & RENDER ESSAYS (SIDEBAR + TABLE)
   ========================================================================== */

async function loadEssays() {
  try {
    const res = await fetch(`${API}/admin/essays`, { credentials: 'same-origin' });
    if (res.status === 401) {
      showLogin();
      return;
    }
    const data = await res.json();
    allEssays = Array.isArray(data.essays) ? data.essays : [];
    if (sidebarEssayCount) sidebarEssayCount.textContent = String(allEssays.length);
    renderSidebarEssays();
    renderEssaysTable();
  } catch (err) {
    console.error('Failed to load essays:', err);
  }
}

function renderSidebarEssays() {
  if (!sidebarEssayList) return;
  const q = (sidebarSearch?.value || '').trim().toLowerCase();
  const filtered = allEssays.filter((e) => {
    if (!q) return true;
    return (
      String(e.week).toLowerCase().includes(q) ||
      (e.title || '').toLowerCase().includes(q)
    );
  });

  if (filtered.length === 0) {
    sidebarEssayList.innerHTML = `<div class="bundle-info" style="padding:12px;">Geen edities gevonden.</div>`;
    return;
  }

  sidebarEssayList.innerHTML = filtered
    .map((e) => {
      const isActive = editingWeek === e.week;
      const hasTarget = Boolean(e.has_target8w || e.target8w);
      const thumbUrl = resolveAssetUrl(e.page_image);
      const layerCount = e.layers_count ?? (Array.isArray(e.layers) ? e.layers.length : 0);
      const scanCount = Number(e.scans) || 0;
      const pubBadge = e.published ? 'LIVE' : 'CONCEPT';
      return `
        <button type="button" class="sidebar-essay-item ${isActive ? 'active' : ''}" data-week="${escHtml(e.week)}">
          ${
            thumbUrl
              ? `<img class="sidebar-essay-thumb" src="${escHtml(thumbUrl)}" alt="${escHtml(e.week)}" loading="lazy" />`
              : `<div class="sidebar-essay-thumb"></div>`
          }
          <div class="sidebar-essay-meta">
            <div class="sidebar-essay-top">
              <span class="sidebar-essay-week">${escHtml(e.week)}</span>
              <span>${pubBadge}</span>
            </div>
            <div class="sidebar-essay-title">${escHtml(e.title || e.week)}</div>
            <div class="sidebar-essay-stats">
              <span><i class="${hasTarget ? 'dot-ready' : 'dot-missing'}"></i> ${hasTarget ? '8W' : 'Geen 8W'}</span>
              <span>| ${layerCount} lagen</span>
              <span>| ${scanCount} scans</span>
            </div>
          </div>
        </button>
      `;
    })
    .join('');

  sidebarEssayList.querySelectorAll('.sidebar-essay-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchMainView('editor');
      loadIntoForm(btn.dataset.week);
    });
  });
}

sidebarSearch?.addEventListener('input', renderSidebarEssays);

function renderEssaysTable() {
  if (!essaysTableBody) return;
  if (allEssays.length === 0) {
    essaysTableBody.innerHTML = `<tr><td colspan="6" style="color:#777">Nog geen edities.</td></tr>`;
    return;
  }

  essaysTableBody.innerHTML = allEssays
    .map((essay) => {
      const layerCount = essay.layers_count ?? (Array.isArray(essay.layers) ? essay.layers.length : 0);
      const scans = Number(essay.scans) || 0;
      return `
        <tr>
          <td><strong>${escHtml(essay.week)}</strong></td>
          <td>${escHtml(essay.title)}</td>
          <td>
            <span class="badge ${essay.published ? 'live' : 'draft'}">
              ${essay.published ? 'live' : 'draft'}
            </span>
          </td>
          <td>${layerCount} <span class="hint">(${fmtBytes(essay.total_bytes || 0)})</span></td>
          <td>${scans}</td>
          <td class="actions">
            <button type="button" class="ghost small-btn pub-row-btn" data-week="${escHtml(essay.week)}" data-pub="${essay.published ? 1 : 0}">
              ${essay.published ? 'OFFLINE' : 'PUBLICEER'}
            </button>
            <button type="button" class="ghost small-btn edit-row-btn" data-week="${escHtml(essay.week)}">BEWERK</button>
            <a class="btn ghost small-btn" href="../position/?week=${encodeURIComponent(essay.week)}" title="Open in 3D AR Positioneer-tool">3D POS</a>
            <button type="button" class="danger small-btn del-row-btn" data-week="${escHtml(essay.week)}">WIS</button>
          </td>
        </tr>
      `;
    })
    .join('');

  essaysTableBody.querySelectorAll('.pub-row-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextPub = Number(btn.dataset.pub) === 1 ? 0 : 1;
      togglePublish(btn.dataset.week, nextPub);
    });
  });

  essaysTableBody.querySelectorAll('.edit-row-btn').forEach((btn) => {
    btn.addEventListener('click', () => loadIntoForm(btn.dataset.week));
  });

  essaysTableBody.querySelectorAll('.del-row-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteEssay(btn.dataset.week));
  });
}

async function togglePublish(week, published) {
  try {
    await apiJson(`/admin/essays/${encodeURIComponent(week)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ published }),
    });
    await loadEssays();
  } catch (err) {
    alert(`Publicatiestatus wijzigen mislukt: ${err.message}`);
  }
}

/* ==========================================================================
   PAGE ASPECT RATIO & 8TH WALL TARGET DIMENSIONS
   ========================================================================== */

/**
 * Exact dezelfde fitSize-berekening als krant/js/app.js en krant/position/position.js:
 * In 8th Wall heeft het planar image target:
 * - Bij staande pagina (aspect <= 1): breedte = aspect, hoogte = 1.0
 * - Bij liggende pagina (aspect > 1): breedte = 1.0, hoogte = 1.0 / aspect
 */
function fittedSizeNum() {
  const a = pageAspect > 0 ? pageAspect : 0.7071;
  if (a <= 1) {
    return { w: a, h: 1 };
  }
  return { w: 1, h: 1 / a };
}

function fittedSize() {
  const f = fittedSizeNum();
  return { w: f.w.toFixed(3), h: f.h.toFixed(3) };
}

function updatePagePreview(url, fileMetaText = '', revoke = false) {
  if (!url) {
    pagePreviewWrap.style.display = 'none';
    ar2dPaper.style.backgroundImage = 'none';
    return;
  }

  const resolved = resolveAssetUrl(url);
  pagePreviewWrap.style.display = 'block';
  pagePreviewImg.onload = () => {
    if (pagePreviewImg.naturalWidth > 0 && pagePreviewImg.naturalHeight > 0) {
      pageAspect = pagePreviewImg.naturalWidth / pagePreviewImg.naturalHeight;
      pageDimensionsInfo.textContent = `${pagePreviewImg.naturalWidth} × ${pagePreviewImg.naturalHeight} px (verhouding B/H: ${pageAspect.toFixed(3)})`;
      ar2dPaper.style.aspectRatio = String(pageAspect);
      render2dStage();
    }
    if (revoke) URL.revokeObjectURL(url);
  };
  pagePreviewImg.src = resolved;
  ar2dPaper.style.backgroundImage = `url("${resolved}")`;
  const placeholder = ar2dPaper.querySelector('.ar-2d-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  if (fileMetaText) pageFileInfo.textContent = fileMetaText;
}

fPage?.addEventListener('change', () => {
  const file = fPage.files?.[0];
  if (!file) return;
  const blobUrl = URL.createObjectURL(file);
  updatePagePreview(blobUrl, `Geselecteerd: ${file.name} (${fmtBytes(file.size)})`, false);
  updateSummaryChecklist();
});

fWeek?.addEventListener('change', async () => {
  const week = fWeek.value.trim();
  if (!week) {
    weekHint.textContent = '';
    updateSummaryChecklist();
    return;
  }
  try {
    const res = await fetch(`${API}/admin/essays/${encodeURIComponent(week)}`, {
      credentials: 'same-origin',
    });
    if (res.ok) {
      weekHint.textContent =
        'Deze week bestaat al — opslaan OVERSCHRIJFT dat essay. Gebruik een andere week voor een nieuw essay.';
    } else if (res.status === 404) {
      weekHint.textContent = 'Nieuwe week — wordt een nieuw essay.';
    } else {
      weekHint.textContent = '';
    }
  } catch (_) {
    weekHint.textContent = '';
  }
  updateSummaryChecklist();
});

fWeek?.addEventListener('input', updateSummaryChecklist);
fTitle?.addEventListener('input', updateSummaryChecklist);
fPublished?.addEventListener('change', updateSummaryChecklist);

/* ==========================================================================
   LOAD INTO FORM / RESET / DUPLICATE / DELETE
   ========================================================================== */

async function loadIntoForm(week) {
  try {
    const data = await apiJson(`/admin/essays/${encodeURIComponent(week)}`);
    const essay = data.essay;
    if (!essay) return;

    editingWeek = essay.week;
    existingPageUrl = essay.page_image || '';
    selectedStageLayerIdx = -1;

    // Lees alvast synchroon de exacte pagina-verhouding uit target8w.properties (indien aanwezig)
    const props = essay.target8w && essay.target8w.properties;
    const ow = parseFloat(props && (props.originalWidth || props.width));
    const oh = parseFloat(props && (props.originalHeight || props.height));
    if (ow > 0 && oh > 0) {
      pageAspect = ow / oh;
      ar2dPaper.style.aspectRatio = String(pageAspect);
      pageDimensionsInfo.textContent = `${ow} × ${oh} px (verhouding B/H: ${pageAspect.toFixed(3)})`;
    }

    editorModeBadge.textContent = `BEWERK EDITIE // ${essay.week}`;
    editorModeBadge.classList.add('editing');
    formHeading.textContent = `Bewerken: ${essay.week} — ${essay.title || ''}`;
    fWeek.value = essay.week;
    fTitle.value = essay.title || '';
    fPublished.checked = Boolean(essay.published);
    fPage.value = '';
    weekHint.textContent = `Bestaande editie (${essay.week})`;

    const posUrl = `../position/?week=${encodeURIComponent(essay.week)}`;
    if (headerPositionLink) headerPositionLink.href = posUrl;
    if (sidebarPosLink) sidebarPosLink.href = posUrl;
    if (duplicateEssayBtn) duplicateEssayBtn.style.display = 'inline-flex';
    if (deleteCurrentBtn) deleteCurrentBtn.style.display = 'inline-flex';

    if (essay.page_image) {
      updatePagePreview(
        essay.page_image,
        `Huidige pagina: ${baseName(essay.page_image)} (${fmtBytes(essay.page_bytes || 0)}) — kies een nieuw bestand om te vervangen`
      );
    } else {
      updatePagePreview('', 'Nog geen pagina-afbeelding.');
    }

    if (essay.target8w) {
      target8wBadge.textContent = '8W TARGET ACTIEF';
      target8wBadge.className = 'status-pill ok';
      target8wStatus.textContent = `8th Wall target aanwezig: ${essay.target8w.name}`;
    } else {
      target8wBadge.textContent = 'GEEN 8W TARGET';
      target8wBadge.className = 'status-pill warn';
      target8wStatus.textContent = 'Nog geen 8th Wall target voor dit essay.';
    }

    const fit = fittedSizeNum();
    layersRows.innerHTML = '';
    const layers = Array.isArray(essay.layers) ? essay.layers : [];
    layers.forEach((layer) => {
      addLayerRow({
        x: layer.x || 0,
        y: layer.y || 0,
        z: layer.z !== undefined ? layer.z : 0.01,
        w: layer.w > 0 ? layer.w : fit.w.toFixed(3),
        h: layer.h > 0 ? layer.h : fit.h.toFixed(3),
        opacity: layer.opacity !== undefined ? layer.opacity : 1,
        rx: layer.rx || 0,
        ry: layer.ry || 0,
        rz: layer.rz || 0,
        scale: layer.scale > 0 ? layer.scale : 1,
        lit: layer.lit ? 1 : 0,
        anim_dur: layer.anim_dur || 0,
        anim_x: layer.anim_x || 0,
        anim_y: layer.anim_y || 0,
        anim_z: layer.anim_z !== undefined ? layer.anim_z : (layer.z || 0.01),
        existingFile: baseName(layer.file),
        existingUrl: layer.file,
        existingSize: layer.bytes || 0,
      });
    });
    if (layers.length === 0) addLayerRow();

    layerHistory = [];
    layerHistoryIndex = -1;
    recordLayerHistory();

    formError.textContent = '';
    formOk.textContent =
      'Bestaande bestanden (pagina/marker/layers) blijven behouden als je geen nieuw bestand kiest.';

    renderSidebarEssays();
    updateSummaryChecklist();
    render2dStage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    formError.textContent = err.message;
  }
}

function resetForm(keepWeek) {
  editingWeek = null;
  existingPageUrl = '';
  pageAspect = 0.7071;
  selectedStageLayerIdx = -1;

  editorModeBadge.textContent = 'NIEUWE EDITIE';
  editorModeBadge.classList.remove('editing');
  formHeading.textContent = 'Nieuw essay';
  fWeek.value = keepWeek || isoWeek();
  fTitle.value = '';
  fPage.value = '';
  fPublished.checked = true;
  weekHint.textContent = '';

  if (duplicateEssayBtn) duplicateEssayBtn.style.display = 'none';
  if (deleteCurrentBtn) deleteCurrentBtn.style.display = 'none';
  if (headerPositionLink) headerPositionLink.href = '../position/';
  if (sidebarPosLink) sidebarPosLink.href = '../position/';

  pagePreviewWrap.style.display = 'none';
  pageFileInfo.textContent = 'Nog geen bestand geselecteerd.';
  target8wBadge.textContent = 'Auto-Target';
  target8wBadge.className = 'status-pill neutral';
  target8wStatus.textContent = '';

  ar2dPaper.style.backgroundImage = 'none';
  ar2dPaper.style.aspectRatio = '0.7071';
  const placeholder = ar2dPaper.querySelector('.ar-2d-placeholder');
  if (placeholder) placeholder.style.display = 'flex';

  layersRows.innerHTML = '';
  addLayerRow();

  layerHistory = [];
  layerHistoryIndex = -1;
  recordLayerHistory();

  formError.textContent = '';
  formOk.textContent = '';
  renderSidebarEssays();
  updateSummaryChecklist();
  render2dStage();
}

resetFormBtn?.addEventListener('click', () => {
  switchMainView('editor');
  resetForm();
});

duplicateEssayBtn?.addEventListener('click', async () => {
  if (!editingWeek) return;
  const targetWeek = prompt(
    `Naar welke week-code wil je "${editingWeek}" dupliceren?`,
    isoWeek()
  );
  if (!targetWeek) return;

  try {
    const res = await apiJson(`/admin/essays/${encodeURIComponent(editingWeek)}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ to_week: targetWeek.trim() }),
    });
    await loadEssays();
    if (res.essay) {
      await loadIntoForm(res.essay.week);
      formOk.textContent = `Editie gedupliceerd naar ${res.essay.week}.`;
    }
  } catch (err) {
    alert(`Dupliceren mislukt: ${err.message}`);
  }
});

deleteCurrentBtn?.addEventListener('click', () => {
  if (editingWeek) deleteEssay(editingWeek);
});

async function deleteEssay(week) {
  if (!confirm(`Essay "${week}" definitief verwijderen?`)) return;
  try {
    await apiJson(`/admin/essays/${encodeURIComponent(week)}`, { method: 'DELETE' });
    if (editingWeek === week) resetForm();
    await loadEssays();
  } catch (err) {
    alert(`Verwijderen mislukt: ${err.message}`);
  }
}

/* ==========================================================================
   SUMMARY CHECKLIST
   ========================================================================== */

function updateSummaryChecklist() {
  const wk = fWeek?.value?.trim() || '—';
  const title = fTitle?.value?.trim() || '—';
  const pageFile = fPage?.files?.[0];

  let totalBytes = pageFile ? pageFile.size : 0;
  const rows = Array.from(layersRows.querySelectorAll('.layer-row'));
  let validLayers = 0;

  rows.forEach((row) => {
    const f = row.querySelector('input[name="layer_file"]')?.files?.[0];
    const ex = row.querySelector('input[name="layer_existing"]')?.value || '';
    const exSize = Number(row.dataset.existingSize) || 0;
    if (f) {
      validLayers++;
      totalBytes += f.size;
    } else if (ex) {
      validLayers++;
      totalBytes += exSize;
    }
  });

  if (sumWeek) sumWeek.innerHTML = `<span>Week-code</span><strong>${escHtml(wk)}</strong>`;
  if (sumTitle) sumTitle.innerHTML = `<span>Titel</span><strong>${escHtml(title)}</strong>`;
  if (sumPage) {
    const pageLabel = pageFile
      ? `${pageFile.name} (${fmtBytes(pageFile.size)})`
      : existingPageUrl
      ? `${baseName(existingPageUrl)} (behouden)`
      : 'Nog niet gekozen';
    sumPage.innerHTML = `<span>Pagina-afbeelding</span><strong>${escHtml(pageLabel)}</strong>`;
  }
  if (sumTarget) {
    sumTarget.innerHTML = `<span>8th Wall Target</span><strong>Automatisch bij opslaan</strong>`;
  }
  if (sumLayers) {
    sumLayers.innerHTML = `<span>AR Lagen</span><strong>${validLayers} actieve laag/lagen</strong>`;
  }
  if (summaryBundleBadge) {
    summaryBundleBadge.textContent = fmtBytes(totalBytes);
  }
}

/* ==========================================================================
   AR LAYERS MANAGEMENT + UNDO/REDO + 1:1 2D STAGE
   ========================================================================== */

function layerDefaults(index) {
  const fit = fittedSize();
  return {
    x: '0',
    y: '0',
    z: (0.01 + index * 0.01).toFixed(2),
    w: fit.w,
    h: fit.h,
    opacity: '1',
    rx: '0',
    ry: '0',
    rz: '0',
    scale: '1',
    lit: 0,
    anim_dur: '0',
    anim_x: '0',
    anim_y: '0',
    anim_z: '0',
    existingFile: '',
    existingUrl: '',
    existingSize: 0,
  };
}

function getLayersSnapshot() {
  return Array.from(layersRows.querySelectorAll('.layer-row')).map((row) => {
    const g = (name) => row.querySelector(`input[name="${name}"]`)?.value ?? '0';
    return {
      x: g('layer_x'),
      y: g('layer_y'),
      z: g('layer_z'),
      w: g('layer_w'),
      h: g('layer_h'),
      opacity: g('layer_opacity'),
      rx: g('layer_rx'),
      ry: g('layer_ry'),
      rz: g('layer_rz'),
      scale: g('layer_scale'),
      lit: row.querySelector('input[name="layer_lit"]')?.checked ? 1 : 0,
      anim_dur: g('layer_anim_dur'),
      anim_x: g('layer_anim_x'),
      anim_y: g('layer_anim_y'),
      anim_z: g('layer_anim_z'),
      existingFile: g('layer_existing'),
      existingUrl: row.dataset.previewUrl || '',
      existingSize: Number(row.dataset.existingSize) || 0,
      hiddenOnStage: row.classList.contains('layer-hidden'),
    };
  });
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
    items.forEach((v) => addLayerRow(v));
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

function numField(name, label, value, extra = '') {
  return `<label>${label}<input type="number" step="0.01" name="${name}" value="${escHtml(value)}"${extra}></label>`;
}

function renderThumbPreviewHtml(filenameOrUrl) {
  if (!filenameOrUrl) return `<span>Geen bestand</span>`;
  const clean = baseName(filenameOrUrl).toLowerCase();
  if (clean.endsWith('.glb') || clean.endsWith('.gltf')) {
    return `<span>3D GLB</span>`;
  }
  return `<img src="${escHtml(resolveAssetUrl(filenameOrUrl))}" alt="Preview" />`;
}

function addLayerRow(values) {
  const v = values || layerDefaults(layersRows.children.length);
  const row = document.createElement('div');
  row.className = `layer-row ${v.hiddenOnStage ? 'layer-hidden' : ''}`;
  row.dataset.existingSize = String(v.existingSize || 0);
  if (v.existingUrl) {
    row.dataset.previewUrl = v.existingUrl;
  }

  const fileLabel = v.existingFile
    ? `Behouden: ${escHtml(v.existingFile)} (${fmtBytes(v.existingSize)})`
    : 'Kies bestand (PNG/JPG/WebP/GIF/GLB)';

  row.innerHTML = `
    <div class="layer-top">
      <div class="layer-head-left">
        <span class="layer-index-pill">#1</span>
        <strong class="layer-file-title">${fileLabel}</strong>
        <span class="layer-size hint">${v.existingFile ? escHtml(fmtBytes(v.existingSize)) : ''}</span>
      </div>
      <div class="layer-controls">
        <button type="button" class="icon-btn layer-fit-page-btn" title="Zet breedte, hoogte en positie exact paginavullend op het 8th Wall target">PAGINAVULLEND</button>
        <button type="button" class="icon-btn layer-fit-img-btn" title="Pas breedte/hoogte-verhouding aan de afbeelding zelf aan">FOTO-RATIO</button>
        <button type="button" class="icon-btn layer-vis-btn" title="Toon of verberg deze laag op de 2D preview">${v.hiddenOnStage ? 'VERBORGEN' : 'ZICHTBAAR'}</button>
        <button type="button" class="icon-btn layer-up-btn" title="Laag omhoog">OMHOOG</button>
        <button type="button" class="icon-btn layer-down-btn" title="Laag omlaag">OMLAAG</button>
        <button type="button" class="icon-btn layer-dup-btn" title="Dupliceer laag">KOPIE</button>
        <button type="button" class="icon-btn danger remove-layer" title="Verwijder laag">WIS</button>
      </div>
    </div>

    <div class="layer-main-grid">
      <div class="layer-thumb-box">
        ${renderThumbPreviewHtml(v.existingUrl || '')}
      </div>
      <div>
        <div class="layer-file-bar">
          <input type="file" name="layer_file" accept=".png,.webp,.jpg,.jpeg,.gif,.glb">
          <input type="hidden" name="layer_existing" value="${escHtml(v.existingFile || '')}">
          <button type="button" class="btn ghost mini-btn layer-search-meme-btn">MEME</button>
          <button type="button" class="btn ghost mini-btn layer-search-3d-btn">3D MODEL</button>
        </div>

        <div class="layer-group">
          ${numField('layer_x', 'Pos X', v.x)}
          ${numField('layer_y', 'Pos Y', v.y)}
          ${numField('layer_z', 'Diepte Z', v.z)}
          ${numField('layer_scale', 'Schaal', v.scale, ' min="0.01"')}
          <label>Dekking<input type="number" step="0.05" min="0" max="1" name="layer_opacity" value="${escHtml(v.opacity)}"></label>
        </div>

        <details class="layer-advanced" ${(Number(v.rx) || Number(v.ry) || Number(v.rz) || Number(v.anim_dur) > 0) ? 'open' : ''}>
          <summary>Geavanceerde parameters (Afmetingen, Rotatie &amp; Animatie)</summary>
          <div class="layer-group">
            ${numField('layer_w', 'Breedte', v.w)}
            ${numField('layer_h', 'Hoogte', v.h)}
            ${numField('layer_rx', 'Rot X°', v.rx)}
            ${numField('layer_ry', 'Rot Y°', v.ry)}
            ${numField('layer_rz', 'Rot Z°', v.rz)}
          </div>
          <div class="layer-group">
            <label style="justify-content:center;"><input type="checkbox" name="layer_lit" value="1"${v.lit ? ' checked' : ''}> Licht/schaduw</label>
            <label>Anim (s)<input type="number" step="0.1" min="0" name="layer_anim_dur" value="${escHtml(v.anim_dur)}"></label>
            ${numField('layer_anim_x', 'Naar X', v.anim_x)}
            ${numField('layer_anim_y', 'Naar Y', v.anim_y)}
            ${numField('layer_anim_z', 'Naar Z', v.anim_z)}
          </div>
        </details>
      </div>
    </div>
  `;

  const fileInput = row.querySelector('input[name="layer_file"]');
  const fileTitle = row.querySelector('.layer-file-title');
  const sizeEl = row.querySelector('.layer-size');
  const thumbBox = row.querySelector('.layer-thumb-box');

  // Klikken op een laag-kaart selecteert deze laag voor de 2D preview
  row.addEventListener('click', (ev) => {
    if (ev.target.closest('button')) return;
    const idx = Array.from(layersRows.querySelectorAll('.layer-row')).indexOf(row);
    if (idx >= 0 && selectedStageLayerIdx !== idx) {
      selectedStageLayerIdx = idx;
      if (stageLayerSelect) stageLayerSelect.value = String(idx);
      highlightSelectedLayerRow();
      render2dStage();
    }
  });

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) {
      fileTitle.textContent = f.name;
      sizeEl.textContent = fmtBytes(f.size);
      if (f.name.toLowerCase().endsWith('.glb')) {
        row.dataset.previewUrl = f.name;
        thumbBox.innerHTML = `<span>3D GLB</span>`;
      } else {
        const blobUrl = URL.createObjectURL(f);
        row.dataset.previewUrl = blobUrl;
        thumbBox.innerHTML = `<img src="${escHtml(blobUrl)}" alt="Preview" />`;
      }
    }
    updateSummaryChecklist();
    recordLayerHistory();
    render2dStage();
  });

  // Paginavullend-knop: zet w/h exact gelijk aan het 8th Wall target en centreer op (0,0)
  row.querySelector('.layer-fit-page-btn').addEventListener('click', () => {
    const fit = fittedSize();
    row.querySelector('input[name="layer_w"]').value = fit.w;
    row.querySelector('input[name="layer_h"]').value = fit.h;
    row.querySelector('input[name="layer_x"]').value = '0';
    row.querySelector('input[name="layer_y"]').value = '0';
    row.querySelector('input[name="layer_scale"]').value = '1';
    recordLayerHistory();
    render2dStage();
  });

  // Foto-ratio-knop: leest de natuurlijke beeldverhouding van de laag-afbeelding
  row.querySelector('.layer-fit-img-btn').addEventListener('click', () => {
    const previewUrl = row.dataset.previewUrl;
    if (!previewUrl || previewUrl.toLowerCase().endsWith('.glb')) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const target = fittedSizeNum();
        // Pas binnen de target-breedte met behoud van de foto-aspectratio
        let w = target.w * 0.5;
        let h = w / imgAspect;
        if (h > target.h * 0.8) {
          h = target.h * 0.5;
          w = h * imgAspect;
        }
        row.querySelector('input[name="layer_w"]').value = w.toFixed(3);
        row.querySelector('input[name="layer_h"]').value = h.toFixed(3);
        recordLayerHistory();
        render2dStage();
      }
    };
    img.src = resolveAssetUrl(previewUrl);
  });

  row.querySelectorAll('input[type="number"], input[type="checkbox"]').forEach((inp) => {
    inp.addEventListener('input', () => render2dStage());
    inp.addEventListener('change', () => recordLayerHistory());
  });

  row.querySelector('.layer-vis-btn').addEventListener('click', (e) => {
    row.classList.toggle('layer-hidden');
    e.currentTarget.textContent = row.classList.contains('layer-hidden') ? 'VERBORGEN' : 'ZICHTBAAR';
    recordLayerHistory();
    render2dStage();
  });

  row.querySelector('.layer-up-btn').addEventListener('click', () => {
    const prev = row.previousElementSibling;
    if (prev) {
      layersRows.insertBefore(row, prev);
      renumberLayerRows();
      recordLayerHistory();
      render2dStage();
    }
  });

  row.querySelector('.layer-down-btn').addEventListener('click', () => {
    const next = row.nextElementSibling;
    if (next) {
      layersRows.insertBefore(next, row);
      renumberLayerRows();
      recordLayerHistory();
      render2dStage();
    }
  });

  row.querySelector('.layer-dup-btn').addEventListener('click', () => {
    const g = (n) => row.querySelector(`input[name="${n}"]`)?.value ?? '0';
    const newRow = addLayerRow({
      x: (Number(g('layer_x')) + 0.04).toFixed(2),
      y: (Number(g('layer_y')) - 0.04).toFixed(2),
      z: (Number(g('layer_z')) + 0.01).toFixed(2),
      w: g('layer_w'),
      h: g('layer_h'),
      opacity: g('layer_opacity'),
      rx: g('layer_rx'),
      ry: g('layer_ry'),
      rz: g('layer_rz'),
      scale: g('layer_scale'),
      lit: row.querySelector('input[name="layer_lit"]')?.checked ? 1 : 0,
      anim_dur: g('layer_anim_dur'),
      anim_x: g('layer_anim_x'),
      anim_y: g('layer_anim_y'),
      anim_z: g('layer_anim_z'),
      existingFile: g('layer_existing'),
      existingUrl: row.dataset.previewUrl || '',
      existingSize: Number(row.dataset.existingSize) || 0,
    });
    if (fileInput.files?.[0]) {
      const dt = new DataTransfer();
      dt.items.add(fileInput.files[0]);
      const newInput = newRow.querySelector('input[name="layer_file"]');
      newInput.files = dt.files;
      newInput.dispatchEvent(new Event('change'));
    }
    recordLayerHistory();
    updateSummaryChecklist();
    render2dStage();
  });

  row.querySelector('.remove-layer').addEventListener('click', () => {
    row.remove();
    if (layersRows.children.length === 0) addLayerRow();
    selectedStageLayerIdx = -1;
    renumberLayerRows();
    recordLayerHistory();
    updateSummaryChecklist();
    render2dStage();
  });

  row.querySelector('.layer-search-meme-btn').addEventListener('click', () => {
    openMediaSearchModal(row, 'memes');
  });

  row.querySelector('.layer-search-3d-btn').addEventListener('click', () => {
    openMediaSearchModal(row, '3d');
  });

  layersRows.appendChild(row);
  renumberLayerRows();
  updateSummaryChecklist();
  render2dStage();
  return row;
}

function renumberLayerRows() {
  const rows = Array.from(layersRows.querySelectorAll('.layer-row'));
  rows.forEach((row, idx) => {
    const pill = row.querySelector('.layer-index-pill');
    if (pill) pill.textContent = `#${idx + 1}`;
  });
  updateStageLayerSelect(rows);
  highlightSelectedLayerRow();
}

function updateStageLayerSelect(rows) {
  if (!stageLayerSelect) return;
  const currentVal = String(selectedStageLayerIdx);
  stageLayerSelect.innerHTML =
    `<option value="-1">Alle lagen interactief</option>` +
    rows
      .map((row, idx) => {
        const title = row.querySelector('.layer-file-title')?.textContent || `Laag ${idx + 1}`;
        return `<option value="${idx}">Bewerk enkel Laag #${idx + 1} (${escHtml(title.slice(0, 28))})</option>`;
      })
      .join('');
  if (selectedStageLayerIdx >= rows.length) {
    selectedStageLayerIdx = -1;
  }
  stageLayerSelect.value = currentVal;
}

function highlightSelectedLayerRow() {
  Array.from(layersRows.querySelectorAll('.layer-row')).forEach((row, idx) => {
    row.classList.toggle('selected-row', idx === selectedStageLayerIdx);
  });
}

stageLayerSelect?.addEventListener('change', () => {
  selectedStageLayerIdx = Number(stageLayerSelect.value);
  highlightSelectedLayerRow();
  render2dStage();
});

addLayerBtn?.addEventListener('click', () => {
  addLayerRow();
  recordLayerHistory();
});

/* ==========================================================================
   INTERACTIVE 2D AR STAGE (EXACT 1:1 8TH WALL SCALE + MOVE & SCALE HANDLES)
   ========================================================================== */

toggleStageBtn?.addEventListener('click', () => {
  const hidden = stageBody.classList.toggle('hidden');
  toggleStageBtn.textContent = hidden ? 'Uitklappen' : 'Inklappen';
});

function render2dStage() {
  if (!ar2dLayers) return;
  ar2dLayers.innerHTML = '';

  const target = fittedSizeNum(); // { w: targetW, h: targetH }
  const rows = Array.from(layersRows.querySelectorAll('.layer-row'));

  rows.forEach((row, idx) => {
    if (row.classList.contains('layer-hidden')) return;

    const lx = Number(row.querySelector('input[name="layer_x"]')?.value) || 0;
    const ly = Number(row.querySelector('input[name="layer_y"]')?.value) || 0;
    const lz = Number(row.querySelector('input[name="layer_z"]')?.value) || 0;
    const lwRaw = Number(row.querySelector('input[name="layer_w"]')?.value);
    const lhRaw = Number(row.querySelector('input[name="layer_h"]')?.value);
    const lw = lwRaw > 0 ? lwRaw : target.w;
    const lh = lhRaw > 0 ? lhRaw : target.h;
    const sc = Math.max(0.01, Number(row.querySelector('input[name="layer_scale"]')?.value) || 1);
    const opacity = Math.min(1, Math.max(0, Number(row.querySelector('input[name="layer_opacity"]')?.value ?? 1)));
    const rz = Number(row.querySelector('input[name="layer_rz"]')?.value) || 0;
    const previewUrl = row.dataset.previewUrl || '';
    const isGlb = previewUrl.toLowerCase().endsWith('.glb');

    // Exacte 8th Wall schaalverhouding t.o.v. het pagina-target (target.w × target.h)
    const widthPct = isGlb
      ? ((0.28 * sc) / target.w) * 100
      : ((lw * sc) / target.w) * 100;
    const heightPct = isGlb
      ? ((0.28 * sc) / target.h) * 100
      : ((lh * sc) / target.h) * 100;

    const leftPct = (0.5 + lx / target.w) * 100;
    const topPct = (0.5 - ly / target.h) * 100;

    const isSelected = selectedStageLayerIdx === idx;
    const isPassive = selectedStageLayerIdx >= 0 && selectedStageLayerIdx !== idx;

    const marker = document.createElement('div');
    marker.className = `ar-2d-marker ${isSelected ? 'selected' : ''} ${isPassive ? 'marker-passive' : ''}`;
    marker.style.left = `${leftPct}%`;
    marker.style.top = `${topPct}%`;
    marker.style.width = `${widthPct}%`;
    marker.style.height = `${heightPct}%`;
    marker.style.zIndex = String(isSelected ? 5000 : Math.max(1, Math.round(lz * 1000) + idx + 10));
    marker.style.transform = `translate(-50%, -50%) rotate(${-rz}deg)`;

    let contentHtml = `<span class="ar-2d-marker-label">#${idx + 1}</span>`;
    if (isGlb) {
      contentHtml += `<div class="ar-2d-marker-3d">3D GLB (#${idx + 1})</div>`;
    } else if (previewUrl) {
      contentHtml += `<img class="ar-2d-marker-thumb" src="${escHtml(resolveAssetUrl(previewUrl))}" style="opacity:${opacity};" alt="" />`;
    } else {
      contentHtml += `<div class="ar-2d-marker-3d" style="opacity:0.65;">LAAG #${idx + 1}</div>`;
    }

    if (!isPassive) {
      contentHtml += `<div class="ar-2d-resize-handle" title="Sleep om Schaal aan te passen"></div>`;
    }

    marker.innerHTML = contentHtml;

    // 1. Schalen via het hoekpunt rechtsonder
    const resizeHandle = marker.querySelector('.ar-2d-resize-handle');
    resizeHandle?.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      resizeHandle.setPointerCapture(ev.pointerId);
      marker.classList.add('dragging');

      const rect = ar2dPaper.getBoundingClientRect();
      const startX = ev.clientX;
      const startScale = Number(row.querySelector('input[name="layer_scale"]')?.value) || 1;

      const onResizeMove = (moveEv) => {
        const dxRatio = (moveEv.clientX - startX) / Math.max(1, rect.width);
        const newScale = Math.max(0.05, Number((startScale + dxRatio * 2).toFixed(2)));
        row.querySelector('input[name="layer_scale"]').value = newScale.toFixed(2);

        const nextWPct = isGlb
          ? ((0.28 * newScale) / target.w) * 100
          : ((lw * newScale) / target.w) * 100;
        const nextHPct = isGlb
          ? ((0.28 * newScale) / target.h) * 100
          : ((lh * newScale) / target.h) * 100;

        marker.style.width = `${nextWPct}%`;
        marker.style.height = `${nextHPct}%`;

        if (stageCoordsReadout) {
          stageCoordsReadout.textContent = `Laag #${idx + 1} | X: ${lx.toFixed(2)} · Y: ${ly.toFixed(2)} · S: ${newScale.toFixed(2)}`;
        }
      };

      const onResizeUp = (upEv) => {
        resizeHandle.releasePointerCapture(upEv.pointerId);
        marker.classList.remove('dragging');
        resizeHandle.removeEventListener('pointermove', onResizeMove);
        resizeHandle.removeEventListener('pointerup', onResizeUp);
        recordLayerHistory();
      };

      resizeHandle.addEventListener('pointermove', onResizeMove);
      resizeHandle.addEventListener('pointerup', onResizeUp);
    });

    // 2. Verplaatsen (Pos X / Pos Y) door de laag zelf te slepen
    marker.addEventListener('pointerdown', (ev) => {
      if (ev.target.classList.contains('ar-2d-resize-handle')) return;
      ev.preventDefault();
      marker.setPointerCapture(ev.pointerId);
      marker.classList.add('dragging');

      const rect = ar2dPaper.getBoundingClientRect();
      const startMouseX = ev.clientX;
      const startMouseY = ev.clientY;
      const startLx = Number(row.querySelector('input[name="layer_x"]')?.value) || 0;
      const startLy = Number(row.querySelector('input[name="layer_y"]')?.value) || 0;
      const curScale = Number(row.querySelector('input[name="layer_scale"]')?.value) || 1;

      const onMove = (moveEv) => {
        const dxNorm = (moveEv.clientX - startMouseX) / Math.max(1, rect.width);
        const dyNorm = (moveEv.clientY - startMouseY) / Math.max(1, rect.height);

        const worldX = Number((startLx + dxNorm * target.w).toFixed(2));
        const worldY = Number((startLy - dyNorm * target.h).toFixed(2));

        row.querySelector('input[name="layer_x"]').value = worldX.toFixed(2);
        row.querySelector('input[name="layer_y"]').value = worldY.toFixed(2);

        marker.style.left = `${(0.5 + worldX / target.w) * 100}%`;
        marker.style.top = `${(0.5 - worldY / target.h) * 100}%`;

        if (stageCoordsReadout) {
          stageCoordsReadout.textContent = `Laag #${idx + 1} | X: ${worldX.toFixed(2)} · Y: ${worldY.toFixed(2)} · S: ${curScale.toFixed(2)}`;
        }
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
   SAVE ESSAY (EXACT API.PHP FORMDATA CONTRACT + XHR PROGRESS)
   ========================================================================== */

essayForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  formOk.textContent = '';

  const week = fWeek.value.trim();
  const title = fTitle.value.trim();
  if (!week || !title) {
    formError.textContent = 'Week-code en titel zijn verplicht.';
    return;
  }

  const fd = new FormData();
  fd.append('week', week);
  fd.append('title', title);
  fd.append('published', fPublished.checked ? '1' : '0');

  const pageFile = fPage.files?.[0];
  if (pageFile) {
    fd.append('page_image', pageFile);
  }

  const getNum = (row, name, def) => {
    const el = row.querySelector(`input[name="${name}"]`);
    return el && el.value !== '' ? el.value : def;
  };

  layersRows.querySelectorAll('.layer-row').forEach((row) => {
    const file = row.querySelector('input[name="layer_file"]')?.files?.[0];
    const existing = row.querySelector('input[name="layer_existing"]')?.value || '';
    if (!file && !existing) return;

    if (file) {
      fd.append('layers[]', file);
      fd.append('layer_has_file[]', '1');
    } else {
      fd.append('layer_has_file[]', '0');
    }
    fd.append('layer_existing[]', existing);
    fd.append('layer_x[]', getNum(row, 'layer_x', '0'));
    fd.append('layer_y[]', getNum(row, 'layer_y', '0'));
    fd.append('layer_z[]', getNum(row, 'layer_z', '0.01'));
    fd.append('layer_w[]', getNum(row, 'layer_w', '1'));
    fd.append('layer_h[]', getNum(row, 'layer_h', '1'));
    fd.append('layer_opacity[]', getNum(row, 'layer_opacity', '1'));
    fd.append('layer_rx[]', getNum(row, 'layer_rx', '0'));
    fd.append('layer_ry[]', getNum(row, 'layer_ry', '0'));
    fd.append('layer_rz[]', getNum(row, 'layer_rz', '0'));
    fd.append('layer_scale[]', getNum(row, 'layer_scale', '1'));
    fd.append('layer_lit[]', row.querySelector('input[name="layer_lit"]')?.checked ? '1' : '0');
    fd.append('layer_anim_dur[]', getNum(row, 'layer_anim_dur', '0'));
    fd.append('layer_anim_x[]', getNum(row, 'layer_anim_x', '0'));
    fd.append('layer_anim_y[]', getNum(row, 'layer_anim_y', '0'));
    fd.append('layer_anim_z[]', getNum(row, 'layer_anim_z', '0'));
  });

  saveButton.disabled = true;
  uploadProgressWrap.style.display = 'block';
  uploadProgressFill.style.width = '0%';
  uploadProgressPct.textContent = '0%';
  uploadProgressText.textContent = 'Bezig met uploaden...';

  try {
    const data = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/admin/essays`, true);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          uploadProgressFill.style.width = `${pct}%`;
          uploadProgressPct.textContent = `${pct}%`;
          if (pct >= 100) {
            uploadProgressText.textContent = '8th Wall target & lagen verwerken...';
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
          reject(new Error(parsed.message || parsed.error || `HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Geen verbinding met de server'));
      xhr.send(fd);
    });

    await loadEssays();
    if (data.essay) {
      await loadIntoForm(data.essay.week);
      formOk.textContent =
        'Opgeslagen: ' +
        data.essay.week +
        (data.essay.target8w ? ' (8th Wall target gereed)' : ' — LET OP: geen 8th Wall target aangemaakt');
    }
  } catch (err) {
    formError.textContent = err.message || 'Opslaan mislukt';
  } finally {
    saveButton.disabled = false;
    setTimeout(() => {
      uploadProgressWrap.style.display = 'none';
    }, 800);
  }
});

/* ==========================================================================
   MEDIA SEARCH MODAL (REDDIT MEMES & SKETCHFAB 3D)
   ========================================================================== */

function openMediaSearchModal(targetRow = null, tab = 'memes') {
  activeMediaSearchLayerRow =
    targetRow || layersRows.querySelector('.layer-row:last-child') || addLayerRow();
  setMediaSearchTab(tab);
  mediaSearchModal.classList.remove('hidden');
  mediaSearchQuery.focus();
}

function setMediaSearchTab(tab) {
  activeMediaTab = tab;
  document.querySelectorAll('.media-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  if (tab === '3d') {
    mediaSearchSub.style.display = 'none';
    mediaSearchQuery.placeholder = 'Zoek downloadbare 3D modellen op Sketchfab (bv. chair, newspaper, statue)...';
  } else {
    mediaSearchSub.style.display = '';
    mediaSearchQuery.placeholder = 'Zoek memes of GIFs op Reddit (bv. cat, art, newspaper)...';
  }
}

document.querySelectorAll('.media-tab').forEach((btn) => {
  btn.addEventListener('click', () => setMediaSearchTab(btn.dataset.tab));
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
  const source = mediaSearchSub.value || 'memes';
  if (!q) {
    mediaSearchStatus.textContent = 'Voer eerst een zoekterm in.';
    return;
  }

  mediaSearchResults.innerHTML = '';
  mediaSearchStatus.textContent = 'Zoeken...';

  try {
    if (activeMediaTab === 'memes') {
      const data = await apiJson(
        `/admin/search/memes?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`
      );
      const memes = Array.isArray(data.memes) ? data.memes : [];
      if (memes.length === 0) {
        mediaSearchStatus.textContent = 'Geen memes gevonden.';
        return;
      }
      mediaSearchStatus.textContent = `${memes.length} resultaten gevonden. Klik om direct in de laag te plaatsen:`;
      mediaSearchResults.innerHTML = memes
        .map(
          (m) => `
          <div class="media-result-card">
            <img class="media-result-thumb" src="${escHtml(m.preview_url || m.url)}" alt="" loading="lazy" />
            <div class="media-result-info">
              <div class="media-result-title" title="${escHtml(m.title)}">${escHtml(m.title)}</div>
              <button type="button" class="btn-primary mini-btn import-remote-btn"
                data-type="image"
                data-url="${escHtml(m.url)}"
                data-title="${escHtml(m.title)}">
                KIES MEME
              </button>
            </div>
          </div>
        `
        )
        .join('');
    } else {
      const data = await apiJson(`/admin/search/3d?q=${encodeURIComponent(q)}`);
      const models = Array.isArray(data.models) ? data.models : [];
      if (models.length === 0) {
        mediaSearchStatus.textContent = 'Geen downloadbare 3D-modellen gevonden.';
        return;
      }
      mediaSearchStatus.textContent = `${models.length} 3D-modellen gevonden:`;
      mediaSearchResults.innerHTML = models
        .map(
          (m) => `
          <div class="media-result-card">
            <img class="media-result-thumb" src="${escHtml(m.thumbnail)}" alt="" loading="lazy" />
            <div class="media-result-info">
              <div class="media-result-title" title="${escHtml(m.name)}">${escHtml(m.name)} (${fmtBytes(m.glb_size || 0)})</div>
              <button type="button" class="btn-primary mini-btn import-remote-btn"
                data-type="3d"
                data-uid="${escHtml(m.uid)}"
                data-title="${escHtml(m.name)}">
                IMPORTEER GLB
              </button>
            </div>
          </div>
        `
        )
        .join('');
    }

    mediaSearchResults.querySelectorAll('.import-remote-btn').forEach((btn) => {
      btn.addEventListener('click', () => importRemoteMediaIntoLayer(btn));
    });
  } catch (err) {
    mediaSearchStatus.textContent = `Fout: ${err.message}`;
  }
}

async function importRemoteMediaIntoLayer(btn) {
  const type = btn.dataset.type;
  const title = btn.dataset.title || 'asset';
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'LADEN...';

  try {
    const qs =
      type === '3d'
        ? `type=3d&uid=${encodeURIComponent(btn.dataset.uid)}`
        : `type=image&url=${encodeURIComponent(btn.dataset.url)}`;

    const res = await fetch(`${API}/admin/fetch-remote-asset?${qs}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}`);
    }

    const blob = await res.blob();
    let ext = 'jpg';
    if (type === '3d') ext = 'glb';
    else if (blob.type.includes('png')) ext = 'png';
    else if (blob.type.includes('gif')) ext = 'gif';
    else if (blob.type.includes('webp')) ext = 'webp';

    const safeName = `${title.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 30) || 'layer'}.${ext}`;
    const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' });

    const row = activeMediaSearchLayerRow || addLayerRow();
    const fileInput = row.querySelector('input[name="layer_file"]');
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));

    mediaSearchModal.classList.add('hidden');
  } catch (err) {
    alert(`Importeren mislukt: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

document.querySelectorAll('[data-close-modal]').forEach((el) => {
  el.addEventListener('click', () => {
    const id = el.dataset.closeModal;
    document.getElementById(id)?.classList.add('hidden');
  });
});

/* ==========================================================================
   BUILT-IN SETTINGS PAGE LOGIC
   ========================================================================== */

async function loadSettingsStatus() {
  updateOptOutUI();
  try {
    const data = await apiJson('/admin/settings');
    if (sketchfabKeyStatus) {
      sketchfabKeyStatus.textContent = data.sketchfab_key_set
        ? 'Sketchfab API-key is ingesteld.'
        : 'Nog geen Sketchfab API-key ingesteld.';
    }
  } catch (_) {}
}

function isAnalyticsIgnored() {
  try {
    return (
      localStorage.getItem('interventie_analytics_ignore') === '1' ||
      document.cookie.indexOf('analytics_ignore=1') !== -1
    );
  } catch (_) {
    return false;
  }
}

function setAnalyticsIgnored(enabled) {
  try {
    if (enabled) {
      localStorage.setItem('interventie_analytics_ignore', '1');
      document.cookie = 'analytics_ignore=1; path=/; max-age=31536000; SameSite=Lax';
    } else {
      localStorage.removeItem('interventie_analytics_ignore');
      document.cookie = 'analytics_ignore=; path=/; max-age=0; SameSite=Lax';
    }
  } catch (_) {}
  updateOptOutUI();
}

function updateOptOutUI() {
  const ignored = isAnalyticsIgnored();
  if (optoutStatusBadge) {
    optoutStatusBadge.textContent = ignored ? 'UITGESLOTEN (Geen metingen)' : 'ACTIEF (Wordt gemeten)';
    optoutStatusBadge.className = `badge ${ignored ? 'live' : 'draft'}`;
  }
  if (optoutToggleBtn) {
    optoutToggleBtn.textContent = ignored
      ? 'METINGEN WEER INSCHAKELEN OP DIT TOESTEL'
      : 'EIGEN BEZOEKEN UITSLUITEN OP DIT TOESTEL';
    optoutToggleBtn.className = ignored ? 'btn ghost' : 'btn-primary';
  }
  if (optoutCurrentHint) {
    optoutCurrentHint.textContent = ignored
      ? 'Jouw bezoeken en AR-scans op deze browser worden 100% genegeerd.'
      : 'Bezoeken op deze browser tellen momenteel mee in de statistieken.';
  }

  const optoutUrl = `${window.location.origin}/krant/?optout=1`;
  if (optoutUrlInput) {
    optoutUrlInput.value = optoutUrl;
  }
  if (optoutQrImg) {
    optoutQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(optoutUrl)}`;
  }
}

optoutToggleBtn?.addEventListener('click', () => {
  setAnalyticsIgnored(!isAnalyticsIgnored());
});

optoutCopyUrlBtn?.addEventListener('click', async () => {
  if (optoutUrlInput) {
    try {
      await navigator.clipboard.writeText(optoutUrlInput.value);
      const orig = optoutCopyUrlBtn.textContent;
      optoutCopyUrlBtn.textContent = 'LINK GEKOPIEERD!';
      setTimeout(() => { optoutCopyUrlBtn.textContent = orig; }, 2000);
    } catch (_) {
      optoutUrlInput.select();
    }
  }
});

rebuildTargetsBtn?.addEventListener('click', async () => {
  rebuildTargetsBtn.disabled = true;
  rebuildTargetsStatus.textContent = 'Bezig met controleren en herbouwen...';
  try {
    const data = await apiJson('/admin/rebuild-targets', { method: 'POST' });
    rebuildTargetsStatus.textContent = data.message || 'Targets bijgewerkt.';
    await loadEssays();
  } catch (err) {
    rebuildTargetsStatus.textContent = `Fout: ${err.message}`;
  } finally {
    rebuildTargetsBtn.disabled = false;
  }
});

exportEssaysJsonBtn?.addEventListener('click', async () => {
  exportEssaysStatus.textContent = 'Exporteren...';
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
    await apiJson('/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ sketchfab_api_key: sketchfabApiKeyInput.value.trim() }),
    });
    sketchfabApiKeyInput.value = '';
    sketchfabKeyStatus.textContent = 'Sketchfab API-key opgeslagen.';
  } catch (err) {
    sketchfabKeyStatus.textContent = `Fout: ${err.message}`;
  }
});

passwordForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  pwError.textContent = '';
  pwOk.textContent = '';
  try {
    await apiJson('/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        current: pwCurrent.value,
        new: pwNew.value,
      }),
    });
    pwOk.textContent = 'Wachtwoord gewijzigd.';
    passwordForm.reset();
  } catch (err) {
    pwError.textContent = err.message || 'Wijzigen mislukt';
  }
});

wipeAllBtn?.addEventListener('click', async () => {
  if (!confirm('ALLE essays + bestanden definitief verwijderen? Dit kan niet ongedaan worden.')) return;
  if (!confirm('Zeker weten? Alles wordt gewist.')) return;
  try {
    await apiJson('/admin/essays', { method: 'DELETE' });
    resetForm();
    await loadEssays();
    switchMainView('editor');
  } catch (err) {
    alert(`Wissen mislukt: ${err.message}`);
  }
});

/* ==========================================================================
   BUILT-IN ANALYTICS PAGE (COOKIE-FREE JSONL + AR SCANS)
   ========================================================================== */

async function loadKrantAnalytics(days = 30) {
  currentStatsDays = days;
  if (!analyticsContent) return;
  analyticsContent.innerHTML = `<div class="panel-card"><div class="panel-card-body"><p class="bundle-info" style="margin:0;">Statistieken voor de afgelopen ${days} dagen laden...</p></div></div>`;
  try {
    const data = await apiJson(`/admin/stats?days=${days}`);
    currentStatsData = data;
    renderKrantAnalytics(data);
  } catch (err) {
    analyticsContent.innerHTML = `<div class="panel-card"><div class="panel-card-body"><p class="error" style="margin:0;">Kon statistieken niet laden: ${escHtml(err.message)}</p></div></div>`;
  }
}

function renderTrendBadge(trendVal, invertColors = false) {
  if (trendVal === null || trendVal === undefined) {
    return `<span class="krant-kpi-trend neutral">—</span>`;
  }
  const n = Number(trendVal);
  if (n === 0) {
    return `<span class="krant-kpi-trend neutral">0%</span>`;
  }
  const isUp = n > 0;
  const good = invertColors ? !isUp : isUp;
  const cls = good ? 'up' : 'down';
  const sign = isUp ? '+' : '';
  return `<span class="krant-kpi-trend ${cls}">${sign}${n}%</span>`;
}

function formatRelativeOrDate(ts) {
  const n = Number(ts) || 0;
  if (n <= 0) return '—';
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - n);
  if (diffSec < 60) return 'Zojuist';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m geleden`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}u geleden`;
  const d = new Date(n * 1000);
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
}

function renderEssayScanRows(essayMetrics, filterQuery = '') {
  if (!essayMetrics || essayMetrics.length === 0) {
    return `<tr><td colspan="9" class="bundle-info">Nog geen edities aangemaakt.</td></tr>`;
  }
  const q = filterQuery.trim().toLowerCase();
  const filtered = q
    ? essayMetrics.filter(
        (em) =>
          String(em.week || '').toLowerCase().includes(q) ||
          String(em.title || '').toLowerCase().includes(q)
      )
    : essayMetrics;

  if (filtered.length === 0) {
    return `<tr><td colspan="9" class="bundle-info">Geen edities gevonden voor "${escHtml(filterQuery)}".</td></tr>`;
  }

  return filtered
    .map((em, idx) => {
      const periodScans = Number(em.period_scans) || 0;
      const allTimeScans = Number(em.scans) || 0;
      const uniqueScanners = Number(em.unique_scanners) || 0;
      const sharePct = Number(em.share_pct) || 0;
      const avgArDwell = Number(em.avg_ar_dwell) || 0;
      const layersCount = Number(em.layers_count) || 0;
      const isTop = idx === 0 && (periodScans > 0 || allTimeScans > 0);

      return `
        <tr>
          <td style="width:36px;">
            <span class="article-rank ${isTop ? 'rank-1' : ''}">${idx + 1}</span>
          </td>
          <td>
            <div><strong>${escHtml(em.title || em.week)}</strong></div>
            <div class="bundle-info" style="margin:2px 0 0;">Editie ${escHtml(em.week)} · ${layersCount} AR-laag/lagen</div>
          </td>
          <td>
            <span class="badge ${em.published ? 'live' : 'draft'}">
              ${em.published ? 'LIVE' : 'CONCEPT'}
            </span>
          </td>
          <td style="min-width:150px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <strong>${periodScans} scans</strong>
              <span class="bundle-info">${sharePct}%</span>
            </div>
            <div class="krant-share-bar">
              <div class="krant-share-fill blue" style="width:${Math.min(100, sharePct)}%;"></div>
            </div>
          </td>
          <td><strong>${allTimeScans}</strong></td>
          <td>${uniqueScanners > 0 ? uniqueScanners : '—'}</td>
          <td>${avgArDwell > 0 ? formatDuration(avgArDwell) : '—'}</td>
          <td class="bundle-info">${em.last_scanned ? formatRelativeOrDate(em.last_scanned) : '—'}</td>
          <td style="text-align:right;">
            <button type="button" class="btn ghost mini-btn analytics-open-essay-btn" data-week="${escHtml(em.week)}">
              BEWERK
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderKrantAnalytics(data) {
  try {
    const kpis = data.kpis || {};
    const funnel = data.ar_funnel || {};
    const daily = Array.isArray(data.daily) ? data.daily : [];
    const peakDay = data.peak_day || null;
    const hourly = Array.isArray(data.hourly) ? data.hourly : [];
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const devices = Array.isArray(data.devices) ? data.devices : [];
    const languages = Array.isArray(data.languages) ? data.languages : [];
    const errors404 = Array.isArray(data.errors_404) ? data.errors_404 : [];
    const botScans = Array.isArray(data.bot_scans) ? data.bot_scans : [];
    const essayMetrics = Array.isArray(data.essay_metrics) ? data.essay_metrics : [];
    const arDiag = data.ar_diagnostics || {};
    const perfSummary = arDiag.perf_summary || {};
    const gsmHardware = Array.isArray(arDiag.gsm_hardware) ? arDiag.gsm_hardware : [];
    const recentArErrors = Array.isArray(arDiag.recent_errors) ? arDiag.recent_errors : [];

    const totalSessions = Math.max(0, Number(funnel.sessions ?? kpis.sessions?.value) || 0);
    const camStarts = Math.max(0, Number(funnel.camera_starts ?? kpis.camera_starts?.value) || 0);
    const camRate = Number(funnel.camera_rate ?? kpis.camera_starts?.rate) || 0;
    const camDenied = Math.max(0, Number(funnel.camera_denied ?? kpis.camera_starts?.denied) || 0);
    const scannedSessions = Math.max(0, Number(funnel.scanned_sessions ?? kpis.scan_conversion?.scanned_sessions) || 0);
    const scanRate = Number(funnel.scan_rate ?? kpis.scan_conversion?.value) || 0;
    const periodScans = Number(kpis.scans?.period_value ?? funnel.period_scans) || 0;
    const allTimeScans = Number(kpis.scans?.all_time ?? funnel.all_time_scans) || 0;
    const displayScans = periodScans > 0 ? periodScans : allTimeScans;
    const topEssay = funnel.top_essay || (essayMetrics.length > 0 && (essayMetrics[0].period_scans > 0 || essayMetrics[0].scans > 0) ? essayMetrics[0] : null);

    const maxDailyVal = Math.max(
      1,
      ...daily.map((d) => Math.max(Number(d.views) || 0, Number(d.scans) || 0, Number(d.visitors) || 0))
    );
    const maxHourlyVal = Math.max(
      1,
      ...hourly.map((h) => Math.max(Number(h.views) || 0, Number(h.scans) || 0))
    );

    const deviceLabels = {
      mobile: 'Smartphone (AR)',
      desktop: 'Desktop',
      tablet: 'Tablet',
    };

    analyticsContent.innerHTML = `
      <!-- 1. Top Toolbar -->
      <div class="krant-stats-toolbar">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div class="krant-stats-live">
            <span class="krant-stats-live-dot"></span>
            <span>Nu actief: ${Number(data.live_online) || 0} lezers</span>
          </div>
          <span class="bundle-info" style="margin:0;">8th Wall AR-Tracking · Cookie-vrij · AVG/GDPR-proof</span>
        </div>
        <div class="krant-stats-controls">
          ${[
            { d: 1, label: '24U' },
            { d: 7, label: '7 DAGEN' },
            { d: 30, label: '30 DAGEN' },
            { d: 90, label: '90 DAGEN' },
            { d: 365, label: '365 DAGEN' },
          ]
            .map(
              (p) => `
            <button type="button" class="period-pill ${Number(data.period_days) === p.d ? 'active' : ''}" data-days="${p.d}">
              ${p.label}
            </button>
          `
            )
            .join('')}
          <button type="button" class="btn ghost small-btn" id="krant-export-csv-btn">CSV EXPORT</button>
          <button type="button" class="btn ghost small-btn" id="krant-refresh-stats-btn">VERVERS</button>
        </div>
      </div>

      <!-- 2. 4 Kern-KPI's voor De Krant AR -->
      <div class="krant-kpi-grid">
        <div class="krant-kpi-card highlight-card">
          <span class="krant-kpi-label">AR Artikel-Scans</span>
          <div class="krant-kpi-value-row">
            <span class="krant-kpi-value">${displayScans}</span>
            ${renderTrendBadge(kpis.scans?.trend)}
          </div>
          <div class="krant-kpi-sub">
            <span>In periode: ${periodScans}</span>
            <span>All-time: ${allTimeScans}</span>
          </div>
        </div>

        <div class="krant-kpi-card">
          <span class="krant-kpi-label">Meest Gescand Artikel</span>
          <div class="krant-kpi-value-row">
            <span class="krant-kpi-title-value">
              ${topEssay ? escHtml(topEssay.title || topEssay.week) : 'Nog geen scans'}
            </span>
          </div>
          <div class="krant-kpi-sub">
            <span>${topEssay ? `Editie ${escHtml(topEssay.week)}` : 'Scan een pagina met de camera'}</span>
            <strong>${topEssay ? `${topEssay.period_scans || topEssay.scans} scans (${topEssay.share_pct}%)` : ''}</strong>
          </div>
        </div>

        <div class="krant-kpi-card">
          <span class="krant-kpi-label">AR Scan-Conversie</span>
          <div class="krant-kpi-value-row">
            <span class="krant-kpi-value">${scanRate}%</span>
            ${renderTrendBadge(kpis.scan_conversion?.trend)}
          </div>
          <div class="krant-kpi-sub">
            <span>Camera gestart: ${camRate}%</span>
            <span>${scannedSessions} / ${totalSessions} sessies</span>
          </div>
        </div>

        <div class="krant-kpi-card">
          <span class="krant-kpi-label">Unieke Bezoekers &amp; Kijktijd</span>
          <div class="krant-kpi-value-row">
            <span class="krant-kpi-value">${Number(kpis.visitors?.value) || 0}</span>
            ${renderTrendBadge(kpis.visitors?.trend)}
          </div>
          <div class="krant-kpi-sub">
            <span>Gem. kijktijd: <strong>${formatDuration(kpis.avg_dwell?.avg_ar_dwell || kpis.avg_dwell?.value)}</strong></span>
            <span>${totalSessions} sessies</span>
          </div>
        </div>
      </div>

      <!-- 3. Hoofdpaneel: Gescande Artikelen & Edities -->
      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <div>
            <h4>Gescande Artikelen &amp; Edities (${essayMetrics.length})</h4>
            <p class="bundle-info" style="margin:2px 0 0;">Welke artikelen uit de fysieke krant worden het vaakst met de smartphone-camera gescand</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="search" id="krant-articles-filter" placeholder="Filter op week of titel..." style="width:210px;padding:6px 10px;font-size:11px;" />
          </div>
        </div>
        <div class="table-scroll-wrap">
          <table id="krant-articles-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Artikel / Editie</th>
                <th>Status</th>
                <th>Scans in periode</th>
                <th>All-time scans</th>
                <th>Unieke scanners</th>
                <th>Gem. AR-kijktijd</th>
                <th>Laatst gescand</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${renderEssayScanRows(essayMetrics)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. Dagelijkse Tijdreeks & AR Conversie-Funnel -->
      <div class="krant-two-col-grid">
        <div class="krant-chart-card">
          <div class="krant-chart-head">
            <div>
              <h4>Dagelijkse AR-Scans &amp; Bezoekers</h4>
              <span class="bundle-info" id="krant-daily-hover-readout">
                ${peakDay && (peakDay.scans > 0 || peakDay.views > 0) ? `Piekdag: ${peakDay.label} (${peakDay.scans || 0} scans, ${peakDay.visitors} bezoekers)` : 'Beweeg over een kolom voor dagdetails'}
              </span>
            </div>
            <div class="chart-legend">
              <span><i class="legend-swatch" style="background:var(--accent-blue);"></i>AR-Scans</span>
              <span><i class="legend-swatch" style="background:var(--ink);"></i>Bezoeken</span>
            </div>
          </div>
          <div class="krant-vchart">
            ${daily
              .map((d, idx) => {
                const scans = Number(d.scans) || 0;
                const views = Number(d.views) || 0;
                const scansH = scans > 0 ? Math.max(6, Math.round((scans / maxDailyVal) * 100)) : 0;
                const viewsH = views > 0 ? Math.max(6, Math.round((views / maxDailyVal) * 100)) : 0;
                const isZero = scans === 0 && views === 0;
                const showLbl =
                  daily.length <= 14 || idx === 0 || idx === daily.length - 1 || idx % Math.ceil(daily.length / 8) === 0;
                return `
                  <div class="krant-vbar-col" data-label="${escHtml(d.label)}" data-scans="${scans}" data-views="${views}" data-visitors="${d.visitors}">
                    <div class="krant-vbar-stack">
                      ${scans > 0 ? `<div class="krant-vbar-scans" style="height:${scansH}%;"></div>` : ''}
                      ${views > 0 || isZero ? `<div class="krant-vbar-views ${isZero ? 'is-zero' : ''}" style="height:${viewsH}%;"></div>` : ''}
                    </div>
                    ${showLbl ? `<span class="krant-vbar-label">${escHtml(d.label)}</span>` : ''}
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="krant-chart-card">
          <div class="krant-chart-head">
            <div>
              <h4>AR Gebruikers-Funnel</h4>
              <p class="bundle-info" style="margin:2px 0 0;">Van het openen van de webapp tot het daadwerkelijk scannen van de krant</p>
            </div>
          </div>
          <div class="krant-funnel-list">
            <div class="krant-funnel-step">
              <div class="krant-funnel-top">
                <span class="krant-funnel-title">1. Krant AR Geopend</span>
                <span class="krant-funnel-val">${totalSessions} sessies (100%)</span>
              </div>
              <div class="krant-share-bar"><div class="krant-share-fill" style="width:100%;"></div></div>
              <div class="bundle-info" style="margin-top:4px;">${Number(kpis.visitors?.value) || 0} unieke bezoekers · Bounce rate: ${Number(kpis.bounce_rate?.value) || 0}%</div>
            </div>

            <div class="krant-funnel-step">
              <div class="krant-funnel-top">
                <span class="krant-funnel-title">2. Camera Gestart (8th Wall Engine)</span>
                <span class="krant-funnel-val">${camStarts} sessies (${camRate}%)</span>
              </div>
              <div class="krant-share-bar"><div class="krant-share-fill blue" style="width:${Math.min(100, camRate)}%;"></div></div>
              <div class="bundle-info" style="margin-top:4px;">
                ${camDenied > 0 ? `Camera geweigerd / geblokkeerd in ${camDenied} sessie(s)` : 'Geen camera-weigeringen geregistreerd'}
              </div>
            </div>

            <div class="krant-funnel-step">
              <div class="krant-funnel-top">
                <span class="krant-funnel-title">3. Krantenartikel Gescand</span>
                <span class="krant-funnel-val">${scannedSessions} sessies (${scanRate}%)</span>
              </div>
              <div class="krant-share-bar"><div class="krant-share-fill blue" style="width:${Math.min(100, scanRate)}%;"></div></div>
              <div class="bundle-info" style="margin-top:4px;">
                ${periodScans} scans in deze periode · ${allTimeScans} scans all-time
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. Uur-verdeling, Toestellen & Herkomst (3-Koloms Grid) -->
      <div class="krant-three-col-grid">
        <div class="krant-chart-card">
          <div class="krant-chart-head">
            <h4>Moment van de dag (24u)</h4>
            <span class="bundle-info" id="krant-hourly-hover-readout">00:00 – 23:00</span>
          </div>
          <div class="krant-vchart" style="height:150px;">
            ${hourly
              .map((h) => {
                const scans = Number(h.scans) || 0;
                const views = Number(h.views) || 0;
                const val = Math.max(scans, views);
                const isZero = val === 0;
                const pct = val > 0 ? Math.max(6, Math.round((val / maxHourlyVal) * 100)) : 0;
                const showHour = h.hour % 4 === 0;
                return `
                  <div class="krant-vbar-col krant-hour-col" data-label="${escHtml(h.label)}" data-scans="${scans}" data-views="${views}" data-visitors="${h.visitors}">
                    <div class="krant-vbar-stack">
                      <div class="${scans > 0 ? 'krant-vbar-scans' : 'krant-vbar-views'} ${isZero ? 'is-zero' : ''}" style="height:${pct}%;"></div>
                    </div>
                    ${showHour ? `<span class="krant-vbar-label">${escHtml(String(h.hour).padStart(2, '0'))}</span>` : ''}
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="krant-chart-card">
          <div class="krant-chart-head">
            <h4>Toestellen &amp; Talen</h4>
            <span class="bundle-info">Mobiel vs. Desktop</span>
          </div>
          <ul class="krant-metric-list">
            ${
              devices.length === 0
                ? `<li class="bundle-info">Nog geen toesteldata.</li>`
                : devices
                    .map(
                      (d) => `
                  <li class="krant-metric-item">
                    <div class="krant-metric-row">
                      <span><strong>${escHtml(deviceLabels[d.device] || d.device)}</strong></span>
                      <span>${d.sessions} (${d.share_pct}%)</span>
                    </div>
                    <div class="krant-share-bar"><div class="krant-share-fill" style="width:${d.share_pct}%;"></div></div>
                  </li>
                `
                    )
                    .join('')
            }
          </ul>
          ${
            languages.length > 0
              ? `
            <div style="margin-top:14px;padding-top:10px;border-top:1px dashed var(--paper-subtle);font-size:11px;">
              <span class="bundle-info">Talen: </span>
              ${languages.map((l) => `<strong>${escHtml(l.lang)}</strong> (${l.share_pct}%)`).join(' · ')}
            </div>
          `
              : ''
          }
        </div>

        <div class="krant-chart-card">
          <div class="krant-chart-head">
            <h4>Herkomst (QR &amp; Kanalen)</h4>
            <span class="bundle-info">Acquisitie</span>
          </div>
          <ul class="krant-metric-list">
            ${
              sources.length === 0
                ? `<li class="bundle-info">Nog geen sessies geregistreerd.</li>`
                : sources
                    .slice(0, 6)
                    .map(
                      (s) => `
                  <li class="krant-metric-item">
                    <div class="krant-metric-row">
                      <span><strong>${escHtml(s.source === 'Direct' ? 'Direct / Krant QR-code' : s.source)}</strong></span>
                      <span>${s.sessions} (${s.share_pct}%)</span>
                    </div>
                    <div class="krant-share-bar"><div class="krant-share-fill" style="width:${s.share_pct}%;"></div></div>
                  </li>
                `
                    )
                    .join('')
            }
          </ul>
        </div>
      </div>

      <!-- 6. AR Telemetrie, GSM Modellen & LLM-Diagnose -->
      <div class="krant-chart-card">
        <div class="krant-chart-head">
          <div>
            <h4>AR Telemetrie, GSM Modellen &amp; LLM Export</h4>
            <p class="bundle-info" style="margin:2px 0 0;">Precieze mobiele telemetrie (hardware, laadtijden, GPU en fouten) — direct exporteerbaar voor AI debugging</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button type="button" class="btn ghost small-btn" id="krant-copy-llm-prompt-btn">KOPIEER LLM PROMPT</button>
            <button type="button" class="btn ghost small-btn" id="krant-download-llm-json-btn">DOWNLOAD JSON</button>
          </div>
        </div>

        <div class="krant-diag-badges-grid">
          <div class="krant-diag-badge">
            <span class="diag-label">Mediaan Target Lock</span>
            <strong class="diag-val">${perfSummary.median_lock_ms > 0 ? (perfSummary.median_lock_ms / 1000).toFixed(2) + 's' : '—'}</strong>
            <span class="bundle-info">Tijd tot herkenning van krant</span>
          </div>
          <div class="krant-diag-badge">
            <span class="diag-label">Mediaan Engine Laadtijd</span>
            <strong class="diag-val">${perfSummary.median_engine_ms > 0 ? (perfSummary.median_engine_ms / 1000).toFixed(2) + 's' : '—'}</strong>
            <span class="bundle-info">A-Frame + 8th Wall chunks</span>
          </div>
          <div class="krant-diag-badge">
            <span class="diag-label">Mediaan Camera Start</span>
            <strong class="diag-val">${perfSummary.median_cam_ms > 0 ? (perfSummary.median_cam_ms / 1000).toFixed(2) + 's' : '—'}</strong>
            <span class="bundle-info">Stream request tot active feed</span>
          </div>
          <div class="krant-diag-badge">
            <span class="diag-label">Geregistreerde AR Fouten</span>
            <strong class="diag-val ${recentArErrors.length > 0 ? 'has-errors' : ''}">${recentArErrors.length}</strong>
            <span class="bundle-info">${recentArErrors.length > 0 ? 'Fouten opgevangen in periode' : 'Geen hardware/camera crashes'}</span>
          </div>
        </div>

        <div class="krant-diag-subgrid">
          <div>
            <div class="krant-chart-head" style="margin-bottom:8px;padding-bottom:8px;">
              <h5 style="margin:0;font-size:13px;font-family:var(--font-serif);font-weight:600;">GSM Toestellen &amp; GPU Matrix (${gsmHardware.length})</h5>
              <span class="bundle-info">Scan-succes per model</span>
            </div>
            <div class="table-scroll-wrap">
              <table class="krant-diag-table">
                <thead>
                  <tr>
                    <th>GSM Model</th>
                    <th>GPU / Renderer</th>
                    <th>Sessies</th>
                    <th>Scans</th>
                    <th>Fouten</th>
                    <th>Gem. Lock</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    gsmHardware.length === 0
                      ? `<tr><td colspan="6" class="bundle-info">Nog geen mobiele telemetrie vastgelegd.</td></tr>`
                      : gsmHardware
                          .slice(0, 15)
                          .map(
                            (g) => `
                        <tr>
                          <td><strong>${escHtml(g.model)}</strong></td>
                          <td class="bundle-info">${escHtml(g.gpu || '—')}</td>
                          <td>${g.sessions}</td>
                          <td><strong>${g.scans}</strong> (${g.scan_rate_pct}%)</td>
                          <td><span class="${g.errors > 0 ? 'krant-kpi-trend down' : 'bundle-info'}">${g.errors}</span></td>
                          <td>${g.avg_lock_ms > 0 ? (g.avg_lock_ms / 1000).toFixed(2) + 's' : '—'}</td>
                        </tr>
                      `
                          )
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div class="krant-chart-head" style="margin-bottom:8px;padding-bottom:8px;">
              <h5 style="margin:0;font-size:13px;font-family:var(--font-serif);font-weight:600;">Recente AR Foutmeldingen (${recentArErrors.length})</h5>
              <span class="bundle-info">Voor LLM analyse</span>
            </div>
            <div style="max-height:280px;overflow-y:auto;">
              ${
                recentArErrors.length === 0
                  ? `<p class="bundle-info" style="padding:10px 0;">Geen camera- of WebGL-fouten gedetecteerd in deze periode.</p>`
                  : `
                <ul class="error-log-list">
                  ${recentArErrors
                    .slice(0, 15)
                    .map((err) => {
                      const hw = err.hw || {};
                      return `
                      <li class="error-log-item">
                        <div class="error-log-top">
                          <span class="error-cat-badge">${escHtml(err.category || 'error')} / ${escHtml(err.stage || 'runtime')}</span>
                          <span class="bundle-info">${formatRelativeOrDate(err.t)}</span>
                        </div>
                        <div><strong>${escHtml(err.message || 'Onbekende fout')}</strong></div>
                        <div class="bundle-info">
                          Toestel: ${escHtml(hw.model || 'Onbekend')} · GPU: ${escHtml(hw.gpu || 'Onbekend')} ${hw.screen ? '· ' + escHtml(hw.screen) : ''}
                        </div>
                        ${err.details ? `<div style="font-family:var(--font-mono);font-size:9px;color:var(--ink-muted);word-break:break-all;">${escHtml(err.details.slice(0, 150))}</div>` : ''}
                      </li>
                    `;
                    })
                    .join('')}
                </ul>
              `
              }
            </div>
          </div>
        </div>
      </div>

      <!-- 7. Inklapbare Systeemdiagnose (404-meldingen & Bot-filtering) -->
      <details class="analytics-tech-details" ${errors404.length > 0 ? 'open' : ''}>
        <summary>
          <span>Systeemdiagnose: 404-meldingen (${errors404.length}) &amp; Geblokkeerde bot-scans (${Number(kpis.bots_filtered?.value) || 0})</span>
          <span class="bundle-info" style="margin:0;">Klik om te openen/sluiten</span>
        </summary>
        <div class="analytics-tech-body">
          <div>
            <div class="krant-chart-head">
              <h4>Errors (404 — Echte bezoekers: ${errors404.length})</h4>
              ${
                errors404.length > 0
                  ? `<button type="button" class="btn danger mini-btn" id="krant-dismiss-all-404">WIS ALLES</button>`
                  : ''
              }
            </div>
            <div class="table-scroll-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pad</th>
                    <th>Hits</th>
                    <th>Referrer</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    errors404.length === 0
                      ? `<tr><td colspan="4" class="bundle-info">Geen 404-meldingen van echte bezoekers.</td></tr>`
                      : errors404
                          .map(
                            (err) => `
                        <tr>
                          <td><code>${escHtml(err.page)}</code></td>
                          <td><strong>${err.count}</strong></td>
                          <td class="bundle-info">${escHtml(err.last_ref || 'Direct')}</td>
                          <td style="text-align:right;">
                            <button type="button" class="icon-btn danger dismiss-404-btn" data-page="${escHtml(err.page)}">WIS</button>
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

          <div>
            <div class="krant-chart-head">
              <h4>Geblokkeerde bot- &amp; kwetsbaarheidsscans (${botScans.length})</h4>
              <span class="bundle-info">Automatisch genegeerd</span>
            </div>
            <div class="table-scroll-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pad</th>
                    <th>Categorie</th>
                    <th>Hits</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    botScans.length === 0
                      ? `<tr><td colspan="3" class="bundle-info">Geen kwetsbaarheidsscans gedetecteerd.</td></tr>`
                      : botScans
                          .slice(0, 15)
                          .map(
                            (s) => `
                        <tr>
                          <td><code class="bundle-info">${escHtml(s.page)}</code></td>
                          <td class="bundle-info">${escHtml(s.category || 'Bot')}</td>
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
      </details>
    `;

    // Wire up analytics events
    analyticsContent.querySelectorAll('.period-pill').forEach((btn) => {
      btn.addEventListener('click', () => loadKrantAnalytics(Number(btn.dataset.days)));
    });

    document.getElementById('krant-refresh-stats-btn')?.addEventListener('click', () => {
      loadKrantAnalytics(currentStatsDays);
    });

    document.getElementById('krant-export-csv-btn')?.addEventListener('click', () => {
      exportKrantAnalyticsCsv(data);
    });

    document.getElementById('krant-copy-llm-prompt-btn')?.addEventListener('click', async () => {
      const promptText = data.ar_diagnostics?.llm_prompt || 'Geen telemetrie beschikbaar.';
      const btn = document.getElementById('krant-copy-llm-prompt-btn');
      try {
        await navigator.clipboard.writeText(promptText);
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = 'GEKOPIEERD NAAR KLEMBLORD!';
          setTimeout(() => { btn.textContent = orig; }, 2000);
        }
      } catch (e) {
        alert('Kopiëren mislukt: selecteer handmatig in JSON.');
      }
    });

    document.getElementById('krant-download-llm-json-btn')?.addEventListener('click', () => {
      const diagData = {
        generated_at: new Date().toISOString(),
        period_days: data.period_days,
        kpis: data.kpis,
        ar_funnel: data.ar_funnel,
        ar_diagnostics: data.ar_diagnostics,
        essay_metrics: data.essay_metrics,
        hourly: data.hourly,
        daily: data.daily
      };
      const blob = new Blob([JSON.stringify(diagData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `krant-ar-diagnostics-${data.period_days}d-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const dailyReadout = document.getElementById('krant-daily-hover-readout');
    analyticsContent.querySelectorAll('.krant-vbar-col[data-scans]').forEach((col) => {
      if (col.classList.contains('krant-hour-col')) return;
      col.addEventListener('mouseenter', () => {
        if (dailyReadout) {
          dailyReadout.textContent = `${col.dataset.label}: ${col.dataset.scans} AR-scans · ${col.dataset.views} weergaven · ${col.dataset.visitors} unieke bezoekers`;
        }
      });
    });

    const hourlyReadout = document.getElementById('krant-hourly-hover-readout');
    analyticsContent.querySelectorAll('.krant-hour-col').forEach((col) => {
      col.addEventListener('mouseenter', () => {
        if (hourlyReadout) {
          hourlyReadout.textContent = `${col.dataset.label} — ${col.dataset.scans} scans · ${col.dataset.views} weergaven`;
        }
      });
    });

    const articlesFilter = document.getElementById('krant-articles-filter');
    const articlesTbody = document.querySelector('#krant-articles-table tbody');
    articlesFilter?.addEventListener('input', () => {
      if (articlesTbody) {
        articlesTbody.innerHTML = renderEssayScanRows(essayMetrics, articlesFilter.value);
        bindAnalyticsEssayButtons();
      }
    });

    function bindAnalyticsEssayButtons() {
      analyticsContent.querySelectorAll('.analytics-open-essay-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const wk = btn.dataset.week;
          if (wk) {
            switchMainView('editor');
            loadIntoForm(wk);
          }
        });
      });
    }
    bindAnalyticsEssayButtons();

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
        body: JSON.stringify({ all: true }),
      });
      await loadKrantAnalytics(currentStatsDays);
    });
  } catch (err) {
    analyticsContent.innerHTML = `<div class="panel-card"><div class="panel-card-body"><p class="error" style="margin:0;">Weergavefout in statistieken: ${escHtml(err.message)}</p></div></div>`;
  }
}

function exportKrantAnalyticsCsv(data) {
  const lines = [
    ['Type', 'Week/Datum', 'Titel/Label', 'Scans (Periode)', 'Scans (All-time) / Views', 'Unieke Scanners / Bezoekers', 'Gem. AR-Kijktijd (sec)'].join(','),
  ];
  (data.essay_metrics || []).forEach((em) => {
    const cleanTitle = `"${String(em.title || '').replace(/"/g, '""')}"`;
    lines.push([
      'ARTIKEL',
      `"${em.week}"`,
      cleanTitle,
      em.period_scans || 0,
      em.scans || 0,
      em.unique_scanners || 0,
      em.avg_ar_dwell || 0,
    ].join(','));
  });
  (data.daily || []).forEach((d) => {
    lines.push(['DAG', d.date, `"${d.label}"`, d.scans || 0, d.views || 0, d.visitors || 0, d.sessions || 0].join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `krant-ar-analytics-${data.period_days}d-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

(async function init() {
  resetForm();
  try {
    const data = await apiJson('/admin/status');
    if (data.needs_setup) {
      showSetup();
    } else if (data.logged_in) {
      setAnalyticsIgnored(true);
      showPanel();
    } else {
      showLogin();
    }
  } catch (_) {
    showLogin();
  }
})();
