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
    $stmt = $db->prepare("SELECT * FROM essays WHERE published = 1 ORDER BY week DESC, updated_at DESC LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();
    if (!$row) {
        jsonResponse(['message' => 'Nog geen essay gepubliceerd'], 404);
    }
    $row = ensureTarget8w($db, $row);
    jsonResponse(essayToApi($row));
}

// Vorige essays: alle gepubliceerde essays behalve de nieuwste (huidige).
// Met 8th Wall staan alle targets tegelijk geregistreerd; er is geen
// gecombineerde .mind-bundel meer nodig.
if ($method === 'GET' && $path === '/essays/previous') {
    $cur = $db->query("SELECT week FROM essays WHERE published = 1 ORDER BY updated_at DESC LIMIT 1")->fetch();
    $currentWeek = $cur ? $cur['week'] : null;

    $rows = $db->query("SELECT * FROM essays WHERE published = 1 ORDER BY updated_at DESC")->fetchAll();

    $essays = [];
    foreach ($rows as $row) {
        if ($currentWeek !== null && $row['week'] === $currentWeek) continue;
        $row = ensureTarget8w($db, $row);

        $base = 'uploads/essays/' . rawurlencode($row['week']) . '/';
        $v = '?v=' . urlencode((string)$row['updated_at']);
        $layers = json_decode((string)$row['layers'], true);
        $layerList = [];
        if (is_array($layers)) {
            $weekDir = ESSAYS_DIR . '/' . $row['week'];
            foreach ($layers as $layer) {
                $entry = layerToApi($layer, $base, $v, $weekDir);
                if ($entry) $layerList[] = $entry;
            }
        }

        $essays[] = [
            'week'        => $row['week'],
            'title'       => $row['title'],
            'target8w'    => target8wToApi($row, 'uploads/essays/' . rawurlencode($row['week']) . '/', '?v=' . urlencode((string)$row['updated_at'])),
            'layers'      => $layerList,
        ];
    }

    jsonResponse(['essays' => $essays]);
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
    $text = ''; // essay-tekst wordt niet meer gebruikt: de pagina-afbeelding IS de tekst
    $published = isset($_POST['published']) && $_POST['published'] === '1' ? 1 : 0;

    // Bestaande rij ophalen (upsert)
    $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
    $stmt->execute([$week]);
    $existing = $stmt->fetch();

    $pageImage = $existing ? $existing['page_image'] : '';
    // mind_file-kolom blijft bestaan (oude data), maar er kan niets meer
    // geüpload worden — AR draait volledig op 8th Wall targets.
    $mindFile  = $existing ? $existing['mind_file'] : '';
    $target8wJson = $existing ? ($existing['target8w_json'] ?? '') : '';
    $target8wImage = $existing ? ($existing['target8w_image'] ?? '') : '';
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

        // 8th Wall target automatisch genereren (zoals vroeger: enkel JPG nodig)
        if (autogenerateTarget8w($weekDir, $week, $pageImage)) {
            $target8wJson = 'target8w.json';
            $target8wImage = 'target8w.jpg';
        }
    }

    // 8th Wall target (JSON + luminantie-afbeelding, gegenereerd met image-target-cli)
    if (!empty($_FILES['target8w_json']['name'])) {
        $ext = fileExt($_FILES['target8w_json']['name']);
        if ($ext !== 'json') {
            jsonResponse(['message' => 'Target moet een .json bestand zijn'], 400);
        }
        $target8wJson = 'target8w.json';
        move_uploaded_file($_FILES['target8w_json']['tmp_name'], $weekDir . '/' . $target8wJson);
    }
    if (!empty($_FILES['target8w_image']['name'])) {
        $ext = fileExt($_FILES['target8w_image']['name']);
        if (!in_array($ext, ['jpg', 'jpeg', 'png'], true)) {
            jsonResponse(['message' => 'Target-afbeelding moet jpg of png zijn'], 400);
        }
        $target8wImage = 'target8w.' . $ext;
        move_uploaded_file($_FILES['target8w_image']['tmp_name'], $weekDir . '/' . $target8wImage);
    }

    // AR-layers: elke rij stuurt zijn params mee; alleen bij een nieuw
    // bestand zit er een upload bij (layer_has_file=1). Zonder nieuw
    // bestand blijft de bestaande laag behouden met de nieuwe params —
    // opslaan wist dus nooit meer stilletjes je lagen.
    $rowXs = isset($_POST['layer_x']) && is_array($_POST['layer_x']) ? $_POST['layer_x'] : null;
    if (is_array($rowXs)) {
        $upNames = isset($_FILES['layers']) && is_array($_FILES['layers']['name']) ? $_FILES['layers']['name'] : [];
        $upTmps  = isset($_FILES['layers']) && is_array($_FILES['layers']['tmp_name']) ? $_FILES['layers']['tmp_name'] : [];
        $upSizes = isset($_FILES['layers']) && is_array($_FILES['layers']['size']) ? $_FILES['layers']['size'] : [];
        $fi = 0;
        $oldByFile = [];
        foreach ($layers as $old) {
            if (!empty($old['file'])) $oldByFile[$old['file']] = $old;
        }
        $layers = [];
        $nRows = count($rowXs);
        for ($i = 0; $i < $nRows; $i++) {
            $p = function ($k, $def = 0) use ($i) {
                return isset($_POST[$k]) && is_array($_POST[$k]) && isset($_POST[$k][$i]) ? $_POST[$k][$i] : $def;
            };
            $hasFile = (($p('layer_has_file', '0') === '1') && isset($upNames[$fi]) && $upNames[$fi]) ? true : false;

            if ($hasFile) {
                $ext = fileExt($upNames[$fi]);
                if (!in_array($ext, ALLOWED_LAYER_EXT, true)) {
                    jsonResponse(['message' => 'Ongeldig type voor layer ' . ($i + 1)], 400);
                }
                if ($ext === 'glb' && ($upSizes[$fi] ?? 0) > MAX_GLB_SIZE) {
                    jsonResponse(['message' => '3D-model (laag ' . ($i + 1) . ') mag max. 10MB zijn'], 400);
                }
                $filename = 'layer_' . $i . '.' . $ext;
                move_uploaded_file($upTmps[$fi], $weekDir . '/' . $filename);
                // Snelheid > pixels: grote lagen direct verkleinen (foto's
                // max 1600px, GIF's max 800px met behoud van animatie).
                if (in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)) {
                    downscaleLayerImage($weekDir . '/' . $filename, 1600);
                } elseif ($ext === 'gif') {
                    downscaleLayerGif($weekDir . '/' . $filename, 800);
                }
                $fi++;
                // Oud bestand met andere extensie opruimen
                $prevKept = basename((string)$p('layer_existing', ''));
                if ($prevKept !== '' && $prevKept !== $filename && strpos($prevKept, 'layer_') === 0) {
                    @unlink($weekDir . '/' . $prevKept);
                }
            } else {
                $filename = basename((string)$p('layer_existing', ''));
                if ($filename === '' || !isset($oldByFile[$filename]) || !file_exists($weekDir . '/' . $filename)) {
                    continue; // geen nieuw bestand én geen behoudenswaardige laag
                }
            }

            $layers[] = [
                'file'      => $filename,
                'x'         => (float)$p('layer_x', 0),
                'y'         => (float)$p('layer_y', 0),
                'z'         => (float)$p('layer_z', 0.01 + $i * 0.01),
                'w'         => (float)$p('layer_w', 1.0),
                'h'         => (float)$p('layer_h', 1.0),
                'opacity'   => min(1.0, max(0.0, (float)$p('layer_opacity', 1.0))),
                'rx'        => (float)$p('layer_rx', 0),
                'ry'        => (float)$p('layer_ry', 0),
                'rz'        => (float)$p('layer_rz', 0),
                'scale'     => max(0.001, (float)$p('layer_scale', 1.0)),
                'lit'       => ($p('layer_lit', '0') === '1') ? 1 : 0,
                'anim_dur'  => (float)$p('layer_anim_dur', 0),
                'anim_x'    => (float)$p('layer_anim_x', 0),
                'anim_y'    => (float)$p('layer_anim_y', 0),
                'anim_z'    => (float)$p('layer_anim_z', 0),
            ];
        }
    }

    $layersJson = json_encode($layers, JSON_UNESCAPED_UNICODE);

    if ($existing) {
        $db->prepare("UPDATE essays SET title = ?, text = ?, page_image = ?, mind_file = ?, target8w_json = ?, target8w_image = ?, layers = ?, published = ?, updated_at = CURRENT_TIMESTAMP WHERE week = ?")
           ->execute([$title, $text, $pageImage, $mindFile, $target8wJson, $target8wImage, $layersJson, $published, $week]);
    } else {
        $db->prepare("INSERT INTO essays (week, title, text, page_image, mind_file, target8w_json, target8w_image, layers, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
           ->execute([$week, $title, $text, $pageImage, $mindFile, $target8wJson, $target8wImage, $layersJson, $published]);
    }

    $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
    $stmt->execute([$week]);
    jsonResponse(['ok' => true, 'essay' => essayToApi($stmt->fetch())]);
}

