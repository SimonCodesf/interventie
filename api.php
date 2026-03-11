<?php
// api.php - REST API endpoints

// Error handling
error_reporting(E_ALL);
ini_set('display_errors', 1); // Tijdelijk voor debugging
ini_set('log_errors', 1);

set_error_handler(function($errno, $errstr, $errfile, $errline) {
    $error = "PHP Error [$errno]: $errstr in $errfile on line $errline";
    error_log($error);
    http_response_code(500);
    echo json_encode(['message' => 'Server error', 'error' => $error]);
    exit;
});

set_exception_handler(function($exception) {
    $error = "Exception: " . $exception->getMessage() . " in " . $exception->getFile() . ":" . $exception->getLine();
    error_log($error);
    http_response_code(500);
    echo json_encode(['message' => 'Server error', 'error' => $error, 'trace' => $exception->getTraceAsString()]);
    exit;
});

// Session settings
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', 1);
session_start();

// Dependencies
require_once 'includes/config.php';
require_once 'includes/security.php';
require_once 'includes/api_utils.php';
require_once 'includes/poster_controller.php';
require_once 'includes/klipy_proxy.php';

// Headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if (rand(1, 100) === 1) cleanupOldAttempts();

// Gebruik de nieuwe database functie met migraties (uit api_utils.php)
$db = initDatabaseWithMigrations();
$method = $_SERVER['REQUEST_METHOD'];

// Path parsing
$path = '/';
if (isset($_SERVER['PATH_INFO'])) {
    $path = $_SERVER['PATH_INFO'];
} else {
    $requestUri = $_SERVER['REQUEST_URI'] ?? '/';
    $scriptName = str_replace('/index.php', '', $_SERVER['SCRIPT_NAME']);
    $path = str_replace($scriptName, '', parse_url($requestUri, PHP_URL_PATH));
    $path = str_replace('/api.php', '', $path);
    if (empty($path)) $path = '/';
}

if ($method === 'OPTIONS') exit(0);

