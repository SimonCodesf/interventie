<?php
// krant/track.php - Cookie-vrij, AVG/GDPR-proof Web Analytics Collector Endpoint voor Krant AR

require_once __DIR__ . '/includes/stats_controller.php';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

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

if (empty($payload['type']) && empty($payload['page'])) {
    http_response_code(204);
    exit;
}

$allowedTypes = ['view', 'dwell', 'scan', 'ar_dwell', 'cam_start', 'cam_denied', 'ar_perf', 'ar_error'];
$type = in_array($payload['type'] ?? '', $allowedTypes, true) ? $payload['type'] : 'view';
$sec  = isset($payload['sec']) ? (int)$payload['sec'] : 0;

if (($type === 'dwell' || $type === 'ar_dwell') && $sec <= 0) {
    http_response_code(204);
    exit;
}

// 2. Anonieme bezoeker-hash (geen ruwe IP of volledige UA opgeslagen)
$ip = getKrantStatsClientIP();
$ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
$visitorHash = computeKrantVisitorHash($ip, $ua);

// 3. Bot-detectie
$isBot = isKrantBotUserAgent($ua) ? 1 : 0;

// 4. Normaliseer velden
$rawPage = (string)($payload['page'] ?? '/krant/');
$page = normalizeKrantStatsPagePath($rawPage, true);
if (isKrantScannerPath($page)) {
    $isBot = 1;
}

$rawRef = (string)($payload['ref'] ?? ($_SERVER['HTTP_REFERER'] ?? ''));
$ref = normalizeKrantReferrerValue($rawRef);

$dev = (string)($payload['dev'] ?? '');
if (!in_array($dev, ['desktop', 'mobile', 'tablet'], true)) {
    $dev = detectKrantDeviceFromUA($ua);
}

$lang = strtolower(substr(preg_replace('/[^a-zA-Z]/', '', (string)($payload['lang'] ?? '')), 0, 2));
if ($lang === '' && !empty($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
    $lang = strtolower(substr(preg_replace('/[^a-zA-Z]/', '', (string)$_SERVER['HTTP_ACCEPT_LANGUAGE']), 0, 2));
}

$sid = substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($payload['sid'] ?? '')), 0, 32);
if ($sid === '') {
    $sid = substr($visitorHash, 0, 12);
}

// 5. Hardware, Performance & Error Details sanitizen voor LLM-diagnostiek
$hw = null;
if (!empty($payload['hw']) && is_array($payload['hw'])) {
    $rawHw = $payload['hw'];
    $hw = [
        'model'  => substr(strip_tags((string)($rawHw['model'] ?? '')), 0, 60),
        'gpu'    => substr(strip_tags((string)($rawHw['gpu'] ?? '')), 0, 80),
        'screen' => substr(strip_tags((string)($rawHw['screen'] ?? '')), 0, 40),
        'ram'    => substr(strip_tags((string)($rawHw['ram'] ?? '')), 0, 20),
        'cores'  => substr(strip_tags((string)($rawHw['cores'] ?? '')), 0, 20),
        'conn'   => substr(strip_tags((string)($rawHw['conn'] ?? '')), 0, 20),
    ];
}

$perf = null;
if (!empty($payload['perf']) && is_array($payload['perf'])) {
    $rawP = $payload['perf'];
    $perf = [
        't_engine' => max(0, min(120000, (int)($rawP['t_engine'] ?? 0))),
        't_cam'    => max(0, min(120000, (int)($rawP['t_cam'] ?? 0))),
        't_lock'   => max(0, min(120000, (int)($rawP['t_lock'] ?? 0))),
        'jit'      => (float)($rawP['jit'] ?? 0),
        'found'    => (int)($rawP['found'] ?? 0),
        'lost'     => (int)($rawP['lost'] ?? 0),
        'fps'      => (int)($rawP['fps'] ?? 0),
    ];
}

$err = null;
if (!empty($payload['err']) && is_array($payload['err'])) {
    $rawE = $payload['err'];
    $err = [
        'category' => substr(strip_tags((string)($rawE['category'] ?? 'general')), 0, 32),
        'message'  => substr(strip_tags((string)($rawE['message'] ?? '')), 0, 300),
        'details'  => substr(strip_tags((string)($rawE['details'] ?? '')), 0, 500),
        'stage'    => substr(strip_tags((string)($rawE['stage'] ?? 'runtime')), 0, 32),
    ];
}

// 6. Admin- / eigen testapparaat detectie
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

// 7. Schrijf JSONL-regel met flock(LOCK_EX)
writeKrantStatsEvent([
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
    'hw'   => $hw,
    'perf' => $perf,
    'err'  => $err,
]);

http_response_code(204);
exit;
