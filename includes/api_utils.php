<?php
// includes/api_utils.php - Helper functies voor de API

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
    $logFile = __DIR__ . '/../admin_activity.log'; // Adjusted path
    $timestamp = date('Y-m-d H:i:s');
    $ip = getClientIP();
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
    
    $logEntry = "[{$timestamp}] IP: {$ip} | Action: {$action} | Details: {$details} | User-Agent: {$userAgent}" . PHP_EOL;
    
    error_log($logEntry, 3, $logFile);
}
