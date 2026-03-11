<?php
/**
 * Klipy GIF API Proxy
 * 
 * Server-side proxy voor de Klipy API zodat de API key niet client-side
 * blootgesteld wordt. Bevat ook caching om rate limits te respecteren.
 * 
 * Gebruik via api.php routes:
 *   GET /api.php/verkeersborden/gif?q=sharp+left+turn
 *   GET /api.php/verkeersborden/signs
 */

// Klipy API configuratie
define('KLIPY_APP_KEY', 'emhyogWOFDc58FVWHnhFRd91r2F6LE2uVVJOyVqsVo7xdFbf7AuPpkS7LUYVNRh5');
define('KLIPY_BASE_URL', 'https://api.klipy.com/api/v1');
define('KLIPY_CACHE_DIR', dirname(__DIR__) . '/data/klipy_cache');
define('KLIPY_CACHE_TTL', 3600); // Cache GIF resultaten voor 1 uur
define('KLIPY_PER_PAGE', 20); // Aantal resultaten per zoekopdracht
define('KLIPY_CONTENT_FILTER', 'medium'); // Veiligheidsfilter

// Verkeersborden data pad
define('SIGNS_DATA_FILE', dirname(__DIR__) . '/verkeersborden/data/signs.json');
define('TOP30_DATA_FILE', dirname(__DIR__) . '/verkeersborden/data/top30.json');

// Zorg dat cache directory bestaat
if (!file_exists(KLIPY_CACHE_DIR)) {
    mkdir(KLIPY_CACHE_DIR, 0755, true);
}

/**
 * Zoek een random GIF via Klipy API voor een gegeven zoekopdracht
 * 
 * @param string $query Engelse zoekterm
 * @return array GIF data met url, title, etc.
 */
function searchKlipyGif($query) {
    // Controleer cache eerst
    $cacheKey = md5($query);
    $cacheFile = KLIPY_CACHE_DIR . "/{$cacheKey}.json";
    
    if (file_exists($cacheFile)) {
        $cacheAge = time() - filemtime($cacheFile);
        if ($cacheAge < KLIPY_CACHE_TTL) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if ($cached && !empty($cached['gifs'])) {
                // Kies een random GIF uit de gecachte resultaten
                $randomIndex = array_rand($cached['gifs']);
                return [
                    'success' => true,
                    'gif' => $cached['gifs'][$randomIndex],
                    'cached' => true,
                    'query' => $query,
                ];
            }
        }
    }
    
    // Genereer een unieke maar consistente customer_id
    $customerId = 'memeborden-' . md5($_SERVER['REMOTE_ADDR'] ?? 'anonymous');
    
    // Bouw Klipy API URL
    $apiUrl = KLIPY_BASE_URL . '/' . KLIPY_APP_KEY . '/gifs/search?' . http_build_query([
        'q' => $query,
        'customer_id' => $customerId,
        'per_page' => KLIPY_PER_PAGE,
        'locale' => 'be',
        'content_filter' => KLIPY_CONTENT_FILTER,
        'format_filter' => 'gif',
    ]);
    
    // API aanroep via cURL
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $apiUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'Memeborden/1.0 (interventie.org)',
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        return ['success' => false, 'error' => "Klipy API fout: $curlError"];
    }
    
    if ($httpCode !== 200) {
        return ['success' => false, 'error' => "Klipy API HTTP $httpCode"];
    }
    
    $data = json_decode($response, true);
    
    if (!$data || !$data['result'] || empty($data['data']['data'])) {
        return ['success' => false, 'error' => 'Geen GIFs gevonden voor: ' . $query];
    }
    
    // Extraheer relevante GIF data
    $gifs = [];
    foreach ($data['data']['data'] as $item) {
        // Zorg dat het een GIF is (geen ad)
        if (($item['type'] ?? '') === 'ad') continue;
        
        $gif = [
            'id' => $item['id'],
            'slug' => $item['slug'] ?? '',
            'title' => $item['title'] ?? '',
            'url' => null,
            'preview_url' => null,
            'width' => 0,
            'height' => 0,
        ];
        
        // Kies de 'md' (medium) formaat GIF - goed compromis tussen kwaliteit en grootte
        if (isset($item['file']['md']['gif'])) {
            $gif['url'] = $item['file']['md']['gif']['url'];
            $gif['width'] = $item['file']['md']['gif']['width'];
            $gif['height'] = $item['file']['md']['gif']['height'];
        } elseif (isset($item['file']['sm']['gif'])) {
            $gif['url'] = $item['file']['sm']['gif']['url'];
            $gif['width'] = $item['file']['sm']['gif']['width'];
            $gif['height'] = $item['file']['sm']['gif']['height'];
        }
        
        // Preview (klein formaat voor thumbnail)
        if (isset($item['file']['xs']['gif'])) {
            $gif['preview_url'] = $item['file']['xs']['gif']['url'];
        }
        
        if ($gif['url']) {
            $gifs[] = $gif;
        }
    }
    
    if (empty($gifs)) {
        return ['success' => false, 'error' => 'Geen bruikbare GIFs in resultaten'];
    }
    
    // Sla op in cache
    file_put_contents($cacheFile, json_encode(['gifs' => $gifs, 'cached_at' => time()]));
    
    // Kies een random GIF
    $randomIndex = array_rand($gifs);
    
    return [
        'success' => true,
        'gif' => $gifs[$randomIndex],
        'cached' => false,
        'query' => $query,
        'total_results' => count($gifs),
    ];
}

