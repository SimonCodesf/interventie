/**
 * Terminal Bestandsbeheer - Venster Systeem
 * Retro terminal-stijl bestandsbrowser met sleepbare, schaalbare vensters
 */

// Venster beheer
let windowZIndex = 100;
let openWindows = new Map();
let activeWindowId = null;

// Initialize file manager
function initFileManager() {

    
    // Create main file manager structure
    createFileManagerUI();
    
    // Load posters as files
    loadFilesFromPosters();
    
    // Setup sidebar navigation
    setupSidebar();
}

// Create the main UI structure
function createFileManagerUI() {
    const desktopView = document.getElementById('desktop-view');
    if (!desktopView) return;
    
    desktopView.innerHTML = `
        <div class="file-manager">
            <!-- Terminal Header Bar -->
            <header class="terminal-header">
                <div class="header-left">
                    <img src="img/Artboard 1logo.svg" alt="Logo" class="header-logo">
                    <span class="terminal-title" id="header-title"></span>
                </div>
                <span class="terminal-status">● ONLINE</span>
            </header>
            
            <!-- Main Container -->
            <div class="fm-container">
                <!-- Sidebar -->
                <aside class="fm-sidebar">
                    <div class="sidebar-section">
                        <div class="sidebar-box" id="nav-box">
                            <div class="box-header"><span class="box-title">NAVIGATIE</span></div>
                            <div class="box-content">
                                <nav class="sidebar-nav">
                                    <a href="#" class="nav-item active" data-filter="all">
                                        <span class="nav-icon">▸</span>
                                        <span class="nav-label">ALLE_BESTANDEN/</span>
                                        <span class="nav-count"></span>
                                    </a>
                                    <a href="#" class="nav-item" data-filter="recent">
                                        <span class="nav-icon">▸</span>
                                        <span class="nav-label">RECENT/</span>
                                        <span class="nav-count"></span>
                                    </a>
                                    <a href="#" class="nav-item" data-filter="ar">
                                        <span class="nav-icon">▸</span>
                                        <span class="nav-label">AR_ENABLED/</span>
                                        <span class="nav-count"></span>
                                    </a>
                                </nav>
                            </div>
                            <div class="box-footer"></div>
                        </div>
                    </div>
                    
                    <div class="sidebar-section">
                        <div class="sidebar-box" id="loc-box">
                            <div class="box-header"><span class="box-title">LOCATIES</span></div>
                            <div class="box-content">
                                <nav class="sidebar-nav" id="location-nav">
                                    <!-- Dynamically filled -->
                                </nav>
                            </div>
                            <div class="box-footer"></div>
                        </div>
                    </div>
                    
                    <div class="sidebar-section">
                        <div class="sidebar-box" id="info-box">
                            <div class="box-header"><span class="box-title">INFO</span></div>
                            <div class="box-content">
                                <div class="sidebar-info">
                                    <p>│ <span id="total-files">0</span> BESTANDEN</p>
                                    <p>│ <span id="total-downloads">0</span> DOWNLOADS</p>
                                    <p>│ <span id="total-ar">0</span> AR MARKERS</p>
                                </div>
                            </div>
                            <div class="box-footer"></div>
                        </div>
                    </div>
                </aside>
                
                <!-- Main Content Area -->
                <main class="fm-main">
                    <!-- Path Bar (display only) -->
                    <div class="path-bar">
                        <span class="path-prefix">locatie:</span>
                        <span class="path-current" id="current-path">~/ALLE_BESTANDEN/</span>
                    </div>
                    
                    <!-- File List Header -->
                    <div class="file-list-header">
                        <span class="col-select">├</span>
                        <span class="col-thumb"></span>
                        <span class="col-name">NAAM</span>
                        <span class="col-location">LOCATIE</span>
                        <span class="col-downloads">DOWNLOADS</span>
                        <span class="col-date">DATUM</span>
                    </div>
                    
                    <!-- File List -->
                    <div class="file-list" id="file-list">
                        <!-- Files will be loaded here -->
                    </div>
                    
                    <!-- Status Bar -->
                    <div class="status-bar">
                        <span id="selected-count">0 geselecteerd</span>
                        <span class="status-divider">│</span>
                        <span id="visible-count">0 bestanden</span>
                    </div>
                </main>
            </div>
        </div>
        
        <!-- Window Container (for popup windows) -->
        <div class="window-container" id="window-container"></div>
    `;
    
    // Initialize dynamic box borders
    setTimeout(initBoxBorders, 0);
    
    // Update borders on window resize
    window.addEventListener('resize', debounce(initBoxBorders, 100));
}

