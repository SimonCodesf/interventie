#!/bin/bash
# Download ontbrekende verkeersbord SVGs van Wikimedia en converteer naar PNG
# Gebruikt directe SVG link (niet thumbnail service die rate-limitte)
# Vereist: rsvg-convert (brew install librsvg)

IMAGES_DIR="$(dirname "$0")/../verkeersborden/images"
TEMP_DIR="/tmp/signs_svg"
mkdir -p "$TEMP_DIR" "$IMAGES_DIR"

# Wikimedia base URL: https://upload.wikimedia.org/wikipedia/commons/HASH/FILENAME
# We gebruiken de API om de directe URL op te halen, maar de SVG URLs worden
# direct uit het JSON bestand gehaald (API batch call al gedaan in Node script)

# Array: signId | image_filename | direct_SVG_URL (opgehaald via Wikimedia API)
# URLs zijn: https://upload.wikimedia.org/wikipedia/commons/HASH/FILENAME
declare -a SIGNS=(
    "A11|A11.png|https://upload.wikimedia.org/wikipedia/commons/b/b8/Belgian_road_sign_A11.svg"
    "A19|A19.png|https://upload.wikimedia.org/wikipedia/commons/a/a5/Belgian_road_sign_A19.svg"
    "A27|A27.png|https://upload.wikimedia.org/wikipedia/commons/8/81/Belgian_road_sign_A27.svg"
    "A29|A29.png|https://upload.wikimedia.org/wikipedia/commons/9/9c/Belgian_road_sign_A29.svg"
    "A35|A35.png|https://upload.wikimedia.org/wikipedia/commons/7/75/Belgian_road_sign_A35.svg"
    "A37|A37.png|https://upload.wikimedia.org/wikipedia/commons/a/a5/Belgian_road_sign_A37.svg"
    "A43|A43.png|https://upload.wikimedia.org/wikipedia/commons/8/81/Belgian_road_sign_A43.svg"
    "B19|B19.png|https://upload.wikimedia.org/wikipedia/commons/f/f2/Belgian_road_sign_B19.svg"
    "B21|B21.png|https://upload.wikimedia.org/wikipedia/commons/b/b8/Belgian_road_sign_B21.svg"
    "C5|C5.png|https://upload.wikimedia.org/wikipedia/commons/6/62/Belgian_road_sign_C5.svg"
    "C7|C7.png|https://upload.wikimedia.org/wikipedia/commons/c/ce/Belgian_road_sign_C7.svg"
    "C9|C9.png|https://upload.wikimedia.org/wikipedia/commons/7/72/Belgian_road_sign_C9.svg"
    "C11|C11.png|https://upload.wikimedia.org/wikipedia/commons/1/1f/Belgian_road_sign_C11.svg"
    "C15|C15.png|https://upload.wikimedia.org/wikipedia/commons/8/80/Belgian_road_sign_C15.svg"
    "C22|C22.png|https://upload.wikimedia.org/wikipedia/commons/d/d6/Belgian_road_sign_C22.svg"
    "C23|C23.png|https://upload.wikimedia.org/wikipedia/commons/6/6d/Belgian_road_sign_C23.svg"
    "C24b|C24b.png|https://upload.wikimedia.org/wikipedia/commons/5/55/Belgian_road_sign_C24b.svg"
    "C24c|C24c.png|https://upload.wikimedia.org/wikipedia/commons/a/a9/Belgian_road_sign_C24c.svg"
    "C25|C25.png|https://upload.wikimedia.org/wikipedia/commons/a/a5/Belgian_road_sign_C25.svg"
    "C35|C35.png|https://upload.wikimedia.org/wikipedia/commons/4/4b/Belgian_road_sign_C35.svg"
    "C37|C37.png|https://upload.wikimedia.org/wikipedia/commons/7/7e/Belgian_road_sign_C37.svg"
    "C45|C45.png|https://upload.wikimedia.org/wikipedia/commons/2/27/Belgian_road_sign_C45.svg"
    "C47|C47.png|https://upload.wikimedia.org/wikipedia/commons/1/16/Belgian_road_sign_C47.svg"
    "D1a|D1a.png|https://upload.wikimedia.org/wikipedia/commons/e/ef/Belgian_road_sign_D01a.svg"
    "D1b|D1b.png|https://upload.wikimedia.org/wikipedia/commons/3/3c/Belgian_road_sign_D01b.svg"
    "D1b2|D1b2.png|https://upload.wikimedia.org/wikipedia/commons/7/77/Belgian_road_sign_D1_ru.svg"
    "D7|D7.png|https://upload.wikimedia.org/wikipedia/commons/a/ad/Belgian_road_sign_D07.svg"
    "F1b|F1b.png|https://upload.wikimedia.org/wikipedia/commons/c/c0/Belgian_traffic_sign_F1b_horizontaal.svg"
    "F3a|F3a.png|https://upload.wikimedia.org/wikipedia/commons/e/e7/Belgian_traffic_sign_F3a_horizontaal.svg"
    "F47|F47.png|https://upload.wikimedia.org/wikipedia/commons/b/bf/Belgian_road_sign_F47.svg"
    "F49|F49.png|https://upload.wikimedia.org/wikipedia/commons/0/0b/Belgian_road_sign_F49.svg"
    "F57|F57.png|https://upload.wikimedia.org/wikipedia/commons/0/05/Belgian_road_sign_F57.svg"
    "F111|F111.png|https://upload.wikimedia.org/wikipedia/commons/6/6c/Belgian_road_sign_F111.svg"
)

