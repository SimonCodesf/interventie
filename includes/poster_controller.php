<?php
// includes/poster_controller.php

function handleGetPosters($db) {
    try {
        $stmt = $db->query("SELECT * FROM posters ORDER BY upload_date DESC");
        $posters = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Decode layers_data en gallery_images for all posters
        foreach ($posters as &$poster) {
            if (isset($poster['layers_data']) && !empty($poster['layers_data'])) {
                $poster['layers'] = json_decode($poster['layers_data'], true);
                unset($poster['layers_data']);
            } else {
                $poster['layers'] = [];
            }
            
            // Parse gallery_images van JSON string naar array
            if (isset($poster['gallery_images']) && !empty($poster['gallery_images'])) {
                $gallery = json_decode($poster['gallery_images'], true);
                $poster['gallery_images'] = is_array($gallery) ? $gallery : [];
            } else {
                $poster['gallery_images'] = [];
            }
        }
        
        jsonResponse($posters);
    } catch (PDOException $e) {
        error_log("Database error in handleGetPosters: " . $e->getMessage());
        jsonResponse(['message' => 'Database error: ' . $e->getMessage()], 500);
    }
}

function handleGetPoster($db, $id) {
    $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt->execute([$id]);
    $poster = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($poster) {
        if (!empty($poster['layers_data'])) {
            $poster['layers'] = json_decode($poster['layers_data'], true);
            unset($poster['layers_data']);
        }
        
        // Parse gallery_images van JSON string naar array
        if (!empty($poster['gallery_images'])) {
            $gallery = json_decode($poster['gallery_images'], true);
            $poster['gallery_images'] = is_array($gallery) ? $gallery : [];
        } else {
            $poster['gallery_images'] = [];
        }
        
        jsonResponse($poster);
    } else {
        jsonResponse(['message' => 'Poster niet gevonden'], 404);
    }
}

