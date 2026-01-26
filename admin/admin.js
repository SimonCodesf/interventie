// Admin.js - Client-side JavaScript voor het admin dashboard

// Layer Configuration - centraal beheer van layers
const LAYER_CONFIG = {
    maxLayers: 8,
    defaultLayers: [
        { num: 1, name: 'Base - op poster oppervlak', defaultZ: 0.000 },
        { num: 2, name: '1cm boven poster', defaultZ: 0.010 },
        { num: 3, name: '4cm boven poster', defaultZ: 0.040 },
        { num: 4, name: '10cm boven poster', defaultZ: 0.100 },
        { num: 5, name: 'Extra layer 5', defaultZ: 0.150 },
        { num: 6, name: 'Extra layer 6', defaultZ: 0.200 },
        { num: 7, name: 'Extra layer 7', defaultZ: 0.250 },
        { num: 8, name: 'Extra layer 8', defaultZ: 0.300 }
    ]
};


// ========== GIF handling: use GIF directly as video ==========
// GIFs can be used directly in <a-video> tags; no conversion needed!
async function convertGifFileToMp4(file, label = 'layer') {
    if (file.type !== 'image/gif') {
        console.log(`[GIF] Not a GIF, skipping: ${file.name}`);
        return file;
    }
    
    console.log(`[GIF] Sending GIF directly as video (no conversion needed): ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    
    // Return GIF as-is; A-Frame can play GIFs directly in <a-video> elements
    return file;
}



// Generate HTML for a single layer
function generateLayerHTML(layerNum, isEditForm = false) {
    const prefix = isEditForm ? 'edit-' : '';
    const config = LAYER_CONFIG.defaultLayers.find(l => l.num === layerNum);
    const layerName = config ? config.name : `Layer ${layerNum}`;
    const defaultZ = config ? config.defaultZ : 0;
    
    // Open first layer by default
    const isOpen = layerNum === 1 ? 'open' : '';
    
    return `
        <details class="layer-accordion" ${isOpen}>
            <summary>
                <span>Laag ${layerNum} - ${layerName}</span>
                <span class="layer-status" id="${prefix}layer-${layerNum}-status">Leeg</span>
            </summary>
            <div class="layer-content">
                <div class="form-group">
                    <label for="${prefix}layer-${layerNum}-image">${isEditForm ? 'Nieuwe afbeelding/video (optioneel)' : 'Afbeelding (.png/.jpg) of Video (.mp4/.webm, GIF geconverteerd naar MP4)'}:</label>
                    <input type="file" id="${prefix}layer-${layerNum}-image" name="layer_${layerNum}_image" accept="image/png,image/jpeg,image/gif,video/mp4,video/webm">
                    <input type="hidden" id="${prefix}layer-${layerNum}-delete" name="layer_${layerNum}_delete" value="0">
                    ${isEditForm ? `<p class="file-info" id="${prefix}layer-${layerNum}-current" style="font-size: 0.85rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem; font-family: 'Roboto Mono', monospace;"></p>` : ''}
                </div>
                
                <div class="position-scale-section">
                    <h5 class="section-subtitle">BASIS POSITIE & SCHAAL</h5>
                    <div class="anim-group">
                        <div class="anim-inputs">
                            <div class="input-wrapper">
                                <label>X OFFSET</label>
                                <input type="number" id="${prefix}layer-${layerNum}-pos-x" name="layer_${layerNum}_pos_x" placeholder="0.000" step="0.001">
                            </div>
                            <div class="input-wrapper">
                                <label>Y OFFSET</label>
                                <input type="number" id="${prefix}layer-${layerNum}-pos-y" name="layer_${layerNum}_pos_y" placeholder="0.000" step="0.001">
                            </div>
                            <div class="input-wrapper">
                                <label>Z-POS</label>
                                <input type="number" id="${prefix}layer-${layerNum}-z" name="layer_${layerNum}_z" step="0.001" value="${defaultZ.toFixed(3)}" placeholder="${defaultZ.toFixed(3)}">
                            </div>
                        </div>
                    </div>
                    <div class="anim-group">
                        <div class="anim-inputs">
                            <div class="input-wrapper">
                                <label>SCALE</label>
                                <input type="number" id="${prefix}layer-${layerNum}-scale" name="layer_${layerNum}_scale" placeholder="1.0" step="0.001" value="1.0">
                            </div>
                            <div class="input-wrapper">
                                <label>ROT-X</label>
                                <input type="number" id="${prefix}layer-${layerNum}-rot-x" name="layer_${layerNum}_rot_x" placeholder="0" step="1" value="0">
                            </div>
                            <div class="input-wrapper">
                                <label>ROT-Y</label>
                                <input type="number" id="${prefix}layer-${layerNum}-rot-y" name="layer_${layerNum}_rot_y" placeholder="0" step="1" value="0">
                            </div>
                            <div class="input-wrapper">
                                <label>ROT-Z</label>
                                <input type="number" id="${prefix}layer-${layerNum}-rot-z" name="layer_${layerNum}_rot_z" placeholder="0" step="1" value="0">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="toggle-label">
                        <div class="toggle-switch">
                            <input type="checkbox" id="${prefix}layer-${layerNum}-exclusion" name="layer_${layerNum}_exclusion" value="1">
                            <span class="toggle-slider"></span>
                        </div>
                        <span>Exclusion filter (masker)</span>
                    </label>
                </div>
                
                <div class="animation-section">
                    <label class="toggle-label">
                        <div class="toggle-switch">
                            <input type="checkbox" id="${prefix}layer-${layerNum}-enable-anim">
                            <span class="toggle-slider"></span>
                        </div>
                        <span>ANIMATIE INSCHAKELEN</span>
                    </label>
                    
                    <div id="${prefix}layer-${layerNum}-anim-container" class="anim-container-hidden">
                        
                        <div class="preset-selector">
                            <label>PRESET:</label>
                            <select id="${prefix}layer-${layerNum}-anim-preset" onchange="applyAnimPreset(this, '${prefix}', ${layerNum})" class="terminal-select">
                                <option value="">-- Kies een animatie --</option>
                                <option value="reset">Reset (Geen animatie)</option>
                                <optgroup label="Rotatie">
                                    <option value="spin-y">Draaien rond Y-as (Loop)</option>
                                    <option value="spin-x">Draaien rond X-as (Loop)</option>
                                    <option value="spin-z">Draaien rond Z-as (Loop)</option>
                                </optgroup>
                                <optgroup label="Beweging">
                                    <option value="float-up">Omhoog zweven</option>
                                    <option value="hover">Zweven (Op & Neer)</option>
                                    <option value="slide-in">Inschuiven van links</option>
                                </optgroup>
                                <optgroup label="Effecten">
                                    <option value="pulse">Hartslag (Pulse)</option>
                                    <option value="fade-in">Inkomen (Fade In)</option>
                                    <option value="pop-in">Pop In (Schaal)</option>
                                    <option value="blink">Knipperen</option>
                                </optgroup>
                            </select>
                        </div>

                        <div class="anim-group">
                            <h5>Positie Offset (meters)</h5>
                            <div class="anim-inputs">
                                <div class="input-wrapper">
                                    <label>X</label>
                                    <input type="number" id="${prefix}layer-${layerNum}-anim-x" name="layer_${layerNum}_anim_x" placeholder="0.000" step="0.001">
                                </div>
                                <div class="input-wrapper">
                                    <label>Y</label>
                                    <input type="number" id="${prefix}layer-${layerNum}-anim-y" name="layer_${layerNum}_anim_y" placeholder="0.000" step="0.001">
                                </div>
                                <div class="input-wrapper">
                                    <label>Z</label>
                                    <input type="number" id="${prefix}layer-${layerNum}-anim-z" name="layer_${layerNum}_anim_z" placeholder="0.000" step="0.001">
                                </div>
                            </div>
                        </div>

                        <div class="anim-group">
                            <h5>Rotatie (graden)</h5>
                            <div class="anim-inputs">
                                <div class="input-wrapper">
                                    <label>X</label>
                                    <input type="number" id="${prefix}layer-${layerNum}-anim-rot-x" name="layer_${layerNum}_anim_rot_x" placeholder="0" step="1">
                                </div>
                                <div class="input-wrapper">
                                    <label>Y</label>
                                    <input type="number" id="${prefix}layer-${layerNum}-anim-rot-y" name="layer_${layerNum}_anim_rot_y" placeholder="0" step="1">
                                </div>
                                <div class="input-wrapper">
                                    <label>Z</label>
                                    <input type="number" id="${prefix}layer-${layerNum}-anim-rot-z" name="layer_${layerNum}_anim_rot_z" placeholder="0" step="1">
                                </div>
                            </div>
                        </div>

                        <div class="anim-group">
                            <h5>Effecten & Tijd</h5>
                            <div class="anim-inputs">
                                <div class="input-wrapper" style="flex: 1;">
                                    <label style="width: auto; position: relative; transform: none; top: auto; left: auto; display: block; margin-bottom: 4px;">Schaal</label>
                                    <input type="number" id="${prefix}layer-${layerNum}-anim-scale" name="layer_${layerNum}_anim_scale" placeholder="1.0" step="0.1" style="padding-left: 0.8rem !important; text-align: left;">
                                </div>
                                <div class="input-wrapper" style="flex: 1;">
                                    <label style="width: auto; position: relative; transform: none; top: auto; left: auto; display: block; margin-bottom: 4px;">Opaciteit</label>
                                    <input type="number" id="${prefix}layer-${layerNum}-anim-opacity" name="layer_${layerNum}_anim_opacity" placeholder="1.0" step="0.1" min="0" max="1" style="padding-left: 0.8rem !important; text-align: left;">
                                </div>
                                <div class="input-wrapper" style="flex: 1.5;">
                                    <label style="width: auto; position: relative; transform: none; top: auto; left: auto; display: block; margin-bottom: 4px;">Duur (ms)</label>
                                    <input type="number" id="${prefix}layer-${layerNum}-anim-duration" name="layer_${layerNum}_anim_duration" placeholder="0" style="padding-left: 0.8rem !important; text-align: left;">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- AR Extras per laag -->
                <div class="ar-extras-layer-section">
                    <label class="toggle-label">
                        <div class="toggle-switch">
                            <input type="checkbox" id="${prefix}layer-${layerNum}-enable-extras">
                            <span class="toggle-slider"></span>
                        </div>
                        <span>AR EXTRAS (3D/AUDIO)</span>
                    </label>
                    
                    <div id="${prefix}layer-${layerNum}-extras-container" class="anim-container-hidden">
                        <div class="anim-group">
                            <div class="anim-inputs" style="flex-direction: column; gap: 0.75rem;">
                                <div class="input-wrapper" style="width: 100%;">
                                    <label style="width: auto; position: relative; transform: none; display: block; margin-bottom: 4px;">3D MODEL (.glb)</label>
                                    <input type="file" id="${prefix}layer-${layerNum}-glb" name="layer_${layerNum}_glb" accept=".glb,.gltf" style="width: 100%;">
                                    ${isEditForm ? `<p class="file-info" id="${prefix}layer-${layerNum}-glb-current" style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem;"></p>` : ''}
                                    <p class="hint-text" style="font-size: 0.65rem; color: rgba(255,255,255,0.4); margin-top: 0.25rem;">Max 10MB. Model verschijnt op deze laag positie.</p>
                                </div>
                                <div class="input-wrapper" style="width: 100%;">
                                    <label style="width: auto; position: relative; transform: none; display: block; margin-bottom: 4px;">AUDIO (.mp3/.wav)</label>
                                    <input type="file" id="${prefix}layer-${layerNum}-audio" name="layer_${layerNum}_audio" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" style="width: 100%;">
                                    ${isEditForm ? `<p class="file-info" id="${prefix}layer-${layerNum}-audio-current" style="font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem;"></p>` : ''}
                                    <p class="hint-text" style="font-size: 0.65rem; color: rgba(255,255,255,0.4); margin-top: 0.25rem;">Max 10MB. Speelt bij detectie van deze laag.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${isEditForm ? `
                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 0.5px solid #ddd;">
                    <button type="button" onclick="deleteLayer(${layerNum})" style="background: #e74c3c; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-weight: 600; width: 100%;">
                        Verwijder Laag ${layerNum}
                    </button>
                </div>
                ` : ''}
            </div>
        </details>
    `;
}

// Verwijder een AR laag (alleen in edit mode)
function deleteLayer(layerNum) {
    if (!confirm(`Weet je zeker dat je laag ${layerNum} wilt verwijderen?`)) {
        return;
    }
    
    // Reset al laag input velden
    const inputIds = [
        `edit-layer-${layerNum}-image`,
        `edit-layer-${layerNum}-pos-x`,
        `edit-layer-${layerNum}-pos-y`,
        `edit-layer-${layerNum}-z`,
        `edit-layer-${layerNum}-scale`,
        `edit-layer-${layerNum}-rot-z`,
        `edit-layer-${layerNum}-exclusion`,
        `edit-layer-${layerNum}-enable-anim`,
        `edit-layer-${layerNum}-anim-x`,
        `edit-layer-${layerNum}-anim-y`,
        `edit-layer-${layerNum}-anim-z`,
        `edit-layer-${layerNum}-anim-rot-x`,
        `edit-layer-${layerNum}-anim-rot-y`,
        `edit-layer-${layerNum}-anim-rot-z`,
        `edit-layer-${layerNum}-anim-scale`,
        `edit-layer-${layerNum}-anim-opacity`,
        `edit-layer-${layerNum}-anim-duration`,
        `edit-layer-${layerNum}-anim-preset`
    ];
    
    // Set delete flag
    const deleteInput = document.getElementById(`edit-layer-${layerNum}-delete`);
    if (deleteInput) {
        deleteInput.value = '1';
    }
    
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = false;
            } else if (el.type === 'file') {
                el.value = '';
            } else if (el.tagName === 'SELECT') {
                el.value = '';
            } else {
                const defaultVal = LAYER_CONFIG.defaultLayers.find(l => l.num === layerNum)?.defaultZ?.toFixed(3) || '0.000';
                el.value = id.includes('pos-x') || id.includes('pos-y') ? '0.000' : 
                           id.includes('-z') && !id.includes('rot') ? defaultVal :
                           id.includes('scale') ? '1.0' :
                           '';
            }
        }
    });
    
    // Reset GLB en audio file inputs
    const glbInput = document.getElementById(`edit-layer-${layerNum}-glb`);
    const audioInput = document.getElementById(`edit-layer-${layerNum}-audio`);
    if (glbInput) glbInput.value = '';
    if (audioInput) audioInput.value = '';
    
    // Reset GLB en audio current info
    const glbCurrent = document.getElementById(`edit-layer-${layerNum}-glb-current`);
    const audioCurrent = document.getElementById(`edit-layer-${layerNum}-audio-current`);
    if (glbCurrent) {
        glbCurrent.textContent = 'Geen 3D model';
        glbCurrent.style.color = '#999';
    }
    if (audioCurrent) {
        audioCurrent.textContent = 'Geen audio';
        audioCurrent.style.color = '#999';
    }
    
    // Reset animation container
    const animContainer = document.getElementById(`edit-layer-${layerNum}-anim-container`);
    if (animContainer) {
        animContainer.style.display = 'none';
    }
    
    // Reset extras container
    const extrasContainer = document.getElementById(`edit-layer-${layerNum}-extras-container`);
    if (extrasContainer) {
        extrasContainer.style.display = 'none';
    }
    const extrasToggle = document.getElementById(`edit-layer-${layerNum}-enable-extras`);
    if (extrasToggle) {
        extrasToggle.checked = false;
    }
    
    // Update status badge
    const statusBadge = document.getElementById(`edit-layer-${layerNum}-status`);
    if (statusBadge) {
        statusBadge.textContent = 'Leeg';
    }
    
    // Update current file info
    const currentFileInfo = document.getElementById(`edit-layer-${layerNum}-current`);
    if (currentFileInfo) {
        currentFileInfo.textContent = 'Geen afbeelding';
        currentFileInfo.style.color = '#999';
    }
    
    alert(`Laag ${layerNum} is verwijderd!`);
}

// API URL - Detect environment
const API_URL = window.location.origin + '/api.php'; // cPanel with PHP backend
const BASE_URL = window.location.origin; // Voor statische bestanden

// Utility function voor file size formatting
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Get file size category for styling
function getFileSizeCategory(bytes, maxBytes) {
    const percentage = (bytes / maxBytes) * 100;
    if (percentage > 80) return 'large';
    if (percentage > 50) return 'medium';
    return 'small';
}

// Apply animation preset
function applyAnimPreset(selectEl, prefix, layerNum) {
    const preset = selectEl.value;
    if (!preset) return;

    const setVal = (id, val) => {
        const el = document.getElementById(`${prefix}layer-${layerNum}-${id}`);
        if (el) el.value = val;
    };

    // Reset all first
    setVal('anim-x', 0); setVal('anim-y', 0); setVal('anim-z', 0);
    setVal('anim-rot-x', 0); setVal('anim-rot-y', 0); setVal('anim-rot-z', 0);
    setVal('anim-scale', 1.0); setVal('anim-opacity', 1.0); setVal('anim-duration', 0);

    switch(preset) {
        case 'reset':
            // Already reset above
            break;
        case 'spin-y':
            setVal('anim-rot-y', 360);
            setVal('anim-duration', 5000);
            break;
        case 'spin-x':
            setVal('anim-rot-x', 360);
            setVal('anim-duration', 5000);
            break;
        case 'spin-z':
            setVal('anim-rot-z', 360);
            setVal('anim-duration', 5000);
            break;
        case 'float-up':
            setVal('anim-y', 0.5); // 50cm up
            setVal('anim-duration', 3000);
            break;
        case 'hover':
            setVal('anim-y', 0.2); // 20cm up/down
            setVal('anim-duration', 2000);
            break;
        case 'slide-in':
            setVal('anim-x', -1.0); // Start from left?
            setVal('anim-duration', 1500);
            break;
        case 'pulse':
            setVal('anim-scale', 1.2);
            setVal('anim-duration', 1000);
            break;
        case 'fade-in':
            setVal('anim-opacity', 0); 
            setVal('anim-duration', 2000);
            break;
        case 'pop-in':
            setVal('anim-scale', 0.01); // Start small
            setVal('anim-duration', 800);
            break;
        case 'blink':
            setVal('anim-opacity', 0);
            setVal('anim-duration', 500);
            break;
    }
}

// Session timeout warning (1 hour = 3600 seconds)
const SESSION_TIMEOUT = 3600000; // milliseconds
let sessionTimer = null;

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    renderLayers(false); // Render layers first so elements exist

    const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
    if (isLoggedIn === 'true') {
        showUploadSection();
        loadAdminPosters();
        startSessionTimer(); // Restart timer on page load
    }
    
    setupLoginForm();
    setupUploadForm();
    setupFilePreview();
    setupLogoutButton();
    setupFileSummaryListeners(); // Core files
    setupCreditsSection(); // Credits dynamic rows
    
    // Defer layer listeners slightly to ensure inputs exist
    setTimeout(setupLayerSummaryListeners, 500);
});

// ========== Credits Sectie - Dynamische rijen ==========

function createCreditRow(item = '', owner = '') {
    const row = document.createElement('div');
    row.className = 'credit-row';
    row.innerHTML = `
        <input type="text" class="credit-item" placeholder="Item (bv. Foto)" value="${item}">
        <input type="text" class="credit-owner" placeholder="Eigenaar" value="${owner}">
        <button type="button" class="btn-remove-credit" title="Verwijder">&times;</button>
    `;
    
    // Verwijder knop event
    row.querySelector('.btn-remove-credit').addEventListener('click', () => {
        row.remove();
    });
    
    return row;
}

function setupCreditsSection() {
    // Upload form
    const addBtn = document.getElementById('add-credit-btn');
    const container = document.getElementById('credits-container');
    
    if (addBtn && container) {
        // Setup remove knop voor de eerste rij
        const firstRemoveBtn = container.querySelector('.btn-remove-credit');
        if (firstRemoveBtn) {
            firstRemoveBtn.addEventListener('click', function() {
                // Als er maar 1 rij is, leeg de velden i.p.v. verwijderen
                const rows = container.querySelectorAll('.credit-row');
                if (rows.length <= 1) {
                    this.closest('.credit-row').querySelectorAll('input').forEach(inp => inp.value = '');
                } else {
                    this.closest('.credit-row').remove();
                }
            });
        }
        
        addBtn.addEventListener('click', () => {
            container.appendChild(createCreditRow());
        });
    }
    
    // Edit form
    const editAddBtn = document.getElementById('edit-add-credit-btn');
    if (editAddBtn) {
        editAddBtn.addEventListener('click', () => {
            const editContainer = document.getElementById('edit-credits-container');
            if (editContainer) {
                editContainer.appendChild(createCreditRow());
            }
        });
    }
}

// Verzamel alle credits uit een container als JSON array
function collectCredits(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const credits = [];
    container.querySelectorAll('.credit-row').forEach(row => {
        const item = row.querySelector('.credit-item').value.trim();
        const owner = row.querySelector('.credit-owner').value.trim();
        if (item || owner) {
            credits.push({ item: item, owner: owner });
        }
    });
    
    return credits;
}

// Vul credits container met bestaande data
function populateCredits(containerId, creditsData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = ''; // Leeg de container
    
    let credits = [];
    
    // Parse credits als het een string is (JSON)
    if (typeof creditsData === 'string' && creditsData) {
        try {
            credits = JSON.parse(creditsData);
        } catch (e) {
            console.warn('Credits JSON parse error:', e);
            // Fallback: oude photographer_credit formaat
            credits = [{ item: 'Foto', owner: creditsData }];
        }
    } else if (Array.isArray(creditsData)) {
        credits = creditsData;
    }
    
    if (credits.length === 0) {
        // Voeg lege rij toe
        container.appendChild(createCreditRow());
    } else {
        credits.forEach(c => {
            container.appendChild(createCreditRow(c.item || '', c.owner || ''));
        });
    }
}

function setupFileSummaryListeners() {
    const inputs = [
        { id: 'poster-jpeg', summaryId: 'summary-jpeg' },
        { id: 'ar-marker-file', summaryId: 'summary-mind' },
        { id: 'poster-pdf-medium', summaryId: 'summary-pdf-a3' },
        { id: 'poster-pdf-large', summaryId: 'summary-pdf-a0' }
    ];

    inputs.forEach(input => {
        const el = document.getElementById(input.id);
        if (el) {
            el.addEventListener('change', function() {
                const summaryEl = document.getElementById(input.summaryId);
                if (this.files && this.files[0]) {
                    summaryEl.classList.add('completed');
                    summaryEl.classList.remove('pending');
                    // Format size
                    const size = (this.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                    summaryEl.querySelector('span').textContent = `[OK] ${size}`;
                } else {
                    summaryEl.classList.remove('completed');
                    summaryEl.classList.add('pending');
                    // Reset tekst: originele tekst behouden
                    const isOptional = input.id.includes('glb') || input.id.includes('audio');
                    summaryEl.querySelector('span').textContent = isOptional ? 'optioneel' : '...';
                }
            });
        }
    });
}

function setupLayerSummaryListeners() {
    const layersContainer = document.getElementById('summary-layers-container');
    const updateLayersSummary = () => {
        const activeLayers = [];
        
        // Check all 8 possible layers
        for (let i = 1; i <= 8; i++) {
            const input = document.getElementById(`layer-${i}-image`);
            if (input && input.files && input.files[0]) {
                const size = (input.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                activeLayers.push({
                    name: `Laag ${i}`,
                    size: size,
                    filename: input.files[0].name
                });
            }
        }
        
        if (activeLayers.length === 0) {
            layersContainer.innerHTML = '<div class="summary-item pending" style="font-style: italic; opacity: 0.5;">Geen lagen geselecteerd</div>';
        } else {
            layersContainer.innerHTML = activeLayers.map(l => `
                <div class="summary-item completed">
                    ${l.name}
                    <span>[OK] ${l.size}</span>
                </div>
            `).join('');
        }
    };

    // Attach listeners to layer inputs
    for (let i = 1; i <= 8; i++) {
        const input = document.getElementById(`layer-${i}-image`);
        if (input) {
            input.addEventListener('change', updateLayersSummary);
        }
    }
}

// Track changes in edit modal
function setupEditChangesSummary() {
    const summaryContainer = document.getElementById('edit-changes-summary');
    if (!summaryContainer) return;

    const updateSummary = () => {
        const changes = [];
        
        // Check file changes
        const fileChecks = [
            { id: 'edit-jpeg', label: 'Nieuwe JPEG' },
            { id: 'edit-ar-marker-file', label: 'Nieuwe AR Marker' },
            { id: 'edit-pdf-medium', label: 'Nieuwe PDF (A3)' },
            { id: 'edit-pdf-large', label: 'Nieuwe PDF (A0)' },
            { id: 'edit-glb-model', label: 'Nieuw 3D Model' },
            { id: 'edit-audio', label: 'Nieuw Audio bestand' }
        ];
        
        fileChecks.forEach(check => {
            const input = document.getElementById(check.id);
            if (input && input.files && input.files[0]) {
                const size = (input.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                changes.push({ label: check.label, value: `[OK] ${size}` });
            }
        });
        
        // Check verwijderingen
        const deleteGlb = document.getElementById('edit-delete-glb');
        const deleteAudio = document.getElementById('edit-delete-audio');
        if (deleteGlb && deleteGlb.value === '1') {
            changes.push({ label: '3D Model', value: '[VERWIJDEREN]', isDelete: true });
        }
        if (deleteAudio && deleteAudio.value === '1') {
            changes.push({ label: 'Audio bestand', value: '[VERWIJDEREN]', isDelete: true });
        }
        
        // Check layer changes
        for (let i = 1; i <= 8; i++) {
            const input = document.getElementById(`edit-layer-${i}-image`);
            if (input && input.files && input.files[0]) {
                const size = (input.files[0].size / 1024 / 1024).toFixed(2) + ' MB';
                changes.push({ label: `Laag ${i}`, value: `[OK] ${size}` });
            }
        }
        
        // Render summary
        if (changes.length === 0) {
            summaryContainer.innerHTML = '<div class="summary-item pending" style="font-style: italic; opacity: 0.5;">Geen wijzigingen</div>';
        } else {
            summaryContainer.innerHTML = changes.map(c => `
                <div class="summary-item ${c.isDelete ? 'delete' : 'completed'}">
                    ${c.label}
                    <span>${c.value}</span>
                </div>
            `).join('');
        }
    };

    // Attach listeners to all edit inputs
    const allInputs = ['edit-jpeg', 'edit-ar-marker-file', 'edit-pdf-medium', 'edit-pdf-large', 'edit-glb-model', 'edit-audio'];
    allInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('change', updateSummary);
    });
    
    // Layer inputs
    for (let i = 1; i <= 8; i++) {
        const input = document.getElementById(`edit-layer-${i}-image`);
        if (input) input.addEventListener('change', updateSummary);
    }
    
    // Initial state
    updateSummary();
}

// Setup login form
function setupLoginForm() {
    const form = document.getElementById('login-form');
    const errorMsg = document.getElementById('login-error');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const password = document.getElementById('admin-password').value;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Inloggen...';
        
        try {
            const response = await fetch(`${API_URL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
                credentials: 'include' // Important: include cookies for session
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store secure token (not password!)
                sessionStorage.setItem('adminLoggedIn', 'true');
                sessionStorage.setItem('adminToken', data.token);
                
                // Start session timeout timer
                startSessionTimer();
                
                showUploadSection();
                loadAdminPosters();
                errorMsg.textContent = '';
                errorMsg.style.color = '';
            } else {
                // Show error message
                if (data.locked) {
                    errorMsg.textContent = data.message;
                    errorMsg.style.color = '#e74c3c';
                } else {
                    errorMsg.textContent = data.message || 'Onjuist wachtwoord';
                    errorMsg.style.color = '#e74c3c';
                }
                document.getElementById('admin-password').value = '';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMsg.textContent = 'Kan niet inloggen. Controleer je internetverbinding.';
            errorMsg.style.color = '#e74c3c';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    };
}

// Session timeout management
function startSessionTimer() {
    // Clear existing timer
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
    
    // Set new timer (55 minutes - give 5 min warning before 1 hour timeout)
    sessionTimer = setTimeout(() => {
        alert('Je sessie verloopt bijna. Log opnieuw in om te blijven werken.');
        
        // Auto-logout after 1 hour
        setTimeout(() => {
            logout(true);
        }, 300000); // 5 minutes
    }, SESSION_TIMEOUT - 300000);
}

// Logout function
async function logout(sessionExpired = false) {
    try {
        await fetch(`${API_URL}/admin/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (e) {
        console.error('Logout error:', e);
    }
    
    // Clear session
    sessionStorage.removeItem('adminLoggedIn');
    sessionStorage.removeItem('adminToken');
    
    if (sessionTimer) {
        clearTimeout(sessionTimer);
    }
    
    // Show login screen
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    
    if (sessionExpired) {
        document.getElementById('login-error').textContent = 'Je sessie is verlopen. Log opnieuw in.';
        document.getElementById('login-error').style.color = '#e67e22';
    }
}

// Setup logout button
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.onclick = () => logout(false);
    
    // Setup AR Rebuild button
    const rebuildBtn = document.getElementById('rebuild-mind-btn');
    if (rebuildBtn) {
        rebuildBtn.onclick = async () => {
            console.log('AR Rebuild button clicked'); // Debug log
            
            // Bypass confirm() - directe actie om blokkades te vermijden
            // We tonen gewoon "Bezig..." en de gebruiker ziet wel wat er gebeurt
            
            rebuildBtn.disabled = true;
            rebuildBtn.innerHTML = 'Bezig... <span class="spinner"></span>';
            console.log('Starting fetch request...');
            
            try {
                const token = sessionStorage.getItem('adminToken');
                const response = await fetch(`${API_URL}/admin/rebuild-mind`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('Response received', response.status);
                const result = await response.json();
                
                // Show console output if available
                if (result.output) {
                    console.group("🖥️ AR Rebuild Server Output");
                    console.log(`%c=== START LOGS ===`, 'color: #00ff00; font-weight: bold;');
                    result.output.forEach(line => console.log(`%c${line}`, 'color: #aaa; font-family: monospace;'));
                    console.log(`%c=== END LOGS ===`, 'color: #00ff00; font-weight: bold;');
                    console.groupEnd();
                }
                
                if (result.success) {
                    console.log('Success! Rebuild complete.');
                    // Gebruik setTimeout om alert te ontkoppelen van de click event stack
                    setTimeout(() => alert('AR rebuild succesvol!\nCheck console voor details.'), 100);
                } else {
                    console.error('Rebuild failed:', result.message);
                    setTimeout(() => alert('Fout: ' + (result.message || 'Onbekende fout')), 100);
                }
            } catch (err) {
                console.error('Fetch error:', err);
                setTimeout(() => alert('Fout bij rebuild: ' + err.message), 100);
            } finally {
                rebuildBtn.disabled = false;
                rebuildBtn.textContent = 'AR Rebuild';
            }
        };
    }
}

// Toon upload sectie
function showUploadSection() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('upload-section').style.display = 'block';
    document.getElementById('logout-btn').style.display = 'inline-block';
}

// Setup upload form
function setupUploadForm() {
    const form = document.getElementById('upload-form');
    const successMsg = document.getElementById('upload-success');
    const errorMsg = document.getElementById('upload-error');
    const uploadBtn = document.getElementById('upload-btn');
    const btnText = uploadBtn.querySelector('.btn-text');
    const btnLoader = uploadBtn.querySelector('.btn-loader');
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        // Clear messages
        successMsg.textContent = '';
        errorMsg.textContent = '';
        
        // Get form data
        const formData = new FormData();
        formData.append('title', document.getElementById('poster-title').value);
        formData.append('description', document.getElementById('poster-description').value);
        
        // Parse and add location data
        const coordinatesInput = document.getElementById('poster-coordinates').value.trim();
        let latitude = '';
        let longitude = '';
        
        if (coordinatesInput) {
            // Parse format: "51.04932179780276, 3.7185706753061156"
            const parts = coordinatesInput.split(',').map(p => p.trim());
            if (parts.length === 2) {
                latitude = parts[0];
                longitude = parts[1];
            } else {
                errorMsg.textContent = 'Ongeldig coördinaten formaat. Gebruik: latitude, longitude';
                return;
            }
        }
        
        const locationDescription = document.getElementById('poster-location').value;
        if (latitude) formData.append('latitude', latitude);
        if (longitude) formData.append('longitude', longitude);
        if (locationDescription) formData.append('location_description', locationDescription);
        
        // Add article link
        const artikelLink = document.getElementById('poster-artikel-link').value;
        if (artikelLink) formData.append('artikel_link', artikelLink);
        
        // Add credits (JSON array)
        const credits = collectCredits('credits-container');
        if (credits.length > 0) {
            formData.append('credits', JSON.stringify(credits));
        }
        
        // Add AR marker file (single marker, required)
        const arMarkerFile = document.getElementById('ar-marker-file').files[0];
        
        if (!arMarkerFile) {
            errorMsg.textContent = 'AR Marker (.mind bestand) is verplicht';
            return;
        }
        formData.append('ar_marker_file', arMarkerFile);
        
        // AR Layers (8 layers with positioning and animation)
        for (let i = 1; i <= 8; i++) {
            const imageInput = document.getElementById(`layer-${i}-image`);
            const zInput = document.getElementById(`layer-${i}-z`);
            const exclusionInput = document.getElementById(`layer-${i}-exclusion`);
            
            // Base position and scale inputs
            const posXInput = document.getElementById(`layer-${i}-pos-x`);
            const posYInput = document.getElementById(`layer-${i}-pos-y`);
            const scaleInput = document.getElementById(`layer-${i}-scale`);
            const rotZInput = document.getElementById(`layer-${i}-rot-z`);
            
            // Animation inputs
            const animXInput = document.getElementById(`layer-${i}-anim-x`);
            const animYInput = document.getElementById(`layer-${i}-anim-y`);
            const animZInput = document.getElementById(`layer-${i}-anim-z`);
            const animRotXInput = document.getElementById(`layer-${i}-anim-rot-x`);
            const animRotYInput = document.getElementById(`layer-${i}-anim-rot-y`);
            const animRotZInput = document.getElementById(`layer-${i}-anim-rot-z`);
            const animScaleInput = document.getElementById(`layer-${i}-anim-scale`);
            const animOpacityInput = document.getElementById(`layer-${i}-anim-opacity`);
            const durationInput = document.getElementById(`layer-${i}-anim-duration`);
            
            // Skip if layer inputs don't exist
            if (!imageInput || !zInput) {
                continue;
            }
            
            let layerImage = imageInput.files[0];
            const layerZ = zInput.value;
            const isExclusion = exclusionInput ? exclusionInput.checked : false;
            
            // Only append if layer has an image
            if (layerImage) {
                if (layerImage.type === 'image/gif') {
                    // Convert GIF to MP4 client-side to avoid server dependency on ffmpeg
                    layerImage = await convertGifFileToMp4(layerImage, `upload_layer_${i}`);
                }
                formData.append(`layer_${i}_image`, layerImage);
            }
            
            // Always send configuration
            formData.append(`layer_${i}_z`, layerZ || '0');
            formData.append(`layer_${i}_exclusion`, isExclusion ? '1' : '0');
            
            // Base position and scale
            formData.append(`layer_${i}_pos_x`, posXInput ? posXInput.value || '0' : '0');
            formData.append(`layer_${i}_pos_y`, posYInput ? posYInput.value || '0' : '0');
            formData.append(`layer_${i}_scale`, scaleInput ? scaleInput.value || '1.0' : '1.0');
            formData.append(`layer_${i}_rot_z`, rotZInput ? rotZInput.value || '0' : '0');
            
            // Animation params
            formData.append(`layer_${i}_anim_x`, animXInput ? animXInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_y`, animYInput ? animYInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_z`, animZInput ? animZInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_x`, animRotXInput ? animRotXInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_y`, animRotYInput ? animRotYInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_z`, animRotZInput ? animRotZInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_scale`, animScaleInput ? animScaleInput.value || '1.0' : '1.0');
            formData.append(`layer_${i}_anim_opacity`, animOpacityInput ? animOpacityInput.value || '1.0' : '1.0');
            formData.append(`layer_${i}_anim_duration`, durationInput ? durationInput.value || '0' : '0');
            
            // Per-laag AR extras: GLB model en audio
            const layerGlbInput = document.getElementById(`layer-${i}-glb`);
            const layerAudioInput = document.getElementById(`layer-${i}-audio`);
            
            if (layerGlbInput && layerGlbInput.files[0]) {
                const glbFile = layerGlbInput.files[0];
                if (glbFile.size > 10 * 1024 * 1024) {
                    errorMsg.textContent = `Laag ${i}: GLB model is te groot (max 10MB)`;
                    return;
                }
                formData.append(`layer_${i}_glb`, glbFile);
            }
            
            if (layerAudioInput && layerAudioInput.files[0]) {
                const audioFile = layerAudioInput.files[0];
                if (audioFile.size > 10 * 1024 * 1024) {
                    errorMsg.textContent = `Laag ${i}: Audio bestand is te groot (max 10MB)`;
                    return;
                }
                formData.append(`layer_${i}_audio`, audioFile);
            }
        }
        
        const jpegFile = document.getElementById('poster-jpeg').files[0];
        const pdfMediumFile = document.getElementById('poster-pdf-medium').files[0];
        const pdfLargeFile = document.getElementById('poster-pdf-large').files[0];
        
        // Validate files
        if (!jpegFile || !pdfMediumFile || !pdfLargeFile) {
            errorMsg.textContent = 'Alle bestanden zijn verplicht';
            return;
        }
        
        // Check file sizes (max 300MB total for high-quality posters)
        const totalSize = jpegFile.size + pdfMediumFile.size + pdfLargeFile.size;
        if (totalSize > 300 * 1024 * 1024) {
            errorMsg.textContent = 'Totale bestandsgrootte is te groot (max 300MB)';
            return;
        }
        
        formData.append('jpeg', jpegFile);
        formData.append('pdfMedium', pdfMediumFile);
        formData.append('pdfLarge', pdfLargeFile);
        
        // Show loading state and progress bar
        uploadBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';
        
        // Scroll to bottom to show progress
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        
        const progressContainer = document.getElementById('upload-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const progressPercentage = document.getElementById('progress-percentage');
        const uploadSpeed = document.getElementById('upload-speed');
        const uploadEta = document.getElementById('upload-eta');
        
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';
        progressPercentage.textContent = '0%';
        
        // Calculate total size for progress display
        const uploadTotalSize = jpegFile.size + pdfMediumFile.size + pdfLargeFile.size;
        progressText.textContent = `Voorbereiden upload van ${formatFileSize(uploadTotalSize)}...`;
        
        let startTime = Date.now();
        let lastLoaded = 0;
        let lastTime = startTime;
        
        try {
            const token = sessionStorage.getItem('adminToken');
            
            // Use XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentage = Math.round((e.loaded / e.total) * 100);
                    const currentTime = Date.now();
                    const timeElapsed = (currentTime - startTime) / 1000; // seconds
                    const bytesUploaded = e.loaded;
                    const totalBytes = e.total;
                    
                    // Update progress bar
                    progressFill.style.width = percentage + '%';
                    progressPercentage.textContent = percentage + '%';
                    progressText.textContent = `${formatFileSize(bytesUploaded)} / ${formatFileSize(totalBytes)}...`;
                    
                    // Calculate speed (bytes per second)
                    if (timeElapsed > 0) {
                        const speed = bytesUploaded / timeElapsed;
                        const speedMB = (speed / (1024 * 1024)).toFixed(1);
                        if (uploadSpeed) uploadSpeed.textContent = `${speedMB} MB/s`;
                        
                        // Calculate ETA
                        const remainingBytes = totalBytes - bytesUploaded;
                        const remainingTime = remainingBytes / speed;
                        
                        if (remainingTime > 0 && percentage < 100) {
                            const eta = Math.ceil(remainingTime);
                            const minutes = Math.floor(eta / 60);
                            const seconds = eta % 60;
                            
                            if (uploadEta) {
                                if (minutes > 0) {
                                    uploadEta.textContent = `${minutes}m ${seconds}s resterend`;
                                } else {
                                    uploadEta.textContent = `${seconds}s resterend`;
                                }
                            }
                        } else {
                            if (uploadEta) uploadEta.textContent = 'Bijna klaar...';
                        }
                    }
                }
            });
            
            // Handle completion
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    progressText.textContent = `Upload voltooid! (${formatFileSize(uploadTotalSize)} verzonden)`;
                    if (uploadSpeed) uploadSpeed.textContent = 'Gereed';
                    if (uploadEta) uploadEta.textContent = 'Verwerken...';
                    
                    try {
                        const result = JSON.parse(xhr.responseText);
                        successMsg.textContent = 'Poster succesvol geüpload';
                        
                        // Reset form
                        form.reset();
                        document.getElementById('preview-container').style.display = 'none';
                        progressContainer.style.display = 'none';
                        
                        // Reload poster list
                        setTimeout(() => {
                            loadAdminPosters();
                            successMsg.textContent = '';
                        }, 2000);
                    } catch (parseError) {
                        console.error('Parse error:', parseError);
                        errorMsg.textContent = 'Upload succesvol maar fout bij verwerken response';
                        progressContainer.style.display = 'none';
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        errorMsg.textContent = `Upload mislukt: ${error.message || 'Onbekende fout'}`;
                    } catch {
                        errorMsg.textContent = `Upload mislukt: HTTP ${xhr.status}`;
                    }
                    progressContainer.style.display = 'none';
                }
            });
            
            // Handle errors
            xhr.addEventListener('error', () => {
                console.error('Upload error: Network error');
                errorMsg.textContent = 'Upload mislukt. Controleer je internetverbinding.';
                progressContainer.style.display = 'none';
            });
            
            // Handle timeout
            xhr.addEventListener('timeout', () => {
                console.error('Upload timeout');
                errorMsg.textContent = 'Upload timeout. Bestanden te groot of langzame verbinding.';
                progressContainer.style.display = 'none';
            });
            
            // Configure and send request
            xhr.timeout = 300000; // 5 minutes timeout
            xhr.open('POST', `${API_URL}/admin/upload`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.withCredentials = true;
            xhr.send(formData);
            
        } catch (error) {
            console.error('Upload error:', error);
            errorMsg.textContent = 'Upload mislukt. Controleer of de server draait.';
            progressContainer.style.display = 'none';
        } finally {
            // Reset button state
            uploadBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    };
}

// Setup file preview
function setupFilePreview() {
    const jpegInput = document.getElementById('poster-jpeg');
    const pdfMediumInput = document.getElementById('poster-pdf-medium');
    const pdfLargeInput = document.getElementById('poster-pdf-large');
    const mindInput = document.getElementById('ar-marker-file');
    
    // Ensure elements exist before attaching listeners
    if (!jpegInput) return;

    const previewContainer = document.getElementById('preview-container');
    const previewImage = document.getElementById('preview-image');
    
    const jpegSizeInfo = document.getElementById('jpeg-size-info');
    const pdfMediumSizeInfo = document.getElementById('pdf-medium-size-info');
    const pdfLargeSizeInfo = document.getElementById('pdf-large-size-info');
    const mindSizeInfo = document.getElementById('mind-size-info');
    const totalSummary = document.getElementById('total-size-summary');
    const sizeBreakdown = document.getElementById('size-breakdown');
    const sizeTotal = document.getElementById('size-total');
    
    let currentFiles = {
        jpeg: null,
        pdfMedium: null,
        pdfLarge: null,
        mind: null,
        layers: {}
    };
    
    function updateFileSizeDisplay() {
        let hasFiles = false;
        let totalSize = 0;
        let breakdown = [];
        
        // JPEG handling
        if (currentFiles.jpeg) {
            const size = currentFiles.jpeg.size;
            const maxSize = 50 * 1024 * 1024; // 50MB
            const category = getFileSizeCategory(size, maxSize);
            
            if (jpegSizeInfo) {
                jpegSizeInfo.textContent = `${currentFiles.jpeg.name} - ${formatFileSize(size)}`;
                jpegSizeInfo.className = `file-size-info show ${category}`;
                jpegSizeInfo.style.display = 'inline-block';
            }
            
            totalSize += size;
            breakdown.push(`<div><strong>JPEG:</strong> ${currentFiles.jpeg.name} <span style="color:#666">(${formatFileSize(size)})</span></div>`);
            hasFiles = true;
        } else {
            if (jpegSizeInfo) jpegSizeInfo.style.display = 'none';
        }
        
        // PDF Medium handling
        if (currentFiles.pdfMedium) {
            const size = currentFiles.pdfMedium.size;
            const maxSize = 120 * 1024 * 1024; // 120MB
            const category = getFileSizeCategory(size, maxSize);
            
            if (pdfMediumSizeInfo) {
                pdfMediumSizeInfo.textContent = `${currentFiles.pdfMedium.name} - ${formatFileSize(size)}`;
                pdfMediumSizeInfo.className = `file-size-info show ${category}`;
                pdfMediumSizeInfo.style.display = 'inline-block';
            }
            
            totalSize += size;
            breakdown.push(`<div><strong>PDF (A3):</strong> ${currentFiles.pdfMedium.name} <span style="color:#666">(${formatFileSize(size)})</span></div>`);
            hasFiles = true;
        } else {
            if (pdfMediumSizeInfo) pdfMediumSizeInfo.style.display = 'none';
        }
        
        // PDF Large handling
        if (currentFiles.pdfLarge) {
            const size = currentFiles.pdfLarge.size;
            const maxSize = 120 * 1024 * 1024; // 120MB
            const category = getFileSizeCategory(size, maxSize);
            
            if (pdfLargeSizeInfo) {
                pdfLargeSizeInfo.textContent = `${currentFiles.pdfLarge.name} - ${formatFileSize(size)}`;
                pdfLargeSizeInfo.className = `file-size-info show ${category}`;
                pdfLargeSizeInfo.style.display = 'inline-block';
            }
            
            totalSize += size;
            breakdown.push(`<div><strong>PDF (A0):</strong> ${currentFiles.pdfLarge.name} <span style="color:#666">(${formatFileSize(size)})</span></div>`);
            hasFiles = true;
        } else {
            if (pdfLargeSizeInfo) pdfLargeSizeInfo.style.display = 'none';
        }
        
        // .mind file handling
        if (currentFiles.mind) {
            const size = currentFiles.mind.size;
            const maxSize = 10 * 1024 * 1024; // 10MB
            const category = getFileSizeCategory(size, maxSize);
            
            if (mindSizeInfo) {
                mindSizeInfo.textContent = `${currentFiles.mind.name} - ${formatFileSize(size)}`;
                mindSizeInfo.className = `file-size-info show ${category}`;
                mindSizeInfo.style.display = 'inline-block';
            }
            
            totalSize += size;
            breakdown.push(`<div><strong>Marker:</strong> ${currentFiles.mind.name} <span style="color:#666">(${formatFileSize(size)})</span></div>`);
            hasFiles = true;
        } else {
            if (mindSizeInfo) mindSizeInfo.style.display = 'none';
        }
        
        // AR Layer files handling
        let layerCount = 0;
        let layersTotalSize = 0;
        for (let i = 1; i <= 8; i++) {
            if (currentFiles.layers[i]) {
                layerCount++;
                layersTotalSize += currentFiles.layers[i].size;
                breakdown.push(`<div><strong>Laag ${i}:</strong> ${currentFiles.layers[i].name} <span style="color:#666">(${formatFileSize(currentFiles.layers[i].size)})</span></div>`);
            }
        }
        if (layerCount > 0) {
            totalSize += layersTotalSize;
            hasFiles = true;
        }
        
        // Update total summary (indien elementen bestaan)
        if (hasFiles && sizeBreakdown && sizeTotal && totalSummary) {
            sizeBreakdown.innerHTML = breakdown.join('');
            sizeTotal.textContent = `Totaal: ${formatFileSize(totalSize)} (max 300MB)`;
            totalSummary.style.display = 'block';
            
            // Color code total size
            if (totalSize > 250 * 1024 * 1024) {
                sizeTotal.style.color = '#c62828'; // Red warning
            } else if (totalSize > 150 * 1024 * 1024) {
                sizeTotal.style.color = '#ef6c00'; // Orange warning
            } else {
                sizeTotal.style.color = '#2e7d32'; // Green ok
            }
        } else if (totalSummary) {
            totalSummary.style.display = 'none';
        }
    }
    
    // JPEG input handler
    jpegInput.onchange = (e) => {
        const file = e.target.files[0];
        currentFiles.jpeg = file;
        
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                previewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
        
        updateFileSizeDisplay();
    };
    
    // PDF Medium input handler
    pdfMediumInput.onchange = (e) => {
        currentFiles.pdfMedium = e.target.files[0];
        updateFileSizeDisplay();
    };
    
    // PDF Large input handler
    pdfLargeInput.onchange = (e) => {
        currentFiles.pdfLarge = e.target.files[0];
        updateFileSizeDisplay();
    };
    
    // .mind file input handler
    if (mindInput) {
        mindInput.onchange = (e) => {
            currentFiles.mind = e.target.files[0];
            updateFileSizeDisplay();
        };
    }
    
    // AR Layer inputs handlers (8 layers)
    for (let i = 1; i <= 8; i++) {
        const layerInput = document.getElementById(`layer-${i}-image`);
        if (layerInput) {
            layerInput.onchange = (e) => {
                const file = e.target.files[0];
                const statusBadge = document.getElementById(`layer-${i}-status`);
                
                if (file) {
                    currentFiles.layers[i] = file;
                    if (statusBadge) {
                        statusBadge.textContent = 'Geselecteerd';
                        statusBadge.classList.add('active');
                    }
                } else {
                    delete currentFiles.layers[i];
                    if (statusBadge) {
                        statusBadge.textContent = 'Leeg';
                        statusBadge.classList.remove('active');
                    }
                }
                updateFileSizeDisplay();
            };
        }
    }
}

// Laad alle posters voor admin overzicht
async function loadAdminPosters() {
    try {
        const response = await fetch(`${API_URL}/posters`);
        if (!response.ok) throw new Error('Kan posters niet laden');
        
        const posters = await response.json();
        
        const postersList = document.getElementById('admin-poster-list');
        if (posters.length === 0) {
            postersList.innerHTML = '<p style="text-align: center; color: #666; padding: 1rem; font-size: 0.9rem;">Nog geen posters.</p>';
            return;
        }
        
        postersList.innerHTML = posters.map(poster => `
            <div class="sidebar-poster-item" data-id="${poster.id}" onclick="openEditModal('${poster.id}')">
                <div class="poster-item-header">
                    <h4 class="poster-item-title">${poster.title}</h4>
                </div>
                <p class="poster-item-meta">${formatDate(poster.upload_date || poster.uploadDate)}</p>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading posters:', error);
        document.getElementById('admin-poster-list').innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 1rem;">Fout bij laden</p>';
    }
}

// Verwijder poster
async function deletePoster(posterId) {
    if (!confirm('Weet je zeker dat je deze poster wilt verwijderen?')) {
        return;
    }
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/admin/posters/${posterId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include' // Include session cookies
        });
        
        if (response.ok) {
            // Close modal if open
            closeEditModal();
            
            // Verwijder van UI
            const posterElement = document.querySelector(`[data-id="${posterId}"]`);
            if (posterElement) {
                posterElement.style.opacity = '0';
                setTimeout(() => {
                    posterElement.remove();
                    loadAdminPosters();
                }, 300);
            }
        } else {
            alert('Kon poster niet verwijderen. Probeer opnieuw.');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Kon poster niet verwijderen. Controleer of de server draait.');
    }
}

// Formatteer datum
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('nl-NL', options);
}