// Router
if ($method === 'GET' && $path === '/posters') {
    handleGetPosters($db);
} elseif ($method === 'GET' && preg_match('#^/posters/([^/]+)$#', $path, $matches)) {
    handleGetPoster($db, $matches[1]);
} elseif ($method === 'POST' && $path === '/admin/upload') {
    handleUploadPoster($db);
} elseif ($method === 'POST' && preg_match('#^/admin/posters/([^/]+)/update$#', $path, $matches)) {
    handleUpdatePoster($db, $matches[1]);
} elseif ($method === 'DELETE' && preg_match('#^/admin/posters/([^/]+)$#', $path, $matches)) {
    handleDeletePoster($db, $matches[1]);
} elseif ($method === 'GET' && preg_match('#^/download/([^/]+)$#', $path, $matches)) {
    handleDownloadPoster($db, $matches[1]);
} elseif ($method === 'POST' && $path === '/admin/login') {
    // Login logic
    $clientIP = getClientIP();
    if (isRateLimited($clientIP)) {
        jsonResponse(['message' => 'Te veel pogingen', 'locked' => true], 429);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (verifyPassword($input['password'] ?? '', ADMIN_PASSWORD)) {
        clearLoginAttempts($clientIP);
        $token = generateSecureToken();
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['auth_token'] = $token;
        $_SESSION['last_activity'] = time();
        logAdminActivity('LOGIN_SUCCESS');
        jsonResponse(['token' => $token, 'message' => 'Login succesvol']);
    } else {
        recordFailedAttempt($clientIP);
        logAdminActivity('LOGIN_FAILED');
        sleep(1);
        jsonResponse(['message' => 'Onjuist wachtwoord'], 401);
    }
} elseif ($method === 'POST' && $path === '/admin/logout') {
    session_destroy();
    jsonResponse(['message' => 'Uitgelogd']);
} elseif ($method === 'POST' && $path === '/admin/rebuild-mind') {
    // Handmatig .mind files herbouwen (admin only)
    if (!isAdmin()) jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    
    // Trigger MindAR chunk rebuild with output capture
    $result = triggerMindMerge(true);
    logAdminActivity('REBUILD_MIND', 'Handmatige rebuild uitgevoerd');
    
    // Zoek welke poster IDs zonder .mind zijn (gerapporteerd door merge script)
    $missingIds = [];
    foreach ($result['output'] as $line) {
        if (strpos($line, 'MISSING_MIND_IDS:') === 0) {
            $ids = explode(',', substr($line, strlen('MISSING_MIND_IDS:')));
            $missingIds = array_filter(array_map('trim', $ids));
        }
    }
    
    // Haal titels op voor de missing IDs
    $missingPosters = [];
    if (!empty($missingIds)) {
        try {
            $db = getDatabase();
            foreach ($missingIds as $missingId) {
                $stmt = $db->prepare("SELECT id, title FROM posters WHERE id = ?");
                $stmt->execute([$missingId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $missingPosters[] = ['id' => $row['id'], 'title' => $row['title']];
                } else {
                    $missingPosters[] = ['id' => $missingId, 'title' => '(onbekend)'];
                }
            }
        } catch (Exception $e) {
            // Negeer DB-fout, stuur toch door
        }
    }
    
    jsonResponse([
        'success' => $result['returnVar'] === 0,
        'message' => 'Mind rebuild ' . ($result['returnVar'] === 0 ? 'succesvol' : 'mislukt'),
        'output' => $result['output'],
        'missingMind' => $missingPosters
    ]);
} elseif ($path === '/settings/ar-tracking') {
    // Settings logic
    $settingsFile = __DIR__ . '/assets/ar-settings.json';
    if ($method === 'GET') {
        $settings = ['filterMinCF' => '0.003', 'filterBeta' => '0.025'];
        if (file_exists($settingsFile)) {
            $settings = array_merge($settings, json_decode(file_get_contents($settingsFile), true) ?: []);
        }
        jsonResponse($settings);
    } elseif ($method === 'POST') {
        if (!isAdmin()) jsonResponse(['message' => 'Unauthorized'], 401);
        $input = json_decode(file_get_contents('php://input'), true);
        file_put_contents($settingsFile, json_encode($input));
        jsonResponse(['message' => 'Saved']);
    }
// === Verkeersborden / Memeborden API routes ===
} elseif ($method === 'GET' && $path === '/verkeersborden/signs') {
    // Haal alle verkeersborden op (of top 30 met ?top30=true)
    handleGetSigns();
} elseif ($method === 'GET' && $path === '/verkeersborden/gif') {
    // Haal random GIF op voor een verkeersbord (?sign=A1a of ?q=zoekterm)
    handleGetGif();
} elseif ($method === 'GET' && $path === '/api-search/gifs') {
    // Zoek meerdere GIFs via Klipy API (voor admin layer selector)
    if (!isAdmin()) jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    $query = $_GET['q'] ?? '';
    if (!$query) jsonResponse(['message' => 'Zoekterm is vereist'], 400);
    $results = searchKlipyGifMultiple($query);
    jsonResponse($results);
} elseif ($method === 'GET' && $path === '/api-search/memes') {
    // Zoek memes via Reddit JSON API (r/memes of r/dankmemes)
    if (!isAdmin()) jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    $query = $_GET['q'] ?? '';
    $source = $_GET['source'] ?? 'memes';
    if (!$query) jsonResponse(['message' => 'Zoekterm is vereist'], 400);
    // Whitelist van toegestane subreddits
    $allowedSubs = ['memes', 'dankmemes', 'me_irl', 'AdviceAnimals', 'funny'];
    if (!in_array($source, $allowedSubs)) $source = 'memes';

    // Helper: haal posts op van een Reddit URL en filter op afbeeldingen
    $fetchRedditPosts = function($url) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            // Reddit vereist een herkenbare user-agent, anders 429/403
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; interventie-poster/1.0; +https://interventie.org)',
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($httpCode !== 200 || !$body) return null;
        return json_decode($body, true);
    };

    // Extraheer afbeeldingsresultaten uit Reddit post array
    $extractMemes = function($posts) {
        $memes = [];
        foreach ($posts as $post) {
            $p = $post['data'] ?? [];
            if (!empty($p['is_video'])) continue;
            if (($p['post_hint'] ?? '') === 'self') continue;
            // Gebruik url_overridden_by_dest (modernere veld) of url
            $imgUrl = $p['url_overridden_by_dest'] ?? $p['url'] ?? '';
            if (!$imgUrl) continue;
            // Sla Reddit gallery/link posts over, accepteer directe afbeeldingen
            // en posts met post_hint=image (zelfs zonder extensie, bijv. i.redd.it/abc)
            $isDirectImage = preg_match('/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i', $imgUrl);
            $isRedditImage = ($p['post_hint'] ?? '') === 'image';
            $isImgurDirect = (bool) preg_match('#^https?://(i\.)?imgur\.com/#', $imgUrl) && !str_ends_with($imgUrl, '/');
            if (!$isDirectImage && !$isRedditImage && !$isImgurDirect) continue;
            if (strpos($imgUrl, 'reddit.com/gallery') !== false) continue;
            // Reddit HTML-escapeert preview URLs (&amp; → &)
            $preview = html_entity_decode($p['preview']['images'][0]['source']['url'] ?? $imgUrl);
            $memes[] = [
                'id'          => $p['id'] ?? '',
                'title'       => $p['title'] ?? '',
                'url'         => $imgUrl,
                'preview_url' => $preview,
                'author'      => $p['author'] ?? '',
                'ups'         => (int)($p['ups'] ?? 0),
            ];
            if (count($memes) >= 12) break;
        }
        return $memes;
    };

    // Stap 1: zoek op query in het subreddit
    $searchUrl = 'https://www.reddit.com/r/' . urlencode($source) . '/search.json?' . http_build_query([
        'q' => $query, 'restrict_sr' => '1', 'sort' => 'top', 't' => 'year', 'limit' => 50,
    ]);
    $data = $fetchRedditPosts($searchUrl);
    $memes = $data ? $extractMemes($data['data']['children'] ?? []) : [];

    // Stap 2: fallback naar hot posts als zoekterm geen resultaten oplevert
    if (empty($memes)) {
        $hotUrl = 'https://www.reddit.com/r/' . urlencode($source) . '/hot.json?limit=50';
        $data = $fetchRedditPosts($hotUrl);
        $memes = $data ? $extractMemes($data['data']['children'] ?? []) : [];
    }

    jsonResponse(['success' => true, 'memes' => $memes, 'query' => $query, 'source' => $source]);
} elseif ($method === 'GET' && $path === '/verkeersborden/gif-proxy') {
    // Proxy externe GIF URL naar eigen domein (lost CORS op voor gif-component fetch)
    $gifUrl = isset($_GET['url']) ? $_GET['url'] : '';
    if (!$gifUrl) {
        http_response_code(400);
        exit('Geen URL opgegeven');
    }
    // Valideer dat het een toegestane URL is (veiligheidscheck)
    $allowedDomains = ['klipy.com', 'klipy.co', 'media.klipy.com', 'media.klipy.co', 'cdn.klipy.com', 'i.imgflip.com', 'imgflip.com', 'api.memegen.link', 'i.redd.it', 'preview.redd.it', 'external-preview.redd.it', 'i.imgur.com', 'imgur.com'];
    $host = parse_url($gifUrl, PHP_URL_HOST);
    $allowed = false;
    foreach ($allowedDomains as $domain) {
        if ($host === $domain || str_ends_with($host, '.' . $domain)) {
            $allowed = true;
            break;
        }
    }
    if (!$allowed) {
        http_response_code(403);
        exit('Niet toegestaan');
    }
    // Haal GIF op via cURL en stream naar browser
    $ch = curl_init($gifUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_USERAGENT => 'Memeborden/1.0 (interventie.org)',
    ]);
    $data = curl_exec($ch);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (!$data || $httpCode !== 200) {
        http_response_code(502);
        exit('GIF ophalen mislukt');
    }
    header('Content-Type: ' . ($contentType ?: 'image/gif'));
    header('Cache-Control: public, max-age=3600');
    header('Access-Control-Allow-Origin: *');
    echo $data;
    exit;
} elseif ($method === 'GET' && preg_match('#^/verkeersborden/sign/([A-Za-z0-9]+)$#', $path, $matches)) {
    // Haal details van één verkeersbord op
    handleGetSign($matches[1]);
} elseif ($method === 'GET' && $path === '/api-search/3d') {
    // Zoek 3D modellen via Sketchfab publieke API (geen API key nodig voor browse)
    if (!isAdmin()) jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    $query = $_GET['q'] ?? '';
    $maxTriangles = min((int)($_GET['max_triangles'] ?? 10000), 100000);
    if (!$query) jsonResponse(['message' => 'Zoekterm is vereist'], 400);

    $sketchfabUrl = 'https://api.sketchfab.com/v3/models?' . http_build_query([
        'q'               => $query,
        'type'            => 'models',
        'downloadable'    => 'true',
        'max_vertex_count'=> $maxTriangles,
        'sort_by'         => '-likeCount',
        'count'           => 20,
    ]);
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $sketchfabUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT      => 'interventie-poster/1.0 (+https://interventie.org)',
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $body     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$body) {
        jsonResponse(['success' => false, 'models' => [], 'message' => 'Sketchfab niet bereikbaar']);
    }
    $data   = json_decode($body, true);
    $models = [];
    foreach ($data['results'] ?? [] as $m) {
        // Thumbnail: kies een kleine maat (~200-300px)
        $thumb = '';
        foreach ($m['thumbnails']['images'] ?? [] as $img) {
            if ($img['width'] <= 640) { $thumb = $img['url']; break; }
        }
        if (!$thumb && !empty($m['thumbnails']['images'])) {
            $thumb = end($m['thumbnails']['images'])['url'];
        }
        $models[] = [
            'uid'          => $m['uid'],
            'name'         => $m['name'] ?? '',
            'thumbnail'    => $thumb,
            'face_count'   => $m['faceCount'] ?? 0,
            'vertex_count' => $m['vertexCount'] ?? 0,
            'license'      => $m['license']['label'] ?? 'onbekend',
            'author'       => $m['user']['displayName'] ?? '',
            'glb_size'     => $m['archives']['glb']['size'] ?? 0,
            'embed_url'    => $m['embedUrl'] ?? '',
        ];
    }
    jsonResponse(['success' => true, 'models' => $models, 'query' => $query]);

} elseif ($method === 'GET' && $path === '/api-search/3d/random') {
    // AR runtime: haal random Sketchfab GLB op voor een query, cache op server, geef lokale URL terug
    // (Geen admin auth, wel Sketchfab API key nodig voor download)
    $query       = $_GET['q'] ?? '';
    $maxTriangles = min((int)($_GET['max_triangles'] ?? 10000), 100000);
    if (!$query) jsonResponse(['success' => false, 'message' => 'Geen zoekterm'], 400);

    $apiKey = defined('SKETCHFAB_API_KEY') ? SKETCHFAB_API_KEY : '';
    if (!$apiKey) jsonResponse(['success' => false, 'message' => 'Geen Sketchfab API key geconfigureerd'], 503);

    // Zoek downloadbare modellen voor de query
    $searchUrl = 'https://api.sketchfab.com/v3/models?' . http_build_query([
        'q'               => $query,
        'type'            => 'models',
        'downloadable'    => 'true',
        'max_vertex_count'=> $maxTriangles,
        'sort_by'         => '-likeCount',
        'count'           => 20,
    ]);
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $searchUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_USERAGENT      => 'interventie-poster/1.0',
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $body     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$body) jsonResponse(['success' => false, 'message' => 'Sketchfab niet bereikbaar'], 502);
    $data    = json_decode($body, true);
    $results = $data['results'] ?? [];
    if (empty($results)) jsonResponse(['success' => false, 'message' => 'Geen modellen gevonden voor query'], 404);

    // Pik een random model uit de top resultaten
    shuffle($results);
    $chosen = $results[0];
    $uid    = $chosen['uid'];
    $name   = $chosen['name'] ?? 'model';

    // Controleer of het GLB al gecached is (max 24 uur)
    $cacheDir  = defined('GLB_CACHE_DIR') ? GLB_CACHE_DIR : dirname(__DIR__) . '/uploads/glb_cache';
    $cacheFile = $cacheDir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $uid) . '.glb';
    if (!file_exists($cacheDir)) mkdir($cacheDir, 0755, true);

    if (!file_exists($cacheFile) || (time() - filemtime($cacheFile)) > 86400) {
        // Haal download URL op bij Sketchfab (vereist API key)
        $dlUrl = 'https://api.sketchfab.com/v3/models/' . urlencode($uid) . '/download';
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $dlUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Token ' . $apiKey,
                'Accept: application/json',
            ],
        ]);
        $dlBody     = curl_exec($ch);
        $dlHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($dlHttpCode !== 200 || !$dlBody) {
            jsonResponse(['success' => false, 'message' => 'Download URL ophalen mislukt (code ' . $dlHttpCode . ')'], 502);
        }
        $dlData  = json_decode($dlBody, true);
        $glbUrl  = $dlData['gltf']['url'] ?? ($dlData['glb']['url'] ?? '');
        if (!$glbUrl) jsonResponse(['success' => false, 'message' => 'Geen GLB URL in Sketchfab response'], 502);

        // Download het GLB bestand (max 15 MB)
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $glbUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_MAXFILESIZE    => 15 * 1024 * 1024,
        ]);
        $glbData    = curl_exec($ch);
        $glbCode    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $glbSize    = curl_getinfo($ch, CURLINFO_SIZE_DOWNLOAD);
        curl_close($ch);

        if ($glbCode !== 200 || !$glbData || $glbSize > 15 * 1024 * 1024) {
            jsonResponse(['success' => false, 'message' => 'GLB downloaden mislukt of te groot'], 502);
        }
        file_put_contents($cacheFile, $glbData);
    }

    // Geef de lokale proxy URL terug
    $baseUrl  = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'];
    $localUrl = $baseUrl . '/api.php/api-search/3d/model?uid=' . urlencode($uid);
    jsonResponse([
        'success'   => true,
        'model_url' => $localUrl,
        'uid'       => $uid,
        'name'      => $name,
    ]);

} elseif ($method === 'GET' && $path === '/api-search/3d/model') {
    // Serveer een gecached GLB bestand (CORS-vrije proxy)
    $uid = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['uid'] ?? '');
    if (!$uid) { http_response_code(400); exit('Geen UID'); }

    $cacheDir  = defined('GLB_CACHE_DIR') ? GLB_CACHE_DIR : dirname(__DIR__) . '/uploads/glb_cache';
    $cacheFile = $cacheDir . '/' . $uid . '.glb';
    if (!file_exists($cacheFile)) { http_response_code(404); exit('Model niet gecached'); }

    header('Content-Type: model/gltf-binary');
    header('Content-Length: ' . filesize($cacheFile));
    header('Cache-Control: public, max-age=86400');
    header('Access-Control-Allow-Origin: *');
    readfile($cacheFile);
    exit;

} else {
    jsonResponse(['message' => 'Endpoint niet gevonden'], 404);
}
