<?php
// krant/includes/stats_controller.php - Zelfgehost, cookie-vrij web-analytics systeem voor Krant AR

define('KRANT_STATS_DATA_DIR', dirname(__DIR__) . '/data');
define('KRANT_STATS_DIR', KRANT_STATS_DATA_DIR . '/stats');
define('KRANT_STATS_SALT_FILE', KRANT_STATS_DATA_DIR . '/stats_salt');
define('KRANT_STATS_DISMISSED_404_FILE', KRANT_STATS_DIR . '/dismissed_404.json');

/**
 * Zorg dat de stats-map en .htaccess beveiliging (Require all denied) bestaan.
 */
function ensureKrantStatsStorage(): void {
    if (!is_dir(KRANT_STATS_DATA_DIR)) {
        @mkdir(KRANT_STATS_DATA_DIR, 0755, true);
    }
    if (!is_dir(KRANT_STATS_DIR)) {
        @mkdir(KRANT_STATS_DIR, 0755, true);
    }
    $htaccess = KRANT_STATS_DIR . '/.htaccess';
    if (!file_exists($htaccess)) {
        $rules = "# Blokkeer directe HTTP-toegang tot ruwe analytics JSONL-bestanden\n"
               . "<IfModule mod_authz_core.c>\n"
               . "    Require all denied\n"
               . "</IfModule>\n"
               . "<IfModule !mod_authz_core.c>\n"
               . "    Order deny,allow\n"
               . "    Deny from all\n"
               . "</IfModule>\n";
        @file_put_contents($htaccess, $rules);
    }
}

/**
 * Haal de eenmalig gegenereerde random salt op (of maak deze aan).
 */
function getKrantStatsSalt(): string {
    ensureKrantStatsStorage();
    if (file_exists(KRANT_STATS_SALT_FILE)) {
        $salt = trim((string)@file_get_contents(KRANT_STATS_SALT_FILE));
        if (strlen($salt) >= 16) {
            return $salt;
        }
    }
    try {
        $salt = bin2hex(random_bytes(32));
    } catch (Exception $e) {
        $salt = hash('sha256', uniqid((string)mt_rand(), true) . __FILE__);
    }
    @file_put_contents(KRANT_STATS_SALT_FILE, $salt, LOCK_EX);
    return $salt;
}

/**
 * Bepaal het client IP-adres (enkel in geheugen gebruikt voor de HMAC-hash, nooit opgeslagen).
 */