// Formatteer locatie voor admin interface
function formatLocationAdmin(poster) {
    if (!poster.latitude || !poster.longitude) {
        return '<p style="color: #999; font-size: 0.9rem; margin: 0.25rem 0;">Location: Not set</p>';
    }
    
    const lat = parseFloat(poster.latitude);
    const lng = parseFloat(poster.longitude);
    
    const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
    const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;
    
    let locationText = `${latStr}, ${lngStr}`;
    
    if (poster.location_description) {
        locationText += ` / ${poster.location_description}`;
    }
    
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    
    return `<p style="margin: 0.25rem 0;">
        Location: <a href="${mapsUrl}" target="_blank" title="Maps" 
           style="color: #666; text-decoration: underline; font-size: 0.9rem;">
            ${locationText}
        </a>
    </p>`;
}

// Open edit modal
// Setup file preview for edit form
function setupEditFilePreview() {
    const jpegInput = document.getElementById('edit-jpeg');
    const pdfMediumInput = document.getElementById('edit-pdf-medium');
    const pdfLargeInput = document.getElementById('edit-pdf-large');
    const mindInput = document.getElementById('edit-ar-marker-file');
    
    const jpegSizeInfo = document.getElementById('edit-jpeg-size-info');
    const pdfMediumSizeInfo = document.getElementById('edit-pdf-medium-size-info');
    const pdfLargeSizeInfo = document.getElementById('edit-pdf-large-size-info');
    const mindSizeInfo = document.getElementById('edit-ar-marker-file-size-info');
    
    // Helper to update badge
    const updateBadge = (file, badgeEl, maxSize) => {
        if (!badgeEl) return;
        
        if (file) {
            const size = file.size;
            const category = getFileSizeCategory(size, maxSize);
            badgeEl.textContent = `${file.name} - ${formatFileSize(size)}`;
            badgeEl.className = `file-size-info show ${category}`;
            badgeEl.style.display = 'inline-block';
        } else {
            badgeEl.style.display = 'none';
        }
    };

    if (jpegInput) {
        jpegInput.onchange = (e) => {
            const file = e.target.files[0];
            updateBadge(file, jpegSizeInfo, 50 * 1024 * 1024);
            
            // Preview
            const previewContainer = document.getElementById('edit-preview-container');
            const previewImage = document.getElementById('edit-preview-image');
            
            if (file && file.type.startsWith('image/') && previewContainer && previewImage) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else if (previewContainer) {
                previewContainer.style.display = 'none';
            }
        };
    }
    if (pdfMediumInput) {
        pdfMediumInput.onchange = (e) => updateBadge(e.target.files[0], pdfMediumSizeInfo, 120 * 1024 * 1024);
    }
    if (pdfLargeInput) {
        pdfLargeInput.onchange = (e) => updateBadge(e.target.files[0], pdfLargeSizeInfo, 120 * 1024 * 1024);
    }
    if (mindInput) {
        mindInput.onchange = (e) => updateBadge(e.target.files[0], mindSizeInfo, 10 * 1024 * 1024);
    }
    
    // Layers
    for (let i = 1; i <= 8; i++) {
        const layerInput = document.getElementById(`edit-layer-${i}-image`);
        if (layerInput) {
            layerInput.onchange = (e) => {
                const file = e.target.files[0];
                const statusBadge = document.getElementById(`edit-layer-${i}-status`);
                if (file) {
                    if (statusBadge) {
                        statusBadge.textContent = 'Nieuw bestand';
                        statusBadge.classList.add('active');
                        statusBadge.style.background = '#e8f5e9';
                        statusBadge.style.color = '#2e7d32';
                    }
                } else {
                    if (statusBadge) {
                        statusBadge.textContent = 'Leeg'; // Or revert to "Huidig" if we knew it
                        statusBadge.classList.remove('active');
                        statusBadge.style.background = '#eee';
                        statusBadge.style.color = '#999';
                    }
                }
            };
        }
    }
}

