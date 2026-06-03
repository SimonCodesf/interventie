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
    // sx,sy = offset vanaf linker-/bovenrand van het QuickTime-venster (titelbalk)
    // sw,sh = breedte/hoogte van het schermgebied
    const CROP = {
        sx: 0,
        sy: 0,       // stel in op titelbalk-hoogte (bv. 38px)
        sw: 816,
        sh: 1780,
    };

    // Touch-zone voor de geheime trigger (rechtsonder in beeld)
    const TRIGGER = {
        size: 60,          // pixels
        position: 'bottom-right',
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

    async function startCapture() {
        if (mediaStream && mediaStream.active) {
            return true;
        }

        try {
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 60 },
                audio: false,
            });

            const videoTrack = mediaStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.addEventListener('ended', () => {
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
        }
        if (videoElement.srcObject !== mediaStream) {
            videoElement.srcObject = mediaStream;
        }
        videoElement.play().catch(e => console.warn('[iPhoneMirror] video.play() error:', e));
    }

    function startRenderLoop() {
        if (rafHandle) cancelAnimationFrame(rafHandle);

        function render() {
            if (!streamEnded && videoElement && videoElement.readyState >= 2) {
                drawFrame();
            }
            rafHandle = requestAnimationFrame(render);
        }

        rafHandle = requestAnimationFrame(render);
    }

    function drawFrame() {
        if (!canvasElement || !canvasCtx || !videoElement) return;

        const vw = videoElement.videoWidth;
        const vh = videoElement.videoHeight;

        if (vw === 0 || vh === 0) {
            canvasCtx.fillStyle = '#000';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
            return;
        }

        const sx = Math.min(CROP.sx, vw);
        const sy = Math.min(CROP.sy, vh);
        const sw = Math.min(CROP.sw, vw - sx);
        const sh = Math.min(CROP.sh, vh - sy);

        canvasCtx.drawImage(videoElement, sx, sy, sw, sh,
                            0, 0, canvasElement.width, canvasElement.height);
    }

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

    function togglePopup() {
        if (isPopupOpen) {
            closePopup();
            return;
        }

        if (!mediaStream || !mediaStream.active) {
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
            return;
        }

        createPopup();
        isPopupOpen = true;
    }

    function closePopup() {
        if (popupElement) {
            popupElement.style.display = 'none';
        }
        isPopupOpen = false;
    }

    function createPopup() {
        if (popupElement) {
            popupElement.remove();
            popupElement = null;
        }

        const vh = window.innerHeight;
        const popupHeight = Math.round(vh * 0.9);
        const headerHeight = 40;
        const contentHeight = popupHeight - headerHeight;
        const popupWidth = Math.round(contentHeight * CROP.sw / CROP.sh);

        canvasElement = document.createElement('canvas');
        canvasElement.className = 'iphone-mirror-canvas';
        canvasElement.width = popupWidth;
        canvasElement.height = contentHeight;
        canvasElement.style.cssText = 'width:100%;height:100%;display:block;';
        canvasCtx = canvasElement.getContext('2d');

        canvasCtx.fillStyle = '#000';
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

        const posX = Math.round((window.innerWidth - popupWidth) / 2);
        const posY = Math.round((vh - popupHeight) / 2);

        popupElement = document.createElement('div');
        popupElement.id = 'iphone-mirror-popup';
        popupElement.className = 'terminal-window iphone-mirror-window';
        popupElement.style.cssText = `
            position: absolute;
            left: ${posX}px;
            top: ${posY}px;
            width: ${popupWidth}px;
            height: ${popupHeight}px;
            min-width: auto;
            min-height: auto;
            z-index: 99999;
        `;

        popupElement.innerHTML = `
            <div class="window-header" data-window-id="iphone-mirror">
                <span class="window-title">┌─[ iPhone Mirror ]─┐</span>
                <div class="window-controls">
                    <button class="win-btn win-close" title="Sluiten">×</button>
                </div>
            </div>
            <div class="window-content" style="flex:1;overflow:hidden;background:#000;">
                <div class="mirror-content" style="width:100%;height:100%;background:#000;overflow:hidden;">
                </div>
            </div>
        `;

        const mirrorContent = popupElement.querySelector('.mirror-content');
        mirrorContent.appendChild(canvasElement);

        let container = document.getElementById('window-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'window-container';
            container.className = 'window-container';
            document.body.appendChild(container);
        }
        container.appendChild(popupElement);

        setupMirrorDrag(popupElement);
        setupMirrorClose(popupElement);
        setupMirrorFocus(popupElement);

        if (!rafHandle && mediaStream && mediaStream.active) {
            startRenderLoop();
        }

        bringMirrorToFront(popupElement);
    }

    // ============================
    // INTERACTIES
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
            togglePopup();
        });

        document.body.appendChild(trigger);
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
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            keyBuffer += e.key.toLowerCase();
            clearTimeout(keyTimer);

            if (keyBuffer === KEY_SEQUENCE) {
                togglePopup();
                keyBuffer = '';
            } else if (keyBuffer.length >= KEY_SEQUENCE.length) {
                keyBuffer = '';
            }

            keyTimer = setTimeout(() => { keyBuffer = ''; }, 2000);
        });
    }

    // ============================
    // INIT
    // ============================

    function init() {
        createTriggerZone();
        setupKeyboardTrigger();

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