// Debounce helper
function debounce(fn, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Generate box-drawing borders that fit content
function initBoxBorders() {
    // Create a measurement element for accurate char width
    const measure = document.createElement('span');
    measure.style.cssText = 'position:absolute;visibility:hidden;font-family:Roboto Mono,monospace;font-size:0.8rem;white-space:pre;';
    measure.textContent = '─'.repeat(10);
    document.body.appendChild(measure);
    const charWidth = measure.offsetWidth / 10;
    document.body.removeChild(measure);
    
    document.querySelectorAll('.sidebar-box').forEach(box => {
        updateBoxBorder(box, charWidth);
    });
    
    // Update header title
    updateHeaderTitle();
}

function updateBoxBorder(box, charWidth) {
    const title = box.querySelector('.box-title');
    const header = box.querySelector('.box-header');
    const footer = box.querySelector('.box-footer');
    
    if (!title || !header || !footer) return;
    
    // Get the actual width of the box
    const boxWidth = box.offsetWidth;
    // Use measured or fallback charWidth
    const cw = charWidth || 6.5;
    const availableChars = Math.floor(boxWidth / cw) - 1;
    
    const titleText = title.textContent;
    const titleLen = titleText.length + 4; // [ TITLE ]
    const remainingChars = Math.max(0, availableChars - titleLen);
    const leftPad = Math.floor(remainingChars / 2);
    const rightPad = remainingChars - leftPad;
    
    header.innerHTML = `┌${'─'.repeat(leftPad)}[ ${titleText} ]${'─'.repeat(rightPad)}┐`;
    footer.innerHTML = `└${'─'.repeat(availableChars)}┘`;
}

function updateHeaderTitle() {
    const headerTitle = document.getElementById('header-title');
    if (!headerTitle) return;
    
    const titleText = 'INTERVENTIE_POSTER_ARCHIEF';
    headerTitle.textContent = `┌─[ ${titleText} ]─┐`;
}

// Load posters as file entries
async function loadFilesFromPosters() {
    const fileList = document.getElementById('file-list');
    if (!fileList) return;
    
    // Show loading
    fileList.innerHTML = `
        <div class="file-loading">
            <span>LADEN</span>
            <span class="loading-dots">...</span>
        </div>
    `;
    
    try {
        // Use existing poster data or fetch
        if (!window.allPosters || window.allPosters.length === 0) {
            const response = await fetch(`${window.API_URL || (window.location.origin + '/api.php')}/posters`);
            if (response.ok) {
                window.allPosters = await response.json();
            }
        }
        
        const posters = window.allPosters || [];
        
        // Update stats
        document.getElementById('total-files').textContent = posters.length;
        document.getElementById('total-ar').textContent = posters.filter(p => p.ar_marker).length;
        document.getElementById('total-downloads').textContent = posters.reduce((sum, p) => sum + Number(p.downloads || 0), 0);
        
        // Update nav counts
        document.querySelector('[data-filter="all"] .nav-count').textContent = `[${posters.length}]`;
        document.querySelector('[data-filter="ar"] .nav-count').textContent = `[${posters.filter(p => p.ar_marker).length}]`;
        document.querySelector('[data-filter="recent"] .nav-count').textContent = `[${Math.min(10, posters.length)}]`;
        
        // Build location nav
        buildLocationNav(posters);
        
        // Render files
        renderFiles(posters);
        
    } catch (error) {
        console.error('Error loading files:', error);
        fileList.innerHTML = `<div class="file-error">ERROR: Kan bestanden niet laden</div>`;
    }
}

// Build location navigation from posters
function buildLocationNav(posters) {
    const locationNav = document.getElementById('location-nav');
    if (!locationNav) return;
    
    // Get unique locations
    const locations = new Map();
    posters.forEach(p => {
        if (p.location_description) {
            const loc = p.location_description.split(',')[0].trim();
            locations.set(loc, (locations.get(loc) || 0) + 1);
        }
    });
    
    if (locations.size === 0) {
        locationNav.innerHTML = '<p class="nav-empty">│ Geen locaties</p>';
        return;
    }
    
    locationNav.innerHTML = Array.from(locations).map(([loc, count]) => `
        <a href="#" class="nav-item" data-location="${loc}">
            <span class="nav-icon">▸</span>
            <span class="nav-label">${loc.toUpperCase().replace(/\s+/g, '_')}/</span>
            <span class="nav-count">[${count}]</span>
        </a>
    `).join('');
    
    // Add click handlers
    locationNav.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const location = item.dataset.location;
            filterByLocation(location);
            
            // Update active state
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Update path
            document.getElementById('current-path').textContent = `~/LOCATIES/${location.toUpperCase().replace(/\s+/g, '_')}/`;
        });
    });
}

