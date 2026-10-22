<?php
// 404.php - Eigen 404-logger met Scanner-filter + 404 pagina in Interventie huisstijl

require_once __DIR__ . '/includes/stats_controller.php';

http_response_code(404);
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// 1. Veilig normaliseren van REQUEST_URI:
// Strip eerst querystring met strtok() en voeg dubbele slashes samen VÓÓR parse_url()
$rawUri  = (string)($_SERVER['REQUEST_URI'] ?? '');
$rawPath = strtok($rawUri, '?');
if ($rawPath === false || $rawPath === '') {
    $rawPath = '/';
}
$rawPath = preg_replace('#/+#', '/', $rawPath);
if (!str_starts_with($rawPath, '/')) {
    $rawPath = '/' . $rawPath;
}
$parsed = parse_url($rawPath, PHP_URL_PATH);
$normalizedPath = is_string($parsed) && $parsed !== '' ? $parsed : $rawPath;
$normalizedPath = preg_replace('#/+#', '/', $normalizedPath);
$normalizedPath = substr(preg_replace('/[\x00-\x1F\x7F]/', '', $normalizedPath), 0, 255);

// 2. Negeer systeempaden zodat die nooit foutief als 404 worden gelogd
$lowerPath = strtolower($normalizedPath);
$ignoredExact = ['/', '/404.php', '/index.html', '/index.htm', '/favicon.ico', '/robots.txt'];
$isIgnored = in_array($lowerPath, $ignoredExact, true)
          || str_starts_with($lowerPath, '/apple-touch-icon')
          || str_starts_with($lowerPath, '/browserconfig.xml');

if (!$isIgnored) {
    $ip = getStatsClientIP();
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    $visitorHash = computeVisitorHash($ip, $ua);

    // 3. Markeer bekende bots óf kwetsbaarheidsscans (.php, .env, .git, .sql, .bak, .xml, /wp-admin, etc.) als bot: 1
    $isBot = (isBotUserAgent($ua) || isScannerPath($normalizedPath)) ? 1 : 0;

    $rawRef = (string)($_SERVER['HTTP_REFERER'] ?? '');
    $ref = normalizeReferrerValue($rawRef);
    // Bewaar bij een interne kapotte link ook dat deze intern verwezen werd
    if ($ref === '' && $rawRef !== '') {
        $refHost = strtolower((string)parse_url($rawRef, PHP_URL_HOST));
        $ownHost = strtolower(preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
        if ($refHost !== '' && ($refHost === $ownHost || str_ends_with($refHost, '.' . $ownHost))) {
            $refPath = (string)parse_url($rawRef, PHP_URL_PATH);
            $ref = 'intern:' . ($refPath !== '' ? $refPath : '/');
        }
    }

    $dev  = detectDeviceFromUA($ua);
    $lang = '';
    if (!empty($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
        $lang = strtolower(substr(preg_replace('/[^a-zA-Z]/', '', (string)$_SERVER['HTTP_ACCEPT_LANGUAGE']), 0, 2));
    }

    $isAdminVisit = 0;
    if (
        (!empty($_COOKIE['analytics_admin']) && $_COOKIE['analytics_admin'] === '1') ||
        (!empty($_COOKIE['analytics_ignore']) && $_COOKIE['analytics_ignore'] === '1')
    ) {
        $isAdminVisit = 1;
    }
    if ($isAdminVisit === 0 && session_status() === PHP_SESSION_NONE && !empty($_COOKIE[session_name()])) {
        @session_start();
        if (!empty($_SESSION['admin_logged_in'])) {
            $isAdminVisit = 1;
        }
    }

    writeStatsEvent([
        't'    => time(),
        'sid'  => substr($visitorHash, 0, 12),
        'type' => 'err404',
        'page' => $normalizedPath,
        'ref'  => $ref,
        'dev'  => $dev,
        'lang' => $lang,
        'sec'  => 0,
        'v'    => $visitorHash,
        'bot'  => $isBot,
        'adm'  => $isAdminVisit,
    ]);
}

$safePathDisplay = htmlspecialchars($normalizedPath, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>404 // PAGINA NIET GEVONDEN — Interventie</title>
    <link rel="icon" href="/img/Artboard%201logo.svg" type="image/svg+xml">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:wght@700&family=Roboto+Mono:wght@400;500&display=swap');

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: #000000;
            color: #ffffff;
            font-family: 'Roboto Mono', monospace;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
        }

        .error-box {
            width: 100%;
            max-width: 560px;
            border: 1px solid rgba(255, 255, 255, 0.85);
            background: #050505;
        }

        .error-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.55rem 0.9rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.25);
            background: rgba(255, 255, 255, 0.06);
            font-size: 0.72rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .error-status-dot {
            display: inline-block;
            width: 7px;
            height: 7px;
            background: #ff5555;
            margin-right: 6px;
        }

        .error-body {
            padding: 2rem 1.5rem;
            text-align: center;
        }

        .error-logo {
            width: 68px;
            height: auto;
            margin-bottom: 1.25rem;
            opacity: 0.92;
        }

        .error-code {
            font-family: 'Bebas Neue', Impact, sans-serif;
            font-size: 4.5rem;
            line-height: 0.95;
            letter-spacing: 0.06em;
            margin-bottom: 0.5rem;
        }

        .error-title {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 1.35rem;
            margin-bottom: 1rem;
            font-weight: 700;
        }

        .error-path {
            display: inline-block;
            max-width: 100%;
            overflow-wrap: anywhere;
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.65);
            background: rgba(255, 255, 255, 0.05);
            border: 1px dashed rgba(255, 255, 255, 0.22);
            padding: 0.45rem 0.75rem;
            margin-bottom: 1.5rem;
        }

        .error-desc {
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.7);
            line-height: 1.6;
            margin-bottom: 1.75rem;
        }

        .error-actions {
            display: flex;
            gap: 0.75rem;
            justify-content: center;
            flex-wrap: wrap;
        }

        .btn-home {
            display: inline-block;
            padding: 0.65rem 1.35rem;
            background: #ffffff;
            color: #000000;
            text-decoration: none;
            font-size: 0.78rem;
            font-weight: 500;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            border: 1px solid #ffffff;
            transition: background 0.15s ease, color 0.15s ease;
        }

        .btn-home:hover {
            background: #000000;
            color: #ffffff;
        }
    </style>
</head>
<body>
    <div class="error-box">
        <div class="error-header">
            <span><span class="error-status-dot"></span>SYSTEM_ERR // HTTP_404</span>
            <span>INTERVENTIE.ORG</span>
        </div>
        <div class="error-body">
            <img src="/img/Artboard%201logo.svg" alt="Interventie" class="error-logo">
            <div class="error-code">404</div>
            <h1 class="error-title">Dossier of pagina niet gevonden</h1>
            <div class="error-path">&gt; PAD: <?php echo $safePathDisplay; ?></div>
            <p class="error-desc">
                Het opgevraagde pad bestaat niet of is verplaatst. Controleer de URL of keer terug naar het hoofdoverzicht.
            </p>
            <div class="error-actions">
                <a href="/" class="btn-home">&gt;&gt; TERUG NAAR OVERZICHT</a>
            </div>
        </div>
    </div>
</body>
</html>
