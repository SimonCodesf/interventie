// Entry voor onze eigen MindAR-aframe runtime (zie prepare_runtime.sh):
// dezelfde aframe-adapter als de officiële build, maar met de gepatchte
// controller (slanke msgpack-importer) en crop-detector (groot knipvenster).
import './.runtime-src/image-target/aframe.js';
