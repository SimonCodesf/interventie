<?php
// krant/404.php - Eigen 404-logger met Scanner-filter + 404 pagina in Krant AR huisstijl

require_once __DIR__ . '/includes/stats_controller.php';

http_response_code(404);
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// 1. Veilig normaliseren van REQUEST_URI:
// Strip eerst querystring met strtok() en voeg dubbele slashes samen VÓÓR parse_url()
$rawUri  = (string)($_SERVER['REQUEST_URI'] ?? '');
$rawPath = strtok($rawUri, '?');
if ($rawPath === false || $rawPath === '') {
    $rawPath = '/krant/';
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
$ignoredExact = ['/', '/krant', '/krant/', '/404.php', '/krant/404.php', '/index.html', '/krant/index.html', '/favicon.ico', '/krant/favicon.ico', '/robots.txt'];
$isIgnored = in_array($lowerPath, $ignoredExact, true)
          || str_starts_with($lowerPath, '/apple-touch-icon')
          || str_starts_with($lowerPath, '/krant/apple-touch-icon');

if (!$isIgnored) {
    $ip = getKrantStatsClientIP();
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    $visitorHash = computeKrantVisitorHash($ip, $ua);

    // 3. Markeer bekende bots óf kwetsbaarheidsscans (.php, .env, .git, .sql, .bak, .xml, /wp-admin, etc.) als bot: 1
    $isBot = (isKrantBotUserAgent($ua) || isKrantScannerPath($normalizedPath)) ? 1 : 0;

    $rawRef = (string)($_SERVER['HTTP_REFERER'] ?? '');
    $ref = normalizeKrantReferrerValue($rawRef);
    if ($ref === '' && $rawRef !== '') {
        $refHost = strtolower((string)parse_url($rawRef, PHP_URL_HOST));
        $ownHost = strtolower(preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
        if ($refHost !== '' && ($refHost === $ownHost || str_ends_with($refHost, '.' . $ownHost))) {
            $refPath = (string)parse_url($rawRef, PHP_URL_PATH);
            $ref = 'intern:' . ($refPath !== '' ? $refPath : '/krant/');
        }
    }

    $dev  = detectKrantDeviceFromUA($ua);
    $lang = '';
    if (!empty($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
        $lang = strtolower(substr(preg_replace('/[^a-zA-Z]/', '', (string)$_SERVER['HTTP_ACCEPT_LANGUAGE']), 0, 2));
    }

    writeKrantStatsEvent([
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
    <meta name="theme-color" content="#f2eee2">
    <title>404 — Pagina niet gevonden // Interventie Krant</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20fill='%23f2eee2'/%3E%3Crect%20x='4'%20y='4'%20width='56'%20height='56'%20fill='none'%20stroke='%23141414'%20stroke-width='2'/%3E%3Ctext%20x='32'%20y='45'%20font-family='Georgia,serif'%20font-size='36'%20text-anchor='middle'%20fill='%23141414'%3EI%3C/text%3E%3C/svg%3E">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            min-height: 100vh;
            background-color: #f2eee2;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
            color: #141414;
            font-family: Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
        }
        .sheet {
            width: 100%;
            max-width: 520px;
            border: 1px solid #141414;
            background: rgba(246, 244, 239, 0.92);
            padding: 2.2rem 1.8rem;
            text-align: center;
        }
        .masthead {
            font-family: 'Newsreader', Georgia, serif;
            font-size: 1.75rem;
            font-weight: 500;
            padding-bottom: 0.9rem;
            margin-bottom: 1.5rem;
            border-bottom: 2px double #141414;
        }
        .code {
            font-family: 'Newsreader', Georgia, serif;
            font-size: 4rem;
            line-height: 1;
            font-weight: 600;
            margin-bottom: 0.4rem;
        }
        .subtitle {
            font-family: 'Newsreader', Georgia, serif;
            font-size: 1.25rem;
            font-style: italic;
            margin-bottom: 1.2rem;
        }
        .path {
            display: inline-block;
            max-width: 100%;
            overflow-wrap: anywhere;
            font-family: 'Roboto Mono', monospace;
            font-size: 0.75rem;
            padding: 0.4rem 0.7rem;
            border: 1px dashed rgba(20, 20, 20, 0.4);
            background: rgba(20, 20, 20, 0.04);
            margin-bottom: 1.4rem;
        }
        .desc {
            font-size: 0.88rem;
            color: rgba(20, 20, 20, 0.78);
            line-height: 1.55;
            margin-bottom: 1.75rem;
        }
        .btn {
            display: inline-block;
            background: #141414;
            color: #f2eee2;
            text-decoration: none;
            font-size: 0.72rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            padding: 0.7rem 1.5rem;
            border: 1px solid #141414;
            transition: background 0.15s, color 0.15s;
        }
        .btn:hover {
            background: transparent;
            color: #141414;
        }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="masthead">Interventie</div>
        <div class="code">404</div>
        <div class="subtitle">Editie of pagina niet gevonden</div>
        <div class="path"><?php echo $safePathDisplay; ?></div>
        <p class="desc">
            Het opgevraagde pad bestaat niet of is verplaatst. Keer terug naar de AR-krant viewer.
        </p>
        <a href="/krant/" class="btn">Naar de AR Krant</a>
    </div>
</body>
</html>
