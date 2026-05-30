#!/usr/bin/env node
/**
 * compile_single_mind.js
 * 
 * Server-side .mind compilatie is NIET beschikbaar op deze hosting omgeving.
 * De 'canvas' package vereist native C++ build tools (node-gyp + Cairo)
 * die niet beschikbaar zijn op CloudLinux shared hosting.
 * 
 * Reclame-uploads worden zonder .mind opgeslagen en zijn niet AR-trackbaar
 * totdat een .mind bestand handmatig wordt gecompileerd en geüpload.
 * 
 * Voor lokale compilatie: node tools/compile_signs_mind.js
 */

const posterId = process.argv[2];
const jpegPath = process.argv[3];

console.log(`[MIND-COMPILE] Server-side compilatie niet beschikbaar voor poster: ${posterId || 'onbekend'}`);
console.log('[MIND-COMPILE] Reden: canvas package vereist native build tools (niet beschikbaar op CloudLinux)');
console.log('[MIND-COMPILE] Poster is opgeslagen zonder AR tracking. Upload handmatig een .mind bestand via het admin panel.');
process.exit(2);
