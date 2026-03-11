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
} elseif ($method === 'GET' && $path === '/verkeersborden/gif-proxy') {
    // Proxy externe GIF URL naar eigen domein (lost CORS op voor gif-component fetch)
    $gifUrl = isset($_GET['url']) ? $_GET['url'] : '';
    if (!$gifUrl) {
        http_response_code(400);
        exit('Geen URL opgegeven');
    }
    // Valideer dat het een toegestane URL is (veiligheidscheck)
    $allowedDomains = ['klipy.com', 'klipy.co', 'media.klipy.com', 'media.klipy.co', 'cdn.klipy.com', 'i.imgflip.com', 'imgflip.com', 'api.memegen.link'];
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
} else {
    jsonResponse(['message' => 'Endpoint niet gevonden'], 404);
}
