<?php
// api.php - REST API endpoints voor de poster website

// Set error reporting to catch all errors
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display to user, log instead
ini_set('log_errors', 1);

// Global error handler to catch all PHP errors
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    $errorMsg = "PHP Error [$errno]: $errstr in $errfile on line $errline";
    error_log($errorMsg);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Server error: ' . $errstr, 'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $errorMsg : null]);
    exit;
});

// Global exception handler
set_exception_handler(function($exception) {
    $errorMsg = "Exception: " . $exception->getMessage() . " in " . $exception->getFile() . ":" . $exception->getLine();
    error_log($errorMsg);
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Server error: ' . $exception->getMessage(), 'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $errorMsg : null]);
    exit;
});

// Configure session settings BEFORE starting session
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', 1);

// Start session (before any output)
session_start();

// Load required files with error handling
if (!file_exists(__DIR__ . '/config.php')) {
    http_response_code(500);
    header('Content-Type: application/json');
    die(json_encode(['message' => 'config.php not found']));
}

if (!file_exists(__DIR__ . '/security.php')) {
    http_response_code(500);
    header('Content-Type: application/json');
    die(json_encode(['message' => 'security.php not found']));
}

require_once 'config.php';
require_once 'security.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Cleanup old rate limit attempts (1% chance per request)
if (rand(1, 100) === 1) {
    cleanupOldAttempts();
}

$db = initDatabase();

// Parse de request - Support multiple PHP configurations
$method = $_SERVER['REQUEST_METHOD'];

// Try multiple methods to get the path
if (isset($_SERVER['PATH_INFO']) && $_SERVER['PATH_INFO'] !== '') {
    $path = $_SERVER['PATH_INFO'];
} elseif (isset($_SERVER['ORIG_PATH_INFO']) && $_SERVER['ORIG_PATH_INFO'] !== '') {
    $path = $_SERVER['ORIG_PATH_INFO'];
} else {
    // Fallback: parse from REQUEST_URI
    $requestUri = $_SERVER['REQUEST_URI'] ?? '/';
    $scriptName = str_replace('/index.php', '', $_SERVER['SCRIPT_NAME']);
    
    // Remove script name and query string
    $path = str_replace($scriptName, '', parse_url($requestUri, PHP_URL_PATH));
    
    // Remove /api.php if present
    $path = str_replace('/api.php', '', $path);
    
    if (empty($path) || $path === '/') {
        $path = '/';
    }
}

// Helper functie voor JSON response
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// Check admin authenticatie via session
function isAdmin() {
    // Check if valid session exists
    if (isValidSession() && !empty($_SESSION['admin_logged_in'])) {
        return true;
    }
    
    // Also support Bearer token for backwards compatibility (but check session first)
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? '';
    
    if (preg_match('/Bearer\s+(.+)/', $auth, $matches)) {
        // Verify token matches session token
        if (isset($_SESSION['auth_token']) && hash_equals($_SESSION['auth_token'], $matches[1])) {
            return isValidSession();
        }
    }
    
    return false;
}

// Generate UUID
function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// Handle OPTIONS requests for CORS preflight
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Debug: Log request info (remove in production)
error_log("API Request: $method $path");

