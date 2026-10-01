<?php
// api_utils.php - Database & API helpers

function initDatabase() {
    $db = new PDO('sqlite:' . DB_FILE);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $db->exec("
        CREATE TABLE IF NOT EXISTS essays (
            week TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            text TEXT DEFAULT '',
            page_image TEXT DEFAULT '',
            mind_file TEXT DEFAULT '',
            layers TEXT DEFAULT '[]',
            published INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    $db->exec("
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ");

    // Migratie: 8th Wall target-kolommen (bestandsnamen, inhoud via API)
    $cols = [];
    foreach ($db->query("PRAGMA table_info(essays)") as $c) { $cols[] = $c['name']; }
    if (!in_array('target8w_json', $cols, true)) {
        $db->exec("ALTER TABLE essays ADD COLUMN target8w_json TEXT DEFAULT ''");
    }
    if (!in_array('target8w_image', $cols, true)) {
        $db->exec("ALTER TABLE essays ADD COLUMN target8w_image TEXT DEFAULT ''");
    }

    return $db;
}

function getAdminHash($db) {
    $stmt = $db->query("SELECT value FROM settings WHERE key = 'admin_password_hash'");
    $row = $stmt->fetch();
    return $row ? $row['value'] : null;
}

function setAdminHash($db, $hash) {
    $stmt = $db->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password_hash', ?)");
    $stmt->execute([$hash]);
}

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function requireAuth() {
    if (!isValidSession()) {
        jsonResponse(['message' => 'Niet geauthenticeerd'], 401);
    }
}

function sanitizeWeek($week) {
    $week = strtolower(trim((string)$week));
    if (!preg_match('/^[a-z0-9][a-z0-9_-]{0,30}$/', $week)) {
        jsonResponse(['message' => 'Ongeldige week (enkel letters, cijfers, - en _)'], 400);
    }
    return $week;
}

function fileExt($filename) {
    return strtolower(pathinfo($filename, PATHINFO_EXTENSION));
}

// 8th Wall target inline uitleveren: JSON parsen + imagePath absoluut maken
function target8wToApi($row, $base, $v) {
    if (empty($row['target8w_json']) || empty($row['target8w_image'])) return null;
    $weekDir = dirname(__DIR__) . '/uploads/essays/' . $row['week'] . '/';
    $jsonPath = $weekDir . basename((string)$row['target8w_json']);
    if (!is_file($jsonPath)) return null;
    $data = json_decode((string)file_get_contents($jsonPath), true);
    if (!is_array($data) || empty($data['name'])) return null;
    $data['imagePath'] = $base . rawurlencode(basename((string)$row['target8w_image'])) . $v;
    // Anchor-naam = week-slug (ongeacht de naam uit de CLI), zodat de
    // frontend altijd 1-op-1 kan matchen.
    $data['name'] = $row['week'];
    return $data;
}

// 8th Wall target automatisch genereren uit de pagina-afbeelding:
// grijswaarde-versie (max 640px, zoals de CLI-luminance) + metadata-JSON.
// Dezelfde eenvoud als vroeger: enkel een JPG uploaden volstaat.
// Handmatige uploads (target8w_json/target8w_image) overschrijven dit nadien.
function autogenerateTarget8w($weekDir, $week, $pageFilename) {
    if (!function_exists('imagecreatefromjpeg')) return false;
    $srcPath = $weekDir . '/' . basename((string)$pageFilename);
    if (!is_file($srcPath)) return false;

    $ext = strtolower(pathinfo($srcPath, PATHINFO_EXTENSION));
    if ($ext === 'jpg' || $ext === 'jpeg') $src = @imagecreatefromjpeg($srcPath);
    elseif ($ext === 'png') $src = @imagecreatefrompng($srcPath);
    elseif ($ext === 'webp' && function_exists('imagecreatefromwebp')) $src = @imagecreatefromwebp($srcPath);
    else $src = false;
    if (!$src) return false;

    $w = imagesx($src); $h = imagesy($src);
    if ($w < 10 || $h < 10) { imagedestroy($src); return false; }

    $scale = min(1.0, 640 / max($w, $h));
    $tw = (int)max(1, round($w * $scale));
    $th = (int)max(1, round($h * $scale));
    $dst = imagecreatetruecolor($tw, $th);
    // Transparantie afvlakken op wit (zoals de pagina op papier staat)
    $white = imagecolorallocate($dst, 255, 255, 255);
    imagefill($dst, 0, 0, $white);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $tw, $th, $w, $h);
    imagedestroy($src);
    imagefilter($dst, IMG_FILTER_GRAYSCALE);
    if (!@imagejpeg($dst, $weekDir . '/target8w.jpg', 85)) { imagedestroy($dst); return false; }
    imagedestroy($dst);

    $now = (int)(microtime(true) * 1000);
    $json = [
        'imagePath' => 'target8w.jpg',
        'metadata' => null,
        'name' => $week,
        'type' => 'PLANAR',
        'properties' => [
            'left' => 0, 'top' => 0, 'width' => $w, 'height' => $h,
            'isRotated' => false, 'originalWidth' => $w, 'originalHeight' => $h,
        ],
        'resources' => [
            'originalImage' => basename((string)$pageFilename),
            'luminanceImage' => 'target8w.jpg',
        ],
        'created' => $now,
        'updated' => $now,
    ];
    if (!@file_put_contents($weekDir . '/target8w.json', json_encode($json, JSON_UNESCAPED_UNICODE))) return false;
    return true;
}

// Lazy migratie: essay zonder 8th Wall target (bv. van vóór de overstap)
// krijgt er automatisch een uit de pagina-afbeelding, zodat bestaande
// weken na deploy direct blijven werken. Geeft de verse rij terug.
function ensureTarget8w($db, $row) {
    if (!is_array($row) || empty($row['week'])) return $row;
    $weekDir = dirname(__DIR__) . '/uploads/essays/' . $row['week'] . '/';
    $jsonFile = basename((string)($row['target8w_json'] ?? ''));
    if ($jsonFile !== '' && is_file($weekDir . $jsonFile)) return $row; // al compleet
    if (empty($row['page_image']) || !is_dir($weekDir)) return $row;
    if (autogenerateTarget8w($weekDir, $row['week'], $row['page_image'])) {
        $db->prepare("UPDATE essays SET target8w_json = 'target8w.json', target8w_image = 'target8w.jpg', updated_at = CURRENT_TIMESTAMP WHERE week = ?")
           ->execute([$row['week']]);
        $stmt = $db->prepare("SELECT * FROM essays WHERE week = ?");
        $stmt->execute([$row['week']]);
        $fresh = $stmt->fetch();
        if ($fresh) return $fresh;
    }
    return $row;
}

// Eén laag normaliseren voor de API. `lit` = 1 geeft licht/schaduw
// (standaard-materiaal), 0 = vlak/unlit (als print). Default 0.
function layerToApi($layer, $base, $v) {
    if (empty($layer['file'])) return null;
    return [
        'file'      => $base . rawurlencode($layer['file']) . $v,
        'x'         => isset($layer['x']) ? (float)$layer['x'] : 0,
        'y'         => isset($layer['y']) ? (float)$layer['y'] : 0,
        'z'         => isset($layer['z']) ? (float)$layer['z'] : 0.01,
        'w'         => isset($layer['w']) ? (float)$layer['w'] : 1.0,
        'h'         => isset($layer['h']) ? (float)$layer['h'] : 1.0,
        'opacity'   => isset($layer['opacity']) ? min(1.0, max(0.0, (float)$layer['opacity'])) : 1.0,
        'rx'        => isset($layer['rx']) ? (float)$layer['rx'] : 0,
        'ry'        => isset($layer['ry']) ? (float)$layer['ry'] : 0,
        'rz'        => isset($layer['rz']) ? (float)$layer['rz'] : 0,
        'scale'     => isset($layer['scale']) && (float)$layer['scale'] > 0 ? (float)$layer['scale'] : 1.0,
        'lit'       => !empty($layer['lit']) ? 1 : 0,
        'anim_dur'  => isset($layer['anim_dur']) ? (float)$layer['anim_dur'] : 0,
        'anim_x'    => isset($layer['anim_x']) ? (float)$layer['anim_x'] : 0,
        'anim_y'    => isset($layer['anim_y']) ? (float)$layer['anim_y'] : 0,
        'anim_z'    => isset($layer['anim_z']) ? (float)$layer['anim_z'] : (isset($layer['z']) ? (float)$layer['z'] : 0.01),
    ];
}
function essayToApi($row) {
    $v = '?v=' . urlencode((string)$row['updated_at']);
    $base = 'uploads/essays/' . rawurlencode($row['week']) . '/';

    $essay = [
        'week'       => $row['week'],
        'title'      => $row['title'],
        'published'  => !empty($row['published']) ? 1 : 0,
        'page_image' => $row['page_image'] ? $base . rawurlencode($row['page_image']) . $v : '',
        'target8w'   => target8wToApi($row, $base, $v),
        'layers'     => [],
        'updated_at' => $row['updated_at'],
    ];

    $layers = json_decode((string)$row['layers'], true);
    if (is_array($layers)) {
        foreach ($layers as $layer) {
            $entry = layerToApi($layer, $base, $v);
            if ($entry) $essay['layers'][] = $entry;
        }
    }

    return $essay;
}
