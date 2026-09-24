<?php
// api.php - REST API voor de Krant AR spinoff

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

set_exception_handler(function ($exception) {
    error_log('Exception: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['message' => 'Server error']);
    exit;
});

// Session (secure cookie enkel op HTTPS, zodat lokaal testen werkt)
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', 1);
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    ini_set('session.cookie_secure', 1);
}
session_start();

require_once 'includes/config.php';
require_once 'includes/security.php';
require_once 'includes/api_utils.php';

header('Content-Type: application/json; charset=utf-8');

if (rand(1, 100) === 1) cleanupOldAttempts();

$db = initDatabase();
$method = $_SERVER['REQUEST_METHOD'];

// Path parsing (/essays/current, /admin/essays, ...)
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

// OPTIONS preflight (CORS)
if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit(0);
}

// ---- Publieke endpoints ----

if ($method === 'GET' && $path === '/essays/current') {
    $stmt = $db->prepare("SELECT * FROM essays WHERE published = 1 ORDER BY updated_at DESC LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();
    if (!$row) {
        jsonResponse(['message' => 'Nog geen essay gepubliceerd'], 404);
    }
    jsonResponse(essayToApi($row));
}

// ---- Admin: login/logout/status ----

if ($method === 'POST' && $path === '/admin/login') {
    $ip = getClientIP();
    if (isRateLimited($ip)) {
        jsonResponse(['message' => 'Te veel pogingen. Probeer opnieuw over 15 minuten.'], 429);
    }
    $input = getJsonInput();
    $password = (string)($input['password'] ?? '');

    $hash = getAdminHash($db);
    if (!$hash) {
        jsonResponse(['message' => 'Nog geen wachtwoord ingesteld.', 'needs_setup' => true], 409);
    }

    if ($password !== '' && verifyPassword($password, $hash)) {
        clearLoginAttempts($ip);
        session_regenerate_id(true);
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['last_activity'] = time();
        jsonResponse(['ok' => true]);
    }
    recordFailedAttempt($ip);
    jsonResponse(['message' => 'Fout wachtwoord'], 401);
}

// First-run setup: werkt enkel zolang er nog geen wachtwoord is ingesteld
if ($method === 'POST' && $path === '/admin/setup') {
    if (getAdminHash($db)) {
        jsonResponse(['message' => 'Wachtwoord is al ingesteld'], 409);
    }
    $input = getJsonInput();
    $password = (string)($input['password'] ?? '');
    if (strlen($password) < 8) {
        jsonResponse(['message' => 'Wachtwoord moet minstens 8 tekens bevatten'], 400);
    }
    setAdminHash($db, password_hash($password, PASSWORD_BCRYPT));
    session_regenerate_id(true);
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['last_activity'] = time();
    jsonResponse(['ok' => true]);
}

// Wachtwoord wijzigen (admin)
if ($method === 'POST' && $path === '/admin/password') {
    requireAuth();
    $input = getJsonInput();
    $current = (string)($input['current'] ?? '');
    $new = (string)($input['new'] ?? '');

    $hash = getAdminHash($db);
    if (!$hash || !verifyPassword($current, $hash)) {
        jsonResponse(['message' => 'Huidig wachtwoord is fout'], 401);
    }
    if (strlen($new) < 8) {
        jsonResponse(['message' => 'Nieuw wachtwoord moet minstens 8 tekens bevatten'], 400);
    }
    setAdminHash($db, password_hash($new, PASSWORD_BCRYPT));
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && $path === '/admin/logout') {
    $_SESSION = [];
    session_destroy();
    jsonResponse(['ok' => true]);
}

if ($method === 'GET' && $path === '/admin/status') {
    jsonResponse([
        'logged_in' => isValidSession(),
        'needs_setup' => getAdminHash($db) === null,
    ]);
}

// ---- Admin: essays beheren ----

if ($method === 'GET' && $path === '/admin/essays') {
    requireAuth();
    $rows = $db->query("SELECT week, title, published, updated_at FROM essays ORDER BY updated_at DESC")->fetchAll();
    jsonResponse(['essays' => $rows]);
}

if ($method === 'GET' && preg_match('#^/admin/essays/([^/]+)$#', $path, $m)) {
    requireAuth();
    $week = sanitizeWeek($m[1]);
    $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
    $stmt->execute([$week]);
    $row = $stmt->fetch();
    if (!$row) {
        jsonResponse(['message' => 'Essay niet gevonden'], 404);
    }
    jsonResponse(['essay' => essayToApi($row)]);
}

if ($method === 'POST' && $path === '/admin/essays') {
    requireAuth();

    $week = sanitizeWeek((string)($_POST['week'] ?? ''));
    if (!isset($_POST['title']) || trim((string)$_POST['title']) === '') {
        jsonResponse(['message' => 'Titel is verplicht'], 400);
    }

    $title = trim((string)$_POST['title']);
    $text = (string)($_POST['text'] ?? '');
    $published = isset($_POST['published']) && $_POST['published'] === '1' ? 1 : 0;

    // Bestaande rij ophalen (upsert)
    $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
    $stmt->execute([$week]);
    $existing = $stmt->fetch();

    $pageImage = $existing ? $existing['page_image'] : '';
    $mindFile  = $existing ? $existing['mind_file'] : '';
    $layers    = $existing ? json_decode((string)$existing['layers'], true) : [];
    if (!is_array($layers)) $layers = [];

    $weekDir = ESSAYS_DIR . '/' . $week;
    if (!file_exists($weekDir)) {
        mkdir($weekDir, 0755, true);
    }

    // Pagina-afbeelding (bron van de marker)
    if (!empty($_FILES['page_image']['name'])) {
        $ext = fileExt($_FILES['page_image']['name']);
        if (!in_array($ext, ALLOWED_PAGE_EXT, true)) {
            jsonResponse(['message' => 'Ongeldig type voor pagina-afbeelding'], 400);
        }
        $pageImage = 'page.' . $ext;
        move_uploaded_file($_FILES['page_image']['tmp_name'], $weekDir . '/' . $pageImage);
    }

    // Gecompileerd .mind marker bestand
    if (!empty($_FILES['mind_file']['name'])) {
        $ext = fileExt($_FILES['mind_file']['name']);
        if (!in_array($ext, ALLOWED_MIND_EXT, true)) {
            jsonResponse(['message' => 'Marker moet een .mind bestand zijn'], 400);
        }
        $mindFile = 'target.mind';
        move_uploaded_file($_FILES['mind_file']['tmp_name'], $weekDir . '/' . $mindFile);
    }

    // AR-layers (transparante PNG's boven de pagina)
    $layerFiles = isset($_FILES['layers']) && is_array($_FILES['layers']['name']) ? $_FILES['layers']['name'] : [];
    if (!empty($layerFiles[0])) {
        $layers = [];
        foreach ($layerFiles as $i => $name) {
            if (!$name) continue;
            $ext = fileExt($name);
            if (!in_array($ext, ALLOWED_LAYER_EXT, true)) {
                jsonResponse(['message' => 'Ongeldig type voor layer ' . ($i + 1)], 400);
            }
            $filename = 'layer_' . $i . '.' . $ext;
            move_uploaded_file($_FILES['layers']['tmp_name'][$i], $weekDir . '/' . $filename);

            $layers[] = [
                'file'      => $filename,
                'z'         => (float)($_POST['layer_z'][$i] ?? 0.01 + $i * 0.01),
                'w'         => (float)($_POST['layer_w'][$i] ?? 1.0),
                'h'         => (float)($_POST['layer_h'][$i] ?? 1.414),
                'anim_dur'  => (float)($_POST['layer_anim_dur'][$i] ?? 0),
                'anim_dist' => (float)($_POST['layer_anim_dist'][$i] ?? 0),
            ];
        }
    }

    $layersJson = json_encode($layers, JSON_UNESCAPED_UNICODE);

    if ($existing) {
        $db->prepare("UPDATE essays SET title = ?, text = ?, page_image = ?, mind_file = ?, layers = ?, published = ?, updated_at = CURRENT_TIMESTAMP WHERE week = ?")
           ->execute([$title, $text, $pageImage, $mindFile, $layersJson, $published, $week]);
    } else {
        $db->prepare("INSERT INTO essays (week, title, text, page_image, mind_file, layers, published) VALUES (?, ?, ?, ?, ?, ?, ?)")
           ->execute([$week, $title, $text, $pageImage, $mindFile, $layersJson, $published]);
    }

    $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
    $stmt->execute([$week]);
    jsonResponse(['ok' => true, 'essay' => essayToApi($stmt->fetch())]);
}

if ($method === 'POST' && preg_match('#^/admin/essays/([^/]+)/publish$#', $path, $m)) {
    requireAuth();
    $week = sanitizeWeek($m[1]);
    $input = getJsonInput();
    $published = !empty($input['published']) ? 1 : 0;

    $stmt = $db->prepare("UPDATE essays SET published = ?, updated_at = CURRENT_TIMESTAMP WHERE week = ?");
    $stmt->execute([$published, $week]);
    if ($stmt->rowCount() === 0) {
        jsonResponse(['message' => 'Essay niet gevonden'], 404);
    }
    jsonResponse(['ok' => true, 'published' => $published]);
}

if ($method === 'DELETE' && preg_match('#^/admin/essays/([^/]+)$#', $path, $m)) {
    requireAuth();
    $week = sanitizeWeek($m[1]);

    $stmt = $db->prepare("DELETE FROM essays WHERE week = ?");
    $stmt->execute([$week]);

    // Bestanden opruimen
    $weekDir = ESSAYS_DIR . '/' . $week;
    if (file_exists($weekDir)) {
        $files = glob($weekDir . '/*');
        foreach ($files as $file) {
            if (is_file($file)) unlink($file);
        }
        @rmdir($weekDir);
    }

    jsonResponse(['ok' => true]);
}

// Onbekende route
jsonResponse(['message' => 'Onbekend endpoint'], 404);