function getKrantStatsClientIP(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $ip = $_SERVER['HTTP_CF_CONNECTING_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($parts[0]);
    } elseif (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        $ip = $_SERVER['HTTP_CLIENT_IP'];
    }
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

/**
 * Genereer anonieme bezoeker-hash (16 hex-karakters, AVG/GDPR-proof).
 */
function computeKrantVisitorHash(string $ip, string $ua): string {
    $salt = getKrantStatsSalt();
    return substr(hash_hmac('sha256', $ip . '|' . $ua, $salt), 0, 16);
}

/**
 * Detecteer bots, crawlers, scrapers, AI-bots, headless browsers en HTTP-clients.
 */
function isKrantBotUserAgent(string $ua): bool {
    $trimmed = trim($ua);
    if (strlen($trimmed) < 12) {
        return true;
    }
    $pattern = '/bot|crawl|spider|slurp|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider'
             . '|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic|ccbot|perplexitybot|youbot|amazonbot|applebot'
             . '|bingpreview|facebookexternalhit|meta-externalagent|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|pinterest|slackbot'
             . '|headless|playwright|puppeteer|selenium|phantomjs|cypress|webdriver|electron'
             . '|curl|wget|python-requests|python-urllib|python-httpx|aiohttp|go-http-client|java\/|libwww|httpclient|apache-httpclient|okhttp|axios|node-fetch|undici|got\/|pycurl|ruby|perl'
             . '|postman|insomnia|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|datadog|newrelic|site24x7|betteruptime'
             . '|censys|shodan|zgrab|masscan|nmap|nikto|nuclei|sqlmap|dirbuster|gobuster|wfuzz|ffuf|wpscan|acunetix|nessus|qualys/i';
    return (bool)preg_match($pattern, $trimmed);
}

/**
 * Detecteer of een pad een automatische kwetsbaarheidsscan / bot-probe is.
 */
function isKrantScannerPath(string $path): bool {
    $clean = strtolower(strtok($path, '?') ?: '/');
    if (preg_match('/\.(php\d*|phtml|phar|env|git|gitignore|gitattributes|svn|hg|sql|sqlite|db|bak|backup|old|orig|swp|save|tmp|xml|yml|yaml|ini|log|sh|bash|zsh|conf|config|cfg|dist|inc|asp|aspx|jsp|cgi|pl|py|rb|dll|exe|msi|tar|gz|tgz|zip|rar|7z|pem|key|crt|csr)$/i', $clean)) {
        return true;
    }
    $scanRegex = '#(^|/)(wp-admin|wp-content|wp-includes|wp-login|wp-json|wp-config|wordpress|wlwmanifest|xmlrpc'
               . '|phpmyadmin|pma|myadmin|mysql|adminer|dbadmin|sqladmin'
               . '|\.well-known|\.env|\.git|\.svn|\.vscode|\.idea|\.aws|\.ssh'
               . '|cgi-bin|vendor|node_modules|bower_components|composer\.json|composer\.lock|package\.json'
               . '|actuator|solr|jenkins|hudson|owa|autodiscover|ecp|aspnet_client'
               . '|shell|eval-stdin|phpunit|alfa|c99|r57|webshell|backdoor|setup\.php|install\.php|info\.php|phpinfo|test\.php)#i';
    return (bool)preg_match($scanRegex, $clean);
}

/**
 * Classificeer het type kwetsbaarheidsscan voor het rapport.
 */
function classifyKrantScannerPath(string $path, string $ua = ''): string {
    $clean = strtolower(strtok($path, '?') ?: '/');
    if (preg_match('#(wp-admin|wp-content|wp-includes|wp-login|wlwmanifest|xmlrpc|wordpress)#i', $clean)) {
        return 'WordPress Scan';
    }
    if (preg_match('#(\.env|\.git|\.aws|\.ssh|config|ini|yml|yaml|bak|backup|old|sql|db)#i', $clean)) {
        return 'Config / Secret Probe';
    }
    if (preg_match('#(phpmyadmin|pma|adminer|mysql|dbadmin)#i', $clean)) {
        return 'Database Admin Scan';
    }
    if (preg_match('#\.well-known#i', $clean)) {
        return 'Well-Known / Bot Probe';
    }
    if (preg_match('#\.(php\d*|phtml|phar|asp|aspx|jsp|cgi|sh)#i', $clean) || preg_match('#(phpunit|shell|eval-stdin|vendor)#i', $clean)) {
        return 'PHP / Exploit Scan';
    }
    if (preg_match('#\.xml$#i', $clean)) {
        return 'XML / Sitemap Probe';
    }
    if ($ua !== '' && isKrantBotUserAgent($ua)) {
        return 'Crawler / Bot';
    }
    return 'Scanner Probe';
}

/**
 * Normaliseer een URI veilig (voorkomt parse_url('//test.php') === null bug).
 */
function normalizeKrantStatsPagePath(string $rawUri, bool $preserveAllowedQuery = false): string {
    $rawUri = trim($rawUri);
    if ($rawUri === '') {
        return '/krant/';
    }

    $rawPath = strtok($rawUri, '?');
    $queryStr = strtok('');

    if ($rawPath === false || $rawPath === '') {
        $rawPath = '/krant/';
    }

    // Voeg dubbele slashes samen vóór parse_url zodat //test.php nooit als hostnaam wordt gezien
    $rawPath = preg_replace('#/+#', '/', $rawPath);
    if (!str_starts_with($rawPath, '/')) {
        $rawPath = '/' . $rawPath;
    }

    $parsedPath = parse_url($rawPath, PHP_URL_PATH);
    $path = is_string($parsedPath) && $parsedPath !== '' ? $parsedPath : $rawPath;
    $path = preg_replace('#/+#', '/', $path);
    $path = preg_replace('#/index\.html?$#i', '/', $path);

    $path = preg_replace('/[\x00-\x1F\x7F]/', '', $path);
    if ($path === '') {
        $path = '/krant/';
    }

    if ($preserveAllowedQuery && is_string($queryStr) && $queryStr !== '') {
        parse_str($queryStr, $qParams);
        $allowed = ['week', 'slug', 'id'];
        $kept = [];
        foreach ($allowed as $key) {
            if (isset($qParams[$key]) && is_scalar($qParams[$key])) {
                $val = trim((string)$qParams[$key]);
                if ($val !== '') {
                    $kept[$key] = substr($val, 0, 80);
                }
            }
        }
        if (!empty($kept)) {
            $path .= '?' . http_build_query($kept);
        }
    }

    return substr($path, 0, 255);
}

/**
 * Detecteer device type uit User-Agent als fallback.
 */
function detectKrantDeviceFromUA(string $ua): string {
    if (preg_match('/ipad|tablet|playbook|silk|(android(?!.*mobile))/i', $ua)) {
        return 'tablet';
    }
    if (preg_match('/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|iemobile|opera mini/i', $ua)) {
        return 'mobile';
    }
    return 'desktop';
}

/**
 * Normaliseer referrer-waarde (negeer eigen domein, behoud 'utm:...' of externe hostnaam).
 */
function normalizeKrantReferrerValue(string $rawRef): string {
    $rawRef = trim($rawRef);
    if ($rawRef === '') {
        return '';
    }

    $ownHost = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $ownHost = preg_replace('/:\d+$/', '', $ownHost);
    $ownHost = preg_replace('/^www\./', '', $ownHost);

    if (str_starts_with(strtolower($rawRef), 'utm:')) {
        $utmVal = preg_replace('/[^a-z0-9._-]/', '', strtolower(substr($rawRef, 4)));
        return $utmVal !== '' ? 'utm:' . substr($utmVal, 0, 64) : '';
    }

    if (str_contains($rawRef, '://')) {
        $host = parse_url($rawRef, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return '';
        }
        $cleanHost = strtolower(preg_replace('/^www\./', '', $host));
    } else {
        $cleanHost = strtolower(preg_replace('/^www\./', '', strtok($rawRef, '/') ?: ''));
        $cleanHost = preg_replace('/[^a-z0-9._-]/', '', $cleanHost);
    }

    if ($cleanHost === '' || $cleanHost === $ownHost || $cleanHost === 'localhost' || $cleanHost === '127.0.0.1') {
        return '';
    }

    return substr($cleanHost, 0, 120);
}

/**
 * Schrijf één event veilig met flock(LOCK_EX) naar krant/data/stats/YYYY-MM-DD.jsonl
 */
function writeKrantStatsEvent(array $event): bool {
    ensureKrantStatsStorage();
    $timestamp = isset($event['t']) ? (int)$event['t'] : time();
    $dateStr = date('Y-m-d', $timestamp);
    $filePath = KRANT_STATS_DIR . '/' . $dateStr . '.jsonl';

    $record = [
        't'    => $timestamp,
        'sid'  => substr(preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($event['sid'] ?? '')), 0, 32),
        'type' => in_array($event['type'] ?? '', ['view', 'dwell', 'err404'], true) ? $event['type'] : 'view',
        'page' => (string)($event['page'] ?? '/krant/'),
        'ref'  => (string)($event['ref'] ?? ''),
        'dev'  => in_array($event['dev'] ?? '', ['desktop', 'mobile', 'tablet'], true) ? $event['dev'] : 'desktop',
        'lang' => substr(preg_replace('/[^a-z]/', '', strtolower((string)($event['lang'] ?? ''))), 0, 5),
        'sec'  => max(0, min(1800, (int)($event['sec'] ?? 0))),
        'v'    => substr(preg_replace('/[^a-f0-9]/', '', strtolower((string)($event['v'] ?? ''))), 0, 16),
        'bot'  => !empty($event['bot']) ? 1 : 0,
    ];

    $line = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
    $fh = @fopen($filePath, 'ab');
    if (!$fh) {
        return false;
    }
    $ok = false;
    if (@flock($fh, LOCK_EX)) {
        $written = @fwrite($fh, $line);
        @fflush($fh);
        @flock($fh, LOCK_UN);
        $ok = ($written !== false);
    }
    @fclose($fh);

    // Spiegel optioneel naar de hoofd-statsmap (../data/stats) als deze bestaat
    $parentStatsDir = dirname(__DIR__, 2) . '/data/stats';
    if (is_dir($parentStatsDir)) {
        $pFile = $parentStatsDir . '/' . $dateStr . '.jsonl';
        $pfh = @fopen($pFile, 'ab');
        if ($pfh) {
            if (@flock($pfh, LOCK_EX)) {
                @fwrite($pfh, $line);
                @fflush($pfh);
                @flock($pfh, LOCK_UN);
            }
            @fclose($pfh);
        }
    }

    return $ok;
}

