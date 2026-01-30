<?php
/**
 * Test script voor MindAR rebuild debugging
 * Upload dit naar de server en open in browser: interventie.org/test_mind_rebuild.php
 * VERWIJDER NA GEBRUIK!
 */

header('Content-Type: text/plain; charset=utf-8');

echo "=== MindAR Rebuild Test ===\n\n";

// 0. Direct database query test
echo "0. Database query test:\n";
try {
    $dbPath = __DIR__ . '/data/posters.db';
    $pdo = new PDO("sqlite:$dbPath");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $stmt = $pdo->query("SELECT id, title, created_at FROM posters ORDER BY created_at DESC");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "   [DB] Totaal posters in database: " . count($rows) . "\n";
    foreach ($rows as $i => $row) {
        echo "   " . ($i + 1) . ". " . $row['title'] . " (" . substr($row['id'], 0, 8) . "...)\n";
    }
    
    // Check specifiek voor MANIFESTO
    $manifestoId = '5cc01927-7de3-440e-b567-379eff931922';
    $stmt2 = $pdo->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt2->execute([$manifestoId]);
    $manifesto = $stmt2->fetch(PDO::FETCH_ASSOC);
    if ($manifesto) {
        echo "\n   [OK] MANIFESTO gevonden in database!\n";
    } else {
        echo "\n   [FOUT] MANIFESTO NIET in database!\n";
    }
    
    // Nu poster_ids.json updaten met correcte data
    echo "\n   Schrijf nieuwe poster_ids.json...\n";
    $posterData = array_map(function($row) {
        return ['id' => $row['id'], 'created_at' => $row['created_at']];
    }, $rows);
    $jsonPath = __DIR__ . '/data/poster_ids.json';
    $result = file_put_contents($jsonPath, json_encode($posterData, JSON_PRETTY_PRINT));
    if ($result) {
        echo "   [OK] Geschreven: " . count($posterData) . " IDs naar poster_ids.json\n";
    } else {
        echo "   [FOUT] Kon poster_ids.json niet schrijven!\n";
    }
    
} catch (Exception $e) {
    echo "   [FOUT] Database error: " . $e->getMessage() . "\n";
}

echo "\n";

// 1. Check Node.js beschikbaarheid
echo "1. Node.js check:\n";
$nodePaths = [
    '/opt/alt/alt-nodejs20/root/usr/bin/node',
    '/opt/alt/alt-nodejs14/root/usr/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
    'node'
];

$foundNode = null;
foreach ($nodePaths as $path) {
    if ($path === 'node') {
        exec("which node 2>/dev/null", $output, $return);
        if ($return === 0 && !empty($output[0])) {
            echo "   [OK] node gevonden via PATH: " . $output[0] . "\n";
            $foundNode = $output[0];
        }
    } elseif (file_exists($path)) {
        echo "   [OK] $path bestaat\n";
        $foundNode = $path;
    } else {
        echo "   [ ] $path niet gevonden\n";
    }
}

if (!$foundNode) {
    echo "   [FOUT] Geen Node.js gevonden!\n";
}

// 2. Check merge script
echo "\n2. Merge script check:\n";
$scriptPath = __DIR__ . '/tools/merge_mind_files.js';
if (file_exists($scriptPath)) {
    echo "   [OK] Script bestaat: $scriptPath\n";
} else {
    echo "   [FOUT] Script niet gevonden: $scriptPath\n";
}

// 3. Check node_modules
echo "\n3. Node modules check:\n";
$modulesPath = __DIR__ . '/tools/node_modules';
if (is_dir($modulesPath)) {
    echo "   [OK] node_modules map bestaat\n";
    
    $msgpack = $modulesPath . '/@msgpack/msgpack';
    if (is_dir($msgpack)) {
        echo "   [OK] @msgpack/msgpack geinstalleerd\n";
    } else {
        echo "   [FOUT] @msgpack/msgpack ONTBREEKT!\n";
        echo "         → Upload /tools/node_modules/@msgpack van lokaal naar server\n";
    }
} else {
    echo "   [FOUT] node_modules map ONTBREEKT!\n";
    echo "         → Upload /tools/node_modules van lokaal naar server\n";
}

