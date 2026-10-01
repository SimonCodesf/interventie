<?php
// set_password.php - Admin wachtwoord instellen/wijzigen via CLI
// Gebruik: php tools/set_password.php <nieuw-wachtwoord>

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Alleen via command line.');
}

$password = $argv[1] ?? '';
if (strlen($password) < 8) {
    fwrite(STDERR, "Wachtwoord moet minstens 8 tekens bevatten.\n");
    exit(1);
}

$dbFile = dirname(__DIR__) . '/data/essays.db';
$db = new PDO('sqlite:' . $dbFile);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");

$stmt = $db->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password_hash', ?)");
$stmt->execute([password_hash($password, PASSWORD_BCRYPT)]);

echo "Wachtwoord opgeslagen in data/essays.db\n";