// Helper to trigger MindAR chunk rebuild
function triggerMindMerge($captureOutput = false) {
    global $db;
    
    // Schrijf alle poster IDs naar een JSON bestand zodat Node script weet welke geldig zijn
    // Gesorteerd op created_at DESC (nieuwste eerst) voor chunk 0
    // Dit is een fallback voor als better-sqlite3 niet beschikbaar is
    try {
        if (!isset($db)) {
            $db = initDatabaseWithMigrations();
        }
        // Sorteer op created_at DESC zodat nieuwste posters in chunk 0 komen
        $stmt = $db->query("SELECT id, created_at FROM posters ORDER BY created_at DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // Format als array van objects met id en created_at
        $posterData = array_map(function($row) {
            return ['id' => $row['id'], 'created_at' => $row['created_at']];
        }, $rows);
        $jsonPath = dirname(__DIR__) . '/data/poster_ids.json';
        file_put_contents($jsonPath, json_encode($posterData));
        error_log("Wrote " . count($posterData) . " poster IDs to $jsonPath (sorted by date DESC)");
    } catch (Exception $e) {
        error_log("Could not write poster IDs: " . $e->getMessage());
    }
    
    $scriptPath = dirname(__DIR__) . '/tools/merge_mind_files.js';
    // Try to find node executable, fallback to 'node'
    $nodePath = 'node';
    
    // Known paths on this server (detected via test_node.php)
    if (file_exists('/opt/alt/alt-nodejs20/root/usr/bin/node')) {
        $nodePath = '/opt/alt/alt-nodejs20/root/usr/bin/node';
    } elseif (file_exists('/opt/alt/alt-nodejs14/root/usr/bin/node')) {
        $nodePath = '/opt/alt/alt-nodejs14/root/usr/bin/node';
    } elseif (file_exists('/usr/local/bin/node')) {
        $nodePath = '/usr/local/bin/node';
    } elseif (file_exists('/usr/bin/node')) {
        $nodePath = '/usr/bin/node';
    }
    
    // For local dev environment
    if (file_exists('/Users/simon/.nvm/versions/node/v23.6.0/bin/node')) {
        $nodePath = '/Users/simon/.nvm/versions/node/v23.6.0/bin/node';
    }
    
    if ($captureOutput) {
        // Run synchronously and capture output
        $cmd = "$nodePath " . escapeshellarg($scriptPath) . " 2>&1";
        exec($cmd, $output, $returnVar);
        return ['output' => $output, 'returnVar' => $returnVar];
    } else {
        // Run in background (admin upload flow)
        $cmd = "$nodePath " . escapeshellarg($scriptPath) . " > /dev/null 2>&1 &";
        exec($cmd);
        error_log("Triggered MindAR merge: $cmd");
        return true;
    }
}

function handleUploadPoster($db) {
    if (!isAdmin()) {
        logAdminActivity('UNAUTHORIZED_UPLOAD_ATTEMPT', 'User not authenticated');
        jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    }
    
    // Bepaal upload type: 'poster' (volledig) of 'reclame' (snel)
    $uploadType = $_POST['upload_type'] ?? 'poster';
    if (!in_array($uploadType, ['poster', 'reclame'])) {
        $uploadType = 'poster';
    }
    
    // Accept both ar_marker_file (from admin.js) and ar_marker_file_hq (legacy)
    $arMarkerFile = isset($_FILES['ar_marker_file']) ? $_FILES['ar_marker_file'] : 
                    (isset($_FILES['ar_marker_file_hq']) ? $_FILES['ar_marker_file_hq'] : null);
    
    // Validatie: JPEG is altijd verplicht
    if (empty($_FILES['jpeg'])) {
        logAdminActivity('UPLOAD_FAILED', 'Missing JPEG file');
        jsonResponse(['message' => 'JPEG afbeelding is verplicht'], 400);
    }
    
    // In poster modus: .mind is aanbevolen maar niet strict verplicht
    // In reclame modus: .mind wordt server-side gegenereerd als niet meegeleverd
    
    $title = $_POST['title'] ?? '';
    $description = $_POST['description'] ?? '';
    $latitude = !empty($_POST['latitude']) ? (float)$_POST['latitude'] : null;
    $longitude = !empty($_POST['longitude']) ? (float)$_POST['longitude'] : null;
    $locationDescription = $_POST['location_description'] ?? '';
    $artikelLink = $_POST['artikel_link'] ?? '';
    $credits = $_POST['credits'] ?? ''; // JSON string: [{item: "Foto", owner: "Naam"}, ...]
    
    if (empty($title)) {
        logAdminActivity('UPLOAD_FAILED', 'Missing title');
        jsonResponse(['message' => 'Titel is verplicht'], 400);
    }
    
    // Validate coordinates
    if (($latitude !== null && ($latitude < -90 || $latitude > 90)) || 
        ($longitude !== null && ($longitude < -180 || $longitude > 180))) {
        logAdminActivity('UPLOAD_FAILED', 'Invalid coordinates');
        jsonResponse(['message' => 'Ongeldige coördinaten'], 400);
    }
    
    // Validate files
    $jpegValidation = validateUploadedFile($_FILES['jpeg'], ['image/jpeg', 'image/png'], 52428800);
    if (!$jpegValidation['valid']) jsonResponse(['message' => 'JPEG: ' . $jpegValidation['message']], 400);
    
    // PDF is optioneel - alleen valideren als aanwezig
    if (!empty($_FILES['pdfMedium']) && $_FILES['pdfMedium']['error'] === UPLOAD_ERR_OK) {
        $pdfValidation1 = validateUploadedFile($_FILES['pdfMedium'], ['application/pdf'], 104857600);
        if (!$pdfValidation1['valid']) jsonResponse(['message' => 'PDF Medium: ' . $pdfValidation1['message']], 400);
    }
    if (!empty($_FILES['pdfLarge']) && $_FILES['pdfLarge']['error'] === UPLOAD_ERR_OK) {
        $pdfValidation2 = validateUploadedFile($_FILES['pdfLarge'], ['application/pdf'], 104857600);
        if (!$pdfValidation2['valid']) jsonResponse(['message' => 'PDF Large: ' . $pdfValidation2['message']], 400);
    }
    
    // AR Marker validatie - alleen als een .mind bestand is meegeleverd
    if ($arMarkerFile && $arMarkerFile['error'] === UPLOAD_ERR_OK) {
        $hqValidation = validateUploadedFile($arMarkerFile, ['application/octet-stream', 'application/json'], 10485760);
        if (!$hqValidation['valid']) jsonResponse(['message' => 'AR Marker: ' . $hqValidation['message']], 400);
    }
    
    // Upload logic
    try {
        $id = generateUUID();
        $jpegFilename = $id . '_' . basename($_FILES['jpeg']['name']);
        $thumbnailFilename = 'thumb_' . $jpegFilename;
        
        move_uploaded_file($_FILES['jpeg']['tmp_name'], UPLOADS_DIR . '/' . $jpegFilename);
        // Optimize JPEG (max 2500px for good balance between quality/size, 92% quality)
        resizeImage(UPLOADS_DIR . '/' . $jpegFilename, UPLOADS_DIR . '/' . $jpegFilename, 2500, 2500, 92);
        
        // PDF is optioneel
        $pdfMediumFilename = '';
        if (!empty($_FILES['pdfMedium']) && $_FILES['pdfMedium']['error'] === UPLOAD_ERR_OK) {
            $pdfMediumFilename = $id . '_medium.pdf';
            move_uploaded_file($_FILES['pdfMedium']['tmp_name'], UPLOADS_DIR . '/' . $pdfMediumFilename);
        }
        $pdfLargeFilename = '';
        if (!empty($_FILES['pdfLarge']) && $_FILES['pdfLarge']['error'] === UPLOAD_ERR_OK) {
            $pdfLargeFilename = $id . '_large.pdf';
            move_uploaded_file($_FILES['pdfLarge']['tmp_name'], UPLOADS_DIR . '/' . $pdfLargeFilename);
        }
        
        createThumbnail(UPLOADS_DIR . '/' . $jpegFilename, THUMBNAILS_DIR . '/' . $thumbnailFilename);
        
        // Mind files - save as {id}.mind
        $arMarkerPath = '';
        $mindDir = __DIR__ . '/../assets/nft/' . $id;
        
        if ($arMarkerFile && $arMarkerFile['error'] === UPLOAD_ERR_OK) {
            // Handmatig geüploade .mind file
            if (!file_exists($mindDir)) mkdir($mindDir, 0755, true);
            $mindFilename = $id . '.mind';
            move_uploaded_file($arMarkerFile['tmp_name'], $mindDir . '/' . $mindFilename);
            $arMarkerPath = 'assets/nft/' . $id . '/' . $id;
        } else {
            // Geen .mind geüpload - genereer automatisch vanuit JPEG
            $arMarkerPath = 'assets/nft/' . $id . '/' . $id;
            error_log("[UPLOAD] Geen .mind bestand meegeleverd voor {$id} (type: {$uploadType}) - auto-genereren");
            
            // Zoek node executable
            $nodePath = 'node';
            if (file_exists('/opt/alt/alt-nodejs20/root/usr/bin/node')) {
                $nodePath = '/opt/alt/alt-nodejs20/root/usr/bin/node';
            } elseif (file_exists('/usr/local/bin/node')) {
                $nodePath = '/usr/local/bin/node';
            } elseif (file_exists('/usr/bin/node')) {
                $nodePath = '/usr/bin/node';
            }
            
            $compileScript = __DIR__ . '/../tools/compile_single_mind.js';
            $jpegFullPath = UPLOADS_DIR . '/' . $jpegFilename;
            $cmd = $nodePath . ' ' . escapeshellarg($compileScript) . ' ' . escapeshellarg($id) . ' ' . escapeshellarg($jpegFullPath) . ' 2>&1';
            
            error_log("[UPLOAD] .mind compilatie commando: $cmd");
            exec($cmd, $compileOutput, $compileReturn);
            $outputStr = implode("\n", $compileOutput);
            error_log("[UPLOAD] .mind compilatie output: $outputStr");
            
            if ($compileReturn !== 0) {
                error_log("[UPLOAD] WAARSCHUWING: .mind compilatie mislukt (exit code: $compileReturn)");
                // Niet fataal - poster wordt opgeslagen maar zonder werkend AR target
            } else {
                error_log("[UPLOAD] .mind succesvol gegenereerd voor {$id}");
            }
        }
        
        // Layers
        $layersData = [];
        for ($i = 1; $i <= 8; $i++) {
            $layerData = [
                'z' => (float)($_POST["layer_{$i}_z"] ?? 0),
                'pos_x' => (float)($_POST["layer_{$i}_pos_x"] ?? 0),
                'pos_y' => (float)($_POST["layer_{$i}_pos_y"] ?? 0),
                'scale' => (float)($_POST["layer_{$i}_scale"] ?? 1.0),
                'rot_z' => (float)($_POST["layer_{$i}_rot_z"] ?? 0),
                'anim_x' => (float)($_POST["layer_{$i}_anim_x"] ?? 0),
                'anim_y' => (float)($_POST["layer_{$i}_anim_y"] ?? 0),
                'anim_z' => (float)($_POST["layer_{$i}_anim_z"] ?? 0),
                'anim_pos_duration' => (int)($_POST["layer_{$i}_anim_pos_duration"] ?? 0),
                'anim_rot_x' => (float)($_POST["layer_{$i}_anim_rot_x"] ?? 0),
                'anim_rot_y' => (float)($_POST["layer_{$i}_anim_rot_y"] ?? 0),
                'anim_rot_z' => (float)($_POST["layer_{$i}_anim_rot_z"] ?? 0),
                'anim_rot_duration' => (int)($_POST["layer_{$i}_anim_rot_duration"] ?? 0),
                'anim_rot_origin' => $_POST["layer_{$i}_anim_rot_origin"] ?? 'center',
                'anim_scale' => (float)($_POST["layer_{$i}_anim_scale"] ?? 1.0),
                'anim_opacity' => (float)($_POST["layer_{$i}_anim_opacity"] ?? 1.0),
                'anim_scale_duration' => (int)($_POST["layer_{$i}_anim_scale_duration"] ?? 0),
                'transparent' => (int)($_POST["layer_{$i}_transparent"] ?? 0) === 1,
                'bg_color' => $_POST["layer_{$i}_bg_color"] ?? '#000000',
                'exclusion_filter' => (int)($_POST["layer_{$i}_exclusion"] ?? 0) === 1,
                'filename' => null,
                'is_video' => false
            ];
            
            if (isset($_FILES["layer_{$i}_image"]) && $_FILES["layer_{$i}_image"]['error'] === UPLOAD_ERR_OK) {
                $uploadedFile = $_FILES["layer_{$i}_image"];
                
                // Get REAL MIME type by checking file content, not just upload type
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $realMimeType = finfo_file($finfo, $uploadedFile['tmp_name']);
                finfo_close($finfo);
                
                error_log("[LAYER_{$i}] Upload MIME: {$uploadedFile['type']}, Real MIME: {$realMimeType}");
                
                // Check if it's a GIF (either declared or actual)
                $isGif = ($realMimeType === 'image/gif' || $uploadedFile['type'] === 'image/gif');
                
                // Check if it's a video file (MP4, WebM)
                $isVideoFile = in_array($realMimeType, ['video/mp4', 'video/webm']);
                
                if ($isGif) {
                    // Check GIF file size - met nieuwe frame parser is 2MB veilig
                    $gifMaxSize = 2 * 1024 * 1024; // 2MB max voor GIFs
                    if ($uploadedFile['size'] > $gifMaxSize) {
                        $sizeKB = round($uploadedFile['size'] / 1024);
                        error_log("[LAYER_{$i}] GIF te groot: {$sizeKB}KB (max: 2MB)");
                        jsonResponse([
                            'message' => "GIF te groot ({$sizeKB}KB). Maximum is 2MB. Tip: gebruik ezgif.com om je GIF te optimaliseren."
                        ], 400);
                        return;
                    }
                    
                    // Use GIF directly (A-Frame GIF shader handles playback)
                    error_log("[LAYER_{$i}] GIF detected, size OK: {$uploadedFile['size']} bytes");
                    $gifFilename = $id . "_layer_{$i}.gif";
                    move_uploaded_file($uploadedFile['tmp_name'], AR_LAYERS_DIR . '/' . $gifFilename);
                    $layerData['filename'] = $gifFilename;
                    $layerData['is_video'] = true; // GIFs are treated as video
                    error_log("[LAYER_{$i}] ✅ GIF saved: {$gifFilename}");
                } else if ($isVideoFile) {
                    // Direct MP4/WebM upload
                    error_log("[LAYER_{$i}] Native video file detected");
                    $ext = $realMimeType === 'video/webm' ? 'webm' : 'mp4';
                    $videoFilename = $id . "_layer_{$i}." . $ext;
                    move_uploaded_file($uploadedFile['tmp_name'], AR_LAYERS_DIR . '/' . $videoFilename);
                    $layerData['filename'] = $videoFilename;
                    $layerData['is_video'] = true;
                    error_log("[LAYER_{$i}] Native video saved: {$videoFilename}");
                } else {
                    // Regular image (PNG, JPEG, etc.)
                    error_log("[LAYER_{$i}] Image file detected (not GIF)");
                    $layerFilename = $id . "_layer_{$i}.png";
                    move_uploaded_file($uploadedFile['tmp_name'], AR_LAYERS_DIR . '/' . $layerFilename);
                    // Optimize AR Layer (max 1024px - sufficient for mobile AR)
                    resizeImage(AR_LAYERS_DIR . '/' . $layerFilename, AR_LAYERS_DIR . '/' . $layerFilename, 1024, 1024);
                    $layerData['filename'] = $layerFilename;
                    $layerData['is_video'] = false;
                    error_log("[LAYER_{$i}] Image saved and optimized");
                }
            }
            
            // Handle per-layer GLB model upload
            if (isset($_FILES["layer_{$i}_glb"]) && $_FILES["layer_{$i}_glb"]['error'] === UPLOAD_ERR_OK) {
                $glbFile = $_FILES["layer_{$i}_glb"];
                if ($glbFile['size'] <= 10485760) { // 10MB max
                    $glbFilename = $id . "_layer_{$i}.glb";
                    move_uploaded_file($glbFile['tmp_name'], AR_LAYERS_DIR . '/' . $glbFilename);
                    $layerData['glb_model'] = $glbFilename;
                    error_log("[LAYER_{$i}] GLB model opgeslagen: {$glbFilename}");
                }
            }
            
            // Handle per-layer audio file upload
            if (isset($_FILES["layer_{$i}_audio"]) && $_FILES["layer_{$i}_audio"]['error'] === UPLOAD_ERR_OK) {
                $audioFile = $_FILES["layer_{$i}_audio"];
                if ($audioFile['size'] <= 10485760) { // 10MB max
                    $ext = pathinfo($audioFile['name'], PATHINFO_EXTENSION) ?: 'mp3';
                    $audioFilename = $id . "_layer_{$i}_audio." . $ext;
                    move_uploaded_file($audioFile['tmp_name'], AR_LAYERS_DIR . '/' . $audioFilename);
                    $layerData['audio_file'] = $audioFilename;
                    error_log("[LAYER_{$i}] Audio opgeslagen: {$audioFilename}");
                }
            }
            
            $layersData["layer_$i"] = $layerData;
        }
        
        // Sla API bron metadata op per layer (voor toekomstige referentie)
        for ($i = 1; $i <= 8; $i++) {
            if (!empty($_POST["layer_{$i}_api_source"])) {
                $layersData["layer_$i"]['api_source'] = $_POST["layer_{$i}_api_source"];
                $layersData["layer_$i"]['api_url'] = $_POST["layer_{$i}_api_url"] ?? '';
            }
        }
        
        // Database insert
        $arCameraFeed = isset($_POST['ar_camera_feed']) && $_POST['ar_camera_feed'] === '1' ? 1 : 0;
        $stmt = $db->prepare("
            INSERT INTO posters (id, title, description, jpeg_filename, pdf_medium_filename, pdf_large_filename, thumbnail, latitude, longitude, location_description, artikel_link, credits, ar_marker, layers_data, glb_model, audio_file, gallery_images, ar_camera_feed, upload_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
        ");
        
        // Verwerk gallery afbeeldingen
        $galleryImages = [];
        if (!empty($_FILES['gallery_images']['name'][0])) {
            $galleryDir = UPLOADS_DIR . '/gallery';
            if (!is_dir($galleryDir)) {
                mkdir($galleryDir, 0755, true);
            }
            
            foreach ($_FILES['gallery_images']['name'] as $key => $filename) {
                if ($_FILES['gallery_images']['error'][$key] === UPLOAD_ERR_OK) {
                    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                        $newFilename = $id . '_gallery_' . ($key + 1) . '.' . $ext;
                        $destPath = $galleryDir . '/' . $newFilename;
                        if (move_uploaded_file($_FILES['gallery_images']['tmp_name'][$key], $destPath)) {
                            $galleryImages[] = '/uploads/gallery/' . $newFilename;
                        }
                    }
                }
            }
        }
        
        $stmt->execute([
            $id, $title, $description, $jpegFilename, $pdfMediumFilename, $pdfLargeFilename,
            '/uploads/thumbnails/' . $thumbnailFilename, $latitude, $longitude, $locationDescription,
            $artikelLink, $credits, $arMarkerPath, json_encode($layersData), json_encode($galleryImages), $arCameraFeed, $uploadType
        ]);
        
        logAdminActivity('UPLOAD_SUCCESS', "$title (ID: $id, type: $uploadType)");
        
        // Trigger MindAR chunk rebuild
        triggerMindMerge();
        
        // Return new poster met geparsede data
        $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
        $stmt->execute([$id]);
        $newPoster = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Parse layers_data
        if (!empty($newPoster['layers_data'])) {
            $newPoster['layers'] = json_decode($newPoster['layers_data'], true);
            unset($newPoster['layers_data']);
        }
        
        // Parse gallery_images
        if (!empty($newPoster['gallery_images'])) {
            $gallery = json_decode($newPoster['gallery_images'], true);
            $newPoster['gallery_images'] = is_array($gallery) ? $gallery : [];
        } else {
            $newPoster['gallery_images'] = [];
        }
        
        jsonResponse(['success' => true, 'poster' => $newPoster]);
        
    } catch (Exception $e) {
        logAdminActivity('UPLOAD_FAILED', $e->getMessage());
        jsonResponse(['message' => 'Server fout: ' . $e->getMessage()], 500);
    }
}

function handleDeletePoster($db, $id) {
    if (!isAdmin()) jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    
    $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt->execute([$id]);
    $poster = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$poster) jsonResponse(['message' => 'Poster niet gevonden'], 404);
    
    // Delete files
    @unlink(UPLOADS_DIR . '/' . $poster['jpeg_filename']);
    @unlink(UPLOADS_DIR . '/' . $poster['pdf_medium_filename']);
    @unlink(UPLOADS_DIR . '/' . $poster['pdf_large_filename']);
    @unlink(THUMBNAILS_DIR . '/' . basename($poster['thumbnail']));
    
    // Delete DB entry
    $db->prepare("DELETE FROM posters WHERE id = ?")->execute([$id]);
    
    logAdminActivity('DELETE_POSTER', "ID: $id");
    
    // Trigger MindAR chunk rebuild
    triggerMindMerge();
    
    jsonResponse(['success' => true]);
}

function handleUpdatePoster($db, $id) {
    if (!isAdmin()) {
        jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    }
    
    // Get existing poster
    $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt->execute([$id]);
    $poster = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$poster) {
        jsonResponse(['message' => 'Poster niet gevonden'], 404);
    }
    
    try {
        // Get form data (use existing values as defaults)
        $title = $_POST['title'] ?? $poster['title'];
        $description = $_POST['description'] ?? $poster['description'];
        $latitude = isset($_POST['latitude']) && $_POST['latitude'] !== '' ? (float)$_POST['latitude'] : $poster['latitude'];
        $longitude = isset($_POST['longitude']) && $_POST['longitude'] !== '' ? (float)$_POST['longitude'] : $poster['longitude'];
        $locationDescription = $_POST['location_description'] ?? $poster['location_description'];
        $artikelLink = $_POST['artikel_link'] ?? $poster['artikel_link'];
        
        // Credits: gebruik nieuw veld of behoud bestaande waarde
        $credits = isset($_POST['credits']) ? $_POST['credits'] : ($poster['credits'] ?? '');
        
        // AR camera feed: checkbox instelling (0 = zwarte achtergrond, 1 = camera feed)
        $arCameraFeed = isset($_POST['ar_camera_feed']) ? (int)$_POST['ar_camera_feed'] : (int)($poster['ar_camera_feed'] ?? 0);
        
        // File paths (keep existing unless new file uploaded)
        $jpegFilename = $poster['jpeg_filename'];
        $pdfMediumFilename = $poster['pdf_medium_filename'];
        $pdfLargeFilename = $poster['pdf_large_filename'];
        $thumbnailPath = $poster['thumbnail'];
        $arMarkerPath = $poster['ar_marker'];
        
        // Handle new JPEG upload
        if (isset($_FILES['jpeg']) && $_FILES['jpeg']['error'] === UPLOAD_ERR_OK) {
            $validation = validateUploadedFile($_FILES['jpeg'], ['image/jpeg'], 52428800);
            if (!$validation['valid']) {
                jsonResponse(['message' => 'JPEG: ' . $validation['message']], 400);
            }
            // Delete old file
            @unlink(UPLOADS_DIR . '/' . $poster['jpeg_filename']);
            @unlink(THUMBNAILS_DIR . '/' . basename($poster['thumbnail']));
            
            $jpegFilename = $id . '_' . basename($_FILES['jpeg']['name']);
            move_uploaded_file($_FILES['jpeg']['tmp_name'], UPLOADS_DIR . '/' . $jpegFilename);
            // Optimize JPEG
            resizeImage(UPLOADS_DIR . '/' . $jpegFilename, UPLOADS_DIR . '/' . $jpegFilename, 1920, 1920, 85);
            
            $thumbnailFilename = 'thumb_' . $jpegFilename;
            createThumbnail(UPLOADS_DIR . '/' . $jpegFilename, THUMBNAILS_DIR . '/' . $thumbnailFilename);
            $thumbnailPath = '/uploads/thumbnails/' . $thumbnailFilename;
        }
        
        // Handle new PDF Medium upload
        if (isset($_FILES['pdfMedium']) && $_FILES['pdfMedium']['error'] === UPLOAD_ERR_OK) {
            $validation = validateUploadedFile($_FILES['pdfMedium'], ['application/pdf'], 104857600);
            if (!$validation['valid']) {
                jsonResponse(['message' => 'PDF Medium: ' . $validation['message']], 400);
            }
            @unlink(UPLOADS_DIR . '/' . $poster['pdf_medium_filename']);
            $pdfMediumFilename = $id . '_medium.pdf';
            move_uploaded_file($_FILES['pdfMedium']['tmp_name'], UPLOADS_DIR . '/' . $pdfMediumFilename);
        }
        
        // Handle new PDF Large upload
        if (isset($_FILES['pdfLarge']) && $_FILES['pdfLarge']['error'] === UPLOAD_ERR_OK) {
            $validation = validateUploadedFile($_FILES['pdfLarge'], ['application/pdf'], 104857600);
            if (!$validation['valid']) {
                jsonResponse(['message' => 'PDF Large: ' . $validation['message']], 400);
            }
            @unlink(UPLOADS_DIR . '/' . $poster['pdf_large_filename']);
            $pdfLargeFilename = $id . '_large.pdf';
            move_uploaded_file($_FILES['pdfLarge']['tmp_name'], UPLOADS_DIR . '/' . $pdfLargeFilename);
        }
        
        // Handle new AR marker upload
        if (isset($_FILES['ar_marker_file']) && $_FILES['ar_marker_file']['error'] === UPLOAD_ERR_OK) {
            $validation = validateUploadedFile($_FILES['ar_marker_file'], ['application/octet-stream', 'application/json'], 10485760);
            if (!$validation['valid']) {
                jsonResponse(['message' => 'AR Marker: ' . $validation['message']], 400);
            }
            
            $mindDir = __DIR__ . '/../assets/nft/' . $id;
            if (!file_exists($mindDir)) mkdir($mindDir, 0755, true);
            
            // Delete old .mind file if exists
            $oldMindFile = $mindDir . '/' . $id . '.mind';
            @unlink($oldMindFile);
            
            $mindFilename = $id . '.mind';
            move_uploaded_file($_FILES['ar_marker_file']['tmp_name'], $mindDir . '/' . $mindFilename);
            $arMarkerPath = 'assets/nft/' . $id . '/' . $id;
        }
        
        // Handle layer updates
        $existingLayers = json_decode($poster['layers_data'] ?? '{}', true) ?: [];
        $layersData = [];
        
        for ($i = 1; $i <= 8; $i++) {
            $existingLayer = $existingLayers["layer_$i"] ?? [];
            
            // Check for delete flag
            $shouldDelete = isset($_POST["layer_{$i}_delete"]) && (int)$_POST["layer_{$i}_delete"] === 1;
            
            if ($shouldDelete) {
                // Delete old file if exists
                if (!empty($existingLayer['filename'])) {
                    @unlink(AR_LAYERS_DIR . '/' . $existingLayer['filename']);
                }
                
                // Reset layer data
                $layerData = [
                    'z' => 0,
                    'pos_x' => 0,
                    'pos_y' => 0,
                    'scale' => 1.0,
                    'rot_z' => 0,
                    'anim_x' => 0,
                    'anim_y' => 0,
                    'anim_z' => 0,
                    'anim_pos_duration' => 0,
                    'anim_rot_x' => 0,
                    'anim_rot_y' => 0,
                    'anim_rot_z' => 0,
                    'anim_rot_duration' => 0,
                    'anim_rot_origin' => 'center',
                    'anim_scale' => 1.0,
                    'anim_opacity' => 1.0,
                    'anim_scale_duration' => 0,
                    'transparent' => true,
                    'bg_color' => '#000000',
                    'exclusion_filter' => false,
                    'filename' => null,
                    'is_video' => false
                ];
                
                $layersData["layer_$i"] = $layerData;
                continue; // Skip upload processing
            }
            
            // Check voor specifieke media delete flags VOOR initialisatie
            $deleteMedia = isset($_POST["layer_{$i}_delete_media"]) && (int)$_POST["layer_{$i}_delete_media"] === 1;
            $deleteGlb = isset($_POST["layer_{$i}_delete_glb"]) && (int)$_POST["layer_{$i}_delete_glb"] === 1;
            $deleteAudio = isset($_POST["layer_{$i}_delete_audio"]) && (int)$_POST["layer_{$i}_delete_audio"] === 1;
            
            // Verwijder bestanden indien delete flag is gezet
            if ($deleteMedia && !empty($existingLayer['filename'])) {
                $deleteMediaPath = AR_LAYERS_DIR . '/' . $existingLayer['filename'];
                if (file_exists($deleteMediaPath)) {
                    @unlink($deleteMediaPath);
                    error_log("[UPDATE_LAYER_{$i}] Media verwijderd op verzoek");
                } else {
                    error_log("[UPDATE_LAYER_{$i}] Media bestand niet gevonden (skip delete): {$existingLayer['filename']}");
                }
            }
            if ($deleteGlb && !empty($existingLayer['glb_model'])) {
                $deleteGlbPath = AR_LAYERS_DIR . '/' . $existingLayer['glb_model'];
                if (file_exists($deleteGlbPath)) {
                    @unlink($deleteGlbPath);
                    error_log("[UPDATE_LAYER_{$i}] GLB model verwijderd op verzoek");
                } else {
                    error_log("[UPDATE_LAYER_{$i}] GLB model niet gevonden (skip delete): {$existingLayer['glb_model']}");
                }
            }
            if ($deleteAudio && !empty($existingLayer['audio_file'])) {
                $deleteAudioPath = AR_LAYERS_DIR . '/' . $existingLayer['audio_file'];
                if (file_exists($deleteAudioPath)) {
                    @unlink($deleteAudioPath);
                    error_log("[UPDATE_LAYER_{$i}] Audio verwijderd op verzoek");
                } else {
                    error_log("[UPDATE_LAYER_{$i}] Audio niet gevonden (skip delete): {$existingLayer['audio_file']}");
                }
            }
            
            $layerData = [
                'z' => isset($_POST["layer_{$i}_z"]) ? (float)$_POST["layer_{$i}_z"] : ($existingLayer['z'] ?? 0),
                'pos_x' => isset($_POST["layer_{$i}_pos_x"]) ? (float)$_POST["layer_{$i}_pos_x"] : ($existingLayer['pos_x'] ?? 0),
                'pos_y' => isset($_POST["layer_{$i}_pos_y"]) ? (float)$_POST["layer_{$i}_pos_y"] : ($existingLayer['pos_y'] ?? 0),
                'scale' => isset($_POST["layer_{$i}_scale"]) ? (float)$_POST["layer_{$i}_scale"] : ($existingLayer['scale'] ?? 1.0),
                'rot_x' => isset($_POST["layer_{$i}_rot_x"]) ? (float)$_POST["layer_{$i}_rot_x"] : ($existingLayer['rot_x'] ?? 0),
                'rot_y' => isset($_POST["layer_{$i}_rot_y"]) ? (float)$_POST["layer_{$i}_rot_y"] : ($existingLayer['rot_y'] ?? 0),
                'rot_z' => isset($_POST["layer_{$i}_rot_z"]) ? (float)$_POST["layer_{$i}_rot_z"] : ($existingLayer['rot_z'] ?? 0),
                'anim_x' => isset($_POST["layer_{$i}_anim_x"]) ? (float)$_POST["layer_{$i}_anim_x"] : ($existingLayer['anim_x'] ?? 0),
                'anim_y' => isset($_POST["layer_{$i}_anim_y"]) ? (float)$_POST["layer_{$i}_anim_y"] : ($existingLayer['anim_y'] ?? 0),
                'anim_z' => isset($_POST["layer_{$i}_anim_z"]) ? (float)$_POST["layer_{$i}_anim_z"] : ($existingLayer['anim_z'] ?? 0),
                'anim_pos_duration' => isset($_POST["layer_{$i}_anim_pos_duration"]) ? (int)$_POST["layer_{$i}_anim_pos_duration"] : ($existingLayer['anim_pos_duration'] ?? 0),
                'anim_rot_x' => isset($_POST["layer_{$i}_anim_rot_x"]) ? (float)$_POST["layer_{$i}_anim_rot_x"] : ($existingLayer['anim_rot_x'] ?? 0),
                'anim_rot_y' => isset($_POST["layer_{$i}_anim_rot_y"]) ? (float)$_POST["layer_{$i}_anim_rot_y"] : ($existingLayer['anim_rot_y'] ?? 0),
                'anim_rot_z' => isset($_POST["layer_{$i}_anim_rot_z"]) ? (float)$_POST["layer_{$i}_anim_rot_z"] : ($existingLayer['anim_rot_z'] ?? 0),
                'anim_rot_duration' => isset($_POST["layer_{$i}_anim_rot_duration"]) ? (int)$_POST["layer_{$i}_anim_rot_duration"] : ($existingLayer['anim_rot_duration'] ?? 0),
                'anim_rot_origin' => isset($_POST["layer_{$i}_anim_rot_origin"]) ? $_POST["layer_{$i}_anim_rot_origin"] : ($existingLayer['anim_rot_origin'] ?? 'center'),
                'anim_scale' => isset($_POST["layer_{$i}_anim_scale"]) ? (float)$_POST["layer_{$i}_anim_scale"] : ($existingLayer['anim_scale'] ?? 1.0),
                'anim_opacity' => isset($_POST["layer_{$i}_anim_opacity"]) ? (float)$_POST["layer_{$i}_anim_opacity"] : ($existingLayer['anim_opacity'] ?? 1.0),
                'anim_scale_duration' => isset($_POST["layer_{$i}_anim_scale_duration"]) ? (int)$_POST["layer_{$i}_anim_scale_duration"] : ($existingLayer['anim_scale_duration'] ?? 0),
                // Checkbox: afwezigheid = false (unchecked), aanwezigheid = true (checked)
                'transparent' => isset($_POST["layer_{$i}_transparent"]) && (int)$_POST["layer_{$i}_transparent"] === 1,
                'bg_color' => isset($_POST["layer_{$i}_bg_color"]) ? $_POST["layer_{$i}_bg_color"] : ($existingLayer['bg_color'] ?? '#000000'),
                'exclusion_filter' => isset($_POST["layer_{$i}_exclusion"]) && (int)$_POST["layer_{$i}_exclusion"] === 1,
                'filename' => $deleteMedia ? null : ($existingLayer['filename'] ?? null),
                'is_video' => $deleteMedia ? false : ($existingLayer['is_video'] ?? false)
            ];
            
            // Handle new layer image upload
            if (isset($_FILES["layer_{$i}_image"]) && $_FILES["layer_{$i}_image"]['error'] === UPLOAD_ERR_OK) {
                // Delete old layer file if it exists
                if (!empty($existingLayer['filename'])) {
                    $oldFilePath = AR_LAYERS_DIR . '/' . $existingLayer['filename'];
                    if (file_exists($oldFilePath)) {
                        @unlink($oldFilePath);
                        error_log("[UPDATE_LAYER_{$i}] Deleted old file: {$existingLayer['filename']}");
                    } else {
                        error_log("[UPDATE_LAYER_{$i}] Old file not found (skipping delete): {$existingLayer['filename']}");
                    }
                }

                $uploadedFile = $_FILES["layer_{$i}_image"];
                
                // Get REAL MIME type by checking file content
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $realMimeType = finfo_file($finfo, $uploadedFile['tmp_name']);
                finfo_close($finfo);
                
                error_log("[UPDATE_LAYER_{$i}] Upload MIME: {$uploadedFile['type']}, Real MIME: {$realMimeType}");
                
                // Check if it's a GIF (either declared or actual)
                $isGif = ($realMimeType === 'image/gif' || $uploadedFile['type'] === 'image/gif');
                $isVideoFile = in_array($realMimeType, ['video/mp4', 'video/webm']);

                if ($isGif) {
                    // Check GIF file size - met nieuwe frame parser is 2MB veilig
                    $gifMaxSize = 2 * 1024 * 1024; // 2MB max voor GIFs
                    if ($uploadedFile['size'] > $gifMaxSize) {
                        $sizeKB = round($uploadedFile['size'] / 1024);
                        error_log("[UPDATE_LAYER_{$i}] GIF te groot: {$sizeKB}KB (max: 2MB)");
                        jsonResponse([
                            'message' => "GIF te groot ({$sizeKB}KB). Maximum is 2MB. Optimaliseer de GIF of gebruik een kleiner formaat."
                        ], 400);
                        return;
                    }
                    
                    error_log("[UPDATE_LAYER_{$i}] GIF detected, size OK: {$uploadedFile['size']} bytes");
                    $gifFilename = $id . "_layer_{$i}.gif";
                    move_uploaded_file($uploadedFile['tmp_name'], AR_LAYERS_DIR . '/' . $gifFilename);
                    $layerData['filename'] = $gifFilename;
                    $layerData['is_video'] = true;
                    error_log("[UPDATE_LAYER_{$i}] ✅ GIF saved: {$gifFilename}");
                } elseif ($isVideoFile) {
                    error_log("[UPDATE_LAYER_{$i}] Native video file detected");
                    $ext = $realMimeType === 'video/webm' ? 'webm' : 'mp4';
                    $videoFilename = $id . "_layer_{$i}." . $ext;
                    move_uploaded_file($uploadedFile['tmp_name'], AR_LAYERS_DIR . '/' . $videoFilename);
                    $layerData['filename'] = $videoFilename;
                    $layerData['is_video'] = true;
                    error_log("[UPDATE_LAYER_{$i}] Native video saved");
                } else {
                    error_log("[UPDATE_LAYER_{$i}] Image file detected (not GIF)");
                    // Regular image
                    $layerFilename = $id . "_layer_{$i}.png";
                    move_uploaded_file($uploadedFile['tmp_name'], AR_LAYERS_DIR . '/' . $layerFilename);
                    resizeImage(AR_LAYERS_DIR . '/' . $layerFilename, AR_LAYERS_DIR . '/' . $layerFilename, 1024, 1024);
                    $layerData['filename'] = $layerFilename;
                    $layerData['is_video'] = false;
                    error_log("[UPDATE_LAYER_{$i}] Image saved and optimized");
                }
            }
            
            // Handle per-layer GLB model update
            if (isset($_FILES["layer_{$i}_glb"]) && $_FILES["layer_{$i}_glb"]['error'] === UPLOAD_ERR_OK) {
                $glbFile = $_FILES["layer_{$i}_glb"];
                if ($glbFile['size'] <= 10485760) { // 10MB max
                    // Verwijder oude GLB indien aanwezig
                    if (!empty($existingLayer['glb_model'])) {
                        $oldGlbPath = AR_LAYERS_DIR . '/' . $existingLayer['glb_model'];
                        if (file_exists($oldGlbPath)) {
                            @unlink($oldGlbPath);
                        }
                    }
                    $glbFilename = $id . "_layer_{$i}.glb";
                    move_uploaded_file($glbFile['tmp_name'], AR_LAYERS_DIR . '/' . $glbFilename);
                    $layerData['glb_model'] = $glbFilename;
                    error_log("[UPDATE_LAYER_{$i}] GLB model bijgewerkt: {$glbFilename}");
                }
            } else {
                // Behoud bestaand GLB model (tenzij delete flag gezet was)
                $layerData['glb_model'] = $deleteGlb ? null : ($existingLayer['glb_model'] ?? null);
            }
            
            // Handle per-layer audio file update
            if (isset($_FILES["layer_{$i}_audio"]) && $_FILES["layer_{$i}_audio"]['error'] === UPLOAD_ERR_OK) {
                $audioFile = $_FILES["layer_{$i}_audio"];
                if ($audioFile['size'] <= 10485760) { // 10MB max
                    // Verwijder oude audio indien aanwezig
                    if (!empty($existingLayer['audio_file'])) {
                        $oldAudioPath = AR_LAYERS_DIR . '/' . $existingLayer['audio_file'];
                        if (file_exists($oldAudioPath)) {
                            @unlink($oldAudioPath);
                        }
                    }
                    $ext = pathinfo($audioFile['name'], PATHINFO_EXTENSION) ?: 'mp3';
                    $audioFilename = $id . "_layer_{$i}_audio." . $ext;
                    move_uploaded_file($audioFile['tmp_name'], AR_LAYERS_DIR . '/' . $audioFilename);
                    $layerData['audio_file'] = $audioFilename;
                    error_log("[UPDATE_LAYER_{$i}] Audio bijgewerkt: {$audioFilename}");
                }
            } else {
                // Behoud bestaand audio bestand (tenzij delete flag gezet was)
                $layerData['audio_file'] = $deleteAudio ? null : ($existingLayer['audio_file'] ?? null);
            }
            
            $layersData["layer_$i"] = $layerData;
        }
        
        // Update database (geen globale GLB/audio meer)
        // Verwerk gallery afbeeldingen
        $existingGallery = !empty($poster['gallery_images']) ? json_decode($poster['gallery_images'], true) : [];
        if (!is_array($existingGallery)) $existingGallery = [];
        
        // Verwijder gemarkeerde gallery afbeeldingen
        $deleteGalleryImages = isset($_POST['delete_gallery_images']) ? json_decode($_POST['delete_gallery_images'], true) : [];
        if (is_array($deleteGalleryImages) && count($deleteGalleryImages) > 0) {
            foreach ($deleteGalleryImages as $imgPath) {
                $fullPath = dirname(__DIR__) . $imgPath;
                if (file_exists($fullPath)) {
                    @unlink($fullPath);
                }
                $existingGallery = array_filter($existingGallery, fn($img) => $img !== $imgPath);
            }
            $existingGallery = array_values($existingGallery);
        }
        
        // Voeg nieuwe gallery afbeeldingen toe
        error_log("[GALLERY] Checking for gallery uploads...");
        error_log("[GALLERY] FILES array: " . print_r($_FILES, true));
        
        if (!empty($_FILES['gallery_images']['name'][0])) {
            error_log("[GALLERY] Found gallery files to upload");
            $galleryDir = UPLOADS_DIR . '/gallery';
            error_log("[GALLERY] Gallery dir: " . $galleryDir);
            
            if (!is_dir($galleryDir)) {
                $mkdirResult = mkdir($galleryDir, 0755, true);
                error_log("[GALLERY] Created dir: " . ($mkdirResult ? 'yes' : 'no'));
            }
            
            $nextIndex = count($existingGallery) + 1;
            foreach ($_FILES['gallery_images']['name'] as $key => $filename) {
                error_log("[GALLERY] Processing file $key: $filename");
                if ($_FILES['gallery_images']['error'][$key] === UPLOAD_ERR_OK) {
                    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                    error_log("[GALLERY] Extension: $ext");
                    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                        $newFilename = $id . '_gallery_' . time() . '_' . ($nextIndex + $key) . '.' . $ext;
                        $destPath = $galleryDir . '/' . $newFilename;
                        error_log("[GALLERY] Destination: $destPath");
                        if (move_uploaded_file($_FILES['gallery_images']['tmp_name'][$key], $destPath)) {
                            $existingGallery[] = '/uploads/gallery/' . $newFilename;
                            error_log("[GALLERY] SUCCESS: Uploaded $newFilename");
                        } else {
                            error_log("[GALLERY] FAILED: Could not move file to $destPath");
                        }
                    } else {
                        error_log("[GALLERY] SKIPPED: Invalid extension $ext");
                    }
                } else {
                    error_log("[GALLERY] ERROR code: " . $_FILES['gallery_images']['error'][$key]);
                }
            }
        } else {
            error_log("[GALLERY] No gallery files in request");
        }
        
        error_log("[GALLERY] Final gallery array: " . json_encode($existingGallery));
        
        $stmt = $db->prepare("
            UPDATE posters SET 
                title = ?, description = ?, jpeg_filename = ?, pdf_medium_filename = ?, pdf_large_filename = ?,
                thumbnail = ?, latitude = ?, longitude = ?, location_description = ?, 
                artikel_link = ?, credits = ?, ar_marker = ?, layers_data = ?, gallery_images = ?, ar_camera_feed = ?
            WHERE id = ?
        ");
        
        $stmt->execute([
            $title, $description, $jpegFilename, $pdfMediumFilename, $pdfLargeFilename,
            $thumbnailPath, $latitude, $longitude, $locationDescription,
            $artikelLink, $credits, $arMarkerPath, json_encode($layersData), json_encode($existingGallery), $arCameraFeed, $id
        ]);
        
        logAdminActivity('UPDATE_POSTER', "$title (ID: $id)");
        
        // Trigger MindAR chunk rebuild
        triggerMindMerge();
        
        // Return updated poster met geparsede data
        $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
        $stmt->execute([$id]);
        $updatedPoster = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Parse layers_data
        if (!empty($updatedPoster['layers_data'])) {
            $updatedPoster['layers'] = json_decode($updatedPoster['layers_data'], true);
            unset($updatedPoster['layers_data']);
        }
        
        // Parse gallery_images
        if (!empty($updatedPoster['gallery_images'])) {
            $gallery = json_decode($updatedPoster['gallery_images'], true);
            $updatedPoster['gallery_images'] = is_array($gallery) ? $gallery : [];
        } else {
            $updatedPoster['gallery_images'] = [];
        }
        
        jsonResponse(['success' => true, 'poster' => $updatedPoster]);
        
    } catch (Exception $e) {
        logAdminActivity('UPDATE_FAILED', $e->getMessage());
        jsonResponse(['message' => 'Server fout: ' . $e->getMessage()], 500);
    }
}