/**
 * Groepeer ruwe referrer / utm-bron naar leesbare acquisitie-bron.
 */
function classifyKrantTrafficSource(string $ref): string {
    $r = strtolower(trim($ref));
    if ($r === '') {
        return 'Direct';
    }

    if (str_starts_with($r, 'utm:')) {
        $u = substr($r, 4);
        if (in_array($u, ['ig', 'insta', 'instagram'], true)) return 'Instagram';
        if (in_array($u, ['fb', 'facebook', 'meta'], true)) return 'Facebook';
        if (in_array($u, ['li', 'linkedin'], true)) return 'LinkedIn';
        if (in_array($u, ['x', 'twitter'], true)) return 'X / Twitter';
        if (in_array($u, ['google', 'adwords', 'gads'], true)) return 'Google';
        if (in_array($u, ['chatgpt', 'openai', 'perplexity', 'claude', 'ai'], true)) return 'AI Search';
        if (in_array($u, ['newsletter', 'nieuwsbrief', 'mail', 'email', 'substack'], true)) return 'Nieuwsbrief';
        if (in_array($u, ['qr', 'qrcode', 'krant', 'print', 'papier'], true)) return 'Krant / Print QR';
        return 'UTM: ' . $u;
    }

    if (preg_match('/(^|\.)google\.[a-z.]+$/i', $r) || $r === 'googleapis.com') {
        return 'Google';
    }
    if (str_contains($r, 'instagram.com') || $r === 'ig.me') {
        return 'Instagram';
    }
    if (str_contains($r, 'linkedin.com') || $r === 'lnkd.in' || str_contains($r, 'linkedin.android')) {
        return 'LinkedIn';
    }
    if ($r === 't.co' || str_contains($r, 'x.com') || str_contains($r, 'twitter.com')) {
        return 'X / Twitter';
    }
    if (
        str_contains($r, 'chatgpt.com') ||
        str_contains($r, 'openai.com') ||
        str_contains($r, 'perplexity.ai') ||
        str_contains($r, 'claude.ai') ||
        str_contains($r, 'gemini.google.com') ||
        str_contains($r, 'copilot.microsoft.com')
    ) {
        return 'AI Search';
    }
    if (str_contains($r, 'facebook.com') || $r === 'fb.com' || $r === 'fb.me') {
        return 'Facebook';
    }
    if (str_contains($r, 'bing.com')) {
        return 'Bing';
    }
    if (str_contains($r, 'duckduckgo.com')) {
        return 'DuckDuckGo';
    }
    if (str_contains($r, 'youtube.com') || $r === 'youtu.be') {
        return 'YouTube';
    }
    if (str_contains($r, 'reddit.com')) {
        return 'Reddit';
    }
    if (str_contains($r, 'tiktok.com')) {
        return 'TikTok';
    }

    return $r;
}

