<?php
// includes/poster_controller.php

function handleGetPosters($db) {
    $stmt = $db->query("SELECT * FROM posters ORDER BY upload_date DESC");
    $posters = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Decode layers_data for all posters
    foreach ($posters as &$poster) {
        if (!empty($poster['layers_data'])) {
            $poster['layers'] = json_decode($poster['layers_data'], true);
            unset($poster['layers_data']);
        }
    }
    
    jsonResponse($posters);
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

function handleUploadPoster($db) {
    if (!isAdmin()) {
        logAdminActivity('UNAUTHORIZED_UPLOAD_ATTEMPT', 'User not authenticated');
        jsonResponse(['message' => 'Niet geautoriseerd'], 401);
    }
    
    if (empty($_FILES['jpeg']) || empty($_FILES['pdfMedium']) || empty($_FILES['pdfLarge']) || empty($_FILES['ar_marker_file_hq'])) {
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
    
    $hqValidation = validateUploadedFile($_FILES['ar_marker_file_hq'], ['application/octet-stream', 'application/json'], 10485760);
    if (!$hqValidation['valid']) jsonResponse(['message' => 'HQ marker: ' . $hqValidation['message']], 400);
    
    // Upload logic
    try {
        $id = generateUUID();
        $jpegFilename = $id . '_' . basename($_FILES['jpeg']['name']);
        $pdfMediumFilename = $id . '_medium.pdf';
        $pdfLargeFilename = $id . '_large.pdf';
        $thumbnailFilename = 'thumb_' . $jpegFilename;
        
        move_uploaded_file($_FILES['jpeg']['tmp_name'], UPLOADS_DIR . '/' . $jpegFilename);
        move_uploaded_file($_FILES['pdfMedium']['tmp_name'], UPLOADS_DIR . '/' . $pdfMediumFilename);
        move_uploaded_file($_FILES['pdfLarge']['tmp_name'], UPLOADS_DIR . '/' . $pdfLargeFilename);
        
        createThumbnail(UPLOADS_DIR . '/' . $jpegFilename, THUMBNAILS_DIR . '/' . $thumbnailFilename);
        
        // Mind files
        $mindDir = __DIR__ . '/../assets/nft/' . $id;
        if (!file_exists($mindDir)) mkdir($mindDir, 0755, true);
        
        $hqFilename = $id . '_hq.mind';
        move_uploaded_file($_FILES['ar_marker_file_hq']['tmp_name'], $mindDir . '/' . $hqFilename);
        $hqPath = 'assets/nft/' . $id . '/' . $id . '_hq';
        
        $lqPath = null;
        if (isset($_FILES['ar_marker_file_lq']) && $_FILES['ar_marker_file_lq']['error'] === UPLOAD_ERR_OK) {
            $lqFilename = $id . '_lq.mind';
            move_uploaded_file($_FILES['ar_marker_file_lq']['tmp_name'], $mindDir . '/' . $lqFilename);
            $lqPath = 'assets/nft/' . $id . '/' . $id . '_lq';
        }
        
        // Layers
        $layersData = [];
        for ($i = 1; $i <= 8; $i++) {
            $layerData = [
                'z' => (float)($_POST["layer_{$i}_z"] ?? 0),
                'anim_x' => (float)($_POST["layer_{$i}_anim_x"] ?? 0),
                'anim_y' => (float)($_POST["layer_{$i}_anim_y"] ?? 0),
                'anim_z' => (float)($_POST["layer_{$i}_anim_z"] ?? 0),
                'anim_duration' => (int)($_POST["layer_{$i}_anim_duration"] ?? 0),
                'exclusion_filter' => (int)($_POST["layer_{$i}_exclusion"] ?? 0) === 1,
                'filename' => null
            ];
            
            if (isset($_FILES["layer_{$i}_image"]) && $_FILES["layer_{$i}_image"]['error'] === UPLOAD_ERR_OK) {
                $layerFilename = $id . "_layer_{$i}.png";
                move_uploaded_file($_FILES["layer_{$i}_image"]['tmp_name'], AR_LAYERS_DIR . '/' . $layerFilename);
                $layerData['filename'] = $layerFilename;
            }
            $layersData["layer_$i"] = $layerData;
        }
        
        // Database insert
        $stmt = $db->prepare("
            INSERT INTO posters (id, title, description, jpeg_filename, pdf_medium_filename, pdf_large_filename, thumbnail, latitude, longitude, location_description, artikel_link, photographer_credit, ar_marker_hq, ar_marker_lq, layers_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $id, $title, $description, $jpegFilename, $pdfMediumFilename, $pdfLargeFilename,
            '/uploads/thumbnails/' . $thumbnailFilename, $latitude, $longitude, $locationDescription,
            $artikelLink, $photographerCredit, $hqPath, $lqPath, json_encode($layersData)
        ]);
        
        logAdminActivity('UPLOAD_SUCCESS', "$title (ID: $id)");
        
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
    jsonResponse(['success' => true]);
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
