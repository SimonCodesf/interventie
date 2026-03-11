<?php
// includes/api_utils.php - Helper functies voor de API

// ==================== DATABASE INITIALISATIE ====================
// Initialiseer database met alle kolom migraties
// Deze functie overschrijft de versie in config.php indien aanwezig
function initDatabaseWithMigrations() {
    $db = new PDO('sqlite:' . DB_FILE);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Maak posters tabel aan
    $db->exec("
        CREATE TABLE IF NOT EXISTS posters (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            jpeg_filename TEXT NOT NULL,
            pdf_medium_filename TEXT NOT NULL,
            pdf_large_filename TEXT NOT NULL,
            thumbnail TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            location_description TEXT,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            downloads INTEGER DEFAULT 0
        )
    ");
    
    // Helper functie om te checken of kolom bestaat
    $columnExists = function($db, $table, $column) {
        $result = $db->query("PRAGMA table_info($table)");
        foreach ($result as $row) {
            if ($row['name'] === $column) {
                return true;
            }
        }
        return false;
    };
    
    // Voeg ontbrekende kolommen toe (database migratie)
    $columnsToAdd = [
        'latitude' => 'REAL',
        'longitude' => 'REAL', 
        'location_description' => 'TEXT',
        'artikel_link' => 'TEXT',
        'photographer_credit' => 'TEXT',
        'credits' => 'TEXT',
        'ar_marker' => 'TEXT',
        'ar_marker_hq' => 'TEXT',
        'ar_marker_lq' => 'TEXT',
        'layers_data' => 'TEXT',
        'glb_model' => 'TEXT',
        'audio_file' => 'TEXT',
        'gallery_images' => 'TEXT',
        'ar_camera_feed' => 'INTEGER DEFAULT 0',
        'upload_type' => "TEXT DEFAULT 'poster'",
        'created_at' => 'DATETIME DEFAULT CURRENT_TIMESTAMP'
    ];
    
    foreach ($columnsToAdd as $column => $type) {
        if (!$columnExists($db, 'posters', $column)) {
            try {
                $db->exec("ALTER TABLE posters ADD COLUMN $column $type");
                error_log("[DB] Kolom '$column' toegevoegd aan posters tabel");
            } catch (PDOException $e) {
                error_log("[DB] Fout bij toevoegen kolom '$column': " . $e->getMessage());
            }
        }
    }
    
    // Migrate existing ar_marker_hq data to ar_marker (consolidation to single marker)
    try {
        $db->exec("UPDATE posters SET ar_marker = ar_marker_hq WHERE ar_marker_hq IS NOT NULL AND ar_marker IS NULL");
    } catch (PDOException $e) {
        // Migration might fail if data doesn't exist, which is fine
    }
    
    return $db;
}

// ==================== HELPER FUNCTIES ====================

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

// Smart image resizing with transparency support (PNG/JPG)
function resizeImage($source, $dest, $maxWidth, $maxHeight, $quality = 85) {
    if (!file_exists($source)) return false;
    
    list($width, $height, $type) = getimagesize($source);
    if (!$width || !$height) return false;
    
    // Calculate new dimensions
    $ratio = $width / $height;
    if ($width > $maxWidth || $height > $maxHeight) {
        if ($width / $maxWidth > $height / $maxHeight) {
            $newWidth = $maxWidth;
            $newHeight = $newWidth / $ratio;
        } else {
            $newHeight = $maxHeight;
            $newWidth = $newHeight * $ratio;
        }
    } else {
        // No resize needed, just copy if source != dest
        if ($source !== $dest) {
            copy($source, $dest);
        }
        return true;
    }
    
    $newImage = imagecreatetruecolor($newWidth, $newHeight);
    
    switch ($type) {
        case IMAGETYPE_JPEG:
            $sourceImage = imagecreatefromjpeg($source);
            if (!$sourceImage) return false;
            imagecopyresampled($newImage, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagejpeg($newImage, $dest, $quality);
            break;
            
        case IMAGETYPE_PNG:
            $sourceImage = imagecreatefrompng($source);
            if (!$sourceImage) return false;
            // Preserve transparency
            imagealphablending($newImage, false);
            imagesavealpha($newImage, true);
            $transparent = imagecolorallocatealpha($newImage, 255, 255, 255, 127);
            imagefilledrectangle($newImage, 0, 0, $newWidth, $newHeight, $transparent);
            
            imagecopyresampled($newImage, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            // PNG compressielevel: 1 = snel (minder CPU, iets groter bestand)
            // Lagen zijn client-side al naar 1024px geschaald, zelden nog resize nodig
            imagepng($newImage, $dest, 1); 
            break;
            
        default:
            return false;
    }
    
    if (isset($sourceImage)) imagedestroy($sourceImage);
    if (isset($newImage)) imagedestroy($newImage);
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
    $logFile = dirname(__DIR__) . '/data/admin_activity.log'; // Adjusted path
    $timestamp = date('Y-m-d H:i:s');
    $ip = getClientIP();
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
    
    $logEntry = "[{$timestamp}] IP: {$ip} | Action: {$action} | Details: {$details} | User-Agent: {$userAgent}" . PHP_EOL;
    
    error_log($logEntry, 3, $logFile);
}
