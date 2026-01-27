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

// Huidige poster data voor AR preview
let currentPosterData = null;


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



// Generate HTML for a single layer - COMPACT VERSION with visual preview
function generateLayerHTML(layerNum, isEditForm = false) {
    const prefix = isEditForm ? 'edit-' : '';
    const config = LAYER_CONFIG.defaultLayers.find(l => l.num === layerNum);
    const defaultZ = config ? config.defaultZ : 0;
    
    // Only open first layer by default
    const isOpen = layerNum === 1 ? 'open' : '';
    
    return `
        <details class="layer-card" ${isOpen}>
            <summary class="layer-header">
                <span class="layer-num">${layerNum}</span>
                <span class="layer-title">LAAG ${layerNum}</span>
                <span class="layer-status" id="${prefix}layer-${layerNum}-status">LEEG</span>
            </summary>
            
            <div class="layer-body">
                <!-- Unified File Upload -->
                <div class="layer-files">
                    <div class="file-slot">
                        <label>MEDIA</label>
                        <input type="file" id="${prefix}layer-${layerNum}-image" name="layer_${layerNum}_image" accept="image/png,image/jpeg,image/gif,video/mp4,video/webm,.glb,.gltf">
                        <input type="hidden" id="${prefix}layer-${layerNum}-delete" name="layer_${layerNum}_delete" value="0">
                        <input type="hidden" id="${prefix}layer-${layerNum}-delete-media" name="layer_${layerNum}_delete_media" value="0">
                        ${isEditForm ? `<span class="file-current" id="${prefix}layer-${layerNum}-current"></span>` : ''}
                        ${isEditForm ? `<button type="button" class="btn-delete-media" id="${prefix}layer-${layerNum}-delete-media-btn" onclick="deleteLayerMedia(${layerNum}, 'image')" title="Verwijder afbeelding" style="display:none;">×</button>` : ''}
                    </div>
                    <div class="file-slot file-slot-small">
                        <label>3D</label>
                        <input type="file" id="${prefix}layer-${layerNum}-glb" name="layer_${layerNum}_glb" accept=".glb,.gltf">
                        <input type="hidden" id="${prefix}layer-${layerNum}-delete-glb" name="layer_${layerNum}_delete_glb" value="0">
                        ${isEditForm ? `<span class="file-current" id="${prefix}layer-${layerNum}-glb-current"></span>` : ''}
                        ${isEditForm ? `<button type="button" class="btn-delete-media" id="${prefix}layer-${layerNum}-delete-glb-btn" onclick="deleteLayerMedia(${layerNum}, 'glb')" title="Verwijder 3D model" style="display:none;">×</button>` : ''}
                    </div>
                    <div class="file-slot file-slot-small">
                        <label>AUDIO</label>
                        <input type="file" id="${prefix}layer-${layerNum}-audio" name="layer_${layerNum}_audio" accept="audio/mpeg,audio/wav,.mp3,.wav">
                        <input type="hidden" id="${prefix}layer-${layerNum}-delete-audio" name="layer_${layerNum}_delete_audio" value="0">
                        ${isEditForm ? `<span class="file-current" id="${prefix}layer-${layerNum}-audio-current"></span>` : ''}
                        ${isEditForm ? `<button type="button" class="btn-delete-media" id="${prefix}layer-${layerNum}-delete-audio-btn" onclick="deleteLayerMedia(${layerNum}, 'audio')" title="Verwijder audio" style="display:none;">×</button>` : ''}
                    </div>
                </div>
                
                <!-- Transform Controls - Compact Grid -->
                <div class="layer-transform">
                    <div class="transform-group">
                        <span class="group-label">POS</span>
                        <div class="mini-input">
                            <span>X</span>
                            <input type="number" id="${prefix}layer-${layerNum}-pos-x" name="layer_${layerNum}_pos_x" value="0" step="0.01" data-layer="${layerNum}" data-param="posX">
                        </div>
                        <div class="mini-input">
                            <span>Y</span>
                            <input type="number" id="${prefix}layer-${layerNum}-pos-y" name="layer_${layerNum}_pos_y" value="0" step="0.01" data-layer="${layerNum}" data-param="posY">
                        </div>
                        <div class="mini-input">
                            <span>Z</span>
                            <input type="number" id="${prefix}layer-${layerNum}-z" name="layer_${layerNum}_z" value="${defaultZ.toFixed(2)}" step="0.01" data-layer="${layerNum}" data-param="posZ">
                        </div>
                    </div>
                    <div class="transform-group">
                        <span class="group-label">ROT</span>
                        <div class="mini-input">
                            <span>X</span>
                            <input type="number" id="${prefix}layer-${layerNum}-rot-x" name="layer_${layerNum}_rot_x" value="0" step="1" data-layer="${layerNum}" data-param="rotX">
                        </div>
                        <div class="mini-input">
                            <span>Y</span>
                            <input type="number" id="${prefix}layer-${layerNum}-rot-y" name="layer_${layerNum}_rot_y" value="0" step="1" data-layer="${layerNum}" data-param="rotY">
                        </div>
                        <div class="mini-input">
                            <span>Z</span>
                            <input type="number" id="${prefix}layer-${layerNum}-rot-z" name="layer_${layerNum}_rot_z" value="0" step="1" data-layer="${layerNum}" data-param="rotZ">
                        </div>
                    </div>
                    <div class="transform-group">
                        <span class="group-label">SIZE</span>
                        <div class="mini-input wide">
                            <span>SCALE</span>
                            <input type="number" id="${prefix}layer-${layerNum}-scale" name="layer_${layerNum}_scale" value="1.0" step="0.01" data-layer="${layerNum}" data-param="scale">
                        </div>
                    </div>
                </div>
                
                <!-- Quick Options Row -->
                <div class="layer-options">
                    <label class="option-toggle">
                        <input type="checkbox" id="${prefix}layer-${layerNum}-transparent" name="layer_${layerNum}_transparent" value="1" onchange="toggleBgColorPicker(this, '${prefix}', ${layerNum})">
                        <span>TRANSPARANT</span>
                    </label>
                    <div class="bg-color-picker" id="${prefix}layer-${layerNum}-bg-color-container" style="display: none;">
                        <input type="color" id="${prefix}layer-${layerNum}-bg-color" name="layer_${layerNum}_bg_color" value="#000000" title="Achtergrondkleur">
                    </div>
                    <label class="option-toggle">
                        <input type="checkbox" id="${prefix}layer-${layerNum}-exclusion" name="layer_${layerNum}_exclusion" value="1">
                        <span>MASKER</span>
                    </label>
                    <label class="option-toggle">
                        <input type="checkbox" id="${prefix}layer-${layerNum}-enable-anim" data-layer="${layerNum}">
                        <span>ANIMATIE</span>
                    </label>
                    ${isEditForm ? `<button type="button" class="delete-layer-btn" onclick="deleteLayer(${layerNum})">×</button>` : ''}
                </div>
                
                <!-- Animation Panel (hidden by default) -->
                <div id="${prefix}layer-${layerNum}-anim-container" class="anim-panel hidden">
                    <div class="anim-row">
                        <select id="${prefix}layer-${layerNum}-anim-preset" onchange="applyAnimPreset(this, '${prefix}', ${layerNum})" class="anim-preset-select">
                            <option value="">PRESET</option>
                            <option value="spin-y">SPIN Y</option>
                            <option value="spin-x">SPIN X</option>
                            <option value="hover">HOVER</option>
                            <option value="pulse">PULSE</option>
                            <option value="float-up">FLOAT</option>
                        </select>
                    </div>
                    
                    <!-- Positie animatie (ΔX, ΔY, ΔZ) -->
                    <div class="anim-group">
                        <div class="anim-row">
                            <div class="mini-input"><span>ΔX</span><input type="number" id="${prefix}layer-${layerNum}-anim-x" name="layer_${layerNum}_anim_x" value="0" step="0.01"></div>
                            <div class="mini-input"><span>ΔY</span><input type="number" id="${prefix}layer-${layerNum}-anim-y" name="layer_${layerNum}_anim_y" value="0" step="0.01"></div>
                            <div class="mini-input"><span>ΔZ</span><input type="number" id="${prefix}layer-${layerNum}-anim-z" name="layer_${layerNum}_anim_z" value="0" step="0.01"></div>
                            <div class="mini-input dur"><span>DUR</span><input type="number" id="${prefix}layer-${layerNum}-anim-pos-duration" name="layer_${layerNum}_anim_pos_duration" value="0" step="100" placeholder="ms"></div>
                        </div>
                    </div>
                    
                    <!-- Rotatie animatie (RX, RY, RZ) met origin selector -->
                    <div class="anim-group">
                        <div class="anim-row">
                            <div class="mini-input"><span>RX</span><input type="number" id="${prefix}layer-${layerNum}-anim-rot-x" name="layer_${layerNum}_anim_rot_x" value="0" step="1"></div>
                            <div class="mini-input"><span>RY</span><input type="number" id="${prefix}layer-${layerNum}-anim-rot-y" name="layer_${layerNum}_anim_rot_y" value="0" step="1"></div>
                            <div class="mini-input"><span>RZ</span><input type="number" id="${prefix}layer-${layerNum}-anim-rot-z" name="layer_${layerNum}_anim_rot_z" value="0" step="1"></div>
                            <div class="mini-input dur"><span>DUR</span><input type="number" id="${prefix}layer-${layerNum}-anim-rot-duration" name="layer_${layerNum}_anim_rot_duration" value="0" step="100" placeholder="ms"></div>
                        </div>
                        <div class="anim-row">
                            <label class="origin-label">ORIGIN:</label>
                            <select id="${prefix}layer-${layerNum}-anim-rot-origin" name="layer_${layerNum}_anim_rot_origin" class="origin-select">
                                <option value="center">CENTER</option>
                                <option value="top">BOVEN</option>
                                <option value="bottom">ONDER</option>
                                <option value="left">LINKS</option>
                                <option value="right">RECHTS</option>
                                <option value="top-left">LINKS-BOVEN</option>
                                <option value="top-right">RECHTS-BOVEN</option>
                                <option value="bottom-left">LINKS-ONDER</option>
                                <option value="bottom-right">RECHTS-ONDER</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Scale/Opacity animatie -->
                    <div class="anim-group">
                        <div class="anim-row">
                            <div class="mini-input"><span>SCALE</span><input type="number" id="${prefix}layer-${layerNum}-anim-scale" name="layer_${layerNum}_anim_scale" value="1" step="0.1"></div>
                            <div class="mini-input"><span>OPACITY</span><input type="number" id="${prefix}layer-${layerNum}-anim-opacity" name="layer_${layerNum}_anim_opacity" value="1" step="0.1" min="0" max="1"></div>
                            <div class="mini-input dur"><span>DUR</span><input type="number" id="${prefix}layer-${layerNum}-anim-scale-duration" name="layer_${layerNum}_anim_scale_duration" value="0" step="100" placeholder="ms"></div>
                        </div>
                    </div>
                </div>
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
        `edit-layer-${layerNum}-anim-pos-duration`,
        `edit-layer-${layerNum}-anim-rot-x`,
        `edit-layer-${layerNum}-anim-rot-y`,
        `edit-layer-${layerNum}-anim-rot-z`,
        `edit-layer-${layerNum}-anim-rot-duration`,
        `edit-layer-${layerNum}-anim-rot-origin`,
        `edit-layer-${layerNum}-anim-scale`,
        `edit-layer-${layerNum}-anim-opacity`,
        `edit-layer-${layerNum}-anim-scale-duration`,
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

// Toggle achtergrondkleur picker zichtbaarheid
function toggleBgColorPicker(checkbox, prefix, layerNum) {
    const colorContainer = document.getElementById(`${prefix}layer-${layerNum}-bg-color-container`);
    if (colorContainer) {
        // Toon kleurkiezer alleen als NIET transparant
        colorContainer.style.display = checkbox.checked ? 'none' : 'inline-flex';
    }
}

// Verwijder specifiek media type van een laag (afbeelding, glb, of audio)
function deleteLayerMedia(layerNum, mediaType) {
    console.log('[Admin] deleteLayerMedia aangeroepen voor laag', layerNum, 'type:', mediaType);
    
    const prefix = 'edit-';
    
    if (mediaType === 'image') {
        // Set delete flag voor backend
        const deleteFlag = document.getElementById(`${prefix}layer-${layerNum}-delete-media`);
        if (deleteFlag) deleteFlag.value = '1';
        
        // Clear file input
        const fileInput = document.getElementById(`${prefix}layer-${layerNum}-image`);
        if (fileInput) fileInput.value = '';
        
        // Update current info
        const currentInfo = document.getElementById(`${prefix}layer-${layerNum}-current`);
        if (currentInfo) {
            currentInfo.textContent = 'Wordt verwijderd bij opslaan';
            currentInfo.style.color = '#f44';
        }
        
        // Hide delete button
        const deleteBtn = document.getElementById(`${prefix}layer-${layerNum}-delete-media-btn`);
        if (deleteBtn) deleteBtn.style.display = 'none';
        
    } else if (mediaType === 'glb') {
        // Set delete flag voor backend
        const deleteFlag = document.getElementById(`${prefix}layer-${layerNum}-delete-glb`);
        if (deleteFlag) deleteFlag.value = '1';
        
        // Clear file input
        const fileInput = document.getElementById(`${prefix}layer-${layerNum}-glb`);
        if (fileInput) fileInput.value = '';
        
        // Update current info
        const currentInfo = document.getElementById(`${prefix}layer-${layerNum}-glb-current`);
        if (currentInfo) {
            currentInfo.textContent = 'Wordt verwijderd bij opslaan';
            currentInfo.style.color = '#f44';
        }
        
        // Hide delete button
        const deleteBtn = document.getElementById(`${prefix}layer-${layerNum}-delete-glb-btn`);
        if (deleteBtn) deleteBtn.style.display = 'none';
        
    } else if (mediaType === 'audio') {
        // Set delete flag voor backend
        const deleteFlag = document.getElementById(`${prefix}layer-${layerNum}-delete-audio`);
        if (deleteFlag) deleteFlag.value = '1';
        
        // Clear file input
        const fileInput = document.getElementById(`${prefix}layer-${layerNum}-audio`);
        if (fileInput) fileInput.value = '';
        
        // Update current info
        const currentInfo = document.getElementById(`${prefix}layer-${layerNum}-audio-current`);
        if (currentInfo) {
            currentInfo.textContent = 'Wordt verwijderd bij opslaan';
            currentInfo.style.color = '#f44';
        }
        
        // Hide delete button
        const deleteBtn = document.getElementById(`${prefix}layer-${layerNum}-delete-audio-btn`);
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
    
    console.log('[Admin] Media delete gemarkeerd voor laag', layerNum, 'type:', mediaType);
    
    // Update preview
    updatePreviewFromInputs();
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
    setVal('anim-pos-duration', 0);
    setVal('anim-rot-x', 0); setVal('anim-rot-y', 0); setVal('anim-rot-z', 0);
    setVal('anim-rot-duration', 0); setVal('anim-rot-origin', 'center');
    setVal('anim-scale', 1.0); setVal('anim-opacity', 1.0); setVal('anim-scale-duration', 0);

    switch(preset) {
        case 'reset':
            // Already reset above
            break;
        case 'spin-y':
            setVal('anim-rot-y', 360);
            setVal('anim-rot-duration', 5000);
            break;
        case 'spin-x':
            setVal('anim-rot-x', 360);
            setVal('anim-rot-duration', 5000);
            break;
        case 'spin-z':
            setVal('anim-rot-z', 360);
            setVal('anim-rot-duration', 5000);
            break;
        case 'float-up':
            setVal('anim-y', 0.5); // 50cm up
            setVal('anim-pos-duration', 3000);
            break;
        case 'hover':
            setVal('anim-y', 0.2); // 20cm up/down
            setVal('anim-pos-duration', 2000);
            break;
        case 'slide-in':
            setVal('anim-x', -1.0); // Start from left
            setVal('anim-pos-duration', 1500);
            break;
        case 'pulse':
            setVal('anim-scale', 1.2);
            setVal('anim-scale-duration', 1000);
            break;
        case 'fade-in':
            setVal('anim-opacity', 0); 
            setVal('anim-scale-duration', 2000);
            break;
        case 'pop-in':
            setVal('anim-scale', 0.01); // Start small
            setVal('anim-scale-duration', 800);
            break;
        case 'blink':
            setVal('anim-opacity', 0);
            setVal('anim-scale-duration', 500);
            break;
    }
}

// Session timeout warning (1 hour = 3600 seconds)
const SESSION_TIMEOUT = 3600000; // milliseconds
let sessionTimer = null;

// AR Preview state
let previewLayers = {};
let previewCanvas = null;
let previewCtx = null;
let arPreviewWindow = null;
let arPreviewZIndex = 1000;

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
    setTimeout(() => {
        setupLayerSummaryListeners();
        setupLayerAnimationToggles(); // Animation toggles
        setupARPreview(); // Visual preview
    }, 500);
});

// Setup animation toggle listeners (show/hide anim panel)
function setupLayerAnimationToggles() {
    for (let i = 1; i <= LAYER_CONFIG.maxLayers; i++) {
        // Upload form
        const animToggle = document.getElementById(`layer-${i}-enable-anim`);
        const animContainer = document.getElementById(`layer-${i}-anim-container`);
        if (animToggle && animContainer) {
            animToggle.addEventListener('change', function() {
                animContainer.classList.toggle('hidden', !this.checked);
            });
        }
        
        // Edit form
        const editAnimToggle = document.getElementById(`edit-layer-${i}-enable-anim`);
        const editAnimContainer = document.getElementById(`edit-layer-${i}-anim-container`);
        if (editAnimToggle && editAnimContainer) {
            editAnimToggle.addEventListener('change', function() {
                editAnimContainer.classList.toggle('hidden', !this.checked);
            });
        }
    }
}

// Setup AR Preview - Nu als popup window
function setupARPreview() {
    // Verwijder oude static preview als die bestaat
    const oldContainer = document.getElementById('ar-preview-container');
    if (oldContainer) oldContainer.remove();
    
    // Voeg preview knop toe aan layers panel header
    const layersPanelHeader = document.querySelector('#layers-container')?.closest('.panel-box')?.querySelector('.panel-header');
    if (layersPanelHeader && !layersPanelHeader.querySelector('.preview-toggle-btn')) {
        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'preview-toggle-btn';
        previewBtn.textContent = 'PREVIEW';
        previewBtn.onclick = toggleARPreviewWindow;
        layersPanelHeader.appendChild(previewBtn);
    }
    
    // Event delegation voor real-time preview updates
    // Dit werkt ook voor dynamisch aangemaakte elementen
    document.addEventListener('input', (e) => {
        // Check of het een layer input is (positie, rotatie, scale, animatie)
        if (e.target.matches('input[id*="layer-"][id*="-pos-"], input[id*="layer-"][id*="-rot-"], input[id*="layer-"][id*="-scale"], input[id*="layer-"][id*="-z"], input[id*="layer-"][id*="-anim-"]')) {
            updatePreviewFromInputs();
        }
    });
    
    // File upload change events voor real-time preview
    document.addEventListener('change', (e) => {
        if (e.target.matches('input[type="file"][id*="layer-"][id*="-image"]')) {
            updatePreviewFromInputs();
        }
    });
}

// Toggle AR Preview Window
function toggleARPreviewWindow() {
    if (arPreviewWindow && document.body.contains(arPreviewWindow)) {
        closeARPreviewWindow();
    } else {
        openARPreviewWindow();
    }
}

// Open AR Preview Window
function openARPreviewWindow() {
    if (arPreviewWindow && document.body.contains(arPreviewWindow)) return;
    
    // Create window
    const windowWidth = 350;
    const windowHeight = 400;
    const posX = window.innerWidth - windowWidth - 50;
    const posY = 100;
    
    arPreviewWindow = document.createElement('div');
    arPreviewWindow.id = 'ar-preview-window';
    arPreviewWindow.className = 'ar-preview-window';
    arPreviewWindow.style.cssText = `
        position: fixed;
        left: ${posX}px;
        top: ${posY}px;
        width: ${windowWidth}px;
        height: ${windowHeight}px;
        z-index: ${++arPreviewZIndex};
    `;
    
    arPreviewWindow.innerHTML = `
        <div class="ar-window-header">
            <span class="ar-window-title">┌─[ AR PREVIEW ]─┐</span>
            <div class="ar-window-controls">
                <button type="button" class="ar-win-btn ar-win-close" title="Sluiten">×</button>
            </div>
        </div>
        <div class="ar-window-content">
            <div class="ar-view-controls">
                <button type="button" class="ar-view-btn active" data-view="front">FRONT</button>
                <button type="button" class="ar-view-btn" data-view="side">SIDE</button>
                <button type="button" class="ar-view-btn" data-view="top">TOP</button>
            </div>
            <div id="ar-canvas-wrapper" style="position: relative; flex: 1; min-height: 0; overflow: hidden; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.2);">
                <canvas id="ar-preview-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
                <div id="ar-preview-overlays" style="position: absolute; inset: 0; pointer-events: none; overflow: hidden;"></div>
            </div>
            <div class="ar-preview-legend">
                <span><span class="legend-dot" style="background:#fff"></span>L1</span>
                <span><span class="legend-dot" style="background:#f00"></span>L2</span>
                <span><span class="legend-dot" style="background:#0f0"></span>L3</span>
                <span><span class="legend-dot" style="background:#00f"></span>L4</span>
            </div>
        </div>
        <div class="ar-resize-handle ar-resize-se"></div>
        <div class="ar-resize-handle ar-resize-sw"></div>
        <div class="ar-resize-handle ar-resize-ne"></div>
        <div class="ar-resize-handle ar-resize-nw"></div>
    `;
    
    document.body.appendChild(arPreviewWindow);
    
    // Setup interactions
    setupARWindowDrag(arPreviewWindow);
    setupARWindowResize(arPreviewWindow);
    setupARWindowControls(arPreviewWindow);
    
    // Setup canvas
    previewCanvas = document.getElementById('ar-preview-canvas');
    if (previewCanvas) {
        previewCtx = previewCanvas.getContext('2d');
        resizePreviewCanvas();
        updatePreviewFromInputs();
    }
}

// Close AR Preview Window
function closeARPreviewWindow() {
    if (arPreviewWindow) {
        // Stop any running animations
        if (typeof cancelAnimationFrame === 'function' && window._arPreviewAnimationId) {
            cancelAnimationFrame(window._arPreviewAnimationId);
        }
        
        arPreviewWindow.remove();
        arPreviewWindow = null;
        previewCanvas = null;
        previewCtx = null;
    }
}
window.closeARPreviewWindow = closeARPreviewWindow;
window.toggleARPreviewWindow = toggleARPreviewWindow;

// Setup AR Window Dragging
function setupARWindowDrag(windowEl) {
    const header = windowEl.querySelector('.ar-window-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('ar-win-btn')) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = windowEl.offsetLeft;
        startTop = windowEl.offsetTop;
        
        windowEl.style.zIndex = ++arPreviewZIndex;
        windowEl.classList.add('dragging');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        windowEl.style.left = `${startLeft + dx}px`;
        windowEl.style.top = `${startTop + dy}px`;
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            windowEl.classList.remove('dragging');
        }
    });
}

// Setup AR Window Resizing
function setupARWindowResize(windowEl) {
    const handles = windowEl.querySelectorAll('.ar-resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    const minWidth = 250;
    const minHeight = 300;
    
    handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            currentHandle = handle;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = windowEl.offsetWidth;
            startHeight = windowEl.offsetHeight;
            startLeft = windowEl.offsetLeft;
            startTop = windowEl.offsetTop;
            
            windowEl.style.zIndex = ++arPreviewZIndex;
            windowEl.classList.add('resizing');
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing || !currentHandle) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        if (currentHandle.classList.contains('ar-resize-se') || currentHandle.classList.contains('ar-resize-ne')) {
            windowEl.style.width = `${Math.max(minWidth, startWidth + dx)}px`;
        }
        if (currentHandle.classList.contains('ar-resize-sw') || currentHandle.classList.contains('ar-resize-nw')) {
            const newWidth = Math.max(minWidth, startWidth - dx);
            windowEl.style.width = `${newWidth}px`;
            windowEl.style.left = `${startLeft + (startWidth - newWidth)}px`;
        }
        if (currentHandle.classList.contains('ar-resize-se') || currentHandle.classList.contains('ar-resize-sw')) {
            windowEl.style.height = `${Math.max(minHeight, startHeight + dy)}px`;
        }
        if (currentHandle.classList.contains('ar-resize-ne') || currentHandle.classList.contains('ar-resize-nw')) {
            const newHeight = Math.max(minHeight, startHeight - dy);
            windowEl.style.height = `${newHeight}px`;
            windowEl.style.top = `${startTop + (startHeight - newHeight)}px`;
        }
        
        resizePreviewCanvas();
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            currentHandle = null;
            windowEl.classList.remove('resizing');
        }
    });
}

// Setup AR Window Controls
function setupARWindowControls(windowEl) {
    // Close button
    const closeBtn = windowEl.querySelector('.ar-win-close');
    if (closeBtn) {
        closeBtn.onclick = closeARPreviewWindow;
    }
    
    // View buttons
    windowEl.querySelectorAll('.ar-view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            windowEl.querySelectorAll('.ar-view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderARPreview();
        });
    });
}

function resizePreviewCanvas() {
    if (!previewCanvas) return;
    const wrapper = document.getElementById('ar-canvas-wrapper');
    if (!wrapper) return;
    
    // Canvas dimensions = wrapper dimensions (100% fill)
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    
    // Update internal resizing
    if (previewCanvas.width !== width || previewCanvas.height !== height) {
        previewCanvas.width = width;
        previewCanvas.height = height;
        renderARPreview();
    }
}

function updatePreviewFromInputs() {
    // Gather all layer data from inputs (check both upload en edit forms)
    previewLayers = {};
    const isEditMode = document.getElementById('edit-modal')?.style.display === 'block';
    const prefix = isEditMode ? 'edit-' : '';
    
    // Haal poster ID op voor URL constructie (alleen bij edit)
    const posterId = document.getElementById('edit-poster-id')?.value || null;
    
    for (let i = 1; i <= LAYER_CONFIG.maxLayers; i++) {
        const getVal = (id, def = 0) => {
            const el = document.getElementById(id);
            return el ? parseFloat(el.value) || def : def;
        };
        
        const posX = getVal(`${prefix}layer-${i}-pos-x`, 0);
        const posY = getVal(`${prefix}layer-${i}-pos-y`, 0);
        const posZ = getVal(`${prefix}layer-${i}-z`, 0);
        const scale = getVal(`${prefix}layer-${i}-scale`, 1);
        const rotX = getVal(`${prefix}layer-${i}-rot-x`, 0);
        const rotY = getVal(`${prefix}layer-${i}-rot-y`, 0);
        const rotZ = getVal(`${prefix}layer-${i}-rot-z`, 0);
        
        // Animatie parameters
        const animX = getVal(`${prefix}layer-${i}-anim-x`, 0);
        const animY = getVal(`${prefix}layer-${i}-anim-y`, 0);
        const animZ = getVal(`${prefix}layer-${i}-anim-z`, 0);
        const animPosDuration = getVal(`${prefix}layer-${i}-anim-pos-duration`, 0);
        const animRotX = getVal(`${prefix}layer-${i}-anim-rot-x`, 0);
        const animRotY = getVal(`${prefix}layer-${i}-anim-rot-y`, 0);
        const animRotZ = getVal(`${prefix}layer-${i}-anim-rot-z`, 0);
        const animRotDuration = getVal(`${prefix}layer-${i}-anim-rot-duration`, 0);
        const animRotOrigin = document.getElementById(`${prefix}layer-${i}-anim-rot-origin`)?.value || 'center';
        const animScale = getVal(`${prefix}layer-${i}-anim-scale`, 1);
        const animOpacity = getVal(`${prefix}layer-${i}-anim-opacity`, 1);
        const animScaleDuration = getVal(`${prefix}layer-${i}-anim-scale-duration`, 0);
        
        // Check of layer media heeft (file input of bestaand bestand uit poster data)
        const fileInput = document.getElementById(`${prefix}layer-${i}-image`);
        const hasFile = fileInput?.files?.length > 0;
        
        // Check bestaand bestand via opgeslagen poster data
        let existingFilename = null;
        let existingGlbModel = null;
        if (isEditMode && currentPosterData?.layers) {
            const layerKey = `layer_${i}`;
            const layerDataFromPoster = currentPosterData.layers[layerKey];
            
            // Check of media gemarkeerd is voor verwijdering
            const deleteMediaFlag = document.getElementById(`${prefix}layer-${i}-delete-media`);
            const deleteGlbFlag = document.getElementById(`${prefix}layer-${i}-delete-glb`);
            const mediaMarkedForDelete = deleteMediaFlag?.value === '1';
            const glbMarkedForDelete = deleteGlbFlag?.value === '1';
            
            if (layerDataFromPoster?.filename && !mediaMarkedForDelete) {
                existingFilename = layerDataFromPoster.filename;
            }
            if (layerDataFromPoster?.glb_model && !glbMarkedForDelete) {
                existingGlbModel = layerDataFromPoster.glb_model;
            }
        }
        
        // Check voor nieuwe GLB upload
        const glbInput = document.getElementById(`${prefix}layer-${i}-glb`);
        const hasGlbFile = glbInput?.files?.length > 0;
        
        // ALLEEN layers met content tonen in preview
        if (hasFile || existingFilename || hasGlbFile || existingGlbModel) {
            const layerData = { 
                posX, posY, posZ, scale, rotX, rotY, rotZ, 
                // Animatie parameters
                animX, animY, animZ, animPosDuration,
                animRotX, animRotY, animRotZ, animRotDuration, animRotOrigin,
                animScale, animOpacity, animScaleDuration,
                hasContent: true,
                imageSrc: null,
                imageLoaded: false,
                imageEl: null,
                isVideo: false,
                isGlb: false,
                glbFilename: null
            };
            
            // Laad afbeelding voor preview
            if (hasFile) {
                // Nieuw geüploade bestand - gebruik FileReader
                const file = fileInput.files[0];
                if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const img = new Image();
                            img.onload = () => {
                                layerData.imageEl = img;
                                layerData.imageLoaded = true;
                                renderARPreview();
                            };
                            img.src = e.target.result;
                        };
                        reader.readAsDataURL(file);
                    } else {
                        // Video - toon placeholder
                        layerData.isVideo = true;
                        layerData.imageLoaded = true;
                    }
                }
            } else if (existingFilename) {
                // Bestaand bestand - laad van server
                // Treat GIF as image so it animates in preview
                const isVideo = existingFilename.endsWith('.mp4') || existingFilename.endsWith('.webm');
                
                if (isVideo) {
                    // Video - toon placeholder met play icoon
                    layerData.isVideo = true;
                    layerData.imageLoaded = true;
                    layerData.filename = existingFilename;
                } else {
                    // Afbeelding (JPG, PNG, GIF) - laad van server
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        layerData.imageEl = img;
                        layerData.imageLoaded = true;
                        renderARPreview();
                    };
                    img.onerror = () => {
                        console.warn('Kon afbeelding niet laden:', existingFilename);
                        layerData.imageLoaded = true; // Toon placeholder bij error
                    };
                    // Cache buster om verse afbeelding te laden na update
                    const cacheBuster = Date.now();
                    img.src = `../uploads/ar-layers/${existingFilename}?_=${cacheBuster}`;
                }
            }
            
            // GLB 3D model check - toon placeholder in preview
            if (hasGlbFile || existingGlbModel) {
                layerData.isGlb = true;
                layerData.glbFilename = existingGlbModel || (hasGlbFile ? glbInput.files[0].name : null);
                layerData.imageLoaded = true; // Markeer als "geladen" zodat preview rendert
                console.log(`[Preview] Layer ${i} heeft GLB: ${layerData.glbFilename}`);
            }
            
            console.log(`[Preview] Layer ${i} toegevoegd aan previewLayers:`, {
                hasFile, existingFilename, hasGlbFile, existingGlbModel,
                isGlb: layerData.isGlb, imageLoaded: layerData.imageLoaded
            });
            
            previewLayers[i] = layerData;
        }
    }
    renderARPreview();
}

function renderARPreview() {
    if (!previewCanvas || !previewCtx) return;
    
    const ctx = previewCtx;
    const w = previewCanvas.width;
    const h = previewCanvas.height;
    
    if (w <= 0 || h <= 0) return;
    
    const activeView = document.querySelector('.ar-view-btn.active')?.dataset.view || 'front';
    
    // Clear with dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    const gridSize = 25;
    for (let x = 0; x <= w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    
    // Center point
    const cx = w / 2;
    const cy = h / 2;
    const pxPerMeter = Math.min(w, h) * 0.6; // Scale based on canvas size
    
    // Draw poster base (represents the AR target)
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    const posterW = 1 * pxPerMeter * 0.8;
    const posterH = 1.4 * pxPerMeter * 0.8;
    
    if (activeView === 'front') {
        ctx.fillRect(cx - posterW/2, cy - posterH/2, posterW, posterH);
        ctx.strokeRect(cx - posterW/2, cy - posterH/2, posterW, posterH);
        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Roboto Mono';
        ctx.textAlign = 'center';
        ctx.fillText('POSTER', cx, cy);
    } else if (activeView === 'side') {
        ctx.fillRect(cx - 3, cy - posterH/2, 6, posterH);
        ctx.strokeRect(cx - 3, cy - posterH/2, 6, posterH);
    } else if (activeView === 'top') {
        ctx.fillRect(cx - posterW/2, cy - 3, posterW, 6);
        ctx.strokeRect(cx - posterW/2, cy - 3, posterW, 6);
    }
    
    // Update overlays
    const overlayContainer = document.getElementById('ar-preview-overlays');
    if (overlayContainer) overlayContainer.innerHTML = '';
    
    // Clear oude animatie keyframes
    let animStyleEl = document.getElementById('preview-animations');
    if (animStyleEl) {
        animStyleEl.textContent = '';
    }
    
    // Check of er layers zijn met content
    const layersWithContent = Object.entries(previewLayers).filter(([_, data]) => data.hasContent);
    console.log('[Preview] Layers met content:', layersWithContent.length, 'GLB layers:', layersWithContent.filter(([_,d]) => d.isGlb).length);
    
    if (layersWithContent.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px Roboto Mono';
        ctx.textAlign = 'center';
        ctx.fillText('Upload een bestand om preview te zien', cx, cy + posterH/2 + 25);
        return;
    }
    
    // Draw layers
    const colors = ['#ffffff', '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8844'];
    
    // In AR: 1.4 * scale = werkelijke grootte in meters
    // De poster is ook ~1.4m, dus scale=1 = poster grootte
    // We gebruiken posterW als referentie (= 1.4m equivalent)
    const arUnitSize = posterW; // Basis grootte voor scale=1
    
    layersWithContent.forEach(([layerNum, data]) => {
        const idx = parseInt(layerNum) - 1;
        const color = colors[idx] || '#fff';
        
        let x, y;
        // Layer grootte: scale * basis (in AR is dit 1.4 * scale meters)
        const layerSize = arUnitSize * data.scale;
        
        if (activeView === 'front') {
            x = cx + data.posX * pxPerMeter;
            y = cy - data.posY * pxPerMeter;
        } else if (activeView === 'side') {
            x = cx + data.posZ * pxPerMeter;
            y = cy - data.posY * pxPerMeter;
        } else if (activeView === 'top') {
            x = cx + data.posX * pxPerMeter;
            y = cy - data.posZ * pxPerMeter;
        }
        
        // 1. Draw helper badge/placeholder on Canvas
        ctx.save();
        ctx.translate(x, y);
        
        // GLB 3D models: toon altijd als placeholder met nummer
        const is3DModel = data.isGlb;
        
        if (activeView !== 'front' || is3DModel) {
            let drawW = layerSize, drawH = layerSize;
            
            // Side and top view: thin lines
            if (activeView === 'side') { 
                drawW = 4;
            } else if (activeView === 'top') {
                drawH = 4;
            } else if (is3DModel) {
                // Front view 3D model placeholder - duidelijke kubus indicatie
                const size = Math.max(40, layerSize * 0.3); // Schaal mee met layer grootte
                
                // Achtergrond vierkant met 3D effect
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.3;
                ctx.fillRect(-size/2, -size/2, size, size);
                ctx.globalAlpha = 1;
                
                // Border
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.strokeRect(-size/2, -size/2, size, size);
                
                // 3D kubus lijnen (isometrisch effect)
                const offset = size * 0.2;
                ctx.beginPath();
                ctx.moveTo(-size/2, -size/2);
                ctx.lineTo(-size/2 + offset, -size/2 - offset);
                ctx.lineTo(size/2 + offset, -size/2 - offset);
                ctx.lineTo(size/2, -size/2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(size/2 + offset, -size/2 - offset);
                ctx.lineTo(size/2 + offset, size/2 - offset);
                ctx.lineTo(size/2, size/2);
                ctx.stroke();
                
                // "3D" label
                ctx.fillStyle = color;
                ctx.font = 'bold 11px Roboto Mono';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('3D', 0, -4);
                
                // Laagnummer
                ctx.font = 'bold 9px Roboto Mono';
                ctx.fillText(`L${layerNum}`, 0, 8);
            }
            
            if (!is3DModel) {
                // Side/Top view lines
                ctx.fillStyle = color;
                ctx.fillRect(-drawW/2, -drawH/2, drawW, drawH);
                
                // Badge
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(-drawW/2 + 8, -drawH/2 + 8, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 7px Roboto Mono';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(layerNum, -drawW/2 + 8, -drawH/2 + 8);
            }
        }
        ctx.restore();
        
        // 2. Draw Images / GIFs / Video placeholders via DOM Overlays (only in FRONT view)
        if (activeView === 'front' && !is3DModel && overlayContainer) {
            let domW, domH;
            
            if ((data.imageLoaded && data.imageEl) || (data.isVideo && data.filename)) {
                
                // AR gebruikt dezelfde logica voor alle media:
                // Base size = 1.4 * scale (= posterH in preview termen, want poster is ~1.4m hoog)
                // Dus: hoogte = posterH * scale, breedte volgt uit aspect ratio
                const baseHeight = posterH * data.scale;
                
                if (data.imageEl) {
                    const img = data.imageEl;
                    const aspectRatio = img.width / img.height;
                    // Hoogte = poster hoogte * scale, breedte volgt uit aspect ratio
                    domH = baseHeight;
                    domW = baseHeight * aspectRatio;
                    
                    // Cap max breedte (zoals in AR: max 2.0 * scale relatief)
                    const maxWidth = posterW * data.scale * 1.4; // ~140% van poster breedte max
                    if (domW > maxWidth) {
                        domW = maxWidth;
                        domH = maxWidth / aspectRatio;
                    }
                } else if (data.isVideo) {
                    // Video default 16:9
                    domH = baseHeight;
                    domW = baseHeight * (16/9);
                }
                
                // Create Overlay Element
                const el = document.createElement('div');
                el.style.position = 'absolute';
                el.style.left = `${x - domW/2}px`;
                el.style.top = `${y - domH/2}px`;
                el.style.width = `${domW}px`;
                el.style.height = `${domH}px`;
                el.style.zIndex = layerNum;
                el.style.border = `2px solid ${color}`;
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                
                // Basis transform (rotatie)
                const baseTransform = `rotateX(${data.rotX}deg) rotateY(${data.rotY}deg) rotateZ(${data.rotZ}deg)`;
                el.style.transform = baseTransform;
                
                // Transform origin berekenen op basis van animRotOrigin
                const originMap = {
                    'center': 'center center',
                    'top': 'center top',
                    'bottom': 'center bottom',
                    'left': 'left center',
                    'right': 'right center',
                    'top-left': 'left top',
                    'top-right': 'right top',
                    'bottom-left': 'left bottom',
                    'bottom-right': 'right bottom'
                };
                el.style.transformOrigin = originMap[data.animRotOrigin] || 'center center';
                
                // Animatie parameters ophalen
                const animX = data.animX || 0;
                const animY = data.animY || 0;
                const animPosDur = data.animPosDuration || 0;
                const animRotX = data.animRotX || 0;
                const animRotY = data.animRotY || 0;
                const animRotZ = data.animRotZ || 0;
                const animRotDur = data.animRotDuration || 0;
                const animScaleVal = data.animScale || 1;
                const animOpacityVal = data.animOpacity || 1;
                const animScaleDur = data.animScaleDuration || 0;
                
                const hasPositionAnim = (animX !== 0 || animY !== 0) && animPosDur > 0;
                const hasRotationAnim = (animRotX !== 0 || animRotY !== 0 || animRotZ !== 0) && animRotDur > 0;
                const hasScaleAnim = (animScaleVal !== 1 || animOpacityVal !== 1) && animScaleDur > 0;
                
                // Verzamel alle animaties
                const animations = [];
                
                // Maak of update style element
                let styleEl = document.getElementById('preview-animations');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'preview-animations';
                    document.head.appendChild(styleEl);
                }
                
                // Positie animatie
                if (hasPositionAnim) {
                    const animId = `anim-pos-${layerNum}-${Math.random().toString(36).substr(2, 5)}`;
                    const animXPx = animX * pxPerMeter;
                    const animYPx = -animY * pxPerMeter;
                    
                    const keyframeCSS = `
                        @keyframes ${animId} {
                            0% { translate: 0px 0px; }
                            100% { translate: ${animXPx}px ${animYPx}px; }
                        }
                    `;
                    styleEl.textContent += keyframeCSS;
                    animations.push(`${animId} ${animPosDur}ms ease-in-out infinite alternate`);
                }
                
                // Rotatie animatie
                if (hasRotationAnim) {
                    const animId = `anim-rot-${layerNum}-${Math.random().toString(36).substr(2, 5)}`;
                    const endRotX = data.rotX + animRotX;
                    const endRotY = data.rotY + animRotY;
                    const endRotZ = data.rotZ + animRotZ;
                    
                    const keyframeCSS = `
                        @keyframes ${animId} {
                            0% { rotate: ${data.rotZ}deg; }
                            100% { rotate: ${endRotZ}deg; }
                        }
                    `;
                    styleEl.textContent += keyframeCSS;
                    animations.push(`${animId} ${animRotDur}ms ease-in-out infinite alternate`);
                }
                
                // Scale/Opacity animatie
                if (hasScaleAnim) {
                    const animId = `anim-scale-${layerNum}-${Math.random().toString(36).substr(2, 5)}`;
                    
                    const keyframeCSS = `
                        @keyframes ${animId} {
                            0% { scale: 1; opacity: 1; }
                            100% { scale: ${animScaleVal}; opacity: ${animOpacityVal}; }
                        }
                    `;
                    styleEl.textContent += keyframeCSS;
                    animations.push(`${animId} ${animScaleDur}ms ease-in-out infinite alternate`);
                }
                
                // Pas alle animaties toe
                if (animations.length > 0) {
                    el.style.animation = animations.join(', ');
                    console.log(`[Preview] Animaties toegepast op layer ${layerNum}: ${animations.length} animatie(s)`);
                }
                
                // Add Content
                if (data.imageEl) {
                    // Image or GIF
                    const img = document.createElement('img');
                    img.src = data.imageEl.src;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    el.appendChild(img);
                } else if (data.isVideo) {
                    // Video Placeholder
                    el.style.backgroundColor = `${color}33`; // 20% opacity hex
                    const playIcon = document.createElement('div');
                    playIcon.style.width = '0';
                    playIcon.style.height = '0';
                    playIcon.style.borderLeft = '10px solid ' + color;
                    playIcon.style.borderTop = '6px solid transparent';
                    playIcon.style.borderBottom = '6px solid transparent';
                    el.appendChild(playIcon);
                }
                
                // Badge
                const badge = document.createElement('div');
                badge.textContent = layerNum;
                badge.style.position = 'absolute';
                badge.style.top = '4px';
                badge.style.left = '4px';
                badge.style.width = '16px';
                badge.style.height = '16px';
                badge.style.borderRadius = '50%';
                badge.style.backgroundColor = color;
                badge.style.color = '#000';
                badge.style.fontSize = '9px';
                badge.style.fontWeight = 'bold';
                badge.style.display = 'flex';
                badge.style.alignItems = 'center';
                badge.style.justifyContent = 'center';
                el.appendChild(badge);
                
                overlayContainer.appendChild(el);
            }
        }
    });

    // Draw axis indicator (on canvas)
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px Roboto Mono';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    
    const axisLabels = {
        front: ['X →', 'Y ↑'],
        side: ['Z →', 'Y ↑'],
        top: ['X →', 'Z ↑']
    };
    
    ctx.fillText(axisLabels[activeView][0], 8, h - 8);
    ctx.fillText(axisLabels[activeView][1], 8, h - 20);
}

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
            const animPosDurationInput = document.getElementById(`layer-${i}-anim-pos-duration`);
            const animRotXInput = document.getElementById(`layer-${i}-anim-rot-x`);
            const animRotYInput = document.getElementById(`layer-${i}-anim-rot-y`);
            const animRotZInput = document.getElementById(`layer-${i}-anim-rot-z`);
            const animRotDurationInput = document.getElementById(`layer-${i}-anim-rot-duration`);
            const animRotOriginInput = document.getElementById(`layer-${i}-anim-rot-origin`);
            const animScaleInput = document.getElementById(`layer-${i}-anim-scale`);
            const animOpacityInput = document.getElementById(`layer-${i}-anim-opacity`);
            const animScaleDurationInput = document.getElementById(`layer-${i}-anim-scale-duration`);
            
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
            formData.append(`layer_${i}_anim_pos_duration`, animPosDurationInput ? animPosDurationInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_x`, animRotXInput ? animRotXInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_y`, animRotYInput ? animRotYInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_z`, animRotZInput ? animRotZInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_duration`, animRotDurationInput ? animRotDurationInput.value || '0' : '0');
            formData.append(`layer_${i}_anim_rot_origin`, animRotOriginInput ? animRotOriginInput.value || 'center' : 'center');
            formData.append(`layer_${i}_anim_scale`, animScaleInput ? animScaleInput.value || '1.0' : '1.0');
            formData.append(`layer_${i}_anim_opacity`, animOpacityInput ? animOpacityInput.value || '1.0' : '1.0');
            formData.append(`layer_${i}_anim_scale_duration`, animScaleDurationInput ? animScaleDurationInput.value || '0' : '0');
            
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
        const glbInput = document.getElementById(`layer-${i}-glb`);
        const audioInput = document.getElementById(`layer-${i}-audio`);
        
        // Helper functie om layer status badge te updaten
        const updateLayerStatus = (layerNum) => {
            const statusBadge = document.getElementById(`layer-${layerNum}-status`);
            if (!statusBadge) return;
            
            // Check of er enig bestand is geselecteerd
            const hasMedia = currentFiles.layers[layerNum];
            const hasGlb = currentFiles.layerGlbs && currentFiles.layerGlbs[layerNum];
            const hasAudio = currentFiles.layerAudios && currentFiles.layerAudios[layerNum];
            
            if (hasMedia || hasGlb || hasAudio) {
                statusBadge.textContent = 'GESELECTEERD';
                statusBadge.classList.add('active');
            } else {
                statusBadge.textContent = 'LEEG';
                statusBadge.classList.remove('active');
            }
        };
        
        if (layerInput) {
            layerInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    currentFiles.layers[i] = file;
                } else {
                    delete currentFiles.layers[i];
                }
                updateLayerStatus(i);
                updateFileSizeDisplay();
            };
        }
        
        if (glbInput) {
            // Init layerGlbs object if needed
            if (!currentFiles.layerGlbs) currentFiles.layerGlbs = {};
            
            glbInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    currentFiles.layerGlbs[i] = file;
                } else {
                    delete currentFiles.layerGlbs[i];
                }
                updateLayerStatus(i);
                updateFileSizeDisplay();
            };
        }
        
        if (audioInput) {
            // Init layerAudios object if needed
            if (!currentFiles.layerAudios) currentFiles.layerAudios = {};
            
            audioInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    currentFiles.layerAudios[i] = file;
                } else {
                    delete currentFiles.layerAudios[i];
                }
                updateLayerStatus(i);
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
    console.log('[Delete] deletePoster called with ID:', posterId);
    
    // Gebruik custom confirm modal in plaats van native confirm()
    const confirmed = await showConfirmModal(
        'POSTER VERWIJDEREN',
        'Weet je zeker dat je deze poster wilt verwijderen? Dit kan niet ongedaan worden gemaakt.'
    );
    
    if (!confirmed) {
        console.log('[Delete] User cancelled');
        return;
    }
    
    console.log('[Delete] User confirmed, proceeding with delete...');
    
    try {
        const token = sessionStorage.getItem('adminToken');
        console.log('[Delete] Token:', token ? 'present' : 'missing');
        
        const response = await fetch(`${API_URL}/admin/posters/${posterId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include' // Include session cookies
        });
        
        console.log('[Delete] Response status:', response.status);
        
        if (response.ok) {
            console.log('[Delete] Success!');
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
            const errorText = await response.text();
            console.error('[Delete] Server error:', errorText);
            alert('Kon poster niet verwijderen. Probeer opnieuw.');
        }
    } catch (error) {
        console.error('[Delete] Error:', error);
        alert('Kon poster niet verwijderen. Controleer of de server draait.');
    }
}