async function openEditModal(posterId) {
    try {
        // Fetch poster data
        const response = await fetch(`${API_URL}/posters/${posterId}`);
        if (!response.ok) throw new Error('Poster niet gevonden');
        
        const poster = await response.json();
        
        // Populate form
        document.getElementById('edit-poster-id').value = poster.id;
        document.getElementById('edit-title').value = poster.title || '';
        document.getElementById('edit-description').value = poster.description || '';
        
        // Combine lat/lng into single coordinates field
        const lat = poster.latitude || '';
        const lng = poster.longitude || '';
        const coordinatesValue = (lat && lng) ? `${lat}, ${lng}` : '';
        document.getElementById('edit-coordinates').value = coordinatesValue;
        
        document.getElementById('edit-location').value = poster.location_description || '';
        document.getElementById('edit-artikel-link').value = poster.artikel_link || '';
        
        // Populate credits (nieuw systeem of fallback van photographer_credit)
        const creditsData = poster.credits || poster.photographer_credit || '';
        populateCredits('edit-credits-container', creditsData);
        
        // Show current .mind file
        const markerInfo = document.getElementById('edit-ar-marker-current');
        if (markerInfo) {
            if (poster.ar_marker) {
                const filename = poster.ar_marker.split('/').pop() + '.mind';
                markerInfo.textContent = `Huidig: ${filename}`;
                markerInfo.style.color = '#27ae60';
            } else {
                markerInfo.textContent = 'Geen AR marker gekoppeld';
                markerInfo.style.color = '#e74c3c';
            }
        }
        
        // Render all 8 layers for edit form
        renderLayers(true);
        
        // Setup file previews for edit form
        setupEditFilePreview();
        
        // Populate layer data if available
        for (let layerNum = 1; layerNum <= 8; layerNum++) {
            const layerData = poster.layers ? poster.layers[`layer_${layerNum}`] : null;
            
            if (layerData) {
                // Set z-position
                const zInput = document.getElementById(`edit-layer-${layerNum}-z`);
                // Fix: explicit check for undefined/null to allow 0 values
                if (zInput) {
                    const defaultZ = LAYER_CONFIG.defaultLayers.find(l => l.num === layerNum)?.defaultZ.toFixed(3) || '0.000';
                    zInput.value = (layerData.z !== undefined && layerData.z !== null) ? layerData.z : defaultZ;
                }
                
                // Set base position and scale
                const posXInput = document.getElementById(`edit-layer-${layerNum}-pos-x`);
                if (posXInput) posXInput.value = (layerData.pos_x !== undefined && layerData.pos_x !== null) ? layerData.pos_x : '0.000';
                
                const posYInput = document.getElementById(`edit-layer-${layerNum}-pos-y`);
                if (posYInput) posYInput.value = (layerData.pos_y !== undefined && layerData.pos_y !== null) ? layerData.pos_y : '0.000';
                
                const scaleInput = document.getElementById(`edit-layer-${layerNum}-scale`);
                if (scaleInput) {
                    const val = (layerData.scale !== undefined && layerData.scale !== null) ? layerData.scale : '1.0';
                    console.log(`[Admin] Layer ${layerNum} loaded scale:`, layerData.scale, 'Set to:', val);
                    scaleInput.value = val;
                }
                
                const rotXInput = document.getElementById(`edit-layer-${layerNum}-rot-x`);
                if (rotXInput) rotXInput.value = (layerData.rot_x !== undefined && layerData.rot_x !== null) ? layerData.rot_x : '0';
                
                const rotYInput = document.getElementById(`edit-layer-${layerNum}-rot-y`);
                if (rotYInput) rotYInput.value = (layerData.rot_y !== undefined && layerData.rot_y !== null) ? layerData.rot_y : '0';
                
                const rotZInput = document.getElementById(`edit-layer-${layerNum}-rot-z`);
                if (rotZInput) rotZInput.value = (layerData.rot_z !== undefined && layerData.rot_z !== null) ? layerData.rot_z : '0';
                
                // Set exclusion filter checkbox
                const exclusionCheckbox = document.getElementById(`edit-layer-${layerNum}-exclusion`);
                if (exclusionCheckbox) {
                    exclusionCheckbox.checked = layerData.exclusion_filter || false;
                }
                
                // Check if has animation data (any non-zero anim value)
                const hasAnimation = layerData.anim_x || layerData.anim_y || layerData.anim_z || 
                                    layerData.anim_rot_x || layerData.anim_rot_y || layerData.anim_rot_z ||
                                    (layerData.anim_scale && layerData.anim_scale !== 1.0) ||
                                    (layerData.anim_opacity && layerData.anim_opacity !== 1.0) ||
                                    (layerData.anim_duration && layerData.anim_duration !== 0);
                
                // Set animation toggle
                const animToggle = document.getElementById(`edit-layer-${layerNum}-enable-anim`);
                if (animToggle) {
                    animToggle.checked = hasAnimation;
                    // Show/hide animation container
                    const animContainer = document.getElementById(`edit-layer-${layerNum}-anim-container`);
                    if (animContainer) {
                        animContainer.style.display = hasAnimation ? 'block' : 'none';
                    }
                }
                
                // Set animation values
                const fields = ['anim_x', 'anim_y', 'anim_z', 'anim_rot_x', 'anim_rot_y', 'anim_rot_z', 'anim_scale', 'anim_opacity', 'anim_duration'];
                fields.forEach(field => {
                    const input = document.getElementById(`edit-layer-${layerNum}-${field.replace(/_/g, '-')}`);
                    if (input && layerData[field] !== undefined) {
                        input.value = layerData[field];
                    }
                });
                
                // Show current filename if exists
                const currentFileInfo = document.getElementById(`edit-layer-${layerNum}-current`);
                if (currentFileInfo && layerData.filename) {
                    currentFileInfo.textContent = `Huidig: ${layerData.filename}`;
                    currentFileInfo.style.color = '#27ae60';
                } else if (currentFileInfo) {
                    currentFileInfo.textContent = 'Geen afbeelding';
                    currentFileInfo.style.color = '#999';
                }
                
                // Update layer status badge in edit modal
                const statusBadge = document.getElementById(`edit-layer-${layerNum}-status`);
                if (statusBadge && layerData.filename) {
                    statusBadge.textContent = 'Gevuld';
                    statusBadge.style.background = '#e8f5e9';
                    statusBadge.style.color = '#2e7d32';
                } else if (statusBadge) {
                    statusBadge.textContent = 'Leeg';
                    statusBadge.style.background = '#ffebee';
                    statusBadge.style.color = '#c62828';
                }
                
                // Toon huidige GLB/audio status per laag (in AR EXTRAS toggle)
                const glbInfo = document.getElementById(`edit-layer-${layerNum}-glb-current`);
                const audioInfo = document.getElementById(`edit-layer-${layerNum}-audio-current`);
                
                if (glbInfo) {
                    if (layerData.glb_model) {
                        glbInfo.textContent = `Huidig: ${layerData.glb_model}`;
                        glbInfo.style.color = '#27ae60';
                    } else {
                        glbInfo.textContent = 'Geen 3D model';
                        glbInfo.style.color = '#999';
                    }
                }
                
                if (audioInfo) {
                    if (layerData.audio_file) {
                        audioInfo.textContent = `Huidig: ${layerData.audio_file}`;
                        audioInfo.style.color = '#27ae60';
                    } else {
                        audioInfo.textContent = 'Geen audio';
                        audioInfo.style.color = '#999';
                    }
                }
            }
        }
        
        // Clear file inputs
        document.getElementById('edit-jpeg').value = '';
        document.getElementById('edit-pdf-medium').value = '';
        document.getElementById('edit-pdf-large').value = '';
        const arMarkerInput = document.getElementById('edit-ar-marker-file');
        if (arMarkerInput) arMarkerInput.value = '';
        
        // Clear layer file inputs (incl. GLB/audio per laag)
        for (let layerNum = 1; layerNum <= 8; layerNum++) {
            const fileInput = document.getElementById(`edit-layer-${layerNum}-image`);
            if (fileInput) fileInput.value = '';
            
            const deleteInput = document.getElementById(`edit-layer-${layerNum}-delete`);
            if (deleteInput) deleteInput.value = '0';
            
            // Clear GLB en audio inputs per laag
            const glbInput = document.getElementById(`edit-layer-${layerNum}-glb`);
            const audioInput = document.getElementById(`edit-layer-${layerNum}-audio`);
            if (glbInput) glbInput.value = '';
            if (audioInput) audioInput.value = '';
        }
        
        // Clear messages
        document.getElementById('edit-success').textContent = '';
        document.getElementById('edit-error').textContent = '';
        
        // Update header with poster title
        const titleHeader = document.getElementById('edit-poster-title-header');
        if (titleHeader) titleHeader.textContent = poster.title || posterId;
        
        // Setup changes summary tracking
        setupEditChangesSummary();
        
        // Show modal
        document.getElementById('edit-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Setup delete button
        const deleteBtn = document.getElementById('delete-poster-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => deletePoster(posterId);
        }
        
    } catch (error) {
        console.error('Error opening edit modal:', error);
        alert('Kan poster niet laden voor bewerken');
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('edit-form').reset();
    
    // Reset active layers to default (1 layer) for the create form
    // setActiveLayers([1]); // Removed as function is not defined
    renderLayers(false);
}

// Setup edit form submission
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const errorMsg = document.getElementById('edit-error');
            const successMsg = document.getElementById('edit-success');
            if (errorMsg) errorMsg.textContent = '';
            if (successMsg) successMsg.textContent = '';
            
            const posterIdEl = document.getElementById('edit-poster-id');
            if (!posterIdEl) {
                if (errorMsg) errorMsg.textContent = 'Poster ID not found';
                return;
            }
            
            const posterId = posterIdEl.value;
            const formData = new FormData();
            
            // Add text fields
            const titleEl = document.getElementById('edit-title');
            const descriptionEl = document.getElementById('edit-description');
            if (titleEl) formData.append('title', titleEl.value);
            if (descriptionEl) formData.append('description', descriptionEl.value);
            
            // Parse combined coordinates field
            const coordinatesEl = document.getElementById('edit-coordinates');
            const locationEl = document.getElementById('edit-location');
            const artikelLinkEl = document.getElementById('edit-artikel-link');
            
            let latitude = '';
            let longitude = '';
            if (coordinatesEl) {
                const coordinatesInput = coordinatesEl.value.trim();
                const parts = coordinatesInput.split(',').map(p => p.trim());
                if (parts.length === 2) {
                    latitude = parts[0];
                    longitude = parts[1];
                }
            }
            
            const location = locationEl ? locationEl.value : '';
            const artikelLink = artikelLinkEl ? artikelLinkEl.value : '';
            
            console.log('📝 Edit form data:', {
                title: titleEl ? titleEl.value : '',
                latitude: latitude
            });
            
            if (latitude) formData.append('latitude', latitude);
            if (longitude) formData.append('longitude', longitude);
            if (location) formData.append('location_description', location);
            if (artikelLink) formData.append('artikel_link', artikelLink);
            
            // Add credits (JSON array)
            const credits = collectCredits('edit-credits-container');
            formData.append('credits', JSON.stringify(credits));
            
            // AR Layers (8 layers with positioning and animation)
            for (let i = 1; i <= 8; i++) {
                const layerImageEl = document.getElementById(`edit-layer-${i}-image`);
                const layerZEl = document.getElementById(`edit-layer-${i}-z`);
                
                // Base position and scale inputs
                const posXEl = document.getElementById(`edit-layer-${i}-pos-x`);
                const posYEl = document.getElementById(`edit-layer-${i}-pos-y`);
                const scaleEl = document.getElementById(`edit-layer-${i}-scale`);
                const rotXEl = document.getElementById(`edit-layer-${i}-rot-x`);
                const rotYEl = document.getElementById(`edit-layer-${i}-rot-y`);
                const rotZEl = document.getElementById(`edit-layer-${i}-rot-z`);
                
                // Animation inputs
                const animXEl = document.getElementById(`edit-layer-${i}-anim-x`);
                const animYEl = document.getElementById(`edit-layer-${i}-anim-y`);
                const animZEl = document.getElementById(`edit-layer-${i}-anim-z`);
                const animRotXEl = document.getElementById(`edit-layer-${i}-anim-rot-x`);
                const animRotYEl = document.getElementById(`edit-layer-${i}-anim-rot-y`);
                const animRotZEl = document.getElementById(`edit-layer-${i}-anim-rot-z`);
                const animScaleEl = document.getElementById(`edit-layer-${i}-anim-scale`);
                const animOpacityEl = document.getElementById(`edit-layer-${i}-anim-opacity`);
                const animDurationEl = document.getElementById(`edit-layer-${i}-anim-duration`);
                
                // Skip if elements don't exist
                if (!layerImageEl || !layerZEl) {
                    continue;
                }
                
                let layerImage = layerImageEl.files[0];
                const layerZ = layerZEl.value;
                
                // Only append image if a new one is selected
                if (layerImage) {
                    if (layerImage.type === 'image/gif') {
                        // Convert GIF to MP4 client-side
                        layerImage = await convertGifFileToMp4(layerImage, `edit_layer_${i}`);
                    }
                    formData.append(`layer_${i}_image`, layerImage);
                }
                
                // Get exclusion filter checkbox
                const exclusionEl = document.getElementById(`edit-layer-${i}-exclusion`);
                const exclusion = exclusionEl ? (exclusionEl.checked ? '1' : '0') : '0';
                
                // Get delete flag
                const deleteEl = document.getElementById(`edit-layer-${i}-delete`);
                const deleteFlag = deleteEl ? deleteEl.value : '0';
                
                // Always send configuration (updates existing layer config)
                formData.append(`layer_${i}_z`, layerZ || '0');
                formData.append(`layer_${i}_exclusion`, exclusion);
                formData.append(`layer_${i}_delete`, deleteFlag);
                
                // Base position and scale
                formData.append(`layer_${i}_pos_x`, posXEl ? posXEl.value || '0' : '0');
                formData.append(`layer_${i}_pos_y`, posYEl ? posYEl.value || '0' : '0');
                formData.append(`layer_${i}_scale`, scaleEl ? scaleEl.value || '1.0' : '1.0');
                formData.append(`layer_${i}_rot_x`, rotXEl ? rotXEl.value || '0' : '0');
                formData.append(`layer_${i}_rot_y`, rotYEl ? rotYEl.value || '0' : '0');
                formData.append(`layer_${i}_rot_z`, rotZEl ? rotZEl.value || '0' : '0');
                
                // Animation params
                formData.append(`layer_${i}_anim_x`, animXEl ? animXEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_y`, animYEl ? animYEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_z`, animZEl ? animZEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_x`, animRotXEl ? animRotXEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_y`, animRotYEl ? animRotYEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_z`, animRotZEl ? animRotZEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_scale`, animScaleEl ? animScaleEl.value || '1.0' : '1.0');
                formData.append(`layer_${i}_anim_opacity`, animOpacityEl ? animOpacityEl.value || '1.0' : '1.0');
                formData.append(`layer_${i}_anim_duration`, animDurationEl ? animDurationEl.value || '0' : '0');
                
                // Per-laag AR extras: GLB model en audio
                const layerGlbEl = document.getElementById(`edit-layer-${i}-glb`);
                const layerAudioEl = document.getElementById(`edit-layer-${i}-audio`);
                
                if (layerGlbEl && layerGlbEl.files[0]) {
                    const glbFile = layerGlbEl.files[0];
                    if (glbFile.size > 10 * 1024 * 1024) {
                        if (errorMsg) errorMsg.textContent = `Laag ${i}: GLB model is te groot (max 10MB)`;
                        return;
                    }
                    formData.append(`layer_${i}_glb`, glbFile);
                }
                
                if (layerAudioEl && layerAudioEl.files[0]) {
                    const audioFile = layerAudioEl.files[0];
                    if (audioFile.size > 10 * 1024 * 1024) {
                        if (errorMsg) errorMsg.textContent = `Laag ${i}: Audio bestand is te groot (max 10MB)`;
                        return;
                    }
                    formData.append(`layer_${i}_audio`, audioFile);
                }
            }
            
            // Add files if provided
            const jpegEl = document.getElementById('edit-jpeg');
            const pdfMediumEl = document.getElementById('edit-pdf-medium');
            const pdfLargeEl = document.getElementById('edit-pdf-large');
            const arMarkerFileEl = document.getElementById('edit-ar-marker-file');
            
            const jpegFile = jpegEl ? jpegEl.files[0] : null;
            const pdfMediumFile = pdfMediumEl ? pdfMediumEl.files[0] : null;
            const pdfLargeFile = pdfLargeEl ? pdfLargeEl.files[0] : null;
            const arMarkerFile = arMarkerFileEl ? arMarkerFileEl.files[0] : null;
            
            if (jpegFile) formData.append('jpeg', jpegFile);
            if (pdfMediumFile) formData.append('pdfMedium', pdfMediumFile);
            if (pdfLargeFile) formData.append('pdfLarge', pdfLargeFile);
            if (arMarkerFile) formData.append('ar_marker_file', arMarkerFile);
            
            // Build summary of changes
            const changes = [];
            if (titleEl && titleEl.value) changes.push(`Titel: ${titleEl.value}`);
            if (jpegFile) changes.push(`Nieuwe JPEG: ${jpegFile.name}`);
            if (pdfMediumFile) changes.push(`Nieuwe PDF Medium: ${pdfMediumFile.name}`);
            if (pdfLargeFile) changes.push(`Nieuwe PDF Large: ${pdfLargeFile.name}`);
            if (arMarkerFile) changes.push(`Nieuwe AR Marker: ${arMarkerFile.name}`);
            
            // Count layer changes
            let layerChangesCount = 0;
            for (let i = 1; i <= 8; i++) {
                const layerImageEl = document.getElementById(`edit-layer-${i}-image`);
                if (layerImageEl && layerImageEl.files[0]) {
                    layerChangesCount++;
                    changes.push(`Nieuwe Layer ${i}: ${layerImageEl.files[0].name}`);
                }
                // Check voor GLB/audio per laag
                const layerGlbEl = document.getElementById(`edit-layer-${i}-glb`);
                const layerAudioEl = document.getElementById(`edit-layer-${i}-audio`);
                if (layerGlbEl && layerGlbEl.files[0]) {
                    changes.push(`Laag ${i} - Nieuw 3D Model: ${layerGlbEl.files[0].name}`);
                }
                if (layerAudioEl && layerAudioEl.files[0]) {
                    changes.push(`Laag ${i} - Nieuw Audio: ${layerAudioEl.files[0].name}`);
                }
            }
            
            // Show summary in success message area
            if (successMsg && changes.length > 0) {
                successMsg.innerHTML = `<strong>Aanpassingen:</strong><ul style="text-align: left; margin: 10px 0;">${changes.map(c => `<li>${c}</li>`).join('')}</ul>`;
            }
            
            // Calculate total size for progress
            let totalSize = 0;
            if (jpegFile) totalSize += jpegFile.size;
            if (pdfMediumFile) totalSize += pdfMediumFile.size;
            if (pdfLargeFile) totalSize += pdfLargeFile.size;
            if (arMarkerFile) totalSize += arMarkerFile.size;
            
            for (let i = 1; i <= 8; i++) {
                const layerImageEl = document.getElementById(`edit-layer-${i}-image`);
                if (layerImageEl && layerImageEl.files[0]) {
                    totalSize += layerImageEl.files[0].size;
                }
                
                const layerGlbEl = document.getElementById(`edit-layer-${i}-glb`);
                if (layerGlbEl && layerGlbEl.files[0]) {
                    totalSize += layerGlbEl.files[0].size;
                }
                
                const layerAudioEl = document.getElementById(`edit-layer-${i}-audio`);
                if (layerAudioEl && layerAudioEl.files[0]) {
                    totalSize += layerAudioEl.files[0].size;
                }
            }
            
            // Show progress bar if uploading files
            let progressContainer = document.getElementById('edit-upload-progress');
            if (!progressContainer) {
                progressContainer = document.createElement('div');
                progressContainer.id = 'edit-upload-progress';
                progressContainer.style.cssText = 'margin: 20px 0; display: none;';
                progressContainer.innerHTML = `
                    <div style="background: #f0f0f0; border-radius: 10px; overflow: hidden; height: 30px; position: relative;">
                        <div id="edit-progress-bar" style="background: linear-gradient(90deg, #4CAF50, #45a049); height: 100%; width: 0%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;"></div>
                    </div>
                    <p id="edit-progress-text" style="text-align: center; margin-top: 10px; font-size: 14px; color: #666;"></p>
                `;
                // Insert before the form-actions div
                const formActions = editForm.querySelector('.form-actions');
                if (formActions) {
                    editForm.insertBefore(progressContainer, formActions);
                } else {
                    // Fallback: append to end of form
                    editForm.appendChild(progressContainer);
                }
            }
            
            if (totalSize > 0) {
                progressContainer.style.display = 'block';
                const progressBar = document.getElementById('edit-progress-bar');
                const progressText = document.getElementById('edit-progress-text');
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';
                progressText.textContent = 'BEZIG MET UPLOADEN...';
            }
            
            try {
                const token = sessionStorage.getItem('adminToken');
                
                // Use XMLHttpRequest for progress tracking
                const xhr = new XMLHttpRequest();
                
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable && totalSize > 0) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        const progressBar = document.getElementById('edit-progress-bar');
                        const progressText = document.getElementById('edit-progress-text');
                        if (progressBar) {
                            progressBar.style.width = percentComplete + '%';
                            progressBar.textContent = Math.round(percentComplete) + '%';
                        }
                        if (progressText) {
                            progressText.textContent = `${formatFileSize(e.loaded)} / ${formatFileSize(e.total)}`;
                        }
                    }
                });
                
                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        const progressContainer = document.getElementById('edit-upload-progress');
                        if (progressContainer) progressContainer.style.display = 'none';
                        if (successMsg) successMsg.innerHTML = '<strong style="color: #4CAF50;"> Poster succesvol bijgewerkt!</strong>';
                        setTimeout(() => {
                            closeEditModal();
                            loadAdminPosters();
                        }, 1500);
                    } else {
                        const progressContainer = document.getElementById('edit-upload-progress');
                        if (progressContainer) progressContainer.style.display = 'none';
                        let errorData;
                        try {
                            errorData = JSON.parse(xhr.responseText);
                        } catch (e) {
                            errorData = { message: 'Onbekende fout' };
                        }
                        if (errorMsg) errorMsg.textContent = `Update mislukt: ${errorData.message || 'Onbekende fout'}`;
                    }
                });
                
                xhr.addEventListener('error', () => {
                    const progressContainer = document.getElementById('edit-upload-progress');
                    if (progressContainer) progressContainer.style.display = 'none';
                    if (errorMsg) errorMsg.textContent = 'Upload mislukt. Controleer je verbinding.';
                });
                
                xhr.open('POST', `${API_URL}/admin/posters/${posterId}/update`);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.withCredentials = true;
                xhr.send(formData);
                
            } catch (error) {
                console.error('Update error:', error);
                const progressContainer = document.getElementById('edit-upload-progress');
                if (progressContainer) progressContainer.style.display = 'none';
                if (errorMsg) errorMsg.textContent = 'Update mislukt. Controleer je verbinding.';
            }
        };
    }
});

