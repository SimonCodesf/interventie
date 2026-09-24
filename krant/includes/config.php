<?php
// config.php - Krant AR spinoff configuratie
// Geen secrets in dit bestand: het admin-wachtwoord (bcrypt-hash) staat in de SQLite database
// (data/essays.db). Wordt ingesteld via de first-run setup in /admin/ of via tools/set_password.php

define('DB_FILE', dirname(__DIR__) . '/data/essays.db');

define('UPLOADS_DIR', dirname(__DIR__) . '/uploads');
define('ESSAYS_DIR', UPLOADS_DIR . '/essays');

// Maak directories aan als ze niet bestaan (ook op de server na eerste deploy)
foreach ([dirname(DB_FILE), ESSAYS_DIR] as $dir) {
    if (!file_exists($dir)) {
        @mkdir($dir, 0755, true);
    }
}

// Toegestane bestandstypes
define('ALLOWED_PAGE_EXT', ['jpg', 'jpeg', 'png', 'webp']);
define('ALLOWED_LAYER_EXT', ['png', 'webp', 'jpg', 'jpeg']);
define('ALLOWED_MIND_EXT', ['mind']);
