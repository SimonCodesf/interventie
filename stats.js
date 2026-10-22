/**
 * Self-hosted, cookie-free web analytics beacon (/stats.js)
 * AVG/GDPR-proof: geen cookies, enkel sessionStorage voor anonieme sessie-groepering.
 */
(function () {
    'use strict';

    // 1. Respecteer Do Not Track, headless browsers en lokale ontwikkelomgevingen
    var host = (location.hostname || '').toLowerCase();
    if (
        navigator.doNotTrack === '1' ||
        window.doNotTrack === '1' ||
        navigator.msDoNotTrack === '1' ||
        navigator.webdriver ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '[::1]'
    ) {
        return;
    }

    function showAnalyticsNotice(msg) {
        function render() {
            var el = document.createElement('div');
            el.textContent = msg;
            el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#141414;color:#f6f4ef;padding:10px 18px;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;font-weight:600;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,0.35);letter-spacing:0.02em;text-align:center;pointer-events:none;transition:opacity 0.3s ease;';
            document.body.appendChild(el);
            setTimeout(function () {
                el.style.opacity = '0';
                setTimeout(function () { el.remove(); }, 350);
            }, 3500);
        }
        if (document.body) {
            render();
        } else {
            window.addEventListener('DOMContentLoaded', render);
        }
    }

    // 1b. Admin / testapparaat markering via queryparameters (?admin=1 of ?admin=0, met compatibiliteit voor ?optout=1 / ?optin=1)
    try {
        var sp = new URLSearchParams(location.search || '');
        if (sp.get('admin') === '1' || sp.has('admin') || sp.get('owner') === '1' || sp.has('owner') || sp.get('test') === '1' || sp.has('test') || sp.has('dev') || sp.get('optout') === '1' || sp.get('analytics_ignore') === '1') {
            localStorage.setItem('interventie_analytics_admin', '1');
            sessionStorage.setItem('interventie_analytics_admin', '1');
            document.cookie = 'analytics_admin=1; path=/; max-age=31536000; SameSite=Lax';
            showAnalyticsNotice('Dit toestel is gekoppeld als testapparaat.');
        } else if (sp.get('admin') === '0' || sp.get('optin') === '1' || sp.get('analytics_ignore') === '0') {
            localStorage.removeItem('interventie_analytics_admin');
            localStorage.removeItem('interventie_analytics_ignore');
            sessionStorage.removeItem('interventie_analytics_admin');
            document.cookie = 'analytics_admin=; path=/; max-age=0; SameSite=Lax';
            document.cookie = 'analytics_ignore=; path=/; max-age=0; SameSite=Lax';
            showAnalyticsNotice('Testmarkering verwijderd. Dit toestel telt nu als gewone bezoeker.');
        }
    } catch (e) {}

    function checkIsAdminDevice() {
        try {
            var sp = new URLSearchParams(location.search || '');
            if (sp.has('admin') || sp.has('test') || sp.has('dev') || sp.has('owner')) return true;
            if (localStorage.getItem('interventie_analytics_admin') === '1') return true;
            if (localStorage.getItem('interventie_analytics_ignore') === '1') return true;
            if (sessionStorage.getItem('interventie_analytics_admin') === '1') return true;
            if (document.cookie.indexOf('analytics_admin=1') !== -1) return true;
            if (document.cookie.indexOf('analytics_ignore=1') !== -1) return true;
        } catch (e) {}
        return false;
    }

    var isAdminDevice = checkIsAdminDevice();

    var ENDPOINT = '/track.php';
    var MAX_DWELL_SECONDS = 1800; // Max 30 min per paginabezoek

    // 2. Willekeurige sessie-ID enkel in sessionStorage (geen cookies)
    function getSessionId() {
        var key = '_iv_sid';
        try {
            var sid = sessionStorage.getItem(key);
            if (!sid || !/^[a-z0-9]{8,32}$/i.test(sid)) {
                var arr = new Uint8Array(8);
                if (window.crypto && window.crypto.getRandomValues) {
                    window.crypto.getRandomValues(arr);
                } else {
                    for (var i = 0; i < arr.length; i++) {
                        arr[i] = Math.floor(Math.random() * 256);
                    }
                }
                sid = Array.from(arr, function (b) {
                    return b.toString(16).padStart(2, '0');
                }).join('');
                sessionStorage.setItem(key, sid);
            }
            return sid;
        } catch (e) {
            return Math.random().toString(36).slice(2, 14);
        }
    }

    // 3. Normaliseer paginapad (/index.html -> /, dubbele slashes samenvoegen, relevante queryparams behouden)
    function getNormalizedPage() {
        var rawPath = location.pathname || '/';
        var path = rawPath.replace(/\/+/g, '/');
        path = path.replace(/\/index\.html?$/i, '/');
        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        // Behoud relevante dynamische queryparameters
        var allowedParams = ['slug', 'id', 'poster', 'week', 'sign'];
        try {
            var params = new URLSearchParams(location.search || '');
            var kept = [];
            for (var i = 0; i < allowedParams.length; i++) {
                var k = allowedParams[i];
                if (params.has(k) && params.get(k).trim() !== '') {
                    kept.push(encodeURIComponent(k) + '=' + encodeURIComponent(params.get(k).trim()));
                }
            }
            if (kept.length > 0) {
                path += '?' + kept.join('&');
            }
        } catch (e) {}

        return path;
    }

    // 4. Bepaal referrer of fallback naar ?utm_source=, ?ref= of ?source= als 'utm:<waarde>'
    function getReferrer() {
        var refHost = '';
        var rawRef = document.referrer || '';
        if (rawRef) {
            try {
                var parsed = new URL(rawRef);
                var rHost = (parsed.hostname || '').toLowerCase().replace(/^www\./, '');
                var curHost = host.replace(/^www\./, '');
                if (rHost && rHost !== curHost) {
                    refHost = rHost;
                }
            } catch (e) {}
        }

        // Wanneer document.referrer leeg of intern is, vang campagnetags op
        if (!refHost) {
            try {
                var params = new URLSearchParams(location.search || '');
                var utm = params.get('utm_source') || params.get('ref') || params.get('source') || '';
                utm = utm.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
                if (utm) {
                    refHost = 'utm:' + utm.slice(0, 64);
                }
            } catch (e) {}
        }

        return refHost;
    }

    // 5. Device & taal detectie
    function getDeviceType() {
        var ua = navigator.userAgent || '';
        var w = window.innerWidth || screen.width || 1024;
        if (/ipad|tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) || (w >= 600 && w < 1024 && /touch/i.test(ua))) {
            return 'tablet';
        }
        if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|iemobile|opera mini/i.test(ua) || w < 600) {
            return 'mobile';
        }
        return 'desktop';
    }

    function getLanguage() {
        var lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
        return lang ? lang.slice(0, 2).replace(/[^a-z]/g, '') : '';
    }

    // 6. Verstuur event via navigator.sendBeacon met Image fallback
    function sendPayload(payload) {
        payload.adm = checkIsAdminDevice() ? 1 : 0;
        var body = JSON.stringify(payload);
        var sent = false;

        if (navigator.sendBeacon) {
            try {
                sent = navigator.sendBeacon(ENDPOINT, body);
            } catch (e) {
                sent = false;
            }
        }

        if (!sent) {
            try {
                var q = new URLSearchParams({
                    sid: payload.sid || '',
                    type: payload.type || 'view',
                    page: payload.page || '/',
                    ref: payload.ref || '',
                    dev: payload.dev || 'desktop',
                    lang: payload.lang || '',
                    sec: String(payload.sec || 0),
                    adm: String(payload.adm || 0),
                    _t: String(Date.now())
                });
                var img = new Image(1, 1);
                img.src = ENDPOINT + '?' + q.toString();
            } catch (e) {}
        }
    }

    var sid = getSessionId();
    var currentPage = getNormalizedPage();
    var currentRef = getReferrer();
    var deviceType = getDeviceType();
    var language = getLanguage();

    // Stuurt bij het laden een type=view event
    sendPayload({
        sid: sid,
        type: 'view',
        page: currentPage,
        ref: currentRef,
        dev: deviceType,
        lang: language,
        sec: 0
    });

    // 7. Actieve leestijd (type=dwell): enkel zichtbare tijd meten en incrementeel flushen
    var visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    var unFlushedMs = 0;
    var totalFlushedSec = 0;

    function accumulateVisibleTime() {
        if (visibleSince !== null) {
            var now = Date.now();
            var delta = now - visibleSince;
            if (delta > 0) {
                unFlushedMs += delta;
            }
            visibleSince = document.visibilityState === 'visible' ? now : null;
        }
    }

    function flushDwell() {
        accumulateVisibleTime();
        if (totalFlushedSec >= MAX_DWELL_SECONDS) {
            unFlushedMs = 0;
            return;
        }

        var sec = Math.floor(unFlushedMs / 1000);
        if (sec <= 0) {
            return;
        }

        // Houd rest-milliseconden bij en kap af op max 1800s totaal per bezoek
        unFlushedMs -= sec * 1000;
        var remainingBudget = MAX_DWELL_SECONDS - totalFlushedSec;
        if (sec > remainingBudget) {
            sec = remainingBudget;
        }
        if (sec <= 0) {
            return;
        }

        totalFlushedSec += sec;

        sendPayload({
            sid: sid,
            type: 'dwell',
            page: currentPage,
            ref: '',
            dev: deviceType,
            lang: language,
            sec: sec
        });
    }

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            flushDwell();
            visibleSince = null;
        } else if (document.visibilityState === 'visible') {
            visibleSince = Date.now();
        }
    });

    window.addEventListener('pagehide', function () {
        flushDwell();
        visibleSince = null;
    });

    window.addEventListener('beforeunload', function () {
        flushDwell();
        visibleSince = null;
    });
})();