// Routing
if ($method === 'GET' && $path === '/posters') {
    // GET alle posters
    $stmt = $db->query("SELECT * FROM posters ORDER BY upload_date DESC");
    $posters = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Decode layers_data for all posters
    foreach ($posters as &$poster) {
        if (!empty($poster['layers_data'])) {
            $poster['layers'] = json_decode($poster['layers_data'], true);
            unset($poster['layers_data']); // Remove raw JSON from response
        }
    }
    
    jsonResponse($posters);
    
} elseif ($method === 'GET' && $path === '/settings/ar-tracking') {
    // GET AR tracking settings - returns settings stored in localStorage of admin panel
    // Since localStorage is domain-specific, we need to retrieve it from a backend source
    // This is a fallback when localStorage is empty on the AR view domain
    
    // Default values
    $settings = [
        'filterMinCF' => '0.003',
        'filterBeta' => '0.025',
        'warmupTolerance' => '5',
        'missTolerance' => '5'
    ];
    
    // Try to read from a settings file if it exists
    $settingsFile = __DIR__ . '/ar-settings.json';
    if (file_exists($settingsFile)) {
        $fileSettings = json_decode(file_get_contents($settingsFile), true);
        if (is_array($fileSettings)) {
            $settings = array_merge($settings, $fileSettings);
        }
    }
    
    jsonResponse($settings);
    
} elseif ($method === 'POST' && $path === '/settings/ar-tracking') {
    // POST AR tracking settings - admin panel saves settings here as backup
    // This is optional and allows settings to persist across domains
    
    if (!isAdmin()) {
        jsonResponse(['message' => 'Unauthorized'], 401);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['filterMinCF']) || !isset($input['filterBeta'])) {
        jsonResponse(['message' => 'Missing required settings'], 400);
    }
    
    $settings = [
        'filterMinCF' => $input['filterMinCF'],
        'filterBeta' => $input['filterBeta'],
        'warmupTolerance' => $input['warmupTolerance'] ?? '5',
        'missTolerance' => $input['missTolerance'] ?? '5'
    ];
    
    $settingsFile = __DIR__ . '/ar-settings.json';
    if (file_put_contents($settingsFile, json_encode($settings, JSON_PRETTY_PRINT)) === false) {
        jsonResponse(['message' => 'Failed to save settings'], 500);
    }
    
    jsonResponse(['message' => 'Settings saved successfully', 'settings' => $settings]);
    
} elseif ($method === 'GET' && preg_match('#^/posters/([^/]+)$#', $path, $matches)) {
    // GET specifieke poster
    $id = $matches[1];
    $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt->execute([$id]);
    $poster = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($poster) {
        // Decode layers_data
        if (!empty($poster['layers_data'])) {
            $poster['layers'] = json_decode($poster['layers_data'], true);
            unset($poster['layers_data']); // Remove raw JSON from response
        }
        jsonResponse($poster);
    } else {
        jsonResponse(['message' => 'Poster niet gevonden'], 404);
    }
    
} elseif ($method === 'GET' && preg_match('#^/download/([^/]+)$#', $path, $matches)) {
    // Download poster
    $id = $matches[1];
    $format = $_GET['format'] ?? 'jpeg';
    $size = $_GET['size'] ?? 'A3';
    
    $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt->execute([$id]);
    $poster = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$poster) {
        jsonResponse(['message' => 'Poster niet gevonden'], 404);
    }
    
    // Update download count
    $db->prepare("UPDATE posters SET downloads = downloads + 1 WHERE id = ?")->execute([$id]);
    
    // Serve file
    if ($format === 'jpeg') {
        $file = UPLOADS_DIR . '/' . $poster['jpeg_filename'];
        $filename = $poster['title'] . '.jpg';
        $contentType = 'image/jpeg';
    } elseif ($format === 'pdf' && $size === 'A3') {
        $file = UPLOADS_DIR . '/' . $poster['pdf_medium_filename'];
        $filename = $poster['title'] . '_Medium.pdf';
        $contentType = 'application/pdf';
    } elseif ($format === 'pdf' && $size === 'A0') {
        $file = UPLOADS_DIR . '/' . $poster['pdf_large_filename'];
        $filename = $poster['title'] . '_Groot.pdf';
        $contentType = 'application/pdf';
    } elseif ($format === 'pdf-print') {
        // Voor drukklare PDF genereren we die on-the-fly met FPDF of gebruiken we de large PDF
        $file = UPLOADS_DIR . '/' . $poster['pdf_large_filename'];
        $filename = $poster['title'] . '_' . $size . '_Drukklaar.pdf';
        $contentType = 'application/pdf';
    }
    
    if (file_exists($file)) {
        header('Content-Type: ' . $contentType);
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    } else {
        jsonResponse(['message' => 'Bestand niet gevonden'], 404);
    }
    
} elseif ($method === 'POST' && $path === '/admin/login') {
    // Admin login with rate limiting
    $clientIP = getClientIP();
    
    // Check if IP is rate limited
    if (isRateLimited($clientIP)) {
        jsonResponse([
            'message' => 'Te veel login pogingen. Probeer het over 15 minuten opnieuw.',
            'locked' => true
        ], 429);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $password = $input['password'] ?? '';
    
    // Use constant-time comparison to prevent timing attacks
    if (verifyPassword($password, ADMIN_PASSWORD)) {
        // Clear failed attempts
        clearLoginAttempts($clientIP);
        
        // Generate secure token
        $token = generateSecureToken();
        
        // Set session variables
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['auth_token'] = $token;
        $_SESSION['last_activity'] = time();
        $_SESSION['ip_address'] = $clientIP;
        
        // Log successful login
        logAdminActivity('LOGIN_SUCCESS', "Token: " . substr($token, 0, 8) . "...");
        
        // Regenerate session ID for security
        session_regenerate_id(true);
        
        jsonResponse([
            'token' => $token,
            'message' => 'Login succesvol',
            'sessionTimeout' => SESSION_TIMEOUT
        ]);
    } else {
        // Record failed attempt
        recordFailedAttempt($clientIP);
        
        // Log failed login
        logAdminActivity('LOGIN_FAILED', 'Wrong password attempt');
        
        // Add delay to slow down brute force attempts
        sleep(2);
        
        jsonResponse(['message' => 'Onjuist wachtwoord'], 401);
    }
} elseif ($method === 'POST' && $path === '/admin/upload') {
    // Admin upload with enhanced security
    if (!isAdmin()) {
        logAdminActivity('UNAUTHORIZED_UPLOAD_ATTEMPT', 'User not authenticated');
        jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    }
    
    if (empty($_FILES['jpeg']) || empty($_FILES['pdfMedium']) || empty($_FILES['pdfLarge']) || empty($_FILES['ar_marker_file_hq'])) {
        logAdminActivity('UPLOAD_FAILED', 'Missing required files');
        jsonResponse(['message' => 'Alle bestanden (JPEG, PDF Medium, PDF Large, .mind bestand) zijn verplicht'], 400);
    }
    
    $title = $_POST['title'] ?? '';
    $description = $_POST['description'] ?? '';
    $latitude = !empty($_POST['latitude']) ? (float)$_POST['latitude'] : null;
    $longitude = !empty($_POST['longitude']) ? (float)$_POST['longitude'] : null;
    $locationDescription = $_POST['location_description'] ?? '';
    $artikelLink = $_POST['artikel_link'] ?? '';
    $photographerCredit = $_POST['photographer_credit'] ?? '';
    
    if (empty($title)) {
        logAdminActivity('UPLOAD_FAILED', 'Missing title');
        jsonResponse(['message' => 'Titel is verplicht'], 400);
    }
    
    // Validate coordinates if provided
    if (($latitude !== null && ($latitude < -90 || $latitude > 90)) || 
        ($longitude !== null && ($longitude < -180 || $longitude > 180))) {
        logAdminActivity('UPLOAD_FAILED', 'Invalid coordinates');
        jsonResponse(['message' => 'Ongeldige coördinaten (lat: -90 tot 90, lng: -180 tot 180)'], 400);
    }
    
    // Validate uploaded files
    $jpegValidation = validateUploadedFile($_FILES['jpeg'], ['image/jpeg'], 52428800); // 50MB for high-res images
    if (!$jpegValidation['valid']) {
        logAdminActivity('UPLOAD_FAILED', 'JPEG validation failed: ' . $jpegValidation['message']);
        jsonResponse(['message' => 'JPEG bestand: ' . $jpegValidation['message']], 400);
    }
    
    $pdfValidation1 = validateUploadedFile($_FILES['pdfMedium'], ['application/pdf'], 104857600); // 100MB for PDFs
    if (!$pdfValidation1['valid']) {
        logAdminActivity('UPLOAD_FAILED', 'PDF Medium validation failed: ' . $pdfValidation1['message']);
        jsonResponse(['message' => 'PDF Medium: ' . $pdfValidation1['message']], 400);
    }
    
    $pdfValidation2 = validateUploadedFile($_FILES['pdfLarge'], ['application/pdf'], 104857600); // 100MB for PDFs
    if (!$pdfValidation2['valid']) {
        logAdminActivity('UPLOAD_FAILED', 'PDF Large validation failed: ' . $pdfValidation2['message']);
        jsonResponse(['message' => 'PDF Groot: ' . $pdfValidation2['message']], 400);
    }
    
    // Validate .mind file (primary is required, fallback is optional)
    if (!isset($_FILES['ar_marker_file_hq']) || $_FILES['ar_marker_file_hq']['error'] !== UPLOAD_ERR_OK) {
        logAdminActivity('UPLOAD_FAILED', 'AR marker HQ file missing or error: ' . ($_FILES['ar_marker_file_hq']['error'] ?? 'unknown'));
        jsonResponse(['message' => 'High Quality AR marker bestand is verplicht'], 400);
    }
    
    $hqValidation = validateUploadedFile($_FILES['ar_marker_file_hq'], ['application/octet-stream', 'application/json'], 10485760); // 10MB for .mind files
    if (!$hqValidation['valid']) {
        logAdminActivity('UPLOAD_FAILED', 'HQ marker file validation failed: ' . $hqValidation['message']);
        jsonResponse(['message' => 'HQ marker bestand: ' . $hqValidation['message']], 400);
    }
    
    // Validate LQ .mind file (optional)
    $hasLQ = false;
    if (isset($_FILES['ar_marker_file_lq']) && $_FILES['ar_marker_file_lq']['error'] === UPLOAD_ERR_OK) {
        $lqValidation = validateUploadedFile($_FILES['ar_marker_file_lq'], ['application/octet-stream', 'application/json'], 10485760);
        if ($lqValidation['valid']) {
            $hasLQ = true;
        } else {
            logAdminActivity('UPLOAD_WARNING', 'LQ marker file validation failed: ' . $lqValidation['message']);
        }
    }
    
    // Upload files
    try {
        $id = generateUUID();
        $jpegFile = $_FILES['jpeg'];
        $pdfMediumFile = $_FILES['pdfMedium'];
        $pdfLargeFile = $_FILES['pdfLarge'];
        
        $jpegFilename = $id . '_' . basename($jpegFile['name']);
        $pdfMediumFilename = $id . '_medium.pdf';
        $pdfLargeFilename = $id . '_large.pdf';
        $thumbnailFilename = 'thumb_' . $jpegFilename;
        
        if (!move_uploaded_file($jpegFile['tmp_name'], UPLOADS_DIR . '/' . $jpegFilename)) {
            throw new Exception('JPEG bestand kon niet worden geplaatst');
        }
        if (!move_uploaded_file($pdfMediumFile['tmp_name'], UPLOADS_DIR . '/' . $pdfMediumFilename)) {
            throw new Exception('PDF Medium bestand kon niet worden geplaatst');
        }
        if (!move_uploaded_file($pdfLargeFile['tmp_name'], UPLOADS_DIR . '/' . $pdfLargeFilename)) {
            throw new Exception('PDF Large bestand kon niet worden geplaatst');
        }
        
        // Create thumbnail
        createThumbnail(UPLOADS_DIR . '/' . $jpegFilename, THUMBNAILS_DIR . '/' . $thumbnailFilename);
        
        // Upload .mind files (HQ and optional LQ)
        $hqFile = $_FILES['ar_marker_file_hq'];
        $hqFilename = $id . '_hq.mind';
        $hqPath = 'assets/nft/' . $id . '/' . $id . '_hq'; // Path without .mind extension
        $lqPath = null;
        
        // Create directory for .mind files
        $mindDir = __DIR__ . '/assets/nft/' . $id;
        if (!file_exists($mindDir)) {
            if (!mkdir($mindDir, 0755, true)) {
                throw new Exception('Kon directory voor .mind bestand niet aanmaken');
            }
        }
        
        // Move HQ .mind file
        if (!move_uploaded_file($hqFile['tmp_name'], $mindDir . '/' . $hqFilename)) {
            throw new Exception('HQ .mind bestand kon niet worden geplaatst. Check bestandspermissies in assets/nft/');
        }
        
        // Move LQ .mind file (optional)
        if ($hasLQ) {
            $lqFile = $_FILES['ar_marker_file_lq'];
            $lqFilename = $id . '_lq.mind';
            if (!move_uploaded_file($lqFile['tmp_name'], $mindDir . '/' . $lqFilename)) {
                throw new Exception('LQ .mind bestand kon niet worden geplaatst');
            }
            $lqPath = 'assets/nft/' . $id . '/' . $id . '_lq'; // Without .mind extension
        }
        
        // Verify HQ .mind file exists and has content
        if (!file_exists($mindDir . '/' . $hqFilename)) {
            throw new Exception('HQ .mind bestand exists check failed after upload');
        }
        $mindFileSize = filesize($mindDir . '/' . $hqFilename);
        if ($mindFileSize === 0) {
            throw new Exception('HQ .mind bestand is leeg (0 bytes)');
        }
        
        logAdminActivity('UPLOAD_SUCCESS', "Poster '$title' uploaded successfully. HQ .mind file size: " . $mindFileSize . " bytes");
        
        // Process AR Layers (8 layers)
        $layersData = [];
        for ($i = 1; $i <= 8; $i++) {
            $layerImageFile = $_FILES["layer_{$i}_image"] ?? null;
            $layerZ = $_POST["layer_{$i}_z"] ?? '0';
            $animX = $_POST["layer_{$i}_anim_x"] ?? '0';
            $animY = $_POST["layer_{$i}_anim_y"] ?? '0';
            $animZ = $_POST["layer_{$i}_anim_z"] ?? '0';
            $animDuration = $_POST["layer_{$i}_anim_duration"] ?? '0';
            $exclusion = $_POST["layer_{$i}_exclusion"] ?? '0';
            
            $layerData = [
                'z' => (float)$layerZ,
                'anim_x' => (float)$animX,
                'anim_y' => (float)$animY,
                'anim_z' => (float)$animZ,
                'anim_duration' => (int)$animDuration,
                'exclusion_filter' => (int)$exclusion === 1,
                'filename' => null
            ];
            
            // Upload layer image if provided
            if ($layerImageFile && !empty($layerImageFile['tmp_name'])) {
                $layerValidation = validateUploadedFile($layerImageFile, ['image/png'], 52428800); // 50MB
                if ($layerValidation['valid']) {
                    $layerFilename = $id . "_layer_{$i}.png";
                    if (!move_uploaded_file($layerImageFile['tmp_name'], AR_LAYERS_DIR . '/' . $layerFilename)) {
                        throw new Exception("Laag $i afbeelding kon niet worden geplaatst");
                    }
                    $layerData['filename'] = $layerFilename;
                }
            }
            
            $layersData["layer_$i"] = $layerData;
        }
    } catch (Exception $e) {
        logAdminActivity('UPLOAD_FAILED', 'File error: ' . $e->getMessage());
        jsonResponse(['message' => $e->getMessage()], 500);
    }
    
    // Save to database
    try {
        $stmt = $db->prepare("
            INSERT INTO posters (id, title, description, jpeg_filename, pdf_medium_filename, pdf_large_filename, thumbnail, latitude, longitude, location_description, artikel_link, photographer_credit, ar_marker_hq, ar_marker_lq, layers_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $result = $stmt->execute([
            $id,
            $title,
            $description,
            $jpegFilename,
            $pdfMediumFilename,
            $pdfLargeFilename,
            '/uploads/thumbnails/' . $thumbnailFilename,
            $latitude,
            $longitude,
            $locationDescription,
            $artikelLink,
            $photographerCredit,
            $hqPath, // Save the HQ marker path (without extension)
            $lqPath, // Save the LQ path (can be null)
            json_encode($layersData)
        ]);
        
        if (!$result) {
            throw new Exception('Database insert failed');
        }
        
        // Log successful upload
        $locationInfo = '';
        if ($latitude !== null && $longitude !== null) {
            $locationInfo = " at coordinates ($latitude, $longitude)";
            if ($locationDescription) {
                $locationInfo .= " ($locationDescription)";
            }
        }
        $sourceInfo = '';
        if ($artikelLink) {
            $sourceInfo .= " | Article: $artikelLink";
        }
        if ($photographerCredit) {
            $sourceInfo .= " | Photo credit: $photographerCredit";
        }
        logAdminActivity('UPLOAD_SUCCESS', "$title$locationInfo$sourceInfo");
        
        // Get the poster
        $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
        $stmt->execute([$id]);
        $poster = $stmt->fetch(PDO::FETCH_ASSOC);
        
        jsonResponse(['success' => true, 'poster' => $poster]);
    } catch (Exception $e) {
        logAdminActivity('UPLOAD_FAILED', 'Database error: ' . $e->getMessage());
        jsonResponse(['message' => 'Database fout: ' . $e->getMessage()], 500);
    }
} elseif ($method === 'DELETE' && preg_match('#^/admin/posters/([^/]+)$#', $path, $matches)) {
    // Admin delete poster
    if (!isAdmin()) {
        jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    }
    
    $id = $matches[1];
    $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt->execute([$id]);
    $poster = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$poster) {
        jsonResponse(['message' => 'Poster niet gevonden'], 404);
    }
    
    // Delete files
    @unlink(UPLOADS_DIR . '/' . $poster['jpeg_filename']);
    @unlink(UPLOADS_DIR . '/' . $poster['pdf_medium_filename']);
    @unlink(UPLOADS_DIR . '/' . $poster['pdf_large_filename']);
    @unlink(THUMBNAILS_DIR . '/' . basename($poster['thumbnail']));
    
    // Delete from database
    $db->prepare("DELETE FROM posters WHERE id = ?")->execute([$id]);
    
    logAdminActivity('DELETE_POSTER', "Poster deleted: $id");
    jsonResponse(['success' => true]);
    
} elseif ($method === 'POST' && preg_match('#^/admin/posters/([^/]+)/update$#', $path, $matches)) {
    // Admin update poster
    if (!isAdmin()) {
        logAdminActivity('UNAUTHORIZED_UPDATE_ATTEMPT', 'User not authenticated');
        jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    }
    
    $id = $matches[1];
    
    // Check if poster exists
    $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt->execute([$id]);
    $existingPoster = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$existingPoster) {
        jsonResponse(['message' => 'Poster niet gevonden'], 404);
    }
    
    // Get updated data
    $title = $_POST['title'] ?? $existingPoster['title'];
    $description = $_POST['description'] ?? '';
    $latitude = !empty($_POST['latitude']) ? (float)$_POST['latitude'] : null;
    $longitude = !empty($_POST['longitude']) ? (float)$_POST['longitude'] : null;
    $locationDescription = $_POST['location_description'] ?? '';
    $artikelLink = $_POST['artikel_link'] ?? '';
    $photographerCredit = $_POST['photographer_credit'] ?? '';
    $arMarker = $existingPoster['ar_marker']; // Keep existing .mind path
    
    // Validate coordinates if provided
    if (($latitude !== null && ($latitude < -90 || $latitude > 90)) || 
        ($longitude !== null && ($longitude < -180 || $longitude > 180))) {
        jsonResponse(['message' => 'Ongeldige coördinaten'], 400);
    }
    
    // Handle file uploads if new files are provided
    $jpegFilename = $existingPoster['jpeg_filename'];
    $pdfMediumFilename = $existingPoster['pdf_medium_filename'];
    $pdfLargeFilename = $existingPoster['pdf_large_filename'];
    $thumbnailPath = $existingPoster['thumbnail'];
    $arMarkerHQ = $existingPoster['ar_marker_hq'] ?? null; // Keep existing HQ if not updating
    $arMarkerLQ = $existingPoster['ar_marker_lq'] ?? null; // Keep existing LQ if not updating
    
    // Update JPEG if provided
    if (!empty($_FILES['jpeg']) && $_FILES['jpeg']['error'] === UPLOAD_ERR_OK) {
        $jpegValidation = validateUploadedFile($_FILES['jpeg'], ['image/jpeg'], 52428800);
        if (!$jpegValidation['valid']) {
            jsonResponse(['message' => 'JPEG: ' . $jpegValidation['message']], 400);
        }
        
        // Delete old file
        @unlink(UPLOADS_DIR . '/' . $existingPoster['jpeg_filename']);
        @unlink(THUMBNAILS_DIR . '/' . basename($existingPoster['thumbnail']));
        
        // Upload new file
        $jpegFilename = uniqid() . '.jpg';
        move_uploaded_file($_FILES['jpeg']['tmp_name'], UPLOADS_DIR . '/' . $jpegFilename);
        
        // Generate new thumbnail
        $thumbnailFilename = 'thumb_' . $jpegFilename;
        createThumbnail(UPLOADS_DIR . '/' . $jpegFilename, THUMBNAILS_DIR . '/' . $thumbnailFilename);
        $thumbnailPath = '/uploads/thumbnails/' . $thumbnailFilename;
    }
    
    // Update PDF Medium if provided
    if (!empty($_FILES['pdfMedium']) && $_FILES['pdfMedium']['error'] === UPLOAD_ERR_OK) {
        $pdfValidation = validateUploadedFile($_FILES['pdfMedium'], ['application/pdf'], 104857600);
        if (!$pdfValidation['valid']) {
            jsonResponse(['message' => 'PDF Medium: ' . $pdfValidation['message']], 400);
        }
        
        @unlink(UPLOADS_DIR . '/' . $existingPoster['pdf_medium_filename']);
        $pdfMediumFilename = uniqid() . '.pdf';
        move_uploaded_file($_FILES['pdfMedium']['tmp_name'], UPLOADS_DIR . '/' . $pdfMediumFilename);
    }
    
    // Update PDF Large if provided
    if (!empty($_FILES['pdfLarge']) && $_FILES['pdfLarge']['error'] === UPLOAD_ERR_OK) {
        $pdfValidation = validateUploadedFile($_FILES['pdfLarge'], ['application/pdf'], 104857600);
        if (!$pdfValidation['valid']) {
            jsonResponse(['message' => 'PDF Large: ' . $pdfValidation['message']], 400);
        }
        
        @unlink(UPLOADS_DIR . '/' . $existingPoster['pdf_large_filename']);
        $pdfLargeFilename = uniqid() . '.pdf';
        move_uploaded_file($_FILES['pdfLarge']['tmp_name'], UPLOADS_DIR . '/' . $pdfLargeFilename);
    }
    
    // Update .mind file if provided
    if (!empty($_FILES['ar_marker_file']) && $_FILES['ar_marker_file']['error'] === UPLOAD_ERR_OK) {
        $mindValidation = validateUploadedFile($_FILES['ar_marker_file'], ['application/octet-stream', 'application/json'], 10485760);
        if (!$mindValidation['valid']) {
            jsonResponse(['message' => '.mind bestand: ' . $mindValidation['message']], 400);
        }
        
        // Create directory if it doesn't exist
        $mindDir = __DIR__ . '/assets/nft/' . $id;
        if (!file_exists($mindDir)) {
            mkdir($mindDir, 0755, true);
        }
        
        // Upload new HQ .mind file
        $hqFile = $_FILES['ar_marker_file_hq'];
        $hqFilename = $id . '_hq.mind';
        $hqPath = 'assets/nft/' . $id . '/' . $id . '_hq';
        move_uploaded_file($hqFile['tmp_name'], $mindDir . '/' . $hqFilename);
        $arMarkerHQ = $hqPath;
    }
    
    // Update LQ .mind file if provided
    if (!empty($_FILES['ar_marker_file_lq']) && $_FILES['ar_marker_file_lq']['error'] === UPLOAD_ERR_OK) {
        $lqValidation = validateUploadedFile($_FILES['ar_marker_file_lq'], ['application/octet-stream', 'application/json'], 10485760);
        if (!$lqValidation['valid']) {
            jsonResponse(['message' => 'LQ marker bestand: ' . $lqValidation['message']], 400);
        }
        
        // Create directory if it doesn't exist
        $mindDir = __DIR__ . '/assets/nft/' . $id;
        if (!file_exists($mindDir)) {
            mkdir($mindDir, 0755, true);
        }
        
        // Upload new LQ .mind file
        $lqFile = $_FILES['ar_marker_file_lq'];
        $lqFilename = $id . '_lq.mind';
        $lqPath = 'assets/nft/' . $id . '/' . $id . '_lq';
        move_uploaded_file($lqFile['tmp_name'], $mindDir . '/' . $lqFilename);
        $arMarkerLQ = $lqPath;
    }
    
    // Process AR Layers (8 layers)
    // Get existing layers data or initialize empty
    $layersData = !empty($existingPoster['layers_data']) ? json_decode($existingPoster['layers_data'], true) : [];
    
    for ($i = 1; $i <= 8; $i++) {
        $layerImageFile = $_FILES["layer_{$i}_image"] ?? null;
        $layerZ = $_POST["layer_{$i}_z"] ?? null;
        $animX = $_POST["layer_{$i}_anim_x"] ?? null;
        $animY = $_POST["layer_{$i}_anim_y"] ?? null;
        $animZ = $_POST["layer_{$i}_anim_z"] ?? null;
        $animDuration = $_POST["layer_{$i}_anim_duration"] ?? null;
        $exclusion = $_POST["layer_{$i}_exclusion"] ?? '0';
        
        // Initialize layer if not exists
        if (!isset($layersData["layer_$i"])) {
            $layersData["layer_$i"] = [
                'z' => 0,
                'anim_x' => 0,
                'anim_y' => 0,
                'anim_z' => 0,
                'anim_duration' => 0,
                'exclusion_filter' => false,
                'filename' => null
            ];
        }
        
        // Update configuration if provided
        if ($layerZ !== null) $layersData["layer_$i"]['z'] = (float)$layerZ;
        if ($animX !== null) $layersData["layer_$i"]['anim_x'] = (float)$animX;
        if ($animY !== null) $layersData["layer_$i"]['anim_y'] = (float)$animY;
        if ($animZ !== null) $layersData["layer_$i"]['anim_z'] = (float)$animZ;
        if ($animDuration !== null) $layersData["layer_$i"]['anim_duration'] = (int)$animDuration;
        $layersData["layer_$i"]['exclusion_filter'] = (int)$exclusion === 1;
        
        // Upload new layer image if provided
        if ($layerImageFile && !empty($layerImageFile['tmp_name'])) {
            $layerValidation = validateUploadedFile($layerImageFile, ['image/png'], 52428800); // 50MB
            if ($layerValidation['valid']) {
                // Delete old layer file if exists
                if (!empty($layersData["layer_$i"]['filename'])) {
                    @unlink(AR_LAYERS_DIR . '/' . $layersData["layer_$i"]['filename']);
                }
                
                // Upload new file
                $layerFilename = $id . "_layer_{$i}.png";
                move_uploaded_file($layerImageFile['tmp_name'], AR_LAYERS_DIR . '/' . $layerFilename);
                $layersData["layer_$i"]['filename'] = $layerFilename;
            }
        }
    }
    
    // Update database
    // First, check if ar_marker_hq column exists and add it if not
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN ar_marker_hq TEXT");
    } catch (PDOException $e) {
        // Column already exists, continue
    }

    // Check if ar_marker_lq column exists and add it if not
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN ar_marker_lq TEXT");
    } catch (PDOException $e) {
        // Column already exists, continue
    }
    
    $stmt = $db->prepare("
        UPDATE posters 
        SET title = ?, description = ?, jpeg_filename = ?, pdf_medium_filename = ?, 
            pdf_large_filename = ?, thumbnail = ?, latitude = ?, longitude = ?, 
            location_description = ?, artikel_link = ?, photographer_credit = ?, ar_marker_hq = ?, ar_marker_lq = ?, layers_data = ?
        WHERE id = ?
    ");
    
    try {
        $stmt->execute([
            $title,
            $description,
            $jpegFilename,
            $pdfMediumFilename,
            $pdfLargeFilename,
            $thumbnailPath,
            $latitude,
            $longitude,
            $locationDescription,
            $artikelLink,
            $photographerCredit,
            $arMarkerHQ,
            $arMarkerLQ,
            json_encode($layersData),
            $id
        ]);
    } catch (PDOException $e) {
        error_log("Update poster failed: " . $e->getMessage());
        jsonResponse(['message' => 'Database update mislukt: ' . $e->getMessage()], 500);
    }
    
    logAdminActivity('UPDATE_POSTER', "Updated poster: $title (ID: $id)");
    
    // Return updated poster
    $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt->execute([$id]);
    $updatedPoster = $stmt->fetch(PDO::FETCH_ASSOC);
    
    jsonResponse(['success' => true, 'poster' => $updatedPoster]);
    
} elseif ($method === 'POST' && $path === '/admin/logout') {
    // Admin logout
    session_destroy();
    jsonResponse(['message' => 'Uitgelogd']);
    
} else {
    jsonResponse(['message' => 'Endpoint niet gevonden'], 404);
}

