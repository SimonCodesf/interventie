/**
 * Self-hosted, cookie-free web analytics beacon voor Krant AR (/krant/stats.js)
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

    // Bepaal het collector endpoint relatief aan dit script (werkt zowel op /krant/ als standalone)
    var ENDPOINT = '/krant/track.php';
    try {
        var cs = document.currentScript;
        if (cs && cs.src) {
            var u = new URL('track.php', cs.src);
            ENDPOINT = u.pathname;
        } else if (!location.pathname.startsWith('/krant')) {
            ENDPOINT = '/track.php';
        }
    } catch (e) {}

    var MAX_DWELL_SECONDS = 1800; // Max 30 min per paginabezoek

    // 2. Willekeurige sessie-ID enkel in sessionStorage (geen cookies)
    function getSessionId() {
        var key = '_krant_sid';
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
    function getNormalizedPage(customQuery) {
        var rawPath = location.pathname || '/';
        var path = rawPath.replace(/\/+/g, '/');
        path = path.replace(/\/index\.html?$/i, '/');
        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        var allowedParams = ['week', 'slug', 'id'];
        try {
            var params = new URLSearchParams(customQuery !== undefined ? customQuery : (location.search || ''));
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

    // 5. Device, GSM Model & GPU Hardware Detectie
    var cachedHardware = null;

    function parseGsmModel(ua) {
        if (!ua) return 'Onbekend';
        // iPhone / iPad
        if (/iPhone/i.test(ua)) {
            var m = ua.match(/iPhone OS ([0-9_]+)/i);
            var ver = m ? m[1].replace(/_/g, '.') : '';
            return 'Apple iPhone' + (ver ? ' (iOS ' + ver + ')' : '');
        }
        if (/iPad/i.test(ua)) {
            return 'Apple iPad';
        }
        // Samsung
        var sm = ua.match(/SM-[A-Z0-9]+/i);
        if (sm) {
            return 'Samsung ' + sm[0].toUpperCase();
        }
        // Google Pixel
        var px = ua.match(/Pixel\s?[0-9a-zA-Z\s]+/i);
        if (px) {
            return 'Google ' + px[0].trim();
        }
        // Xiaomi / Redmi / POCO
        var redmi = ua.match(/(Redmi[A-Za-z0-9_\s-]+|POCO[A-Za-z0-9_\s-]+|Mi\s?[0-9A-Za-z]+)/i);
        if (redmi) {
            return 'Xiaomi ' + redmi[0].trim();
        }
        // OnePlus
        var op = ua.match(/(OnePlus[A-Za-z0-9_\s-]+|CPH[0-9]+)/i);
        if (op) {
            return 'OnePlus ' + op[0].trim();
        }
        // Motorola
        var moto = ua.match(/moto\s?[a-z0-9_\s-]+/i);
        if (moto) {
            return 'Motorola ' + moto[0].trim();
        }
        // Generic Android build model e.g. "; Build/..." or "; [Model] Build/"
        var gen = ua.match(/;\s?([A-Za-z0-9\s_-]{3,24})\sBuild\//i);
        if (gen && gen[1] && !/Android|Linux|K/i.test(gen[1].trim())) {
            return gen[1].trim();
        }
        if (/Android/i.test(ua)) {
            return 'Android Toestel';
        }
        if (/Macintosh/i.test(ua)) {
            return 'Apple Mac';
        }
        if (/Windows/i.test(ua)) {
            return 'Windows PC';
        }
        if (/Linux/i.test(ua)) {
            return 'Linux';
        }
        return 'Onbekend';
    }

    function getGpuRenderer() {
        try {
            var canvas = document.createElement('canvas');
            var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return 'Geen WebGL';
            var dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg) {
                var r = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
                if (r) return String(r).replace(/ANGLE \((.*)\)/, '$1').trim();
            }
            return String(gl.getParameter(gl.RENDERER) || 'Generieke WebGL GPU');
        } catch (e) {
            return 'WebGL Fout';
        }
    }

    function getKrantDeviceHardware() {
        if (cachedHardware) return cachedHardware;
        var ua = navigator.userAgent || '';
        var scr = (window.screen ? window.screen.width + 'x' + window.screen.height : '0x0') +
                  (window.devicePixelRatio ? ' @' + window.devicePixelRatio.toFixed(1) + 'x' : '');
        var orient = (window.screen && window.screen.orientation && window.screen.orientation.type) ||
                     (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
        var conn = (navigator.connection && (navigator.connection.effectiveType || navigator.connection.type)) || '';
        var ram = navigator.deviceMemory ? navigator.deviceMemory + 'GB' : '';
        var cores = navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' cores' : '';

        cachedHardware = {
            model: parseGsmModel(ua),
            gpu: getGpuRenderer(),
            screen: scr + ' (' + orient + ')',
            ram: ram,
            cores: cores,
            conn: conn,
            ua: ua.slice(0, 220)
        };

        // Query Client Hints async indien beschikbaar om het exacte toestelmodel bij te werken
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
            try {
                navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion']).then(function (hints) {
                    if (hints && hints.model) {
                        cachedHardware.model = (hints.platform ? hints.platform + ' ' : '') + hints.model;
                    }
                }).catch(function () {});
            } catch (e) {}
        }

        return cachedHardware;
    }

    window.getKrantDeviceHardware = getKrantDeviceHardware;

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
        sec: 0,
        hw: getKrantDeviceHardware()
    });

    // Hulpfuncties voor Krant AR-specifieke interacties vanuit krant/js/app.js
    var camStartedInSession = false;
    window.trackKrantCameraStart = function (optHw) {
        if (camStartedInSession) return;
        camStartedInSession = true;
        sendPayload({
            sid: sid,
            type: 'cam_start',
            page: '/krant/',
            ref: '',
            dev: deviceType,
            lang: language,
            sec: 0,
            hw: optHw || getKrantDeviceHardware()
        });
    };

    var camDeniedInSession = false;
    window.trackKrantCameraDenied = function (reason) {
        if (camDeniedInSession) return;
        camDeniedInSession = true;
        sendPayload({
            sid: sid,
            type: 'cam_denied',
            page: '/krant/',
            ref: '',
            dev: deviceType,
            lang: language,
            sec: 0,
            hw: getKrantDeviceHardware(),
            err: { category: 'camera', message: reason || 'Toestemming geweigerd of geblokkeerd', stage: 'permission' }
        });
    };

    var scannedWeeksInSession = {};
    window.trackKrantEssayScan = function (week) {
        if (!week) return;
        var scanPage = getNormalizedPage('?week=' + encodeURIComponent(week));
        currentPage = scanPage;
        if (scannedWeeksInSession[week]) return;
        scannedWeeksInSession[week] = true;
        sendPayload({
            sid: sid,
            type: 'scan',
            page: scanPage,
            ref: '',
            dev: deviceType,
            lang: language,
            sec: 0,
            hw: getKrantDeviceHardware()
        });
    };

    window.trackKrantEssayDwell = function (week, sec) {
        var s = Math.round(Number(sec) || 0);
        if (!week || s <= 0) return;
        var scanPage = getNormalizedPage('?week=' + encodeURIComponent(week));
        sendPayload({
            sid: sid,
            type: 'ar_dwell',
            page: scanPage,
            ref: '',
            dev: deviceType,
            lang: language,
            sec: Math.min(1800, s)
        });
    };

    // Telemetrie voor AR Performance (laadtijd, first target lock, jitter)
    window.trackKrantArPerf = function (perf) {
        if (!perf) return;
        sendPayload({
            sid: sid,
            type: 'ar_perf',
            page: currentPage,
            ref: '',
            dev: deviceType,
            lang: language,
            sec: 0,
            hw: getKrantDeviceHardware(),
            perf: {
                t_engine: Math.round(Number(perf.t_engine) || 0),
                t_cam: Math.round(Number(perf.t_cam) || 0),
                t_lock: Math.round(Number(perf.t_lock) || 0),
                jit: Number(Number(perf.jit || 0).toFixed(3)),
                found: Number(perf.found) || 0,
                lost: Number(perf.lost) || 0,
                fps: Math.round(Number(perf.fps) || 0)
            }
        });
    };

    // Opvangen van WebGL-, RealityError-, Camera- en Asset-fouten
    var reportedErrors = {};
    window.trackKrantArError = function (err) {
        if (!err) return;
        var key = (err.category || '') + ':' + (err.message || '');
        if (reportedErrors[key]) return; // Voorkom herhaalde flood
        reportedErrors[key] = true;
        sendPayload({
            sid: sid,
            type: 'ar_error',
            page: currentPage,
            ref: '',
            dev: deviceType,
            lang: language,
            sec: 0,
            hw: getKrantDeviceHardware(),
            err: {
                category: String(err.category || 'general').slice(0, 32),
                message: String(err.message || 'Onbekende AR-fout').slice(0, 300),
                details: String(err.details || '').slice(0, 500),
                stage: String(err.stage || 'runtime').slice(0, 32)
            }
        });
    };

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
