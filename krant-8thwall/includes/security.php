<?php
// security.php - Auth & rate limiting utilities

define('RATE_LIMIT_FILE', dirname(__DIR__) . '/data/login_attempts.json');
define('MAX_ATTEMPTS', 5);
define('LOCKOUT_TIME', 900); // 15 minuten
define('SESSION_TIMEOUT', 3600); // 1 uur

function getClientIP() {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    }
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

function isRateLimited($ip) {
    if (!file_exists(RATE_LIMIT_FILE)) return false;
    $attempts = json_decode((string)file_get_contents(RATE_LIMIT_FILE), true) ?: [];
    if (isset($attempts[$ip]) && ($attempts[$ip]['locked_until'] ?? 0) > time()) {
        return true;
    }
    return false;
}

function recordFailedAttempt($ip) {
    $attempts = [];
    if (file_exists(RATE_LIMIT_FILE)) {
        $attempts = json_decode((string)file_get_contents(RATE_LIMIT_FILE), true) ?: [];
    }
    if (!isset($attempts[$ip])) {
        $attempts[$ip] = ['attempts' => 0, 'locked_until' => 0];
    }
    $attempts[$ip]['attempts']++;
    if ($attempts[$ip]['attempts'] >= MAX_ATTEMPTS) {
        $attempts[$ip]['locked_until'] = time() + LOCKOUT_TIME;
        $attempts[$ip]['attempts'] = 0;
    }
    file_put_contents(RATE_LIMIT_FILE, json_encode($attempts));
}

function clearLoginAttempts($ip) {
    if (!file_exists(RATE_LIMIT_FILE)) return;
    $attempts = json_decode((string)file_get_contents(RATE_LIMIT_FILE), true) ?: [];
    unset($attempts[$ip]);
    file_put_contents(RATE_LIMIT_FILE, json_encode($attempts));
}

function cleanupOldAttempts() {
    if (!file_exists(RATE_LIMIT_FILE)) return;
    $attempts = json_decode((string)file_get_contents(RATE_LIMIT_FILE), true) ?: [];
    $now = time();
    foreach ($attempts as $ip => $data) {
        if (($data['locked_until'] ?? 0) > 0 && $data['locked_until'] < ($now - 86400)) {
            unset($attempts[$ip]);
        }
    }
    file_put_contents(RATE_LIMIT_FILE, json_encode($attempts));
}

function isValidSession() {
    if (empty($_SESSION['admin_logged_in'])) return false;
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > SESSION_TIMEOUT)) {
        unset($_SESSION['admin_logged_in']);
        return false;
    }
    $_SESSION['last_activity'] = time();
    return true;
}

function verifyPassword($input, $hash) {
    return password_verify($input, $hash);
}