// Make functions globally available
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.applyAnimPreset = applyAnimPreset;
window.deleteLayer = deleteLayer;

// Setup animation toggles for all layers
// document.addEventListener('DOMContentLoaded', () => {
//     setupAnimationToggles();
// });

function setupAnimationToggles() {
    // For create form layers (1-8)
    for (let i = 1; i <= 8; i++) {
        setupLayerAnimationToggle(i, false); // false = create form
    }
    
    // For edit form layers (1-8) - will be set up when modal opens
}

function setupLayerAnimationToggle(layerNum, isEditForm) {
    const prefix = isEditForm ? 'edit-' : '';
    const animContainer = document.getElementById(`${prefix}layer-${layerNum}-anim-container`);
    const enableCheckbox = document.getElementById(`${prefix}layer-${layerNum}-enable-anim`);
    
    if (!animContainer || !enableCheckbox) return;
    
    // Initial state based on checkbox
    animContainer.style.display = enableCheckbox.checked ? 'block' : 'none';
    
    // Toggle on checkbox change
    enableCheckbox.addEventListener('change', () => {
        animContainer.style.display = enableCheckbox.checked ? 'block' : 'none';
        
        // Reset values when disabling
        if (!enableCheckbox.checked) {
            const inputs = animContainer.querySelectorAll('input[type="number"]');
            inputs.forEach(input => {
                if (input.id.includes('scale') || input.id.includes('opacity')) {
                    input.value = '1.0';
                } else {
                    input.value = '0';
                }
            });
        }
    });
    
    // Setup AR Extras toggle for this layer
    setupLayerExtrasToggle(layerNum, isEditForm);
}

