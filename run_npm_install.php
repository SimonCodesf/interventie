<?php
/**
 * TIJDELIJK SCRIPT - Verwijder na gebruik
 * Draait npm install in de tools/ directory op de server
 * Vereist: directe HTTP request (niet via API, geen auth check)
 */

// Eenvoudige beveiliging - alleen lokaal of met secret token
$token = $_GET['token'] ?? '';
$expectedToken = 'npm_install_2026';
if ($token !== $expectedToken) {
    http_response_code(403);
    die('Forbidden - gebruik ?token=npm_install_2026');
}

header('Content-Type: text/plain; charset=utf-8');
set_time_limit(300); // 5 minuten timeout

$toolsDir = __DIR__ . '/tools';
echo "=== npm install in tools/ ===\n";
echo "Directory: $toolsDir\n\n";

// Zoek npm path
$npmPath = 'npm';
$possibleNpmPaths = [
    '/opt/alt/alt-nodejs20/root/usr/bin/npm',
    '/opt/alt/alt-nodejs14/root/usr/bin/npm', 
    '/usr/local/bin/npm',
    '/usr/bin/npm',
];
foreach ($possibleNpmPaths as $p) {
    if (file_exists($p)) {
        $npmPath = $p;
        break;
    }
}
echo "npm pad: $npmPath\n\n";

// Draai npm install
$cmd = "cd " . escapeshellarg($toolsDir) . " && $npmPath install --omit=optional 2>&1";
echo "Commando: $cmd\n\n";
echo "--- Output ---\n";
flush();

exec($cmd, $output, $return);
foreach ($output as $line) {
    echo $line . "\n";
}

echo "\n--- Resultaat ---\n";
echo "Exit code: $return\n";
if ($return === 0) {
    echo "SUCCESS: npm install geslaagd!\n";
    echo "\nGeïnstalleerde packages:\n";
    // Toon wat geïnstalleerd is
    $listCmd = "cd " . escapeshellarg($toolsDir) . " && $npmPath list --depth=0 2>&1";
    exec($listCmd, $listOutput);
    foreach ($listOutput as $line) {
        echo $line . "\n";
    }
} else {
    echo "FOUT: npm install mislukt (exit code: $return)\n";
}