/**
 * Vertaal een paginapad naar een leesbare titel (incl. koppeling met essays uit essays.db).
 */
function resolveKrantReadablePageTitle(string $page, array $essayTitleMap): string {
    $pathOnly = strtok($page, '?') ?: '/krant/';
    $queryStr = strtok('');

    if (is_string($queryStr) && $queryStr !== '') {
        parse_str($queryStr, $q);
        foreach (['week', 'slug', 'id'] as $k) {
            if (!empty($q[$k])) {
                $w = strtolower((string)$q[$k]);
                if (isset($essayTitleMap[$w])) {
                    return 'Essay ' . $w . ' — ' . $essayTitleMap[$w];
                }
                return 'Essay Week ' . $w;
            }
        }
    }

    $staticTitles = [
        '/'                  => 'Krant AR — Hoofdpagina',
        '/krant/'            => 'Krant AR — Viewer',
        '/krant'             => 'Krant AR — Viewer',
        '/krant/position/'   => 'Krant AR — Positioneer-tool',
        '/krant/position'    => 'Krant AR — Positioneer-tool',
        '/position/'         => 'Krant AR — Positioneer-tool',
        '/position'          => 'Krant AR — Positioneer-tool',
        '/krant/admin/'      => 'Krant AR — Admin',
        '/admin/'            => 'Krant AR — Admin',
    ];

    if (isset($staticTitles[$pathOnly])) {
        return $staticTitles[$pathOnly];
    }

    $segments = array_values(array_filter(explode('/', trim($pathOnly, '/'))));
    foreach ($segments as $seg) {
        $segLow = strtolower($seg);
        if (isset($essayTitleMap[$segLow])) {
            return 'Essay ' . $segLow . ' — ' . $essayTitleMap[$segLow];
        }
    }

    $last = end($segments);
    if (!$last) {
        return 'Krant AR — Viewer';
    }
    $clean = preg_replace('/\.(html?|php)$/i', '', $last);
    $clean = str_replace(['-', '_'], ' ', $clean);
    return ucfirst($clean);
}

/**
 * Laad de lijst met gewiste 404-meldingen.
 */
function getKrantDismissed404Data(): array {
    ensureKrantStatsStorage();
    if (!file_exists(KRANT_STATS_DISMISSED_404_FILE)) {
        return ['all_before' => 0, 'paths' => []];
    }
    $raw = @file_get_contents(KRANT_STATS_DISMISSED_404_FILE);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) {
        return ['all_before' => 0, 'paths' => []];
    }
    return [
        'all_before' => (int)($data['all_before'] ?? 0),
        'paths'      => is_array($data['paths'] ?? null) ? $data['paths'] : [],
    ];
}

/**
 * Sla gewiste 404-melding(en) op in data/stats/dismissed_404.json.
 */
