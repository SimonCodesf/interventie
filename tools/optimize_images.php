<?php
// tools/optimize_images.php - Batch optimize existing images
// Run this once to fix existing large files

header('Content-Type: text/plain');
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Define paths manually to avoid dependency issues
define('BASE_DIR', dirname(__DIR__));
define('UPLOADS_DIR', BASE_DIR . '/uploads');
define('AR_LAYERS_DIR', BASE_DIR . '/uploads/ar-layers');

echo "=== Image Optimization Tool ===\n";
echo "Base Dir: " . BASE_DIR . "\n";

// Include the resize function directly to be self-contained
function resizeImage($source, $dest, $maxWidth, $maxHeight, $quality = 85) {
    if (!file_exists($source)) return false;
    
    list($width, $height, $type) = getimagesize($source);
    if (!$width || !$height) return false;
    
    // Calculate new dimensions
    $ratio = $width / $height;
    if ($width > $maxWidth || $height > $maxHeight) {
        if ($width / $maxWidth > $height / $maxHeight) {
            $newWidth = $maxWidth;
            $newHeight = $newWidth / $ratio;
        } else {
            $newHeight = $maxHeight;
            $newWidth = $newHeight * $ratio;
        }
    } else {
        // No resize needed
        return false;
    }
    
    echo "   Resizing: {$width}x{$height} -> {$newWidth}x{$newHeight}\n";
    
    $newImage = imagecreatetruecolor($newWidth, $newHeight);
    
    switch ($type) {
        case IMAGETYPE_JPEG:
            $sourceImage = imagecreatefromjpeg($source);
            if (!$sourceImage) return false;
            imagecopyresampled($newImage, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagejpeg($newImage, $dest, $quality);
            break;
            
        case IMAGETYPE_PNG:
            $sourceImage = imagecreatefrompng($source);
            if (!$sourceImage) return false;
            // Preserve transparency
            imagealphablending($newImage, false);
            imagesavealpha($newImage, true);
            $transparent = imagecolorallocatealpha($newImage, 255, 255, 255, 127);
            imagefilledrectangle($newImage, 0, 0, $newWidth, $newHeight, $transparent);
            
            imagecopyresampled($newImage, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagepng($newImage, $dest, 6); 
            break;
            
        default:
            return false;
    }
    
    if (isset($sourceImage)) imagedestroy($sourceImage);
    if (isset($newImage)) imagedestroy($newImage);
    return true;
}

// 1. Optimize AR Layers (PNG)
echo "\n--- Scanning AR Layers (max 1024px) ---\n";
if (is_dir(AR_LAYERS_DIR)) {
    $files = glob(AR_LAYERS_DIR . '/*.png');
    $count = 0;
    $optimized = 0;
    
    foreach ($files as $file) {
        $count++;
        $filename = basename($file);
        $size = filesize($file);
        $sizeMB = round($size / 1024 / 1024, 2);
        
        echo "[$count] Checking $filename ($sizeMB MB)... ";
        
        if ($size > 500 * 1024) { // Only check files > 500KB
            if (resizeImage($file, $file, 1024, 1024)) {
                $newSize = filesize($file);
                $newSizeMB = round($newSize / 1024 / 1024, 2);
                echo "✅ Optimized to $newSizeMB MB\n";
                $optimized++;
            } else {
                echo "Skipped (already small enough dimensions)\n";
            }
        } else {
            echo "Skipped (small file)\n";
        }
    }
    echo "Done. Optimized $optimized / $count layers.\n";
} else {
    echo "❌ AR Layers directory not found: " . AR_LAYERS_DIR . "\n";
}

// 2. Optimize Posters (JPG)
echo "\n--- Scanning Posters (max 1920px) ---\n";
if (is_dir(UPLOADS_DIR)) {
    $files = glob(UPLOADS_DIR . '/*.{jpg,jpeg,JPG,JPEG}', GLOB_BRACE);
    $count = 0;
    $optimized = 0;
    
    foreach ($files as $file) {
        $count++;
        $filename = basename($file);
        $size = filesize($file);
        $sizeMB = round($size / 1024 / 1024, 2);
        
        echo "[$count] Checking $filename ($sizeMB MB)... ";
        
        if ($size > 1 * 1024 * 1024) { // Only check files > 1MB
            if (resizeImage($file, $file, 1920, 1920, 85)) {
                $newSize = filesize($file);
                $newSizeMB = round($newSize / 1024 / 1024, 2);
                echo "✅ Optimized to $newSizeMB MB\n";
                $optimized++;
            } else {
                echo "Skipped (already small enough dimensions)\n";
            }
        } else {
            echo "Skipped (small file)\n";
        }
    }
    echo "Done. Optimized $optimized / $count posters.\n";
} else {
    echo "❌ Uploads directory not found: " . UPLOADS_DIR . "\n";
}

echo "\n=== Optimization Complete ===\n";
?>
