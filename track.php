<?php
// track.php - Cookie-vrij, AVG/GDPR-proof Web Analytics Collector Endpoint

require_once __DIR__ . '/includes/stats_controller.php';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// Sta alleen POST, GET en OPTIONS toe
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 1. Lees payload uit php://input (navigator.sendBeacon stuurt text/plain) én fallback naar $_POST / $_GET
$rawInput = (string)@file_get_contents('php://input');
$payload = [];
if ($rawInput !== '') {
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded)) {
        $payload = $decoded;
    } else {
        parse_str($rawInput, $parsedForm);
        if (is_array($parsedForm)) {
            $payload = $parsedForm;
        }
    }
}
if (empty($payload)) {
    $payload = array_merge($_GET, $_POST);
}

// Als er geen geldig event-type of pagina is, retourneer 204
if (empty($payload['type']) && empty($payload['page'])) {
    http_response_code(204);
    exit;
}

$type = in_array($payload['type'] ?? '', ['view', 'dwell'], true) ? $payload['type'] : 'view';
$sec  = isset($payload['sec']) ? (int)$payload['sec'] : 0;

// Negeer lege dwell-flushes
if ($type === 'dwell' && $sec <= 0) {
    http_response_code(204);
    exit;
}

// 2. Anonieme bezoeker-hash (geen ruwe IP of volledige UA opgeslagen)
$ip = getStatsClientIP();
$ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
$visitorHash = computeVisitorHash($ip, $ua);

// 3. Bot-detectie
$isBot = isBotUserAgent($ua) ? 1 : 0;

// 4. Normaliseer velden
$rawPage = (string)($payload['page'] ?? '/');
$page = normalizeStatsPagePath($rawPage, true);
if (isScannerPath($page)) {
    $isBot = 1;
}

$rawRef = (string)($payload['ref'] ?? ($_SERVER['HTTP_REFERER'] ?? ''));
$ref = normalizeReferrerValue($rawRef);

$dev = (string)($payload['dev'] ?? '');
if (!in_array($dev, ['desktop', 'mobile', 'tablet'], true)) {
    $dev = detectDeviceFromUA($ua);
}

$lang = strtolower(substr(preg_replace('/[^a-zA-Z]/', '', (string)($payload['lang'] ?? '')), 0, 2));
if ($lang === '' && !empty($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
    $lang = strtolower(substr(preg_replace('/[^a-zA-Z]/', '', (string)$_SERVER['HTTP_ACCEPT_LANGUAGE']), 0, 2));
}

$sid = substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($payload['sid'] ?? '')), 0, 32);
if ($sid === '') {
    $sid = substr($visitorHash, 0, 12);
}

// 5. Admin- / eigen testapparaat detectie (zodat eigen testsessies apart getoond of gefilterd kunnen worden)
$isAdminVisit = 0;
if (
    (!empty($_COOKIE['analytics_admin']) && $_COOKIE['analytics_admin'] === '1') ||
    (!empty($_COOKIE['analytics_ignore']) && $_COOKIE['analytics_ignore'] === '1') ||
    (!empty($payload['adm']) && (int)$payload['adm'] === 1)
) {
    $isAdminVisit = 1;
}
if ($isAdminVisit === 0 && session_status() === PHP_SESSION_NONE && !empty($_COOKIE[session_name()])) {
    @session_start();
    if (!empty($_SESSION['admin_logged_in'])) {
        $isAdminVisit = 1;
    }
}

// 6. Schrijf JSONL-regel met flock(LOCK_EX)
writeStatsEvent([
    't'    => time(),
    'sid'  => $sid,
    'type' => $type,
    'page' => $page,
    'ref'  => $ref,
    'dev'  => $dev,
    'lang' => $lang,
    'sec'  => max(0, min(1800, $sec)),
    'v'    => $visitorHash,
    'bot'  => $isBot,
    'adm'  => $isAdminVisit,
]);

http_response_code(204);
exit;