// Helper functie voor thumbnail generatie
function createThumbnail($source, $dest, $width = 400, $height = 566) {
    list($sourceWidth, $sourceHeight, $sourceType) = getimagesize($source);
    
    switch ($sourceType) {
        case IMAGETYPE_JPEG:
            $sourceImage = imagecreatefromjpeg($source);
            break;
        case IMAGETYPE_PNG:
            $sourceImage = imagecreatefrompng($source);
            break;
        default:
            return false;
    }
    
    $thumb = imagecreatetruecolor($width, $height);
    imagecopyresampled($thumb, $sourceImage, 0, 0, 0, 0, $width, $height, $sourceWidth, $sourceHeight);
    
    imagejpeg($thumb, $dest, 85);
    imagedestroy($sourceImage);
    imagedestroy($thumb);
    
    return true;
}

// File upload security validation
function validateUploadedFile($file, $allowedTypes, $maxSize = 10485760) { // 10MB default
    // Check if file was uploaded without errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['valid' => false, 'message' => 'Bestand upload fout'];
    }
    
    // Check file size
    if ($file['size'] > $maxSize) {
        return ['valid' => false, 'message' => 'Bestand te groot (max 10MB)'];
    }
    
    // Check MIME type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedTypes)) {
        return ['valid' => false, 'message' => 'Bestandstype niet toegestaan'];
    }
    
    // Additional check for images
    if (strpos($mimeType, 'image/') === 0) {
        $imageInfo = getimagesize($file['tmp_name']);
        if ($imageInfo === false) {
            return ['valid' => false, 'message' => 'Beschadigd afbeeldingsbestand'];
        }
    }
    
    // Check for PHP code in uploaded files (basic security)
    // Skip this check for binary files (.mind files, octet-stream) as they can contain
    // byte sequences that coincidentally match PHP tags without being executable
    // Only check for actual text-based JSON that might contain PHP code
    if ($mimeType === 'application/json') {
        $content = file_get_contents($file['tmp_name']);
        // Check for PHP opening tags at the start of the file
        if (preg_match('/^\s*<\?php/', $content)) {
            return ['valid' => false, 'message' => 'Verdacht bestand gedetecteerd'];
        }
    }
    
    return ['valid' => true, 'message' => 'Bestand geldig'];
}

// Log admin activities for security monitoring
function logAdminActivity($action, $details = '') {
    $logFile = __DIR__ . '/admin_activity.log';
    $timestamp = date('Y-m-d H:i:s');
    $ip = getClientIP();
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
    
    $logEntry = "[{$timestamp}] IP: {$ip} | Action: {$action} | Details: {$details} | User-Agent: {$userAgent}" . PHP_EOL;
    
    error_log($logEntry, 3, $logFile);
}

// If no route matched, return 404
jsonResponse([
    'message' => 'Endpoint niet gevonden',
    'requested_path' => $path,
    'method' => $method
], 404);