// Setup AR Extras (GLB/Audio) toggle per layer
function setupLayerExtrasToggle(layerNum, isEditForm) {
    const prefix = isEditForm ? 'edit-' : '';
    const extrasContainer = document.getElementById(`${prefix}layer-${layerNum}-extras-container`);
    const enableCheckbox = document.getElementById(`${prefix}layer-${layerNum}-enable-extras`);
    
    if (!extrasContainer || !enableCheckbox) return;
    
    // Initial state
    extrasContainer.style.display = enableCheckbox.checked ? 'block' : 'none';
    
    // Toggle on checkbox change
    enableCheckbox.addEventListener('change', () => {
        extrasContainer.style.display = enableCheckbox.checked ? 'block' : 'none';
    });
}

// Render all 8 layers by default (matching backup behavior)
function renderLayers(isEditForm = false) {
    const containerEl = document.getElementById(isEditForm ? 'edit-layers-container' : 'layers-container');
    if (!containerEl) return;
    
    containerEl.innerHTML = '';
    
    // Always render 8 layers
    for (let i = 1; i <= 8; i++) {
        containerEl.insertAdjacentHTML('beforeend', generateLayerHTML(i, isEditForm));
        setupLayerAnimationToggle(i, isEditForm);
    }
}



// Initialize layers on page load
// document.addEventListener('DOMContentLoaded', () => {
//     renderLayers(false); // Create form layers
// });