// 4. Check data directory
echo "\n4. Data directory check:\n";
$dataDir = __DIR__ . '/data';
if (is_dir($dataDir)) {
    echo "   [OK] data/ map bestaat\n";
    
    $dbPath = $dataDir . '/posters.db';
    if (file_exists($dbPath)) {
        echo "   [OK] posters.db bestaat (" . filesize($dbPath) . " bytes)\n";
    } else {
        echo "   [FOUT] posters.db niet gevonden\n";
    }
    
    $idsPath = $dataDir . '/poster_ids.json';
    if (file_exists($idsPath)) {
        $ids = json_decode(file_get_contents($idsPath), true);
        echo "   [OK] poster_ids.json bestaat (" . count($ids) . " IDs)\n";
    } else {
        echo "   [ ] poster_ids.json niet gevonden (wordt aangemaakt bij rebuild)\n";
    }
} else {
    echo "   [FOUT] data/ map ontbreekt\n";
}

// 5. Check NFT assets
echo "\n5. NFT assets check:\n";
$nftDir = __DIR__ . '/assets/nft';
if (is_dir($nftDir)) {
    $mindFiles = glob($nftDir . '/*/*.mind');
    echo "   [OK] " . count($mindFiles) . " .mind files gevonden in assets/nft/\n";
    
    // Toon eerste paar
    foreach (array_slice($mindFiles, 0, 3) as $f) {
        echo "       → " . basename(dirname($f)) . "/" . basename($f) . "\n";
    }
} else {
    echo "   [FOUT] assets/nft/ map ontbreekt\n";
}

// 6. Check output directory
echo "\n6. Output directory check:\n";
$chunksDir = __DIR__ . '/assets/chunks';
if (is_dir($chunksDir)) {
    echo "   [OK] assets/chunks/ map bestaat\n";
    
    $manifest = $chunksDir . '/manifest.json';
    if (file_exists($manifest)) {
        $m = json_decode(file_get_contents($manifest), true);
        echo "   Laatste manifest:\n";
        echo "       - Gegenereerd: " . ($m['generatedAt'] ?? 'onbekend') . "\n";
        echo "       - Totaal posters: " . ($m['totalPosters'] ?? 0) . "\n";
        echo "       - Chunks: " . count($m['chunks'] ?? []) . "\n";
    }
} else {
    echo "   [ ] assets/chunks/ map ontbreekt (wordt aangemaakt bij rebuild)\n";
}

// 7. Test script uitvoeren
echo "\n7. Script uitvoeren (test):\n";
if ($foundNode && file_exists($scriptPath)) {
    $cmd = "$foundNode " . escapeshellarg($scriptPath) . " 2>&1";
    echo "   Commando: $cmd\n\n";
    echo "--- OUTPUT ---\n";
    
    exec($cmd, $output, $returnVar);
    foreach ($output as $line) {
        echo $line . "\n";
    }
    
    echo "--- EINDE ---\n";
    echo "\nReturn code: $returnVar " . ($returnVar === 0 ? "(OK)" : "(FOUT)") . "\n";
    
    // Check of manifest is geüpdatet
    if ($returnVar === 0 && file_exists($manifest)) {
        clearstatcache();
        $m = json_decode(file_get_contents($manifest), true);
        echo "\nNieuwe manifest status:\n";
        echo "   - Gegenereerd: " . ($m['generatedAt'] ?? 'onbekend') . "\n";
        echo "   - Totaal posters: " . ($m['totalPosters'] ?? 0) . "\n";
    }
} else {
    echo "   Kan script niet uitvoeren (Node.js of script ontbreekt)\n";
}

echo "\n=== EINDE TEST ===\n";
echo "\n⚠️ VERGEET NIET dit bestand te verwijderen na debugging!\n";