function handleDownloadPoster($db, $id) {
    $format = $_GET['format'] ?? 'jpeg';
    $size = $_GET['size'] ?? 'A3';
    
    $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
    $stmt->execute([$id]);
    $poster = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$poster) jsonResponse(['message' => 'Poster niet gevonden'], 404);
    
    $db->prepare("UPDATE posters SET downloads = downloads + 1 WHERE id = ?")->execute([$id]);
    
    if ($format === 'jpeg') {
        $file = UPLOADS_DIR . '/' . $poster['jpeg_filename'];
        $filename = $poster['title'] . '.jpg';
        $contentType = 'image/jpeg';
    } elseif ($format === 'pdf') {
        $file = UPLOADS_DIR . '/' . ($size === 'A0' ? $poster['pdf_large_filename'] : $poster['pdf_medium_filename']);
        $filename = $poster['title'] . '_' . $size . '.pdf';
        $contentType = 'application/pdf';
    } else {
        // Fallback for print or other formats
        $file = UPLOADS_DIR . '/' . $poster['pdf_large_filename'];
        $filename = $poster['title'] . '_Drukklaar.pdf';
        $contentType = 'application/pdf';
    }
    
    if (file_exists($file)) {
        header('Content-Type: ' . $contentType);
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    }
    
    jsonResponse(['message' => 'Bestand niet gevonden'], 404);
}

