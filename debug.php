<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Server Debug Info</h1>";

// Check PHP Version
echo "<h2>PHP Version</h2>";
echo phpversion();

// Check SQLite
echo "<h2>SQLite Support</h2>";
if (extension_loaded('pdo_sqlite')) {
    echo "<p style='color:green'>PDO SQLite is installed.</p>";
} else {
    echo "<p style='color:red'>PDO SQLite is NOT installed.</p>";
}

// Check Write Permissions
echo "<h2>Permissions</h2>";
$dir = __DIR__;
echo "<p>Current directory: $dir</p>";
if (is_writable($dir)) {
    echo "<p style='color:green'>Directory is writable.</p>";
} else {
    echo "<p style='color:red'>Directory is NOT writable.</p>";
}

// Check Database File
echo "<h2>Database</h2>";
$dbFile = $dir . '/posters.db';
if (file_exists($dbFile)) {
    echo "<p>Database file exists.</p>";
    if (is_writable($dbFile)) {
        echo "<p style='color:green'>Database file is writable.</p>";
    } else {
        echo "<p style='color:red'>Database file is NOT writable.</p>";
    }
} else {
    echo "<p>Database file does not exist. Trying to create...</p>";
    try {
        $db = new PDO('sqlite:' . $dbFile);
        echo "<p style='color:green'>Successfully created database file.</p>";
    } catch (Exception $e) {
        echo "<p style='color:red'>Failed to create database: " . $e->getMessage() . "</p>";
    }
}

// Check Uploads Directory
echo "<h2>Uploads Directory</h2>";
$uploadsDir = $dir . '/uploads';
if (file_exists($uploadsDir)) {
    if (is_writable($uploadsDir)) {
        echo "<p style='color:green'>Uploads directory is writable.</p>";
    } else {
        echo "<p style='color:red'>Uploads directory is NOT writable.</p>";
    }
} else {
    echo "<p>Uploads directory does not exist. Trying to create...</p>";
    if (mkdir($uploadsDir, 0755, true)) {
        echo "<p style='color:green'>Successfully created uploads directory.</p>";
    } else {
        echo "<p style='color:red'>Failed to create uploads directory.</p>";
    }
}
?>
