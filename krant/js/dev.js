// Dev-paneel: alleen geladen met ?dev=1 (zie index.html loader).
// Bevat: testmatrix, live-metrics, target-test, feedback.
(function initDevPanel() {
    if (!new URLSearchParams(location.search).has('dev')) return;

    // Matrix v2: extremen staan naast elkaar (duidelijk A/B-verschil bij
    // opeenvolgende taps) + nieuwe assen: crop (detectievenster),
    // sstep (schaalstap matcher), detEvery (detectiefrequentie).
    const POS = [{ name: '0 BASELINE', p: {} }];
    function pair(lab, k, lo, hi) {
        const ol = {};
        ol[k] = lo;
        const oh = {};
        oh[k] = hi;
        POS.push({ name: POS.length + ' ' + lab + '=' + lo, p: ol });
        POS.push({ name: POS.length + ' ' + lab + '=' + hi, p: oh });
    }
    pair('sim', 'sim', 0.35, 0.85);
    pair('fmin', 'fmin', 0.0005, 0.02);
    pair('fbeta', 'fbeta', 5, 200);
    pair('winStatic', 'winStatic', 3, 15);
    pair('movePos', 'movePos', 0.01, 0.12);
    pair('miss', 'miss', 2, 14);
    pair('qfeats', 'qfeats', 60, 300);
    pair('search', 'search', 6, 24);
    pair('crop', 'crop', 0.5, 1.5);
    pair('sstep', 'sstep', 1, 3);
    pair('detEvery', 'detEvery', 1, 4);
    POS.push({ name: POS.length + ' STIL-max', p: { sim: 0.5, fmin: 0.001, winStatic: 11, movePos: 0.08, moveAng: 8 } });
    POS.push({ name: POS.length + ' SNEL-max', p: { sim: 0.65, fmin: 0.008, fbeta: 120, winStatic: 5, winMove: 2, movePos: 0.015, moveAng: 2, search: 18, miss: 4 } });

    function curPos() {
        try { return JSON.parse(localStorage.getItem('AR_TEST_POS') ?? 'null'); } catch (e) { return null; }
    }
    function prevPos() {
        try { return JSON.parse(localStorage.getItem('AR_TEST_PREV') ?? 'null'); } catch (e) { return null; }
    }
    function applyPos(idx) {
        const prev = curPos();
        try {
            localStorage.setItem('AR_TEST_PREV', JSON.stringify(prev));
            localStorage.setItem('AR_TEST_POS', JSON.stringify(idx));
            localStorage.setItem('AR_TUNE', JSON.stringify(POS[idx].p));
        } catch (e) {}
        location.reload();
    }

    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99999;background:rgba(10,10,10,.93);color:#ddd;font:11px/1.5 monospace;padding:8px;max-height:72vh;overflow:auto;width:248px;border:1px solid #555';

    const head = document.createElement('div');
    head.innerHTML = '<b style="color:#fff">DEV TESTPOSITIES</b> <span style="color:#888">' + POS.length + ' stuks</span>';
    el.appendChild(head);

    const stats = document.createElement('div');
    stats.style.cssText = 'color:#0f0;margin:4px 0;white-space:pre';
    stats.textContent = 'metrics\u2026';
    el.appendChild(stats);

    // ---- Compacte navigator: met pijltjes door de posities ----
    const nav = document.createElement('div');
    nav.style.cssText = 'margin-top:4px;border-top:1px solid #555;padding-top:6px';
    const navTitle = document.createElement('div');
    navTitle.style.cssText = 'color:#fc6;font-size:12px';
    nav.appendChild(navTitle);

    function showPos(idx) {
        navTitle.textContent = (idx === null || idx === undefined)
            ? '\u25c0 \u25b6 = positie kiezen'
            : ((idx + 1) + '/' + POS.length + ' \u00b7 ' + POS[idx].name);
    }
    showPos(curPos());

    function stepPos(dir) {
        let cur = curPos();
        if (cur === null || cur === undefined) cur = (dir > 0 ? -1 : 1);
        let nxt = cur + dir;
        if (nxt < 0) nxt = 0;
        if (nxt >= POS.length) nxt = POS.length - 1;
        applyPos(nxt);
    }
    function votePos(vote) {
        sendFeedback('', '', { pos: curPos(), vote: vote, vsPos: prevPos() });
    }

    const navRow = document.createElement('div');
    navRow.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap';
    function nbtn(label, bg, fn) {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'font:12px monospace;padding:6px 10px;background:' + bg + ';color:#eee;border:1px solid #666;cursor:pointer';
        b.addEventListener('click', fn);
        navRow.appendChild(b);
    }
    nbtn('\u25c0', '#333', function () { stepPos(-1); });
    nbtn('\u25b6', '#333', function () { stepPos(1); });
    nbtn('BETER', '#431', function () { votePos('better'); });
    nbtn('SLECHTER', '#431', function () { votePos('worse'); });
    nbtn('NEUTRAAL', '#333', function () { votePos('neutral'); });
    nav.appendChild(navRow);
    el.appendChild(nav);


    // ---- Feedback: ratings + vrije tekst -> console EN server ----
    const fb = document.createElement('div');
    fb.style.cssText = 'margin-top:6px;border-top:1px solid #555;padding-top:6px';
    const fbT = document.createElement('div');
    fbT.textContent = 'FEEDBACK';
    fbT.style.cssText = 'color:#fc6';
    fb.appendChild(fbT);
    const fbStatus = document.createElement('div');
    fbStatus.style.cssText = 'color:#0f0;min-height:14px';
    function sendFeedback(rating, text, extra) {
        const payload = {
            rating: rating || '',
            text: text || '',
            pos: (extra && extra.pos !== undefined) ? extra.pos : curPos(),
            vote: (extra && extra.vote) || '',
            vsPos: (extra && extra.vsPos !== undefined) ? extra.vsPos : null,
            settings: (function () { try { return JSON.parse(localStorage.getItem('AR_TUNE') || '{}'); } catch (e) { return {}; } })(),
            stats: window.__AR_STATS || null,
        };
        console.log('[AR-FEEDBACK] ' + JSON.stringify(payload));
        try {
            const hist = JSON.parse(localStorage.getItem('AR_FEEDBACK') || '[]');
            hist.push(payload);
            localStorage.setItem('AR_FEEDBACK', JSON.stringify(hist));
        } catch (e) {}
        fbStatus.textContent = '\u2713 verzonden (ook in console)';
        fetch('api.php/dev/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(function () {});
    }
    function fbBtn(label) {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'font:11px monospace;padding:3px 6px;margin:2px 3px 0 0;background:#553;color:#eee;border:1px solid #666;cursor:pointer';
        fb.appendChild(b);
        return b;
    }
    ['GOED', 'TRILT', 'TRAAG', 'SPRINGT', 'VALT WEG'].forEach(function (r) {
        fbBtn(r).addEventListener('click', function () { sendFeedback(r, ''); });
    });
    const fbInput = document.createElement('input');
    fbInput.type = 'text';
    fbInput.placeholder = 'opmerking\u2026';
    fbInput.style.cssText = 'width:150px;font:11px monospace;margin-top:4px;display:block';
    fb.appendChild(fbInput);
    fbBtn('STUUR').addEventListener('click', function () { sendFeedback('', fbInput.value); fbInput.value = ''; });
    fbBtn('EXPORT').addEventListener('click', function () {
        try {
            console.log('[AR-FEEDBACK-EXPORT] ' + (localStorage.getItem('AR_FEEDBACK') || '[]'));
        } catch (e) {}
        console.log('[AR-STATS-NU] ' + JSON.stringify(window.__AR_STATS || null));
    });
    fb.appendChild(fbStatus);
    el.appendChild(fb);

    document.body.appendChild(el);

    setInterval(function () {
        const s = window.__AR_STATS;
        if (!s) return;
        stats.textContent =
            'jit  ' + (s.jit === null ? '-' : s.jit.toFixed(1)) + '   good ' + (s.good === null ? '-' : s.good) + '\n' +
            'fps  ' + (s.fps === null ? '-' : s.fps) + '   lock ' + (s.lock === null ? '-' : s.lock) + 'ms\n' +
            'trackFails ' + s.trackFails + '   matches ' + s.matches + '\n' +
            'showing ' + (s.showing ? 'Y' : 'n') + '   tracking ' + (s.tracking ? 'Y' : 'n');
    }, 1000);
})();

