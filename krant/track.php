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

$allowedTypes = ['view', 'dwell', 'scan', 'ar_dwell', 'cam_start', 'cam_denied'];
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

// 5. Schrijf JSONL-regel met flock(LOCK_EX)
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
]);

http_response_code(204);
exit;
