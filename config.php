<?php
// config.php - Configuratie voor de poster website

// Admin wachtwoord - VERANDER DIT!
// Voor extra beveiliging: gebruik een sterk wachtwoord (min 12 tekens, speciale karakters)
define('ADMIN_PASSWORD', 'BETA');

// Database bestand (SQLite)
define('DB_FILE', __DIR__ . '/posters.db');

// Upload directories
define('UPLOADS_DIR', __DIR__ . '/uploads');
define('THUMBNAILS_DIR', UPLOADS_DIR . '/thumbnails');
define('AR_LAYERS_DIR', UPLOADS_DIR . '/ar-layers');

// Maak directories aan als ze niet bestaan
if (!file_exists(UPLOADS_DIR)) {
    mkdir(UPLOADS_DIR, 0755, true);
}
if (!file_exists(THUMBNAILS_DIR)) {
    mkdir(THUMBNAILS_DIR, 0755, true);
}
if (!file_exists(AR_LAYERS_DIR)) {
    mkdir(AR_LAYERS_DIR, 0755, true);
}

// Initialiseer database
function initDatabase() {
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
    
    // Update bestaande database met nieuwe kolommen (als ze niet bestaan)
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN latitude REAL");
    } catch (PDOException $e) {
        // Kolom bestaat al, negeer error
    }
    
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN longitude REAL");
    } catch (PDOException $e) {
        // Kolom bestaat al, negeer error
    }
    
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN location_description TEXT");
    } catch (PDOException $e) {
        // Kolom bestaat al, negeer error
    }
    
    // Voeg artikel_link kolom toe
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN artikel_link TEXT");
    } catch (PDOException $e) {
        // Kolom bestaat al, negeer error
    }
    
    // Voeg photographer_credit kolom toe
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN photographer_credit TEXT");
    } catch (PDOException $e) {
        // Kolom bestaat al, negeer error
    }
    
    // Voeg ar_marker kolom toe voor MindAR tracking
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN ar_marker TEXT");
    } catch (PDOException $e) {
        // Kolom bestaat al, negeer error
    }
    
    // Add HQ and LQ marker columns (for legacy backwards compatibility if needed)
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN ar_marker_hq TEXT");
    } catch (PDOException $e) {
        // Kolom bestaat al, negeer error
    }
    
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN ar_marker_lq TEXT");
    } catch (PDOException $e) {
        // Kolom bestaat al, negeer error
    }
    
    // Migrate existing ar_marker_hq data to ar_marker (consolidation to single marker)
    try {
        $db->exec("UPDATE posters SET ar_marker = ar_marker_hq WHERE ar_marker_hq IS NOT NULL AND ar_marker IS NULL");
    } catch (PDOException $e) {
        // Migration might fail if data doesn't exist, which is fine
    }
    
    // Voeg layers_data kolom toe voor AR layer configuratie
    try {
        $db->exec("ALTER TABLE posters ADD COLUMN layers_data JSON");
    } catch (PDOException $e) {
        // Kolom bestaat al, negeer error
    }
    
    return $db;
}

// Session configuration is now done in api.php BEFORE session_start()
// Regenerate session ID to prevent session fixation (only if session already started)
if (session_status() === PHP_SESSION_ACTIVE) {
    if (!isset($_SESSION['initiated'])) {
        session_regenerate_id(true);
        $_SESSION['initiated'] = true;
    }
}