// Render file list
function renderFiles(posters, filter = 'all') {
    const fileList = document.getElementById('file-list');
    if (!fileList) return;
    
    let filtered = posters;
    
    switch (filter) {
        case 'recent':
            filtered = posters.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 10);
            break;
        case 'ar':
            filtered = posters.filter(p => p.ar_marker);
            break;
    }
    
    if (filtered.length === 0) {
        fileList.innerHTML = '<div class="file-empty">│ Geen bestanden gevonden</div>';
        document.getElementById('visible-count').textContent = '0 bestanden';
        return;
    }
    
    const baseUrl = window.BASE_URL || window.location.origin;
    
    fileList.innerHTML = filtered.map((poster, index) => {
        const dateRaw = poster.created_at || poster.upload_date || poster.uploadDate;
        const date = dateRaw ? new Date(dateRaw).toLocaleDateString('nl-NL') : '──';
        const location = poster.location_description ? poster.location_description.split(',')[0].trim() : '──';
        const downloads = poster.downloads !== undefined ? poster.downloads : '──';
        const thumbUrl = poster.thumbnail ? `${baseUrl}${poster.thumbnail}` : 'img/placeholder.png';
        
        return `
            <div class="file-row" data-poster-id="${poster.id}" tabindex="0">
                <span class="col-select">├</span>
                <span class="col-thumb"><img src="${thumbUrl}" alt="" onerror="this.style.opacity='0.3'"></span>
                <span class="col-name">${escapeHtml(poster.title || 'Untitled')}</span>
                <span class="col-location">${escapeHtml(location)}</span>
                <span class="col-downloads">${downloads}</span>
                <span class="col-date">${date}</span>
            </div>
        `;
    }).join('');
    
    document.getElementById('visible-count').textContent = `${filtered.length} bestanden`;
    
    // Add click handlers
    fileList.querySelectorAll('.file-row').forEach(row => {
        row.addEventListener('click', () => {
            // Open file window on single click
            const posterId = row.dataset.posterId;
            openFileWindow(posterId);
            // Also select this row
            fileList.querySelectorAll('.file-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');
            updateSelectionCount();
        });
        
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const posterId = row.dataset.posterId;
                openFileWindow(posterId);
            }
        });
    });
}

// Filter by location
function filterByLocation(location) {
    const posters = window.allPosters || [];
    const filtered = posters.filter(p => 
        p.location_description && p.location_description.includes(location)
    );
    renderFiles(filtered);
}

// Setup sidebar navigation
function setupSidebar() {
    document.querySelectorAll('.fm-sidebar .nav-item[data-filter]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const filter = item.dataset.filter;
            
            // Update active state
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            // Update path
            const pathMap = {
                'all': '~/ALLE_BESTANDEN/',
                'recent': '~/RECENT/',
                'ar': '~/AR_ENABLED/'
            };
            document.getElementById('current-path').textContent = pathMap[filter] || '~/';
            
            // Render filtered files
            renderFiles(window.allPosters || [], filter);
        });
    });
}

// Update selection count
function updateSelectionCount() {
    const selected = document.querySelectorAll('.file-row.selected').length;
    document.getElementById('selected-count').textContent = `${selected} geselecteerd`;
}