// Custom confirm modal (vervangt native confirm() die geblokkeerd kan worden)
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const yesBtn = document.getElementById('confirm-yes');
        
        if (!modal) {
            // Fallback naar native confirm als modal niet bestaat
            resolve(confirm(message));
            return;
        }
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'block';
        
        // Store resolve function for buttons
        window._confirmResolve = resolve;
        
        yesBtn.onclick = () => {
            closeConfirmModal(true);
        };
    });
}

function closeConfirmModal(result) {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    if (window._confirmResolve) {
        window._confirmResolve(result);
        window._confirmResolve = null;
    }
}
window.closeConfirmModal = closeConfirmModal;

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
        // Fetch poster data (met cache busting om verse data te krijgen)
        const cacheBuster = Date.now();
        const response = await fetch(`${API_URL}/posters/${posterId}?_=${cacheBuster}`, {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Poster niet gevonden');
        
        const poster = await response.json();
        
        // API stuurt poster.layers al als object (geparsed in PHP)
        // Fallback voor oude data: parse layers_data als het een string is
        if (!poster.layers) {
            if (poster.layers_data && typeof poster.layers_data === 'string') {
                try {
                    poster.layers = JSON.parse(poster.layers_data);
                } catch (e) {
                    console.warn('Kon layers_data niet parsen:', e);
                    poster.layers = {};
                }
            } else {
                poster.layers = {};
            }
        }
        
        // Sla poster data globaal op voor AR preview
        currentPosterData = poster;
        
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
                
                // Set transparent checkbox
                const transparentCheckbox = document.getElementById(`edit-layer-${layerNum}-transparent`);
                if (transparentCheckbox) {
                    transparentCheckbox.checked = layerData.transparent || false;
                    // Toon/verberg kleurkiezer op basis van transparantie
                    const bgColorContainer = document.getElementById(`edit-layer-${layerNum}-bg-color-container`);
                    if (bgColorContainer) {
                        bgColorContainer.style.display = transparentCheckbox.checked ? 'none' : 'inline-flex';
                    }
                }
                
                // Set background color
                const bgColorInput = document.getElementById(`edit-layer-${layerNum}-bg-color`);
                if (bgColorInput) {
                    bgColorInput.value = layerData.bg_color || '#000000';
                }
                
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
                                    (layerData.anim_pos_duration && layerData.anim_pos_duration !== 0) ||
                                    (layerData.anim_rot_duration && layerData.anim_rot_duration !== 0) ||
                                    (layerData.anim_scale_duration && layerData.anim_scale_duration !== 0);
                
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
                const animFields = [
                    'anim_x', 'anim_y', 'anim_z', 'anim_pos_duration',
                    'anim_rot_x', 'anim_rot_y', 'anim_rot_z', 'anim_rot_duration', 'anim_rot_origin',
                    'anim_scale', 'anim_opacity', 'anim_scale_duration'
                ];
                animFields.forEach(field => {
                    const input = document.getElementById(`edit-layer-${layerNum}-${field.replace(/_/g, '-')}`);
                    if (input && layerData[field] !== undefined) {
                        input.value = layerData[field];
                    }
                });
                
                // Show current filename if exists
                const currentFileInfo = document.getElementById(`edit-layer-${layerNum}-current`);
                const deleteMediaBtn = document.getElementById(`edit-layer-${layerNum}-delete-media-btn`);
                if (currentFileInfo && layerData.filename) {
                    currentFileInfo.textContent = `Huidig: ${layerData.filename}`;
                    currentFileInfo.style.color = '#27ae60';
                    if (deleteMediaBtn) deleteMediaBtn.style.display = 'inline-block';
                } else if (currentFileInfo) {
                    currentFileInfo.textContent = 'Geen afbeelding';
                    currentFileInfo.style.color = '#999';
                    if (deleteMediaBtn) deleteMediaBtn.style.display = 'none';
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
                const deleteGlbBtn = document.getElementById(`edit-layer-${layerNum}-delete-glb-btn`);
                const deleteAudioBtn = document.getElementById(`edit-layer-${layerNum}-delete-audio-btn`);
                
                if (glbInfo) {
                    if (layerData.glb_model) {
                        glbInfo.textContent = `Huidig: ${layerData.glb_model}`;
                        glbInfo.style.color = '#27ae60';
                        if (deleteGlbBtn) deleteGlbBtn.style.display = 'inline-block';
                    } else {
                        glbInfo.textContent = 'Geen 3D model';
                        glbInfo.style.color = '#999';
                        if (deleteGlbBtn) deleteGlbBtn.style.display = 'none';
                    }
                }
                
                if (audioInfo) {
                    if (layerData.audio_file) {
                        audioInfo.textContent = `Huidig: ${layerData.audio_file}`;
                        audioInfo.style.color = '#27ae60';
                        if (deleteAudioBtn) deleteAudioBtn.style.display = 'inline-block';
                    } else {
                        audioInfo.textContent = 'Geen audio';
                        audioInfo.style.color = '#999';
                        if (deleteAudioBtn) deleteAudioBtn.style.display = 'none';
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
        console.log('[Modal] Delete button found:', !!deleteBtn);
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                console.log('[Modal] Delete button clicked for poster:', posterId);
                deletePoster(posterId);
            };
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
                const animPosDurationEl = document.getElementById(`edit-layer-${i}-anim-pos-duration`);
                const animRotXEl = document.getElementById(`edit-layer-${i}-anim-rot-x`);
                const animRotYEl = document.getElementById(`edit-layer-${i}-anim-rot-y`);
                const animRotZEl = document.getElementById(`edit-layer-${i}-anim-rot-z`);
                const animRotDurationEl = document.getElementById(`edit-layer-${i}-anim-rot-duration`);
                const animRotOriginEl = document.getElementById(`edit-layer-${i}-anim-rot-origin`);
                const animScaleEl = document.getElementById(`edit-layer-${i}-anim-scale`);
                const animOpacityEl = document.getElementById(`edit-layer-${i}-anim-opacity`);
                const animScaleDurationEl = document.getElementById(`edit-layer-${i}-anim-scale-duration`);
                
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
                
                // Get transparent checkbox
                const transparentEl = document.getElementById(`edit-layer-${i}-transparent`);
                const transparent = transparentEl ? (transparentEl.checked ? '1' : '0') : '0';
                
                // Get background color
                const bgColorEl = document.getElementById(`edit-layer-${i}-bg-color`);
                const bgColor = bgColorEl ? bgColorEl.value : '#000000';
                
                // Get delete flag (hele laag)
                const deleteEl = document.getElementById(`edit-layer-${i}-delete`);
                const deleteFlag = deleteEl ? deleteEl.value : '0';
                
                // Get delete media flags (per media type)
                const deleteMediaEl = document.getElementById(`edit-layer-${i}-delete-media`);
                const deleteGlbEl = document.getElementById(`edit-layer-${i}-delete-glb`);
                const deleteAudioEl = document.getElementById(`edit-layer-${i}-delete-audio`);
                const deleteMedia = deleteMediaEl ? deleteMediaEl.value : '0';
                const deleteGlb = deleteGlbEl ? deleteGlbEl.value : '0';
                const deleteAudio = deleteAudioEl ? deleteAudioEl.value : '0';
                
                // Always send configuration (updates existing layer config)
                formData.append(`layer_${i}_z`, layerZ || '0');
                formData.append(`layer_${i}_exclusion`, exclusion);
                formData.append(`layer_${i}_transparent`, transparent);
                formData.append(`layer_${i}_bg_color`, bgColor);
                formData.append(`layer_${i}_delete`, deleteFlag);
                formData.append(`layer_${i}_delete_media`, deleteMedia);
                formData.append(`layer_${i}_delete_glb`, deleteGlb);
                formData.append(`layer_${i}_delete_audio`, deleteAudio);
                
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
                formData.append(`layer_${i}_anim_pos_duration`, animPosDurationEl ? animPosDurationEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_x`, animRotXEl ? animRotXEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_y`, animRotYEl ? animRotYEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_z`, animRotZEl ? animRotZEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_duration`, animRotDurationEl ? animRotDurationEl.value || '0' : '0');
                formData.append(`layer_${i}_anim_rot_origin`, animRotOriginEl ? animRotOriginEl.value || 'center' : 'center');
                formData.append(`layer_${i}_anim_scale`, animScaleEl ? animScaleEl.value || '1.0' : '1.0');
                formData.append(`layer_${i}_anim_opacity`, animOpacityEl ? animOpacityEl.value || '1.0' : '1.0');
                formData.append(`layer_${i}_anim_scale_duration`, animScaleDurationEl ? animScaleDurationEl.value || '0' : '0');
                
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
window.deleteLayerMedia = deleteLayerMedia;
window.toggleBgColorPicker = toggleBgColorPicker;
window.deletePoster = deletePoster;

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
