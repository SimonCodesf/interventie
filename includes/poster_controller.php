<?php
// includes/poster_controller.php

function handleGetPosters($db) {
    try {
        $stmt = $db->query("SELECT * FROM posters ORDER BY upload_date DESC");
        $posters = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Decode layers_data for all posters
        foreach ($posters as &$poster) {
            if (isset($poster['layers_data']) && !empty($poster['layers_data'])) {
                $poster['layers'] = json_decode($poster['layers_data'], true);
                unset($poster['layers_data']);
            } else {
                $poster['layers'] = [];
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
        jsonResponse($poster);
    } else {
        jsonResponse(['message' => 'Poster niet gevonden'], 404);
    }
}

// Helper to trigger MindAR chunk rebuild
function triggerMindMerge() {
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
    
    $cmd = "$nodePath " . escapeshellarg($scriptPath) . " > /dev/null 2>&1 &";
    exec($cmd);
    error_log("Triggered MindAR merge: $cmd");
}

function handleUploadPoster($db) {
    if (!isAdmin()) {
        logAdminActivity('UNAUTHORIZED_UPLOAD_ATTEMPT', 'User not authenticated');
        jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    }
    
    // Accept both ar_marker_file (from admin.js) and ar_marker_file_hq (legacy)
    $arMarkerFile = isset($_FILES['ar_marker_file']) ? $_FILES['ar_marker_file'] : 
                    (isset($_FILES['ar_marker_file_hq']) ? $_FILES['ar_marker_file_hq'] : null);
    
    if (empty($_FILES['jpeg']) || empty($_FILES['pdfMedium']) || empty($_FILES['pdfLarge']) || empty($arMarkerFile)) {
        logAdminActivity('UPLOAD_FAILED', 'Missing required files');
        jsonResponse(['message' => 'Alle bestanden (JPEG, PDF Medium, PDF Large, .mind bestand) zijn verplicht'], 400);
    }
    
    $title = $_POST['title'] ?? '';
    $description = $_POST['description'] ?? '';
    $latitude = !empty($_POST['latitude']) ? (float)$_POST['latitude'] : null;
    $longitude = !empty($_POST['longitude']) ? (float)$_POST['longitude'] : null;
    $locationDescription = $_POST['location_description'] ?? '';
    $artikelLink = $_POST['artikel_link'] ?? '';
    $photographerCredit = $_POST['photographer_credit'] ?? '';
    
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
    $jpegValidation = validateUploadedFile($_FILES['jpeg'], ['image/jpeg'], 52428800);
    if (!$jpegValidation['valid']) jsonResponse(['message' => 'JPEG: ' . $jpegValidation['message']], 400);
    
    $pdfValidation1 = validateUploadedFile($_FILES['pdfMedium'], ['application/pdf'], 104857600);
    if (!$pdfValidation1['valid']) jsonResponse(['message' => 'PDF Medium: ' . $pdfValidation1['message']], 400);
    
    $pdfValidation2 = validateUploadedFile($_FILES['pdfLarge'], ['application/pdf'], 104857600);
    if (!$pdfValidation2['valid']) jsonResponse(['message' => 'PDF Large: ' . $pdfValidation2['message']], 400);
    
    $hqValidation = validateUploadedFile($arMarkerFile, ['application/octet-stream', 'application/json'], 10485760);
    if (!$hqValidation['valid']) jsonResponse(['message' => 'AR Marker: ' . $hqValidation['message']], 400);
    
    // Upload logic
    try {
        $id = generateUUID();
        $jpegFilename = $id . '_' . basename($_FILES['jpeg']['name']);
        $pdfMediumFilename = $id . '_medium.pdf';
        $pdfLargeFilename = $id . '_large.pdf';
        $thumbnailFilename = 'thumb_' . $jpegFilename;
        
        move_uploaded_file($_FILES['jpeg']['tmp_name'], UPLOADS_DIR . '/' . $jpegFilename);
        // Optimize JPEG (max 2500px for good balance between quality/size, 92% quality)
        resizeImage(UPLOADS_DIR . '/' . $jpegFilename, UPLOADS_DIR . '/' . $jpegFilename, 2500, 2500, 92);
        
        move_uploaded_file($_FILES['pdfMedium']['tmp_name'], UPLOADS_DIR . '/' . $pdfMediumFilename);
        move_uploaded_file($_FILES['pdfLarge']['tmp_name'], UPLOADS_DIR . '/' . $pdfLargeFilename);
        
        createThumbnail(UPLOADS_DIR . '/' . $jpegFilename, THUMBNAILS_DIR . '/' . $thumbnailFilename);
        
        // Mind files - save as {id}.mind (without _hq suffix for simplicity)
        $mindDir = __DIR__ . '/../assets/nft/' . $id;
        if (!file_exists($mindDir)) mkdir($mindDir, 0755, true);
        
        $mindFilename = $id . '.mind';
        move_uploaded_file($arMarkerFile['tmp_name'], $mindDir . '/' . $mindFilename);
        // Path without .mind extension (MindAR adds it automatically)
        $arMarkerPath = 'assets/nft/' . $id . '/' . $id;
        
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
                'anim_rot_x' => (float)($_POST["layer_{$i}_anim_rot_x"] ?? 0),
                'anim_rot_y' => (float)($_POST["layer_{$i}_anim_rot_y"] ?? 0),
                'anim_rot_z' => (float)($_POST["layer_{$i}_anim_rot_z"] ?? 0),
                'anim_scale' => (float)($_POST["layer_{$i}_anim_scale"] ?? 1.0),
                'anim_opacity' => (float)($_POST["layer_{$i}_anim_opacity"] ?? 1.0),
                'anim_duration' => (int)($_POST["layer_{$i}_anim_duration"] ?? 0),
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
                    // Use GIF directly as video (A-Frame can play GIFs in <a-video> elements)
                    error_log("[LAYER_{$i}] GIF detected, saving as video");
                    $gifFilename = $id . "_layer_{$i}.gif";
                    move_uploaded_file($uploadedFile['tmp_name'], AR_LAYERS_DIR . '/' . $gifFilename);
                    $layerData['filename'] = $gifFilename;
                    $layerData['is_video'] = true; // GIFs are treated as video
                    error_log("[LAYER_{$i}] ✅ GIF saved as video: {$gifFilename}");
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
            $layersData["layer_$i"] = $layerData;
        }
        
        // Database insert
        $stmt = $db->prepare("
            INSERT INTO posters (id, title, description, jpeg_filename, pdf_medium_filename, pdf_large_filename, thumbnail, latitude, longitude, location_description, artikel_link, photographer_credit, ar_marker, layers_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $id, $title, $description, $jpegFilename, $pdfMediumFilename, $pdfLargeFilename,
            '/uploads/thumbnails/' . $thumbnailFilename, $latitude, $longitude, $locationDescription,
            $artikelLink, $photographerCredit, $arMarkerPath, json_encode($layersData)
        ]);
        
        logAdminActivity('UPLOAD_SUCCESS', "$title (ID: $id)");
        
        // Trigger MindAR chunk rebuild
        triggerMindMerge();
        
        // Return new poster
        $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'poster' => $stmt->fetch(PDO::FETCH_ASSOC)]);
        
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
        $photographerCredit = $_POST['photographer_credit'] ?? $poster['photographer_credit'];
        
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
            
            $layerData = [
                'z' => isset($_POST["layer_{$i}_z"]) ? (float)$_POST["layer_{$i}_z"] : ($existingLayer['z'] ?? 0),
                'pos_x' => isset($_POST["layer_{$i}_pos_x"]) ? (float)$_POST["layer_{$i}_pos_x"] : ($existingLayer['pos_x'] ?? 0),
                'pos_y' => isset($_POST["layer_{$i}_pos_y"]) ? (float)$_POST["layer_{$i}_pos_y"] : ($existingLayer['pos_y'] ?? 0),
                'scale' => isset($_POST["layer_{$i}_scale"]) ? (float)$_POST["layer_{$i}_scale"] : ($existingLayer['scale'] ?? 1.0),
                'rot_z' => isset($_POST["layer_{$i}_rot_z"]) ? (float)$_POST["layer_{$i}_rot_z"] : ($existingLayer['rot_z'] ?? 0),
                'anim_x' => isset($_POST["layer_{$i}_anim_x"]) ? (float)$_POST["layer_{$i}_anim_x"] : ($existingLayer['anim_x'] ?? 0),
                'anim_y' => isset($_POST["layer_{$i}_anim_y"]) ? (float)$_POST["layer_{$i}_anim_y"] : ($existingLayer['anim_y'] ?? 0),
                'anim_z' => isset($_POST["layer_{$i}_anim_z"]) ? (float)$_POST["layer_{$i}_anim_z"] : ($existingLayer['anim_z'] ?? 0),
                'anim_rot_x' => isset($_POST["layer_{$i}_anim_rot_x"]) ? (float)$_POST["layer_{$i}_anim_rot_x"] : ($existingLayer['anim_rot_x'] ?? 0),
                'anim_rot_y' => isset($_POST["layer_{$i}_anim_rot_y"]) ? (float)$_POST["layer_{$i}_anim_rot_y"] : ($existingLayer['anim_rot_y'] ?? 0),
                'anim_rot_z' => isset($_POST["layer_{$i}_anim_rot_z"]) ? (float)$_POST["layer_{$i}_anim_rot_z"] : ($existingLayer['anim_rot_z'] ?? 0),
                'anim_scale' => isset($_POST["layer_{$i}_anim_scale"]) ? (float)$_POST["layer_{$i}_anim_scale"] : ($existingLayer['anim_scale'] ?? 1.0),
                'anim_opacity' => isset($_POST["layer_{$i}_anim_opacity"]) ? (float)$_POST["layer_{$i}_anim_opacity"] : ($existingLayer['anim_opacity'] ?? 1.0),
                'anim_duration' => isset($_POST["layer_{$i}_anim_duration"]) ? (int)$_POST["layer_{$i}_anim_duration"] : ($existingLayer['anim_duration'] ?? 0),
                'exclusion_filter' => isset($_POST["layer_{$i}_exclusion"]) ? ((int)$_POST["layer_{$i}_exclusion"] === 1) : ($existingLayer['exclusion_filter'] ?? false),
                'filename' => $existingLayer['filename'] ?? null,
                'is_video' => $existingLayer['is_video'] ?? false
            ];
            
            // Handle new layer image upload
            if (isset($_FILES["layer_{$i}_image"]) && $_FILES["layer_{$i}_image"]['error'] === UPLOAD_ERR_OK) {
                // Delete old layer file
                if (!empty($existingLayer['filename'])) {
                    @unlink(AR_LAYERS_DIR . '/' . $existingLayer['filename']);
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
                    error_log("[UPDATE_LAYER_{$i}] GIF detected, saving as video");
                    // Use GIF directly as video (A-Frame can play GIFs)
                    $gifFilename = $id . "_layer_{$i}.gif";
                    move_uploaded_file($uploadedFile['tmp_name'], AR_LAYERS_DIR . '/' . $gifFilename);
                    $layerData['filename'] = $gifFilename;
                    $layerData['is_video'] = true;
                    error_log("[UPDATE_LAYER_{$i}] ✅ GIF saved as video: {$gifFilename}");
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
            
            $layersData["layer_$i"] = $layerData;
        }
        
        // Update database
        $stmt = $db->prepare("
            UPDATE posters SET 
                title = ?, description = ?, jpeg_filename = ?, pdf_medium_filename = ?, pdf_large_filename = ?,
                thumbnail = ?, latitude = ?, longitude = ?, location_description = ?, 
                artikel_link = ?, photographer_credit = ?, ar_marker = ?, layers_data = ?
            WHERE id = ?
        ");
        
        $stmt->execute([
            $title, $description, $jpegFilename, $pdfMediumFilename, $pdfLargeFilename,
            $thumbnailPath, $latitude, $longitude, $locationDescription,
            $artikelLink, $photographerCredit, $arMarkerPath, json_encode($layersData), $id
        ]);
        
        logAdminActivity('UPDATE_POSTER', "$title (ID: $id)");
        
        // Trigger MindAR chunk rebuild
        triggerMindMerge();
        
        // Return updated poster
        $stmt = $db->prepare("SELECT * FROM posters WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'poster' => $stmt->fetch(PDO::FETCH_ASSOC)]);
        
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