DOWNLOADED=0
FAILED=0
SKIPPED=0
TOTAL=${#SIGNS[@]}

echo "📦 Downloading ${TOTAL} verkeersbord SVGs + conversie naar PNG"
echo "   Doel: ${IMAGES_DIR}"
echo ""

for entry in "${SIGNS[@]}"; do
    IFS='|' read -r signId pngFile svgUrl <<< "$entry"
    
    pngPath="${IMAGES_DIR}/${pngFile}"
    
    # Skip als PNG al bestaat
    if [[ -f "$pngPath" ]]; then
        ((SKIPPED++))
        continue
    fi
    
    svgPath="${TEMP_DIR}/${signId}.svg"
    
    printf "   [%d/%d] %s: " "$((DOWNLOADED + FAILED + SKIPPED + 1))" "$TOTAL" "$signId"
    
    # Download SVG
    HTTP_CODE=$(curl -s -o "$svgPath" -w "%{http_code}" "$svgUrl" \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    
    if [[ "$HTTP_CODE" != "200" ]]; then
        echo "❌ SVG download mislukt (HTTP ${HTTP_CODE})"
        ((FAILED++))
        sleep 3
        continue
    fi
    
    # Converteer SVG → PNG (512px breed)
    rsvg-convert -w 512 "$svgPath" -o "$pngPath" 2>/dev/null
    
    if [[ -f "$pngPath" ]] && [[ -s "$pngPath" ]]; then
        SIZE=$(ls -la "$pngPath" | awk '{print $5}')
        echo "✅ ${SIZE} bytes"
        ((DOWNLOADED++))
    else
        echo "❌ Conversie mislukt"
        ((FAILED++))
    fi
    
    # Pauze tussen downloads
    sleep 3
done

echo ""
echo "📊 Resultaat: ${DOWNLOADED} gedownload, ${SKIPPED} al aanwezig, ${FAILED} mislukt"

# Cleanup
rm -rf "$TEMP_DIR"

# ZC5 opmerking
if [[ ! -f "${IMAGES_DIR}/ZC5.png" ]]; then
    echo ""
    echo "⚠️  ZC5 (zonaal verkeersbord) bestaat niet op Wikimedia."
    echo "   Oplossing: maak handmatig een variant van C5 met 'ZONE' tekst."
fi