// ==================== LAYER VIDEO CONVERSION ====================

/**
 * Convert GIF to MP4 using FFmpeg
 * Returns true if successful, false if FFmpeg not available
 */
function convertGifToMp4($inputPath, $outputPath) {
    // Check if FFmpeg is available
    $ffmpegPath = trim(shell_exec('which ffmpeg 2>/dev/null')) ?: 'ffmpeg';
    
    error_log("[FFMPEG] Attempting conversion: $inputPath → $outputPath");
    
    if (!$ffmpegPath || !shell_exec("which ffmpeg 2>/dev/null")) {
        error_log("[FFMPEG] ffmpeg NOT FOUND in PATH - trying fallback");
        $ffmpegPath = 'ffmpeg'; // Fallback to system PATH
    } else {
        error_log("[FFMPEG] ffmpeg found at: $ffmpegPath");
    }
    
    if (!file_exists($inputPath)) {
        error_log("[FFMPEG] Input file not found: $inputPath");
        return false;
    }
    
    // Get file info to detect what it really is
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $realMime = finfo_file($finfo, $inputPath);
    finfo_close($finfo);
    error_log("[FFMPEG] Real MIME type of input: $realMime");
    
    try {
        // FFmpeg command to convert GIF to MP4
        $cmd = sprintf(
            '%s -i %s -movflags faststart -vf "scale=1024:1024:force_original_aspect_ratio=decrease,pad=1024:1024:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 28 -an -t 10 -y %s 2>&1',
            escapeshellarg($ffmpegPath),
            escapeshellarg($inputPath),
            escapeshellarg($outputPath)
        );
        
        error_log("[FFMPEG] Command: $cmd");
        
        $output = [];
        $returnCode = 0;
        @exec($cmd, $output, $returnCode);
        
        $fullOutput = implode("\n", $output);
        
        if ($returnCode === 0 && file_exists($outputPath)) {
            $fileSize = filesize($outputPath);
            error_log("✅ [FFMPEG] Successfully converted: $outputPath ($fileSize bytes)");
            return true;
        } else {
            error_log("❌ [FFMPEG] Conversion failed (return code: $returnCode)");
            error_log("[FFMPEG] Output:\n$fullOutput");
            return false;
        }
    } catch (Exception $e) {
        error_log("❌ [FFMPEG] Exception: " . $e->getMessage());
        return false;
    }
}