// Open a file in a new window
async function openFileWindow(posterId) {
    // Check if window already exists
    if (openWindows.has(posterId)) {
        const existingWindow = openWindows.get(posterId);
        bringToFront(existingWindow.element);
        return;
    }
    
    try {
        // Fetch poster data
        const response = await fetch(`${window.API_URL || (window.location.origin + '/api.php')}/posters/${posterId}`);
        if (!response.ok) throw new Error('Cannot load file');
        
        const poster = await response.json();
        
        // Create window
        createWindow(poster);
        
    } catch (error) {
        console.error('Error opening file:', error);
    }
}

// Create a draggable, resizable window
function createWindow(poster) {
    const container = document.getElementById('window-container');
    if (!container) return;
    
    const windowId = `window-${poster.id}`;
    const baseUrl = window.BASE_URL || window.location.origin;
    const imageUrl = poster.thumbnail ? `${baseUrl}${poster.thumbnail}` : 
                     (poster.jpeg_url ? `${baseUrl}${poster.jpeg_url}` : 'img/placeholder.png');
    
    // Window dimensions
    const windowWidth = 680;
    const windowHeight = 450;
    
    // Calculate safe position (always fully visible)
    const maxX = window.innerWidth - windowWidth - 20;
    const maxY = window.innerHeight - windowHeight - 20;
    const minX = 20;
    const minY = 70;
    
    const posX = Math.max(minX, Math.min(maxX, minX + Math.random() * Math.max(0, maxX - minX)));
    const posY = Math.max(minY, Math.min(maxY, minY + Math.random() * Math.max(0, maxY - minY)));
    
    // Generate title with dynamic border
    const titleText = (poster.title || 'BESTAND').toUpperCase();
    const titleDisplay = `┌─[ ${titleText} ]─┐`;
    
    const windowEl = document.createElement('div');
    windowEl.className = 'terminal-window';
    windowEl.id = windowId;
    windowEl.style.cssText = `
        left: ${posX}px;
        top: ${posY}px;
        width: ${windowWidth}px;
        height: ${windowHeight}px;
        z-index: ${++windowZIndex};
    `;
    
    windowEl.innerHTML = `
        <div class="window-header" data-window-id="${windowId}">
            <span class="window-title">${titleDisplay}</span>
            <div class="window-controls">
                <button class="win-btn win-minimize" title="Minimaliseren">─</button>
                <button class="win-btn win-maximize" title="Maximaliseren">□</button>
                <button class="win-btn win-close" title="Sluiten">×</button>
            </div>
        </div>
        <div class="window-content">
            <div class="window-image">
                <img src="${imageUrl}" alt="${escapeHtml(poster.title || '')}" onerror="this.src='img/placeholder.png'">
            </div>
            <div class="window-terminal">
                <div class="term-line"><span class="term-prompt">$</span> cat ./poster_${poster.id}.info</div>
                <div class="term-output">
                    <div class="term-row"><span class="term-key">TITEL</span><span class="term-val">${escapeHtml(poster.title || 'Onbekend')}</span></div>
                    ${poster.description ? `<div class="term-row"><span class="term-key">DESC</span><span class="term-val">${escapeHtml(poster.description)}</span></div>` : ''}
                    ${poster.location_description ? `<div class="term-row"><span class="term-key">LOC</span><span class="term-val">${escapeHtml(poster.location_description)}</span></div>` : ''}
                    ${formatCredits(poster)}
                    <div class="term-row"><span class="term-key">DL_COUNT</span><span class="term-val">${poster.downloads || 0}</span></div>
                    <div class="term-row"><span class="term-key">STATUS</span><span class="term-val term-ok">ONLINE</span></div>
                </div>
                ${poster.artikel_link ? `
                <div class="term-line"><span class="term-prompt">$</span> open --url "${poster.artikel_link}"</div>
                <div class="term-output">
                    <a href="${poster.artikel_link}" target="_blank" class="term-link">[KLIK OM ARTIKEL TE OPENEN]</a>
                </div>
                ` : ''}
                <div class="term-line"><span class="term-prompt">$</span> download --format</div>
                <div class="term-actions">
                    <button class="term-btn" data-action="download-jpeg" data-poster-id="${poster.id}">[JPEG]</button>
                    <button class="term-btn" data-action="download-a3" data-poster-id="${poster.id}">[A3_PDF]</button>
                    <button class="term-btn" data-action="download-a0" data-poster-id="${poster.id}">[A0_PDF]</button>
                </div>
                <div class="term-line term-cursor"><span class="term-prompt">$</span> <span class="cursor">_</span></div>
            </div>
        </div>
        <div class="resize-handle resize-se"></div>
        <div class="resize-handle resize-sw"></div>
        <div class="resize-handle resize-ne"></div>
        <div class="resize-handle resize-nw"></div>
        <div class="resize-handle resize-n"></div>
        <div class="resize-handle resize-s"></div>
        <div class="resize-handle resize-e"></div>
        <div class="resize-handle resize-w"></div>
    `;
    
    container.appendChild(windowEl);
    
    // Store window reference
    openWindows.set(poster.id.toString(), {
        element: windowEl,
        poster: poster,
        minimized: false,
        maximized: false
    });
    
    // Setup window interactions
    setupWindowDrag(windowEl);
    setupWindowResize(windowEl);
    setupWindowControls(windowEl, poster.id);
    setupWindowFocus(windowEl);
    setupDownloadButtons(windowEl);
    
    // Animate in
    windowEl.style.opacity = '0';
    windowEl.style.transform = 'scale(0.95)';
    requestAnimationFrame(() => {
        windowEl.style.transition = 'opacity 0.2s, transform 0.2s';
        windowEl.style.opacity = '1';
        windowEl.style.transform = 'scale(1)';
    });
}