/**
 * Zoek meerdere GIFs via Klipy API (voor admin layer selector)
 * Geeft alle resultaten terug in plaats van 1 random
 * 
 * @param string $query Zoekterm
 * @return array Array met alle gevonden GIFs
 */
function searchKlipyGifMultiple($query) {
    // Controleer cache eerst
    $cacheKey = md5('multi_' . $query);
    $cacheFile = KLIPY_CACHE_DIR . "/{$cacheKey}.json";
    
    if (file_exists($cacheFile)) {
        $cacheAge = time() - filemtime($cacheFile);
        if ($cacheAge < KLIPY_CACHE_TTL) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if ($cached && !empty($cached['gifs'])) {
                return ['success' => true, 'gifs' => $cached['gifs'], 'cached' => true, 'query' => $query];
            }
        }
    }
    
    $customerId = 'admin-' . md5($_SERVER['REMOTE_ADDR'] ?? 'anonymous');
    
    $apiUrl = KLIPY_BASE_URL . '/' . KLIPY_APP_KEY . '/gifs/search?' . http_build_query([
        'q' => $query,
        'customer_id' => $customerId,
        'per_page' => KLIPY_PER_PAGE,
        'locale' => 'be',
        'content_filter' => KLIPY_CONTENT_FILTER,
        'format_filter' => 'gif',
    ]);
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $apiUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'Interventie-Admin/1.0 (interventie.org)',
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) return ['success' => false, 'error' => "Klipy API fout: $curlError"];
    if ($httpCode !== 200) return ['success' => false, 'error' => "Klipy API HTTP $httpCode"];
    
    $data = json_decode($response, true);
    if (!$data || !$data['result'] || empty($data['data']['data'])) {
        return ['success' => false, 'error' => 'Geen GIFs gevonden voor: ' . $query, 'gifs' => []];
    }
    
    $gifs = [];
    foreach ($data['data']['data'] as $item) {
        if (($item['type'] ?? '') === 'ad') continue;
        
        $gif = [
            'id' => $item['id'],
            'slug' => $item['slug'] ?? '',
            'title' => $item['title'] ?? '',
            'url' => null,
            'preview_url' => null,
            'width' => 0,
            'height' => 0,
        ];
        
        if (isset($item['file']['md']['gif'])) {
            $gif['url'] = $item['file']['md']['gif']['url'];
            $gif['width'] = $item['file']['md']['gif']['width'];
            $gif['height'] = $item['file']['md']['gif']['height'];
        } elseif (isset($item['file']['sm']['gif'])) {
            $gif['url'] = $item['file']['sm']['gif']['url'];
            $gif['width'] = $item['file']['sm']['gif']['width'];
            $gif['height'] = $item['file']['sm']['gif']['height'];
        }
        
        if (isset($item['file']['xs']['gif'])) {
            $gif['preview_url'] = $item['file']['xs']['gif']['url'];
        }
        
        if ($gif['url']) $gifs[] = $gif;
    }
    
    // Cache resultaten
    if (!empty($gifs)) {
        file_put_contents($cacheFile, json_encode(['gifs' => $gifs, 'cached_at' => time()]));
    }
    
    return ['success' => true, 'gifs' => $gifs, 'cached' => false, 'query' => $query, 'total_results' => count($gifs)];
}