// Alleen de laag-instellingen opslaan (positioneer-tool; geen bestandsupload)
if ($method === 'POST' && preg_match('#^/admin/essays/([^/]+)/layers$#', $path, $m)) {
    requireAuth();
    $week = sanitizeWeek($m[1]);

    $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
    $stmt->execute([$week]);
    $existing = $stmt->fetch();
    if (!$existing) {
        jsonResponse(['message' => 'Essay niet gevonden'], 404);
    }

    $input = getJsonInput();
    $inLayers = isset($input['layers']) && is_array($input['layers']) ? $input['layers'] : [];
    $weekDir = ESSAYS_DIR . '/' . $week;

    $layers = [];
    foreach ($inLayers as $in) {
        if (!is_array($in) || empty($in['file'])) continue;
        // Alleen bestaande bestanden in de eigen week-map (geen paden)
        $file = basename((string)$in['file']);
        if ($file !== (string)$in['file'] || !file_exists($weekDir . '/' . $file)) continue;

        $num = function ($v, $def, $min = null, $max = null) {
            $f = is_numeric($v) ? (float)$v : (float)$def;
            if ($min !== null) $f = max($min, $f);
            if ($max !== null) $f = min($max, $f);
            return $f;
        };

        $layers[] = [
            'file'      => $file,
            'x'         => $num($in['x'] ?? null, 0),
            'y'         => $num($in['y'] ?? null, 0),
            'z'         => $num($in['z'] ?? null, 0.01, -10, 10),
            'w'         => $num($in['w'] ?? null, 1.0, 0.01, 10),
            'h'         => $num($in['h'] ?? null, 1.414, 0.01, 10),
            'opacity'   => $num($in['opacity'] ?? null, 1.0, 0, 1),
            'rx'        => $num($in['rx'] ?? null, 0, -360, 360),
            'ry'        => $num($in['ry'] ?? null, 0, -360, 360),
            'rz'        => $num($in['rz'] ?? null, 0, -360, 360),
            'scale'     => $num($in['scale'] ?? null, 1.0, 0.001, 100),
            'lit'       => !empty($in['lit']) ? 1 : 0,
            'anim_dur'  => $num($in['anim_dur'] ?? null, 0, 0, 600),
            'anim_x'    => $num($in['anim_x'] ?? null, 0, -10, 10),
            'anim_y'    => $num($in['anim_y'] ?? null, 0, -10, 10),
            'anim_z'    => $num($in['anim_z'] ?? null, 0, -10, 10),
        ];
    }

    $layersJson = json_encode($layers, JSON_UNESCAPED_UNICODE);
    $db->prepare("UPDATE essays SET layers = ?, updated_at = CURRENT_TIMESTAMP WHERE week = ?")
       ->execute([$layersJson, $week]);

    $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
    $stmt->execute([$week]);
    jsonResponse(['ok' => true, 'essay' => essayToApi($stmt->fetch())]);
}