// Setup window dragging
function setupWindowDrag(windowEl) {
    const header = windowEl.querySelector('.window-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('win-btn')) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = windowEl.offsetLeft;
        startTop = windowEl.offsetTop;
        
        bringToFront(windowEl);
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
        isDragging = false;
        windowEl.classList.remove('dragging');
    });
}

// Setup window resizing
function setupWindowResize(windowEl) {
    const handles = windowEl.querySelectorAll('.resize-handle');
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    const minWidth = 400;
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
            
            bringToFront(windowEl);
            windowEl.classList.add('resizing');
            
            e.preventDefault();
            e.stopPropagation();
        });
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing || !currentHandle) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        if (currentHandle.classList.contains('resize-e') || 
            currentHandle.classList.contains('resize-se') || 
            currentHandle.classList.contains('resize-ne')) {
            windowEl.style.width = `${Math.max(minWidth, startWidth + dx)}px`;
        }
        
        if (currentHandle.classList.contains('resize-w') || 
            currentHandle.classList.contains('resize-sw') || 
            currentHandle.classList.contains('resize-nw')) {
            const newWidth = Math.max(minWidth, startWidth - dx);
            if (newWidth !== minWidth || startWidth - dx > 0) {
                windowEl.style.width = `${newWidth}px`;
                windowEl.style.left = `${startLeft + (startWidth - newWidth)}px`;
            }
        }
        
        if (currentHandle.classList.contains('resize-s') || 
            currentHandle.classList.contains('resize-se') || 
            currentHandle.classList.contains('resize-sw')) {
            windowEl.style.height = `${Math.max(minHeight, startHeight + dy)}px`;
        }
        
        if (currentHandle.classList.contains('resize-n') || 
            currentHandle.classList.contains('resize-ne') || 
            currentHandle.classList.contains('resize-nw')) {
            const newHeight = Math.max(minHeight, startHeight - dy);
            if (newHeight !== minHeight || startHeight - dy > 0) {
                windowEl.style.height = `${newHeight}px`;
                windowEl.style.top = `${startTop + (startHeight - newHeight)}px`;
            }
        }
    });
    
    document.addEventListener('mouseup', () => {
        isResizing = false;
        currentHandle = null;
        windowEl.classList.remove('resizing');
    });
}

