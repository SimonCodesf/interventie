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
    jsonResponse([
        'success' => $result['returnVar'] === 0,
        'message' => 'Mind rebuild ' . ($result['returnVar'] === 0 ? 'succesvol' : 'mislukt'),
        'output' => $result['output']
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
} else {
    jsonResponse(['message' => 'Endpoint niet gevonden'], 404);
}
