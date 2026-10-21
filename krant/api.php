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
require_once 'includes/stats_controller.php';

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
    try {
        $db->prepare("UPDATE essays SET views = COALESCE(views, 0) + 1 WHERE week = ?")->execute([$row['week']]);
        $row['views'] = (int)($row['views'] ?? 0) + 1;
    } catch (Exception $e) {}
    $row = ensureTarget8w($db, $row);
    jsonResponse(essayToApi($row));
}

if ($method === 'POST' && preg_match('#^/essays/([^/]+)/scan$#', $path, $m)) {
    $week = sanitizeWeek($m[1]);
    try {
        $stmt = $db->prepare("UPDATE essays SET scans = COALESCE(scans, 0) + 1 WHERE week = ?");
        $stmt->execute([$week]);
    } catch (Exception $e) {}
    jsonResponse(['ok' => true]);
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
    $current = (string)($input['current'] ?? ($input['currentPassword'] ?? ''));
    $new = (string)($input['new'] ?? ($input['newPassword'] ?? ''));

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

if ($method === 'GET' && ($path === '/admin/status' || $path === '/admin/state')) {
    $loggedIn = isValidSession();
    $needsSetup = getAdminHash($db) === null;
    jsonResponse([
        'logged_in'     => $loggedIn,
        'authenticated' => $loggedIn,
        'needs_setup'   => $needsSetup,
        'setupComplete' => !$needsSetup,
    ]);
}

// ---- Admin: essays beheren ----

if ($method === 'GET' && $path === '/admin/essays') {
    requireAuth();
    $rows = $db->query("SELECT * FROM essays ORDER BY week DESC, updated_at DESC")->fetchAll();
    $essays = [];
    foreach ($rows as $r) {
        $full = essayToApi($r);
        $essays[] = [
            'week'         => $full['week'],
            'title'        => $full['title'],
            'published'    => $full['published'],
            'page_image'   => $full['page_image'],
            'page_bytes'   => $full['page_bytes'] ?? 0,
            'target8w'     => $full['target8w'],
            'has_target8w' => !empty($full['target8w']),
            'layers'       => $full['layers'],
            'layers_count' => count($full['layers']),
            'total_bytes'  => $full['total_bytes'] ?? 0,
            'scans'        => $full['scans'] ?? 0,
            'views'        => $full['views'] ?? 0,
            'updated_at'   => $full['updated_at'],
        ];
    }
    jsonResponse(['essays' => $essays]);
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
if (($method === 'DELETE' && $path === '/admin/essays') || ($method === 'POST' && $path === '/admin/wipe')) {
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

// ---- Admin: essay dupliceren naar nieuwe week ----

if ($method === 'POST' && preg_match('#^/admin/essays/([^/]+)/duplicate$#', $path, $m)) {
    requireAuth();
    $sourceWeek = sanitizeWeek($m[1]);
    $input = getJsonInput();
    $targetWeek = sanitizeWeek((string)($input['to_week'] ?? ($input['target_week'] ?? '')));
    $newTitle = trim((string)($input['title'] ?? ''));

    if ($sourceWeek === $targetWeek) {
        jsonResponse(['message' => 'Kies een andere doel-week om naar te dupliceren'], 400);
    }

    $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
    $stmt->execute([$sourceWeek]);
    $src = $stmt->fetch();
    if (!$src) {
        jsonResponse(['message' => 'Bron-essay niet gevonden'], 404);
    }

    $check = $db->prepare("SELECT week FROM essays WHERE week = ?");
    $check->execute([$targetWeek]);
    if ($check->fetch()) {
        jsonResponse(['message' => 'Week ' . $targetWeek . ' bestaat al'], 409);
    }

    $srcDir = ESSAYS_DIR . '/' . $sourceWeek;
    $dstDir = ESSAYS_DIR . '/' . $targetWeek;
    if (!file_exists($dstDir)) {
        @mkdir($dstDir, 0755, true);
    }

    if (is_dir($srcDir)) {
        foreach (glob($srcDir . '/*') ?: [] as $f) {
            if (is_file($f)) {
                @copy($f, $dstDir . '/' . basename($f));
            }
        }
    }

    // Regenereer target8w.json met de nieuwe week-naam
    if (!empty($src['page_image'])) {
        autogenerateTarget8w($dstDir, $targetWeek, $src['page_image']);
    }

    $finalTitle = $newTitle !== '' ? $newTitle : ($src['title'] . ' (Kopie)');
    $db->prepare("INSERT INTO essays (week, title, text, page_image, mind_file, target8w_json, target8w_image, layers, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)")
       ->execute([
           $targetWeek,
           $finalTitle,
           $src['text'] ?? '',
           $src['page_image'] ?? '',
           $src['mind_file'] ?? '',
           $src['target8w_json'] ?? '',
           $src['target8w_image'] ?? '',
           $src['layers'] ?? '[]',
       ]);

    $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
    $stmt->execute([$targetWeek]);
    jsonResponse(['ok' => true, 'essay' => essayToApi($stmt->fetch())]);
}

// ---- Admin: 8th Wall Targets herbouwen & controleren ----

if ($method === 'POST' && $path === '/admin/rebuild-targets') {
    requireAuth();
    $rows = $db->query("SELECT * FROM essays ORDER BY week DESC")->fetchAll();
    $rebuilt = [];
    $missingPage = [];

    foreach ($rows as $r) {
        $week = $r['week'];
        $weekDir = ESSAYS_DIR . '/' . $week;
        $pageImg = $r['page_image'] ?? '';
        if ($pageImg === '' || !is_file($weekDir . '/' . basename($pageImg))) {
            $missingPage[] = ['week' => $week, 'title' => $r['title']];
            continue;
        }
        if (autogenerateTarget8w($weekDir, $week, $pageImg)) {
            $db->prepare("UPDATE essays SET target8w_json = 'target8w.json', target8w_image = 'target8w.jpg', updated_at = CURRENT_TIMESTAMP WHERE week = ?")
               ->execute([$week]);
            $rebuilt[] = $week;
        } else {
            $missingPage[] = ['week' => $week, 'title' => $r['title']];
        }
    }

    jsonResponse([
        'ok'           => true,
        'rebuilt'      => $rebuilt,
        'missing_page' => $missingPage,
        'message'      => count($rebuilt) . ' 8th Wall target(s) gegenereerd/gecontroleerd.',
    ]);
}

// ---- Admin: JSON Export van alle essays ----

if ($method === 'GET' && $path === '/admin/export/essays-json') {
    requireAuth();
    $rows = $db->query("SELECT * FROM essays ORDER BY week DESC")->fetchAll();
    $items = [];
    foreach ($rows as $r) {
        $items[] = essayToApi($r);
    }
    jsonResponse([
        'exported_at' => date('c'),
        'project'     => 'Krant AR — Interventie',
        'count'       => count($items),
        'essays'      => $items,
    ]);
}

// ---- Admin: Instellingen (Sketchfab API key etc.) ----

if ($method === 'GET' && $path === '/admin/settings') {
    requireAuth();
    $sfKey = getKrantSetting($db, 'sketchfab_api_key', '');
    // Fallback naar hoofdwebsite data/settings.json indien aanwezig
    if ($sfKey === '') {
        $mainSettingsFile = dirname(__DIR__) . '/data/settings.json';
        if (is_file($mainSettingsFile)) {
            $ms = json_decode((string)@file_get_contents($mainSettingsFile), true);
            if (!empty($ms['sketchfab_api_key'])) {
                $sfKey = (string)$ms['sketchfab_api_key'];
            }
        }
    }
    jsonResponse([
        'sketchfab_key_set' => $sfKey !== '',
    ]);
}

if ($method === 'POST' && $path === '/admin/settings') {
    requireAuth();
    $input = getJsonInput();
    if (isset($input['sketchfab_api_key'])) {
        setKrantSetting($db, 'sketchfab_api_key', trim((string)$input['sketchfab_api_key']));
    }
    jsonResponse(['ok' => true, 'message' => 'Instellingen opgeslagen']);
}

// ---- Admin: Media Zoeker (Memes & 3D Modellen voor AR Lagen) ----

if ($method === 'GET' && $path === '/admin/search/memes') {
    requireAuth();
    $query = trim((string)($_GET['q'] ?? ''));
    $source = (string)($_GET['source'] ?? 'memes');
    if ($query === '') jsonResponse(['message' => 'Zoekterm is vereist'], 400);
    $allowedSubs = ['memes', 'dankmemes', 'me_irl', 'AdviceAnimals', 'funny'];
    if (!in_array($source, $allowedSubs, true)) $source = 'memes';

    $fetchReddit = function ($url) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; interventie-krant/1.0; +https://interventie.org)',
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($code === 200 && $body) ? json_decode($body, true) : null;
    };

    $extractMemes = function ($posts) {
        $memes = [];
        foreach ($posts as $post) {
            $p = $post['data'] ?? [];
            if (!empty($p['is_video']) || ($p['post_hint'] ?? '') === 'self') continue;
            $imgUrl = $p['url_overridden_by_dest'] ?? $p['url'] ?? '';
            if (!$imgUrl || str_contains($imgUrl, 'reddit.com/gallery')) continue;
            $isImg = preg_match('/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i', $imgUrl) || ($p['post_hint'] ?? '') === 'image';
            if (!$isImg) continue;
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

    $searchUrl = 'https://www.reddit.com/r/' . urlencode($source) . '/search.json?' . http_build_query([
        'q' => $query, 'restrict_sr' => '1', 'sort' => 'top', 't' => 'year', 'limit' => 50,
    ]);
    $data = $fetchReddit($searchUrl);
    $memes = $data ? $extractMemes($data['data']['children'] ?? []) : [];
    if (empty($memes)) {
        $hotUrl = 'https://www.reddit.com/r/' . urlencode($source) . '/hot.json?limit=50';
        $data = $fetchReddit($hotUrl);
        $memes = $data ? $extractMemes($data['data']['children'] ?? []) : [];
    }
    jsonResponse(['success' => true, 'memes' => $memes]);
}

if ($method === 'GET' && $path === '/admin/search/3d') {
    requireAuth();
    $query = trim((string)($_GET['q'] ?? ''));
    $maxTriangles = min((int)($_GET['max_triangles'] ?? 15000), 100000);
    if ($query === '') jsonResponse(['message' => 'Zoekterm is vereist'], 400);

    $sketchfabUrl = 'https://api.sketchfab.com/v3/models?' . http_build_query([
        'q'                => $query,
        'type'             => 'models',
        'downloadable'     => 'true',
        'max_vertex_count' => $maxTriangles,
        'sort_by'          => '-likeCount',
        'count'            => 16,
    ]);
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $sketchfabUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT      => 'interventie-krant/1.0 (+https://interventie.org)',
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$body) {
        jsonResponse(['success' => false, 'models' => [], 'message' => 'Sketchfab niet bereikbaar']);
    }
    $data = json_decode($body, true);
    $models = [];
    foreach ($data['results'] ?? [] as $m) {
        $thumb = '';
        foreach ($m['thumbnails']['images'] ?? [] as $img) {
            if (($img['width'] ?? 9999) <= 640) { $thumb = $img['url']; break; }
        }
        if (!$thumb && !empty($m['thumbnails']['images'])) {
            $thumb = end($m['thumbnails']['images'])['url'];
        }
        $models[] = [
            'uid'        => $m['uid'] ?? '',
            'name'       => $m['name'] ?? '',
            'thumbnail'  => $thumb,
            'face_count' => $m['faceCount'] ?? 0,
            'author'     => $m['user']['displayName'] ?? '',
            'glb_size'   => $m['archives']['glb']['size'] ?? 0,
        ];
    }
    jsonResponse(['success' => true, 'models' => $models]);
}

// Download een gekozen Meme/GIF of Sketchfab 3D-model zodat de admin het direct als laag-bestand kan toevoegen
if ($method === 'GET' && $path === '/admin/fetch-remote-asset') {
    requireAuth();
    $type = (string)($_GET['type'] ?? 'image');

    if ($type === '3d') {
        $uid = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($_GET['uid'] ?? ''));
        if ($uid === '') jsonResponse(['message' => 'Geen model UID opgegeven'], 400);

        $apiKey = getKrantSetting($db, 'sketchfab_api_key', '');
        if ($apiKey === '') {
            $mainSettingsFile = dirname(__DIR__) . '/data/settings.json';
            if (is_file($mainSettingsFile)) {
                $ms = json_decode((string)@file_get_contents($mainSettingsFile), true);
                if (!empty($ms['sketchfab_api_key'])) {
                    $apiKey = (string)$ms['sketchfab_api_key'];
                }
            }
        }
        if ($apiKey === '') {
            jsonResponse(['message' => 'Configureer eerst een Sketchfab API key via Instellingen'], 400);
        }

        $dlUrl = 'https://api.sketchfab.com/v3/models/' . urlencode($uid) . '/download';
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $dlUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HTTPHEADER     => ['Authorization: Token ' . $apiKey, 'Accept: application/json'],
        ]);
        $dlBody = curl_exec($ch);
        $dlCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($dlCode !== 200 || !$dlBody) {
            jsonResponse(['message' => 'Sketchfab download-URL ophalen mislukt (HTTP ' . $dlCode . ')'], 502);
        }
        $dlData = json_decode($dlBody, true);
        $glbUrl = $dlData['glb']['url'] ?? ($dlData['gltf']['url'] ?? '');
        if (!$glbUrl) {
            jsonResponse(['message' => 'Geen GLB beschikbaar voor dit model'], 502);
        }

        $ch = curl_init($glbUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 45,
        ]);
        $fileData = curl_exec($ch);
        $fileCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($fileCode !== 200 || !$fileData || strlen($fileData) > MAX_GLB_SIZE) {
            jsonResponse(['message' => 'GLB bestand te groot (max 10MB) of download mislukt'], 502);
        }

        if (substr($fileData, 0, 2) === 'PK' && class_exists('ZipArchive')) {
            $tmpZip = sys_get_temp_dir() . '/krant_sf_' . $uid . '.zip';
            file_put_contents($tmpZip, $fileData);
            $zip = new ZipArchive();
            if ($zip->open($tmpZip) === true) {
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $fn = $zip->getNameIndex($i);
                    if (strtolower(pathinfo($fn, PATHINFO_EXTENSION)) === 'glb') {
                        $fileData = $zip->getFromIndex($i);
                        break;
                    }
                }
                $zip->close();
            }
            @unlink($tmpZip);
        }

        header('Content-Type: model/gltf-binary');
        header('Content-Disposition: inline; filename="model_' . $uid . '.glb"');
        echo $fileData;
        exit;
    }

    // Externe afbeelding / GIF proxy voor laag-import
    $url = (string)($_GET['url'] ?? '');
    if (!preg_match('#^https?://#i', $url)) {
        jsonResponse(['message' => 'Ongeldige URL'], 400);
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_USERAGENT      => 'interventie-krant/1.0',
    ]);
    $data = curl_exec($ch);
    $ct = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$data) {
        jsonResponse(['message' => 'Afbeelding ophalen mislukt'], 502);
    }
    header('Content-Type: ' . ($ct !== '' ? $ct : 'image/jpeg'));
    echo $data;
    exit;
}

// ---- Admin: Web Analytics endpoints ----

if ($method === 'GET' && $path === '/admin/stats') {
    handleGetKrantAdminStats($db);
}

if ($method === 'POST' && ($path === '/admin/stats/dismiss-404' || $path === '/admin/stats/dismiss_404')) {
    handleKrantDismiss404();
}

// Onbekende route
jsonResponse(['message' => 'Onbekend endpoint'], 404);