function handleKrantDismiss404(): void {
    requireAuth();

    $input = json_decode((string)file_get_contents('php://input'), true) ?: [];
    $dismissed = getKrantDismissed404Data();
    $now = time();

    if (!empty($input['all'])) {
        $dismissed['all_before'] = $now;
        $dismissed['paths'] = [];
    } elseif (!empty($input['page']) && is_string($input['page'])) {
        $page = $input['page'];
        $dismissed['paths'][$page] = $now;
    } else {
        jsonResponse(['success' => false, 'message' => 'Ongeldige parameter'], 400);
    }

    ensureKrantStatsStorage();
    @file_put_contents(
        KRANT_STATS_DISMISSED_404_FILE,
        json_encode($dismissed, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );

    jsonResponse(['success' => true, 'dismissed' => $dismissed]);
}

/**
 * Bereken procentuele trend tussen huidige en vorige periode.
 */
function computeKrantKpiTrend(float $current, float $previous): ?float {
    if ($previous <= 0.0) {
        return $current > 0.0 ? 100.0 : 0.0;
    }
    return round((($current - $previous) / $previous) * 100, 1);
}

/**
 * Aggregeer events binnen een tijdvenster voor KPI-berekening.
 */
function aggregateKrantPeriodMetrics(array $events): array {
    $sessions = [];
    $visitors = [];
    $totalViews = 0;
    $botsFiltered = 0;

    foreach ($events as $ev) {
        $type = $ev['type'] ?? 'view';
        $page = (string)($ev['page'] ?? '/krant/');
        $bot  = !empty($ev['bot']) ? 1 : 0;
        $isScan = isKrantScannerPath($page);

        if ($bot === 1 || $isScan) {
            $botsFiltered++;
            continue;
        }

        if ($type === 'err404') {
            continue;
        }

        $v = (string)($ev['v'] ?? '');
        $sid = (string)($ev['sid'] ?? '');
        if ($sid === '') {
            $sid = ($v !== '' ? $v : 'anon') . '_' . date('YmdH', (int)($ev['t'] ?? 0));
        }

        if (!isset($sessions[$sid])) {
            $sessions[$sid] = [
                'v'          => $v,
                'views'      => 0,
                'page_dwell' => [],
                'first_ref'  => '',
                'dev'        => (string)($ev['dev'] ?? 'desktop'),
                'lang'       => (string)($ev['lang'] ?? ''),
                'first_t'    => (int)($ev['t'] ?? 0),
            ];
        }

        if ($type === 'view') {
            $totalViews++;
            $sessions[$sid]['views']++;
            if ($v !== '') {
                $visitors[$v] = true;
            }
            if ($sessions[$sid]['first_ref'] === '' && !empty($ev['ref'])) {
                $sessions[$sid]['first_ref'] = (string)$ev['ref'];
            }
            if (!isset($sessions[$sid]['page_dwell'][$page])) {
                $sessions[$sid]['page_dwell'][$page] = 0;
            }
        } elseif ($type === 'dwell') {
            $sec = max(0, min(1800, (int)($ev['sec'] ?? 0)));
            if (!isset($sessions[$sid]['page_dwell'][$page])) {
                $sessions[$sid]['page_dwell'][$page] = 0;
            }
            $sessions[$sid]['page_dwell'][$page] = min(1800, $sessions[$sid]['page_dwell'][$page] + $sec);
        }
    }

    $validSessions = array_filter($sessions, function ($s) {
        return $s['views'] > 0;
    });

    $sessionCount = count($validSessions);
    $visitorCount = count($visitors);
    $totalDwellSec = 0;
    $bouncedSessions = 0;

    foreach ($validSessions as $s) {
        $sessDwell = array_sum($s['page_dwell']);
        $totalDwellSec += $sessDwell;

        // Engaged Bounce Rate: enkel bounce als 1 pagina én leestijd < 15 seconden
        if ($s['views'] === 1 && $sessDwell < 15) {
            $bouncedSessions++;
        }
    }

    $pagesPerSession = $sessionCount > 0 ? round($totalViews / $sessionCount, 2) : 0.0;
    $avgDwellSec     = $sessionCount > 0 ? (int)round($totalDwellSec / $sessionCount) : 0;
    $bounceRate      = $sessionCount > 0 ? round(($bouncedSessions / $sessionCount) * 100, 1) : 0.0;

    return [
        'views'             => $totalViews,
        'visitors'          => $visitorCount,
        'sessions'          => $sessionCount,
        'pages_per_session' => $pagesPerSession,
        'avg_dwell'         => $avgDwellSec,
        'bounce_rate'       => $bounceRate,
        'bots_filtered'     => $botsFiltered,
        '_sessions_map'     => $validSessions,
    ];
}

/**
 * Hoofdfunctie voor GET /krant/api.php/admin/stats?days=30
 */
function handleGetKrantAdminStats(?PDO $db = null): void {
    requireAuth();
    ensureKrantStatsStorage();

    $allowedPeriods = [1, 7, 30, 90, 365];
    $days = isset($_GET['days']) ? (int)$_GET['days'] : 30;
    if (!in_array($days, $allowedPeriods, true)) {
        $days = 30;
    }

    $now = time();
    if ($days === 1) {
        $currentStart = $now - 86400;
        $prevStart    = $now - 172800;
        $filesToReadDays = 3;
    } else {
        $currentStart = strtotime(date('Y-m-d 00:00:00', strtotime('-' . ($days - 1) . ' days', $now)));
        $prevStart    = strtotime(date('Y-m-d 00:00:00', strtotime('-' . (2 * $days - 1) . ' days', $now)));
        $filesToReadDays = 2 * $days;
    }

    // Haal essay-titels & scans op
    $essayTitleMap = [];
    $essayMetrics = [];
    if ($db) {
        try {
            $stmt = $db->query("SELECT week, title, published, scans, views, updated_at FROM essays ORDER BY week DESC");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $w = strtolower((string)($row['week'] ?? ''));
                if ($w !== '') {
                    $essayTitleMap[$w] = (string)($row['title'] ?? $w);
                    $essayMetrics[] = [
                        'week'       => $row['week'],
                        'title'      => $row['title'],
                        'published'  => (int)($row['published'] ?? 0),
                        'scans'      => (int)($row['scans'] ?? 0),
                        'views'      => (int)($row['views'] ?? 0),
                        'updated_at' => $row['updated_at'] ?? '',
                    ];
                }
            }
        } catch (Exception $e) {}
    }

    $currentEvents = [];
    $previousEvents = [];
    $liveVisitors = [];
    $liveThreshold = $now - 300; // Laatste 5 minuten

    for ($i = $filesToReadDays - 1; $i >= 0; $i--) {
        $dateStr = date('Y-m-d', strtotime("-{$i} days", $now));
        $filePath = KRANT_STATS_DIR . '/' . $dateStr . '.jsonl';
        if (!file_exists($filePath)) {
            continue;
        }
        $fh = @fopen($filePath, 'rb');
        if (!$fh) {
            continue;
        }
        if (@flock($fh, LOCK_SH)) {
            while (($line = fgets($fh)) !== false) {
                $line = trim($line);
                if ($line === '') continue;
                $ev = json_decode($line, true);
                if (!is_array($ev)) continue;

                $t = (int)($ev['t'] ?? 0);
                if ($t <= 0) continue;

                if ($t >= $liveThreshold && empty($ev['bot']) && ($ev['type'] ?? '') !== 'err404' && !isKrantScannerPath((string)($ev['page'] ?? '/krant/'))) {
                    $v = (string)($ev['v'] ?? '');
                    if ($v !== '') {
                        $liveVisitors[$v] = true;
                    }
                }

                if ($t >= $currentStart && $t <= $now) {
                    $currentEvents[] = $ev;
                } elseif ($t >= $prevStart && $t < $currentStart) {
                    $previousEvents[] = $ev;
                }
            }
            @flock($fh, LOCK_UN);
        }
        @fclose($fh);
    }

    $curMetrics  = aggregateKrantPeriodMetrics($currentEvents);
    $prevMetrics = aggregateKrantPeriodMetrics($previousEvents);

    // 1. Dagelijkse tijdreeks
    $dailyMap = [];
    $dutchMonths = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    $numDaysInChart = $days === 1 ? 1 : $days;
    for ($i = $numDaysInChart - 1; $i >= 0; $i--) {
        $ts = strtotime("-{$i} days", $now);
        $dKey = date('Y-m-d', $ts);
        $mIdx = (int)date('n', $ts) - 1;
        $label = date('j', $ts) . ' ' . ($dutchMonths[$mIdx] ?? date('M', $ts));
        $dailyMap[$dKey] = [
            'date'     => $dKey,
            'label'    => $label,
            'views'    => 0,
            'visitors' => [],
            'sessions' => [],
        ];
    }

    // 2. 24-uurs verdeling (00:00 - 23:00)
    $hourlyMap = [];
    for ($h = 0; $h < 24; $h++) {
        $hourlyMap[$h] = [
            'hour'     => $h,
            'label'    => sprintf('%02d:00', $h),
            'views'    => 0,
            'visitors' => [],
        ];
    }

    // 3. Top pagina's & dwell per pagina
    $pagesMap = [];
    $sessionPageDwell = [];

    // 4. Errors (echte 404's) vs Bot-scans
    $dismissed404 = getKrantDismissed404Data();
    $real404Map = [];
    $botScansMap = [];

    $ownHost = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $ownHost = preg_replace('/:\d+$/', '', $ownHost);
    $ownHost = preg_replace('/^www\./', '', $ownHost);

    foreach ($currentEvents as $ev) {
        $t    = (int)($ev['t'] ?? 0);
        $type = (string)($ev['type'] ?? 'view');
        $page = (string)($ev['page'] ?? '/krant/');
        $bot  = !empty($ev['bot']) ? 1 : 0;
        $v    = (string)($ev['v'] ?? '');
        $sid  = (string)($ev['sid'] ?? '');
        $ref  = (string)($ev['ref'] ?? '');
        $isScan = isKrantScannerPath($page);

        if ($sid === '') {
            $sid = ($v !== '' ? $v : 'anon') . '_' . date('YmdH', $t);
        }

        if ($type === 'err404') {
            $isInternalRef = ($ref !== '' && (str_starts_with($ref, 'intern:') || $ref === $ownHost || str_ends_with($ref, '.' . $ownHost)));
            if (($bot === 0 && !$isScan) || $isInternalRef) {
                $dismissedAt = max(
                    (int)($dismissed404['all_before'] ?? 0),
                    (int)($dismissed404['paths'][$page] ?? 0)
                );
                if ($t > $dismissedAt) {
                    if (!isset($real404Map[$page])) {
                        $real404Map[$page] = [
                            'page'      => $page,
                            'count'     => 0,
                            'last_seen' => $t,
                            'last_ref'  => $ref !== '' ? $ref : 'Direct / Intern',
                            'visitors'  => [],
                        ];
                    }
                    $real404Map[$page]['count']++;
                    if ($t >= $real404Map[$page]['last_seen']) {
                        $real404Map[$page]['last_seen'] = $t;
                        if ($ref !== '') {
                            $real404Map[$page]['last_ref'] = $ref;
                        }
                    }
                    if ($v !== '') {
                        $real404Map[$page]['visitors'][$v] = true;
                    }
                }
            } else {
                if (!isset($botScansMap[$page])) {
                    $botScansMap[$page] = [
                        'page'      => $page,
                        'category'  => classifyKrantScannerPath($page),
                        'count'     => 0,
                        'last_seen' => $t,
                    ];
                }
                $botScansMap[$page]['count']++;
                if ($t > $botScansMap[$page]['last_seen']) {
                    $botScansMap[$page]['last_seen'] = $t;
                }
            }
            continue;
        }

        if ($bot === 1 || $isScan) {
            $scanKey = $isScan ? $page : '[Bot Crawler] ' . $page;
            if (!isset($botScansMap[$scanKey])) {
                $botScansMap[$scanKey] = [
                    'page'      => $page,
                    'category'  => $isScan ? classifyKrantScannerPath($page) : 'Crawler / Bot',
                    'count'     => 0,
                    'last_seen' => $t,
                ];
            }
            $botScansMap[$scanKey]['count']++;
            if ($t > $botScansMap[$scanKey]['last_seen']) {
                $botScansMap[$scanKey]['last_seen'] = $t;
            }
            continue;
        }

        $dKey = date('Y-m-d', $t);
        $hour = (int)date('G', $t);

        if ($type === 'view') {
            if (isset($dailyMap[$dKey])) {
                $dailyMap[$dKey]['views']++;
                if ($v !== '') $dailyMap[$dKey]['visitors'][$v] = true;
                $dailyMap[$dKey]['sessions'][$sid] = true;
            }
            if (isset($hourlyMap[$hour])) {
                $hourlyMap[$hour]['views']++;
                if ($v !== '') $hourlyMap[$hour]['visitors'][$v] = true;
            }

            if (!isset($pagesMap[$page])) {
                $pagesMap[$page] = [
                    'page'      => $page,
                    'title'     => resolveKrantReadablePageTitle($page, $essayTitleMap),
                    'views'     => 0,
                    'visitors'  => [],
                    'sessions'  => [],
                    'dwell_sum' => 0,
                ];
            }
            $pagesMap[$page]['views']++;
            if ($v !== '') $pagesMap[$page]['visitors'][$v] = true;
            $pagesMap[$page]['sessions'][$sid] = true;
        } elseif ($type === 'dwell') {
            $sec = max(0, min(1800, (int)($ev['sec'] ?? 0)));
            $spKey = $sid . '|' . $page;
            if (!isset($sessionPageDwell[$spKey])) {
                $sessionPageDwell[$spKey] = 0;
            }
            $prevDwell = $sessionPageDwell[$spKey];
            $newDwell  = min(1800, $prevDwell + $sec);
            $added     = $newDwell - $prevDwell;
            $sessionPageDwell[$spKey] = $newDwell;

            if ($added > 0 && isset($pagesMap[$page])) {
                $pagesMap[$page]['dwell_sum'] += $added;
            }
        }
    }

    $dailySeries = [];
    $peakDay = null;
    foreach ($dailyMap as $d) {
        $item = [
            'date'     => $d['date'],
            'label'    => $d['label'],
            'views'    => $d['views'],
            'visitors' => count($d['visitors']),
            'sessions' => count($d['sessions']),
        ];
        $dailySeries[] = $item;
        if ($peakDay === null || $item['views'] > $peakDay['views']) {
            $peakDay = $item;
        }
    }

    $hourlySeries = [];
    foreach ($hourlyMap as $h) {
        $hourlySeries[] = [
            'hour'     => $h['hour'],
            'label'    => $h['label'],
            'views'    => $h['views'],
            'visitors' => count($h['visitors']),
        ];
    }

    $totalHumanViews = max(1, $curMetrics['views']);
    $topPages = [];
    foreach ($pagesMap as $p) {
        $sessCount = max(1, count($p['sessions']));
        $topPages[] = [
            'page'      => $p['page'],
            'title'     => $p['title'],
            'views'     => $p['views'],
            'visitors'  => count($p['visitors']),
            'avg_dwell' => (int)round($p['dwell_sum'] / $sessCount),
            'share_pct' => round(($p['views'] / $totalHumanViews) * 100, 1),
        ];
    }
    usort($topPages, fn($a, $b) => $b['views'] <=> $a['views']);

    $sourcesCount = [];
    $devicesCount = ['desktop' => 0, 'mobile' => 0, 'tablet' => 0];
    $langsCount   = [];
    $validSessions = $curMetrics['_sessions_map'];
    $totalSess = max(1, count($validSessions));

    foreach ($validSessions as $s) {
        $srcLabel = classifyKrantTrafficSource($s['first_ref']);
        $sourcesCount[$srcLabel] = ($sourcesCount[$srcLabel] ?? 0) + 1;

        $dev = $s['dev'] ?: 'desktop';
        $devicesCount[$dev] = ($devicesCount[$dev] ?? 0) + 1;

        $lang = $s['lang'] !== '' ? strtoupper($s['lang']) : 'ONBEKEND';
        $langsCount[$lang] = ($langsCount[$lang] ?? 0) + 1;
    }

    arsort($sourcesCount);
    $sourcesList = [];
    foreach ($sourcesCount as $source => $cnt) {
        $sourcesList[] = [
            'source'    => $source,
            'sessions'  => $cnt,
            'share_pct' => round(($cnt / $totalSess) * 100, 1),
        ];
    }

    arsort($devicesCount);
    $devicesList = [];
    foreach ($devicesCount as $dev => $cnt) {
        if ($cnt <= 0 && count($validSessions) > 0) continue;
        $devicesList[] = [
            'device'    => $dev,
            'sessions'  => $cnt,
            'share_pct' => count($validSessions) > 0 ? round(($cnt / $totalSess) * 100, 1) : 0,
        ];
    }

    arsort($langsCount);
    $langsList = [];
    foreach (array_slice($langsCount, 0, 8, true) as $lang => $cnt) {
        $langsList[] = [
            'lang'      => $lang,
            'sessions'  => $cnt,
            'share_pct' => round(($cnt / $totalSess) * 100, 1),
        ];
    }

    $errors404 = [];
    foreach ($real404Map as $err) {
        $errors404[] = [
            'page'      => $err['page'],
            'count'     => $err['count'],
            'visitors'  => count($err['visitors']),
            'last_seen' => $err['last_seen'],
            'last_ref'  => $err['last_ref'],
        ];
    }
    usort($errors404, fn($a, $b) => $b['count'] <=> $a['count'] ?: ($b['last_seen'] <=> $a['last_seen']));

    $botScans = array_values($botScansMap);
    usort($botScans, fn($a, $b) => $b['count'] <=> $a['count'] ?: ($b['last_seen'] <=> $a['last_seen']));

    $response = [
        'success'       => true,
        'period_days'   => $days,
        'generated_at'  => $now,
        'live_online'   => count($liveVisitors),
        'kpis'          => [
            'views' => [
                'value'    => $curMetrics['views'],
                'previous' => $prevMetrics['views'],
                'trend'    => computeKrantKpiTrend($curMetrics['views'], $prevMetrics['views']),
            ],
            'visitors' => [
                'value'    => $curMetrics['visitors'],
                'previous' => $prevMetrics['visitors'],
                'trend'    => computeKrantKpiTrend($curMetrics['visitors'], $prevMetrics['visitors']),
            ],
            'sessions' => [
                'value'             => $curMetrics['sessions'],
                'previous'          => $prevMetrics['sessions'],
                'trend'             => computeKrantKpiTrend($curMetrics['sessions'], $prevMetrics['sessions']),
                'pages_per_session' => $curMetrics['pages_per_session'],
            ],
            'avg_dwell' => [
                'value'    => $curMetrics['avg_dwell'],
                'previous' => $prevMetrics['avg_dwell'],
                'trend'    => computeKrantKpiTrend($curMetrics['avg_dwell'], $prevMetrics['avg_dwell']),
            ],
            'bounce_rate' => [
                'value'    => $curMetrics['bounce_rate'],
                'previous' => $prevMetrics['bounce_rate'],
                'trend'    => computeKrantKpiTrend($curMetrics['bounce_rate'], $prevMetrics['bounce_rate']),
            ],
            'bots_filtered' => [
                'value'    => $curMetrics['bots_filtered'],
                'previous' => $prevMetrics['bots_filtered'],
                'trend'    => computeKrantKpiTrend($curMetrics['bots_filtered'], $prevMetrics['bots_filtered']),
            ],
        ],
        'daily'         => $dailySeries,
        'peak_day'      => $peakDay,
        'hourly'        => $hourlySeries,
        'pages'         => $topPages,
        'sources'       => $sourcesList,
        'devices'       => $devicesList,
        'languages'     => $langsList,
        'errors_404'    => $errors404,
        'bot_scans'     => array_slice($botScans, 0, 100),
        'essay_metrics' => $essayMetrics,
    ];

    jsonResponse($response);
}