/**
 * Haal verkeersborden data op
 * 
 * @param bool $top30Only Alleen top 30 teruggeven
 * @return array Signs data
 */
function getSignsData($top30Only = false) {
    $file = $top30Only ? TOP30_DATA_FILE : SIGNS_DATA_FILE;
    
    if (!file_exists($file)) {
        return ['success' => false, 'error' => 'Signs data niet gevonden. Draai eerst de scraper.'];
    }
    
    $data = json_decode(file_get_contents($file), true);
    if (!$data) {
        return ['success' => false, 'error' => 'Fout bij het lezen van signs data'];
    }
    
    return ['success' => true, 'data' => $data];
}

/**
 * Zoek een specifiek verkeersbord op ID
 * 
 * @param string $signId Bord ID (bijv. "A1a")
 * @return array|null Sign data of null
 */
function findSignById($signId) {
    $result = getSignsData(false);
    if (!$result['success']) return null;
    
    foreach ($result['data']['signs'] as $sign) {
        if (strcasecmp($sign['id'], $signId) === 0) {
            return $sign;
        }
    }
    
    return null;
}

/**
 * Haal een random GIF op voor een specifiek verkeersbord
 * 
 * @param string $signId Bord ID (bijv. "A1a")
 * @return array Resultaat met GIF data
 */
function getGifForSign($signId) {
    $sign = findSignById($signId);
    
    if (!$sign) {
        return ['success' => false, 'error' => "Verkeersbord '$signId' niet gevonden"];
    }
    
    if (!$sign['search_query']) {
        return ['success' => false, 'error' => "Geen zoekterm beschikbaar voor bord '$signId'"];
    }
    
    $gifResult = searchKlipyGif($sign['search_query']);
    
    // Voeg bord-info toe aan resultaat
    $gifResult['sign'] = [
        'id' => $sign['id'],
        'name' => $sign['name'],
        'serie' => $sign['serie'],
        'search_query' => $sign['search_query'],
    ];
    
    return $gifResult;
}

// === API Route Handlers ===

/**
 * GET /verkeersborden/signs - Haal alle (of top 30) verkeersborden op
 */
function handleGetSigns() {
    $top30Only = isset($_GET['top30']) && $_GET['top30'] === 'true';
    $result = getSignsData($top30Only);
    
    if ($result['success']) {
        jsonResponse($result['data']);
    } else {
        jsonResponse(['message' => $result['error']], 500);
    }
}

/**
 * GET /verkeersborden/gif?sign=A1a - Haal een random GIF op voor een verkeersbord
 * GET /verkeersborden/gif?q=custom+query - Zoek direct met een query
 */
function handleGetGif() {
    $signId = $_GET['sign'] ?? null;
    $directQuery = $_GET['q'] ?? null;
    
    if ($signId) {
        $result = getGifForSign($signId);
    } elseif ($directQuery) {
        $result = searchKlipyGif($directQuery);
    } else {
        jsonResponse(['message' => 'Parameter "sign" of "q" is vereist'], 400);
        return;
    }
    
    if ($result['success']) {
        jsonResponse($result);
    } else {
        jsonResponse(['message' => $result['error']], 404);
    }
}

/**
 * GET /verkeersborden/sign/{id} - Haal details van één verkeersbord op
 */
function handleGetSign($signId) {
    $sign = findSignById($signId);
    
    if ($sign) {
        jsonResponse($sign);
    } else {
        jsonResponse(['message' => "Verkeersbord '$signId' niet gevonden"], 404);
    }
}
