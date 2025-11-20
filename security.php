<?php
// Security utilities for admin authentication

// Rate limiting storage file
define('RATE_LIMIT_FILE', __DIR__ . '/login_attempts.json');
define('MAX_ATTEMPTS', 5); // Max login attempts
define('LOCKOUT_TIME', 900); // 15 minutes lockout
define('SESSION_TIMEOUT', 3600); // 1 hour session timeout

// Get client IP address
function getClientIP() {
    $ip = $_SERVER['REMOTE_ADDR'];
    // Check for proxy headers
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        $ip = $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0];
    }
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

// Check if IP is rate limited
function isRateLimited($ip) {
    if (!file_exists(RATE_LIMIT_FILE)) {
        return false;
    }
    
    $attempts = json_decode(file_get_contents(RATE_LIMIT_FILE), true) ?: [];
    
    if (isset($attempts[$ip])) {
        $data = $attempts[$ip];
        
        // Check if locked out
        if ($data['locked_until'] > time()) {
            return true;
        }
        
        // Reset if lockout expired
        if ($data['locked_until'] <= time() && $data['attempts'] >= MAX_ATTEMPTS) {
            unset($attempts[$ip]);
            file_put_contents(RATE_LIMIT_FILE, json_encode($attempts));
        }
    }
    
    return false;
}

// Record failed login attempt
function recordFailedAttempt($ip) {
    $attempts = [];
    if (file_exists(RATE_LIMIT_FILE)) {
        $attempts = json_decode(file_get_contents(RATE_LIMIT_FILE), true) ?: [];
    }
    
    if (!isset($attempts[$ip])) {
        $attempts[$ip] = ['attempts' => 0, 'locked_until' => 0];
    }
    
    $attempts[$ip]['attempts']++;
    
    // Lock if too many attempts
    if ($attempts[$ip]['attempts'] >= MAX_ATTEMPTS) {
        $attempts[$ip]['locked_until'] = time() + LOCKOUT_TIME;
    }
    
    file_put_contents(RATE_LIMIT_FILE, json_encode($attempts));
}

// Clear login attempts for IP (on successful login)
function clearLoginAttempts($ip) {
    if (!file_exists(RATE_LIMIT_FILE)) {
        return;
    }
    
    $attempts = json_decode(file_get_contents(RATE_LIMIT_FILE), true) ?: [];
    unset($attempts[$ip]);
    file_put_contents(RATE_LIMIT_FILE, json_encode($attempts));
}

// Generate secure random token
function generateSecureToken($length = 32) {
    return bin2hex(random_bytes($length));
}

// Check if session is valid and not expired
function isValidSession() {
    if (empty($_SESSION['admin_logged_in'])) {
        return false;
    }
    
    // Check session timeout
    if (isset($_SESSION['last_activity'])) {
        if (time() - $_SESSION['last_activity'] > SESSION_TIMEOUT) {
            session_destroy();
            return false;
        }
    }
    
    // Update last activity
    $_SESSION['last_activity'] = time();
    
    return true;
}

// Verify password with constant-time comparison
function verifyPassword($input, $correct) {
    return hash_equals($correct, $input);
}

// Clean old attempts (cleanup function, can be called periodically)
function cleanupOldAttempts() {
    if (!file_exists(RATE_LIMIT_FILE)) {
        return;
    }
    
    $attempts = json_decode(file_get_contents(RATE_LIMIT_FILE), true) ?: [];
    $now = time();
    
    foreach ($attempts as $ip => $data) {
        // Remove entries older than 24 hours
        if ($data['locked_until'] > 0 && $data['locked_until'] < ($now - 86400)) {
            unset($attempts[$ip]);
        }
    }
    
    file_put_contents(RATE_LIMIT_FILE, json_encode($attempts));
}
