/**
 * iPhone Mirror — toont live iPhone-scherm in een popup.
 * 
 * WERKING:
 *   1. Sluit iPhone via USB-C aan op de Mac
 *   2. Open QuickTime Player → Nieuwe filmopname → kies iPhone als bron
 *   3. Zet het QuickTime-venster in portret-verhouding, muis stil
 *      zodat de zwevende knoppen vervagen
 *   4. Klik op de onzichtbare trigger (rechtsonder) → eerste keer:
 *      kies het QuickTime-venster in het OS-keuzevenster
 *   5. Popup opent met live, gecropt iPhone-scherm
 */

(function () {
    'use strict';

    // ============================
    // CONFIGURATIE (aanpasbaar)
    // ============================

    // Crop-constanten: snij het QuickTime-venster bij tot het zuivere schermbeeld.
    // Tip: maak een screenshot van het QuickTime-venster en meet deze waarden in pixels.
    // sx,sy,sw,sh = het gebied BINNEN het QuickTime-venster dat je wilt tonen.
    const CROP = {
        sx: 0,      // x-offset vanaf linkerrand (px)   — pas aan!
        sy: 68,     // y-offset vanaf bovenrand (px)    — titelbalk ~68px
        sw: 720,    // breedte van het schermgebied (px) — pas aan!
        sh: 1560,   // hoogte van het schermgebied (px)  — pas aan!
    };

    // Touch-zone voor de geheime trigger (rechtsonder in beeld)
    const TRIGGER = {
        size: 60,          // pixels
        position: 'bottom-right', // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    };

    // Toetsenreeks voor back-up trigger (typ in volgorde, binnen 2s)
    const KEY_SEQUENCE = 'scan';

    // ============================
    // STATE
    // ============================

    let mediaStream = null;
    let videoElement = null;
    let canvasElement = null;
    let canvasCtx = null;
    let popupElement = null;
    let rafHandle = null;
    let isPopupOpen = false;
    let streamEnded = false;

    // Toetsenreeks-detectie
    let keyBuffer = '';
    let keyTimer = null;

    // ============================
    // CAPTURE LOGICA
    // ============================

    /**
     * (A) startCapture(): roept getDisplayMedia() aan en start de render-loop.
     * Moet aangeroepen worden vanuit een gebruikersgebaar (klik/toets).
     */
    async function startCapture() {
        if (mediaStream && mediaStream.active) {
            console.log('[iPhoneMirror] Capture loopt al, stream is actief');
            return true;
        }

        try {
            console.log('[iPhoneMirror] startCapture() — OS-keuzevenster opent...');
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 60 },
                audio: false,
            });

            console.log('[iPhoneMirror] Stream verkregen, tracks:', mediaStream.getVideoTracks().length);

            // Luister naar track-einde (QuickTime dicht, kabel los, etc.)
            const videoTrack = mediaStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.addEventListener('ended', () => {
                    console.warn('[iPhoneMirror] Videotrack beëindigd — stream gestopt');
                    handleStreamEnd();
                });
                videoTrack.addEventListener('muted', () => {
                    console.warn('[iPhoneMirror] Videotrack gemute (kabel los?)');
                });
            }

            streamEnded = false;
            initVideoElement();
            startRenderLoop();
            return true;
        } catch (err) {
            console.error('[iPhoneMirror] getDisplayMedia() mislukt:', err.name, err.message);
            mediaStream = null;
            return false;
        }
    }

    function initVideoElement() {
        if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.setAttribute('playsinline', '');
            videoElement.setAttribute('autoplay', '');
            videoElement.muted = true;
            videoElement.style.display = 'none';
            // Vul de video-element met canvas-data ipv directe stream
            // (we gebruiken het enkel als bron voor het canvas)
        }
        // Altijd de huidige stream koppelen
        if (videoElement.srcObject !== mediaStream) {
            videoElement.srcObject = mediaStream;
        }
        videoElement.play().catch(e => console.warn('[iPhoneMirror] video.play() error:', e));
    }

    /**
     * Render-loop: tekent het gecropte beeld naar het canvas.
     * Het canvas wordt via CSS in de popup getoond.
     */
    function startRenderLoop() {
        if (rafHandle) cancelAnimationFrame(rafHandle);

        // Canvas is al aangemaakt via de popup; check of het bestaat
        if (canvasElement) {
            canvasCtx = canvasElement.getContext('2d');
        }

        function render() {
            if (!streamEnded && videoElement && videoElement.readyState >= 2) {
                drawFrame();
            }
            rafHandle = requestAnimationFrame(render);
        }

        rafHandle = requestAnimationFrame(render);
        console.log('[iPhoneMirror] Render-loop gestart');
    }

    function drawFrame() {
        if (!canvasElement || !canvasCtx || !videoElement) return;

        const vw = videoElement.videoWidth;
        const vh = videoElement.videoHeight;

        if (vw === 0 || vh === 0) {
            // Video nog niet klaar, blanco canvas
            canvasCtx.fillStyle = '#000';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
            return;
        }

        // Gebruik de crop-waarden (begrensd tot videogrootte)
        const sx = Math.min(CROP.sx, vw);
        const sy = Math.min(CROP.sy, vh);
        const sw = Math.min(CROP.sw, vw - sx);
        const sh = Math.min(CROP.sh, vh - sy);

        // Pas canvas-grootte aan op basis van crop (als die veranderd is)
        const cw = Math.floor(sw * (canvasElement.width / sw));
        if (canvasElement.width !== Math.floor(sw) || canvasElement.height !== Math.floor(sh)) {
            canvasElement.width = Math.floor(sw);
            canvasElement.height = Math.floor(sh);
        }

        canvasCtx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, canvasElement.width, canvasElement.height);
    }

    /**
     * Stopt de capture volledig.
     */
    function stopCapture() {
        if (rafHandle) {
            cancelAnimationFrame(rafHandle);
            rafHandle = null;
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }

        if (videoElement) {
            videoElement.srcObject = null;
        }

        streamEnded = true;
        console.log('[iPhoneMirror] Capture gestopt');
    }

    function handleStreamEnd() {
        stopCapture();
        if (popupElement && isPopupOpen) {
            showDisconnectedState();
        }
    }

    // ============================
    // POPUP LOGICA
    // ============================

    function showDisconnectedState() {
        if (!popupElement) return;
        const canvas = popupElement.querySelector('.iphone-mirror-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '14px "Roboto Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Verbinding verbroken', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText('Klik de trigger opnieuw', canvas.width / 2, canvas.height / 2 + 15);
    }

    /**
     * (B) togglePopup(): opent/sluit de popup met de lopende stream.
     */
    function togglePopup() {
        if (isPopupOpen) {
            closePopup();
            return;
        }

        if (!mediaStream || !mediaStream.active) {
            console.log('[iPhoneMirror] Geen actieve stream — eerst capture starten...');
            startCapture().then(success => {
                if (success) openPopup();
            });
            return;
        }

        openPopup();
    }

    function openPopup() {
        if (popupElement && popupElement.isConnected) {
            popupElement.style.display = 'flex';
            bringMirrorToFront(popupElement);
            isPopupOpen = true;
            updateCanvasSize();
            console.log('[iPhoneMirror] Popup geopend');
            return;
        }

        createPopup();
        isPopupOpen = true;
        updateCanvasSize();
        console.log('[iPhoneMirror] Popup geopend (nieuw)');
    }

    function closePopup() {
        if (popupElement) {
            popupElement.style.display = 'none';
        }
        isPopupOpen = false;
        // Capture NIET stoppen — blijft op de achtergrond lopen
        console.log('[iPhoneMirror] Popup gesloten');
    }

    function updateCanvasSize() {
        if (!popupElement || !canvasElement) return;
        const content = popupElement.querySelector('.mirror-content');
        if (!content) return;

        const rect = content.getBoundingClientRect();
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);

        if (w > 0 && h > 0 && (canvasElement.width !== w || canvasElement.height !== h)) {
            canvasElement.width = w;
            canvasElement.height = h;
            console.log(`[iPhoneMirror] Canvas aangepast: ${w}x${h}`);
        }
    }

    /**
     * Maakt de popup — zelfde stijl als file-manager windows.
     */
    function createPopup() {
        // Verwijder bestaande popup als die er nog is
        if (popupElement) {
            popupElement.remove();
            popupElement = null;
        }

        // Canvas voor het schermbeeld
        canvasElement = document.createElement('canvas');
        canvasElement.className = 'iphone-mirror-canvas';
        canvasElement.width = CROP.sw || 720;
        canvasElement.height = CROP.sh || 1560;
        canvasElement.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;';
        canvasCtx = canvasElement.getContext('2d');

        // Zwarte achtergrond voor het laden
        canvasCtx.fillStyle = '#000';
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

        const posX = 100 + Math.random() * 200;
        const posY = 50 + Math.random() * 100;

        popupElement = document.createElement('div');
        popupElement.id = 'iphone-mirror-popup';
        popupElement.className = 'terminal-window iphone-mirror-window';
        popupElement.style.cssText = `
            position: absolute;
            left: ${posX}px;
            top: ${posY}px;
            width: 320px;
            z-index: 99999;
            aspect-ratio: 9 / 19.5;
            min-width: 200px;
            min-height: 400px;
        `;

        popupElement.innerHTML = `
            <div class="window-header" data-window-id="iphone-mirror">
                <span class="window-title">┌─[ iPhone Mirror ]─┐</span>
                <div class="window-controls">
                    <button class="win-btn win-close" title="Sluiten">×</button>
                </div>
            </div>
            <div class="window-content" style="display:flex;flex:1;overflow:hidden;background:#000;">
                <div class="mirror-content" style="flex:1;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden;">
                </div>
            </div>
        `;

        // Plaats canvas in de content
        const mirrorContent = popupElement.querySelector('.mirror-content');
        mirrorContent.appendChild(canvasElement);

        // Voeg toe aan de window-container (dezelfde als file-manager windows)
        let container = document.getElementById('window-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'window-container';
            container.className = 'window-container';
            document.body.appendChild(container);
        }
        container.appendChild(popupElement);

        // Setup interacties
        setupMirrorDrag(popupElement);
        setupMirrorResize(popupElement);
        setupMirrorClose(popupElement);
        setupMirrorFocus(popupElement);

        // Start render-loop als die nog niet loopt
        if (!rafHandle && mediaStream && mediaStream.active) {
            startRenderLoop();
        }

        bringMirrorToFront(popupElement);
    }

    // ============================
    // INTERACTIES (zelfde gedrag als file-manager)
    // ============================

    let mirrorZIndex = 99999;

    function bringMirrorToFront(el) {
        el.style.zIndex = ++mirrorZIndex;
        document.querySelectorAll('.iphone-mirror-window').forEach(w => w.classList.remove('active'));
        el.classList.add('active');
    }

    function setupMirrorFocus(el) {
        el.addEventListener('mousedown', () => bringMirrorToFront(el));
    }

    function setupMirrorClose(el) {
        const closeBtn = el.querySelector('.win-close');
        if (!closeBtn) return;
        closeBtn.addEventListener('click', () => {
            closePopup();
        });
    }

    function setupMirrorDrag(el) {
        const header = el.querySelector('.window-header');
        if (!header) return;

        let dragging = false, startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('win-btn')) return;
            dragging = true;
            el.classList.add('dragging');
            bringMirrorToFront(el);

            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(el.style.left) || 0;
            startTop = parseInt(el.style.top) || 0;

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            el.style.left = (startLeft + (e.clientX - startX)) + 'px';
            el.style.top = (startTop + (e.clientY - startY)) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (dragging) {
                dragging = false;
                el.classList.remove('dragging');
            }
        });
    }

    function setupMirrorResize(el) {
        // Alleen de vier hoeken voor resize (simpeler)
        const handles = ['se', 'sw', 'ne', 'nw'];
        const container = el;

        handles.forEach(dir => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${dir}`;
            container.appendChild(handle);

            let resizing = false, startX, startY, startW, startH, startL, startT;

            handle.addEventListener('mousedown', (e) => {
                resizing = true;
                bringMirrorToFront(el);

                startX = e.clientX;
                startY = e.clientY;
                startW = parseInt(el.style.width) || el.offsetWidth;
                startH = parseInt(el.style.height) || el.offsetHeight;
                startL = parseInt(el.style.left) || 0;
                startT = parseInt(el.style.top) || 0;

                e.preventDefault();
                e.stopPropagation();
            });

            document.addEventListener('mousemove', (e) => {
                if (!resizing) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                let newW = startW, newH = startH, newL = startL, newT = startT;

                if (dir.includes('e')) { newW = Math.max(200, startW + dx); }
                if (dir.includes('w')) { newW = Math.max(200, startW - dx); newL = startL + dx; }
                if (dir.includes('s')) { newH = Math.max(350, startH + dy); }
                if (dir.includes('n')) { newH = Math.max(350, startH - dy); newT = startT + dy; }

                el.style.width = newW + 'px';
                el.style.height = newH + 'px';
                el.style.left = newL + 'px';
                el.style.top = newT + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (resizing) {
                    resizing = false;
                    updateCanvasSize();
                }
            });
        });

        // Ook randen voor resize
        const edges = ['n', 's', 'e', 'w'];
        edges.forEach(dir => {
            const handle = document.createElement('div');
            handle.className = `resize-handle resize-${dir}`;
            container.appendChild(handle);

            let resizing = false, startX, startY, startW, startH, startL, startT;

            handle.addEventListener('mousedown', (e) => {
                resizing = true;
                bringMirrorToFront(el);
                startX = e.clientX;
                startY = e.clientY;
                startW = parseInt(el.style.width) || el.offsetWidth;
                startH = parseInt(el.style.height) || el.offsetHeight;
                startL = parseInt(el.style.left) || 0;
                startT = parseInt(el.style.top) || 0;
                e.preventDefault();
                e.stopPropagation();
            });

            document.addEventListener('mousemove', (e) => {
                if (!resizing) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                let newW = startW, newH = startH, newL = startL, newT = startT;

                if (dir === 'e') newW = Math.max(200, startW + dx);
                if (dir === 'w') { newW = Math.max(200, startW - dx); newL = startL + dx; }
                if (dir === 's') newH = Math.max(350, startH + dy);
                if (dir === 'n') { newH = Math.max(350, startH - dy); newT = startT + dy; }

                el.style.width = newW + 'px';
                el.style.height = newH + 'px';
                el.style.left = newL + 'px';
                el.style.top = newT + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (resizing) {
                    resizing = false;
                    updateCanvasSize();
                }
            });
        });
    }

    // ============================
    // TRIGGER LOGICA
    // ============================

    function createTriggerZone() {
        const trigger = document.createElement('div');
        trigger.id = 'iphone-mirror-trigger';
        const size = TRIGGER.size;

        trigger.style.cssText = `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            opacity: 0;
            cursor: default;
            z-index: 999999;
            ${getTriggerPositionCSS()}
        `;

        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[iPhoneMirror] Trigger geklikt');
            togglePopup();
        });

        document.body.appendChild(trigger);
        console.log('[iPhoneMirror] Trigger zone toegevoegd:', getTriggerPositionCSS());
    }

    function getTriggerPositionCSS() {
        const margin = '10px';
        switch (TRIGGER.position) {
            case 'top-left':     return `top: ${margin}; left: ${margin};`;
            case 'top-right':    return `top: ${margin}; right: ${margin};`;
            case 'bottom-left':  return `bottom: ${margin}; left: ${margin};`;
            case 'bottom-right':
            default:             return `bottom: ${margin}; right: ${margin};`;
        }
    }

    function setupKeyboardTrigger() {
        document.addEventListener('keydown', (e) => {
            // Negeer als gebruiker in een input/textarea typt
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            // Negeer modifier combinaties
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            keyBuffer += e.key.toLowerCase();
            clearTimeout(keyTimer);

            if (keyBuffer === KEY_SEQUENCE) {
                console.log('[iPhoneMirror] Toetsenreeks gedetecteerd');
                togglePopup();
                keyBuffer = '';
            } else if (keyBuffer.length >= KEY_SEQUENCE.length) {
                // Buffer te lang — reset
                keyBuffer = '';
            }

            // Reset buffer na 2s inactiviteit
            keyTimer = setTimeout(() => { keyBuffer = ''; }, 2000);
        });
    }

    // ============================
    // RESIZE OBSERVER
    // ============================

    function setupResizeObserver() {
        if (!popupElement) return;
        const observer = new ResizeObserver(() => {
            if (isPopupOpen) updateCanvasSize();
        });
        const content = popupElement.querySelector('.mirror-content');
        if (content) observer.observe(content);
    }

    // ============================
    // INIT
    // ============================

    function init() {
        console.log('[iPhoneMirror] Initialiseren...');
        createTriggerZone();
        setupKeyboardTrigger();

        // Exposeer voor debugging en externe aanroep
        window.iPhoneMirror = {
            startCapture,
            togglePopup,
            stopCapture,
            closePopup,
            getState: () => ({
                hasStream: !!(mediaStream && mediaStream.active),
                isPopupOpen,
                streamEnded,
            }),
        };
    }

    // Wacht op DOM-ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
