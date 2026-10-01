<?php
// router.php - Dev router voor de PHP ingebouwde server
// Gebruik: php -S localhost:8999 tools/router.php
// Bootst de .htaccess rewrite na: /api/* -> api.php

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (preg_match('#^/api(/.*)?$#', $uri)) {
    $_SERVER['PATH_INFO'] = preg_replace('#^/api#', '', $uri) ?: '/';
    require __DIR__ . '/../api.php';
    return true;
}

return false; // statisch serveren