/**
 * Convert GIF to PNG (fallback if FFmpeg not available)
 * Uses ImageMagick or GD as fallback
 */
function convertGifToPng($inputPath, $outputPath) {
    try {
        // Try ImageMagick first (convert command)
        $convertPath = trim(shell_exec('which convert 2>/dev/null')) ?: 'convert';
        if (file_exists($convertPath) || shell_exec('which convert 2>/dev/null')) {
            $cmd = sprintf(
                'convert %s[0] -resize 1024x1024 %s 2>/dev/null',
                escapeshellarg($inputPath),
                escapeshellarg($outputPath)
            );
            error_log("[IMAGEMAGICK] Command: $cmd");
            
            $returnCode = 0;
            @exec($cmd, $output, $returnCode);
            
            if ($returnCode === 0 && file_exists($outputPath)) {
                error_log("✅ Converted GIF to PNG using ImageMagick: $outputPath");
                return true;
            }
        }
        
        // Fallback: Use GD if available
        if (extension_loaded('gd')) {
            $image = imagecreatefromgif($inputPath);
            if ($image !== false) {
                // Resize if needed
                $width = imagesx($image);
                $height = imagesy($image);
                
                if ($width > 1024 || $height > 1024) {
                    $ratio = min(1024 / $width, 1024 / $height);
                    $newWidth = (int)($width * $ratio);
                    $newHeight = (int)($height * $ratio);
                    
                    $resized = imagecreatetruecolor($newWidth, $newHeight);
                    imagecopyresampled($resized, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
                    imagepng($resized, $outputPath);
                    imagedestroy($resized);
                } else {
                    imagepng($image, $outputPath);
                }
                imagedestroy($image);
                
                error_log("✅ Converted GIF to PNG using GD: $outputPath");
                return true;
            }
        }
        
        // Last resort: just copy as PNG (won't work but at least we have a file)
        if (copy($inputPath, $outputPath)) {
            error_log("⚠️ Copied GIF as PNG (conversion unavailable): $outputPath");
            return true;
        }
        
        return false;
    } catch (Exception $e) {
        error_log("⚠️ GIF to PNG conversion error: " . $e->getMessage());
        return false;
    }
}