// Setup window control buttons
function setupWindowControls(windowEl, posterId) {
    const closeBtn = windowEl.querySelector('.win-close');
    const minimizeBtn = windowEl.querySelector('.win-minimize');
    const maximizeBtn = windowEl.querySelector('.win-maximize');
    
    closeBtn.addEventListener('click', () => {
        windowEl.style.transition = 'opacity 0.15s, transform 0.15s';
        windowEl.style.opacity = '0';
        windowEl.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            windowEl.remove();
            openWindows.delete(posterId.toString());
        }, 150);
    });
    
    minimizeBtn.addEventListener('click', () => {
        const windowData = openWindows.get(posterId.toString());
        if (windowData) {
            windowData.minimized = !windowData.minimized;
            windowEl.classList.toggle('minimized', windowData.minimized);
        }
    });
    
    maximizeBtn.addEventListener('click', () => {
        const windowData = openWindows.get(posterId.toString());
        if (windowData) {
            windowData.maximized = !windowData.maximized;
            windowEl.classList.toggle('maximized', windowData.maximized);
            
            if (windowData.maximized) {
                windowEl.dataset.prevStyle = `${windowEl.style.left};${windowEl.style.top};${windowEl.style.width};${windowEl.style.height}`;
                windowEl.style.left = '0';
                windowEl.style.top = '0';
                windowEl.style.width = '100vw';
                windowEl.style.height = '100vh';
            } else if (windowEl.dataset.prevStyle) {
                const [left, top, width, height] = windowEl.dataset.prevStyle.split(';');
                windowEl.style.left = left;
                windowEl.style.top = top;
                windowEl.style.width = width || '';
                windowEl.style.height = height || '';
            }
        }
    });
}

// Setup window focus
function setupWindowFocus(windowEl) {
    windowEl.addEventListener('mousedown', () => {
        bringToFront(windowEl);
    });
}

// Bring window to front
function bringToFront(windowEl) {
    windowEl.style.zIndex = ++windowZIndex;
    
    // Update active state
    document.querySelectorAll('.terminal-window').forEach(w => {
        w.classList.remove('active');
    });
    windowEl.classList.add('active');
}

// Setup download buttons
function setupDownloadButtons(windowEl) {
    const apiUrl = window.API_URL || (window.location.origin + '/api.php');
    
    windowEl.querySelectorAll('.term-btn, .action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = btn.dataset.action;
            const posterId = btn.dataset.posterId;
            
            let url = '';
            switch (action) {
                case 'download-jpeg':
                    url = `${apiUrl}/download/${posterId}?format=jpeg&size=original`;
                    break;
                case 'download-a3':
                    url = `${apiUrl}/download/${posterId}?format=pdf&size=a3`;
                    break;
                case 'download-a0':
                    url = `${apiUrl}/download/${posterId}?format=pdf&size=a0`;
                    break;
            }
            
            if (url) {
                window.location.href = url;
            }
        });
    });
}

// Utility: Format file size
function formatFileSize(bytes) {
    if (!bytes) return '-- KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Utility: Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility: Format credits voor terminal weergave
function formatCredits(poster) {
    console.log('formatCredits v2 aangeroepen voor poster:', poster.id);
    let creditItems = [];
    
    // Probeer eerst het nieuwe credits veld (JSON array)
    if (poster.credits) {
        try {
            let creditsArray = poster.credits;
            // Parse als het een string is
            if (typeof creditsArray === 'string') {
                creditsArray = JSON.parse(creditsArray);
            }
            // Check of het een array is met items
            if (Array.isArray(creditsArray) && creditsArray.length > 0) {
                creditItems = creditsArray.filter(c => c.item && c.owner);
            }
        } catch (e) {
            console.warn('Kon credits niet parsen:', e);
        }
    }
    
    // Fallback naar oud photographer_credit veld
    if (creditItems.length === 0 && poster.photographer_credit) {
        creditItems = [{ item: 'Foto', owner: poster.photographer_credit }];
    }
    
    if (creditItems.length === 0) {
        console.log('Geen credits gevonden voor poster', poster.id);
        return '';
    }
    
    // Format als CREDITS sectie met items op één regel
    const creditLines = creditItems
        .map(c => `${escapeHtml(c.item)}: ${escapeHtml(c.owner)}`)
        .join(' | ');
    
    const result = `<div class="term-row"><span class="term-key">CREDITS</span><span class="term-val">${creditLines}</span></div>`;
    console.log('Credits geformateerd:', result);
    
    return result;
}

// Export for use
window.initFileManager = initFileManager;
window.openFileWindow = openFileWindow;
