/**
 * Slideshow — toont geëxporteerde PNG-slides in een terminal-popup.
 * 
 * Plaats slides in: slides/slide-01.png t/m slide-NN.png
 * 
 * TRIGGERS:
 *   - Klik op de blinkende ● ONLINE in de header
 *   - Typ "show" (binnen 2s)
 * 
 * NAVIGATIE:
 *   - ◀ ▶ knoppen in de popup header
 *   - Pijltjestoetsen ← → (volgende/vorige)
 *   - Escape sluit de popup
 *   - Swipe op touchscreens
 */

(function () {
    'use strict';

    // ============================
    // CONFIGURATIE
    // ============================

    const CONFIG = {
        dir: 'slides/',
        prefix: 'slide-',
        pad: 2,          // slide-01, slide-02, ...
        ext: '.png',
        count: 1,        // pas aan na export
    };

    // ============================
    // STATE
    // ============================

    let popup = null;
    let imgEl = null;
    let isOpen = false;
    let currentIndex = 0;
    let transitionTimer = null;
    let mirrorZIndex = 99999;
    const preloadCache = new Map();

    // ============================
    // SLIDE LOGICA
    // ============================

    function getSlidePath(i) {
        return CONFIG.dir + CONFIG.prefix + String(i + 1).padStart(CONFIG.pad, '0') + CONFIG.ext;
    }

    function preload(i) {
        if (i < 0 || i >= CONFIG.count || preloadCache.has(i)) return;
        const img = new Image();
        img.src = getSlidePath(i);
        preloadCache.set(i, img);
    }

    function showSlide(i) {
        if (!imgEl) return;
        clearTimeout(transitionTimer);
        currentIndex = i;

        imgEl.style.transition = 'opacity 0.2s ease';
        imgEl.style.opacity = '0';

        transitionTimer = setTimeout(() => {
            const cached = preloadCache.get(i);
            imgEl.src = (cached && cached.complete) ? cached.src : getSlidePath(i);
            if (imgEl.complete) imgEl.style.opacity = '1';
            imgEl.onload = () => { imgEl.style.opacity = '1'; };
        }, 200);

        updateTitle();
        preload(i + 1);
        preload(i + 2);
    }

    function updateTitle() {
        const t = popup && popup.querySelector('.window-title');
        if (t) t.textContent = '\u250c\u2500[ SLIDE ' + (currentIndex + 1) + '/' + CONFIG.count + ' ]\u2500\u2510';
    }

    function nextSlide() {
        if (currentIndex < CONFIG.count - 1) showSlide(currentIndex + 1);
    }

    function prevSlide() {
        if (currentIndex > 0) showSlide(currentIndex - 1);
    }

    // ============================
    // POPUP LOGICA
    // ============================

    function open() {
        if (popup && popup.isConnected) {
            popup.style.display = 'flex';
            isOpen = true;
            return;
        }
        buildPopup();
        isOpen = true;
        showSlide(currentIndex);
    }

    function close() {
        if (popup) popup.style.display = 'none';
        isOpen = false;
    }

    function toggle() {
        isOpen ? close() : open();
    }

    function buildPopup() {
        if (popup) {
            popup.remove();
            popup = null;
        }

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pw = Math.round(vw * 0.8);
        const ph = Math.round(vh * 0.85);
        const px = Math.round((vw - pw) / 2);
        const py = Math.round((vh - ph) / 2);

        imgEl = document.createElement('img');
        imgEl.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
        imgEl.alt = 'Slide laden...';
        imgEl.draggable = false;

        popup = document.createElement('div');
        popup.id = 'slideshow-popup';
        popup.className = 'terminal-window slideshow-window';
        popup.style.cssText = [
            'position:absolute;',
            'left:' + px + 'px;top:' + py + 'px;',
            'width:' + pw + 'px;height:' + ph + 'px;',
            'z-index:99999;min-width:auto;min-height:auto;'
        ].join('');

        popup.innerHTML =
            '<div class="window-header" data-window-id="slideshow">' +
                '<span class="window-title">\u250c\u2500[ SLIDE 1/' + CONFIG.count + ' ]\u2500\u2510</span>' +
                '<div class="window-controls">' +
                    '<button class="win-btn" data-slide="prev" title="Vorige (\u2190)">\u25c0</button>' +
                    '<button class="win-btn" data-slide="next" title="Volgende (\u2192)">\u25b6</button>' +
                    '<button class="win-btn win-close" title="Sluiten">\u00d7</button>' +
                '</div>' +
            '</div>' +
            '<div class="window-content" style="flex:1;overflow:hidden;background:#000;"></div>';

        popup.querySelector('.window-content').appendChild(imgEl);

        popup.querySelector('.win-close').addEventListener('click', close);
        popup.querySelector('[data-slide="prev"]').addEventListener('click', prevSlide);
        popup.querySelector('[data-slide="next"]').addEventListener('click', nextSlide);

        let container = document.getElementById('window-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'window-container';
            container.className = 'window-container';
            document.body.appendChild(container);
        }
        container.appendChild(popup);

        setupDrag(popup);
        setupFocus(popup);
        setupTouch(popup);
    }

    // ============================
    // INTERACTIES
    // ============================

    function bringToFront(el) {
        el.style.zIndex = ++mirrorZIndex;
        document.querySelectorAll('.slideshow-window,.iphone-mirror-window')
            .forEach(w => w.classList.remove('active'));
        el.classList.add('active');
    }

    function setupFocus(el) {
        el.addEventListener('mousedown', () => bringToFront(el));
    }

    function setupDrag(el) {
        var header = el.querySelector('.window-header');
        if (!header) return;
        var dragging = false, sx, sy, sl, st;

        header.addEventListener('mousedown', function (e) {
            if (e.target.classList.contains('win-btn')) return;
            dragging = true;
            el.classList.add('dragging');
            bringToFront(el);
            sx = e.clientX; sy = e.clientY;
            sl = parseInt(el.style.left) || 0;
            st = parseInt(el.style.top) || 0;
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            el.style.left = (sl + e.clientX - sx) + 'px';
            el.style.top = (st + e.clientY - sy) + 'px';
        });

        document.addEventListener('mouseup', function () {
            if (dragging) { dragging = false; el.classList.remove('dragging'); }
        });
    }

    function setupTouch(el) {
        var startX = 0, startY = 0;
        el.addEventListener('touchstart', function (e) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        el.addEventListener('touchend', function (e) {
            var dx = e.changedTouches[0].clientX - startX;
            var dy = e.changedTouches[0].clientY - startY;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
                dx > 0 ? prevSlide() : nextSlide();
            }
        });
    }

    // ============================
    // TRIGGERS
    // ============================

    function setupOnlineTrigger() {
        document.addEventListener('click', function (e) {
            if (e.target.closest('.terminal-status')) {
                e.preventDefault();
                toggle();
            }
        });
    }

    function setupKeyboard() {
        var buf = '', timer;
        document.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (isOpen) {
                if (e.key === 'ArrowLeft')  { e.preventDefault(); prevSlide(); return; }
                if (e.key === 'ArrowRight') { e.preventDefault(); nextSlide(); return; }
                if (e.key === 'Escape')     { close(); return; }
            }

            if (e.metaKey || e.ctrlKey || e.altKey) return;
            buf += e.key.toLowerCase();
            clearTimeout(timer);
            if (buf === 'show') { toggle(); buf = ''; }
            else if (buf.length >= 4) buf = '';
            timer = setTimeout(function () { buf = ''; }, 2000);
        });
    }

    // ============================
    // INIT
    // ============================

    function init() {
        setupKeyboard();
        setupOnlineTrigger();

        window.Slideshow = {
            toggle: toggle,
            open: open,
            close: close,
            next: nextSlide,
            prev: prevSlide
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
