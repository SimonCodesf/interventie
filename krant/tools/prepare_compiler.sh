#!/bin/bash
# prepare_compiler.sh - Bouwt de admin-compiler met de gepatchte extractie
# (meer tracking-punten op tekstpagina's) — zie tools/compiler-src/extract.js
set -e
cd "$(dirname "$0")"
rm -rf .compiler-src
cp -r node_modules/mind-ar/src .compiler-src
cp compiler-src/extract.js .compiler-src/image-target/tracker/extract.js
echo "Compiler-bronnen klaar in tools/.compiler-src"
