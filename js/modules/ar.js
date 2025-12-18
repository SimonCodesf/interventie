import { fetchARSettings } from './api.js';

export async function startAR(posters) {
    console.log(' Starting AR...');
    
    const settings = await fetchARSettings() || {
        filterMinCF: 0.003,
        filterBeta: 0.025,
        warmupTolerance: 5,
        missTolerance: 5
    };
    
    const scene = document.querySelector('a-scene');
    if (!scene) return;

    // Setup assets
    const assets = document.querySelector('a-assets');
    
    posters.forEach(poster => {
        if (!poster.ar_marker_hq) return;
        
        // Create target entity
        const entity = document.createElement('a-entity');
        entity.setAttribute('mindar-image-target', `targetIndex: ${posters.indexOf(poster)}`);
        entity.setAttribute('id', `target-${poster.id}`);
        
        // Add layers
        if (poster.layers) {
            Object.values(poster.layers).forEach((layer, index) => {
                if (!layer.filename) return;
                
                const plane = document.createElement('a-plane');
                plane.setAttribute('src', `/uploads/ar-layers/${layer.filename}`);
                plane.setAttribute('position', `0 0 ${layer.z}`);
                plane.setAttribute('height', '1');
                plane.setAttribute('width', '0.707'); // A4 ratio
                plane.setAttribute('opacity', '1');
                plane.setAttribute('transparent', 'true');
                
                if (layer.anim_duration > 0) {
                    plane.setAttribute('animation', `
                        property: position;
                        to: ${layer.anim_x} ${layer.anim_y} ${layer.anim_z};
                        dur: ${layer.anim_duration};
                        dir: alternate;
                        loop: true;
                        easing: easeInOutSine
                    `);
                }
                
                entity.appendChild(plane);
            });
        }
        
        // Events
        entity.addEventListener('targetFound', () => {
            console.log(`Target found: ${poster.title}`);
            document.getElementById('scanning-overlay').style.display = 'none';
        });
        
        entity.addEventListener('targetLost', () => {
            console.log(`Target lost: ${poster.title}`);
            document.getElementById('scanning-overlay').style.display = 'flex';
        });
        
        scene.appendChild(entity);
    });
    
    // Configure MindAR
    // Note: MindAR is usually configured via HTML attributes on a-scene
    // We assume the HTML is already set up with mindar-image system
}
