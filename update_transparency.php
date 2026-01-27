<?php
/**
 * TIJDELIJK SCRIPT - Verwijder na gebruik!
 * Uitvoeren via: http://interventie.org/update_transparency.php
 * 
 * Zet transparantie voor alle bestaande layers op TRUE
 */

// Beveiligingscheck - verwijder deze regel als je het wilt uitvoeren
if (!isset($_GET['confirm']) || $_GET['confirm'] !== 'yes') {
    die('⚠️ Voeg ?confirm=yes toe aan de URL om uit te voeren');
}

// Pad naar database
$dbPath = __DIR__ . '/data/posters.db';

if (!file_exists($dbPath)) {
    die("❌ Database niet gevonden: $dbPath");
}

try {
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "<pre>";
    echo "📊 Database verbonden: $dbPath\n";
    echo "════════════════════════════════════════\n\n";
    
    // Haal alle posters op
    $stmt = $db->query("SELECT id, title, layers FROM posters");
    $posters = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $totalPosters = count($posters);
    $updatedPosters = 0;
    $totalLayers = 0;
    $updatedLayers = 0;
    
    echo "🔍 Gevonden: $totalPosters poster(s)\n\n";
    
    foreach ($posters as $poster) {
        $id = $poster['id'];
        $title = $poster['title'];
        $layersJson = $poster['layers'];
        
        if (empty($layersJson)) {
            continue;
        }
        
        $layers = json_decode($layersJson, true);
        if (!is_array($layers)) {
            continue;
        }
        
        $hasChanges = false;
        
        foreach ($layers as $layerKey => &$layerData) {
            $totalLayers++;
            
            // Check of transparent veld bestaat en niet al true is
            if (!isset($layerData['transparent']) || $layerData['transparent'] === false) {
                $layerData['transparent'] = true;
                $hasChanges = true;
                $updatedLayers++;
                
                echo "  ✓ Layer $layerKey: transparant = TRUE\n";
            }
        }
        unset($layerData);
        
        if ($hasChanges) {
            // Update de database
            $updatedLayersJson = json_encode($layers, JSON_UNESCAPED_UNICODE);
            $updateStmt = $db->prepare("UPDATE posters SET layers = :layers WHERE id = :id");
            $updateStmt->execute([
                ':layers' => $updatedLayersJson,
                ':id' => $id
            ]);
            
            $updatedPosters++;
            echo "✅ Poster '$title' (ID: $id) bijgewerkt\n\n";
        }
    }
    
    echo "════════════════════════════════════════\n";
    echo "🎉 KLAAR!\n";
    echo "   Totaal posters: $totalPosters\n";
    echo "   Bijgewerkt: $updatedPosters posters\n";
    echo "   Totaal layers: $totalLayers\n";
    echo "   Transparant gezet: $updatedLayers layers\n";
    echo "════════════════════════════════════════\n";
    echo "\n⚠️ VERWIJDER DIT BESTAND NU: update_transparency.php\n";
    echo "</pre>";
    
} catch (Exception $e) {
    die("❌ FOUT: " . $e->getMessage());
}
