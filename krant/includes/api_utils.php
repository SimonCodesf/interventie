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

// Essay-rij omzetten naar API-antwoord met cache-veilige URLs
function essayToApi($row) {
    $v = '?v=' . urlencode((string)$row['updated_at']);
    $base = 'uploads/essays/' . rawurlencode($row['week']) . '/';

    $essay = [
        'week'       => $row['week'],
        'title'      => $row['title'],
        'text'       => $row['text'],
        'page_image' => $row['page_image'] ? $base . rawurlencode($row['page_image']) . $v : '',
        'mind'       => $row['mind_file'] ? $base . rawurlencode($row['mind_file']) . $v : '',
        'layers'     => [],
        'updated_at' => $row['updated_at'],
    ];

    $layers = json_decode((string)$row['layers'], true);
    if (is_array($layers)) {
        foreach ($layers as $layer) {
            if (empty($layer['file'])) continue;
            $essay['layers'][] = [
                'file'      => $base . rawurlencode($layer['file']) . $v,
                'z'         => isset($layer['z']) ? (float)$layer['z'] : 0.01,
                'w'         => isset($layer['w']) ? (float)$layer['w'] : 1.0,
                'h'         => isset($layer['h']) ? (float)$layer['h'] : 1.414,
                'anim_dur'  => isset($layer['anim_dur']) ? (float)$layer['anim_dur'] : 0,
                'anim_dist' => isset($layer['anim_dist']) ? (float)$layer['anim_dist'] : 0,
            ];
        }
    }

    return $essay;
}
