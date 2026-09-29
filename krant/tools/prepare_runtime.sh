#!/bin/bash
# prepare_runtime.sh - Bouwt een gepatchte MindAR-runtime voor pagina-AR
#
# Stappen:
#   1. Kopieert mind-ar/src naar tools/.runtime-src
#   2. Vervangt controller.js door de slanke msgpack-variant (geen compiler)
#   3. Vervangt crop-detector.js door de versie met groot knipvenster
#      (essentieel voor tekstpagina's: matcher ziet de lay-out, niet losse glyphs)
# Daarna: npx vite build --config vite.aframe.config.js

set -e
cd "$(dirname "$0")"

rm -rf .runtime-src
cp -r node_modules/mind-ar/src .runtime-src
cp runtime-src/controller.js .runtime-src/image-target/controller.js
cp runtime-src/crop-detector.js .runtime-src/image-target/crop-detector.js
cp runtime-src/tracker.js .runtime-src/image-target/tracker/tracker.js

echo "Runtime bronnen klaar in tools/.runtime-src"