if ($method === 'POST' && preg_match('#^/admin/essays/([^/]+)/publish$#', $path, $m)) {    requireAuth();
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

// Alles wissen (frisse start): alle essays + alle bestanden
if ($method === 'DELETE' && $path === '/admin/essays') {
    requireAuth();

    $db->exec("DELETE FROM essays");

    foreach ([ESSAYS_DIR] as $dir) {
        if (!file_exists($dir)) continue;
        $entries = glob($dir . '/*');
        foreach ($entries as $entry) {
            if (is_dir($entry)) {
                $files = glob($entry . '/*');
                foreach ($files as $file) {
                    if (is_file($file)) unlink($file);
                }
                @rmdir($entry);
            } elseif (is_file($entry)) {
                unlink($entry);
            }
        }
    }

    jsonResponse(['ok' => true, 'wiped' => true]);
}

// ---- Dev-feedback (van het dev-paneel; geen auth, klein en gelimiteerd) ----

if ($method === 'POST' && $path === '/dev/feedback') {
    $input = getJsonInput();
    $entry = [
        't'        => date('c'),
        'rating'   => substr((string)($input['rating'] ?? ''), 0, 40),
        'text'     => substr((string)($input['text'] ?? ''), 0, 500),
        'pos'      => isset($input['pos']) && is_numeric($input['pos']) ? (int)$input['pos'] : null,
        'vote'     => substr((string)($input['vote'] ?? ''), 0, 10),
        'vsPos'    => isset($input['vsPos']) && is_numeric($input['vsPos']) ? (int)$input['vsPos'] : null,
        'settings' => $input['settings'] ?? null,
        'stats'    => $input['stats'] ?? null,
        'ua'       => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200),
    ];
    $file = dirname(DB_FILE) . '/feedback.json';
    $list = file_exists($file) ? (json_decode((string)file_get_contents($file), true) ?: []) : [];
    $list[] = $entry;
    if (count($list) > 500) $list = array_slice($list, -500);
    file_put_contents($file, json_encode($list, JSON_UNESCAPED_UNICODE), LOCK_EX);
    jsonResponse(['ok' => true, 'count' => count($list)]);
}

if ($method === 'GET' && $path === '/dev/feedback') {
    $file = dirname(DB_FILE) . '/feedback.json';
    $list = file_exists($file) ? (json_decode((string)file_get_contents($file), true) ?: []) : [];
    jsonResponse(['feedback' => $list]);
}

// Onbekende route
jsonResponse(['message' => 'Onbekend endpoint'], 404);
