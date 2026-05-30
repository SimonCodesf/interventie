// Verberg en verwijder alle zichtbare download-statistieken van de frontend
(function(){
    const DOWNLOAD_REGEX = /\b(DOWNLOADS?|DL_COUNT|DL:|Downloads:)\b/i;

    function scrubNode(node){
        if (!node) return;
        // If it's a text node and matches, remove the matching parts
        if (node.nodeType === Node.TEXT_NODE) {
            if (DOWNLOAD_REGEX.test(node.textContent)) {
                node.textContent = node.textContent.replace(/\s*(?:DL_COUNT|DL:|Downloads?:|DOWNLOADS?:?)\s*[:]?\s*\d*/ig, '');
            }
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // Remove specific known elements
        const selectors = [
            '.col-downloads',
            '.poster-downloads',
            '.download-stat',
            '#modal-download-count',
            '#total-downloads',
            '.col-downloads',
            '.term-row .term-key'
        ];
        selectors.forEach(sel => {
            node.querySelectorAll && node.querySelectorAll(sel).forEach(el => {
                // If it's a key/value row (term-row with DL_COUNT), remove the whole row
                if (el.classList && el.classList.contains('term-key') && /DL_COUNT|DL/i.test(el.textContent)) {
                    const row = el.closest('.term-row'); if (row) row.remove();
                    return;
                }
                // Otherwise hide the element
                el.style.display = 'none';
            });
        });

        // Clean inline texts that mention downloads
        node.childNodes && node.childNodes.forEach(scrubNode);
    }

    function initialScrub(){
        try { scrubNode(document.body); } catch(e) { console.warn('Scrub failed', e); }
    }

    // Observe for dynamic additions (gallery overlay, windows, etc.)
    function observeMutations(){
        const mo = new MutationObserver(muts => {
            muts.forEach(m => {
                m.addedNodes.forEach(n => scrubNode(n));
                if (m.target) scrubNode(m.target);
            });
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { initialScrub(); observeMutations(); });
    } else {
        initialScrub(); observeMutations();
    }
})();
