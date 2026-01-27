/**
 * Simpele A-Frame GIF Component
 * Gebruikt browser's native GIF animatie en captured die naar WebGL texture
 * Veel stabieler dan handmatige frame parsing
 */

(function() {
    'use strict';
    
    // Wacht tot AFRAME beschikbaar is
    if (typeof AFRAME === 'undefined') {
        console.error('[gif-component] AFRAME niet beschikbaar');
        return;
    }
    
    // Cache voor geladen images - voorkomt dubbel laden
    const imageCache = new Map();
    
    /**
     * A-Frame component voor geanimeerde GIFs
     * Gebruikt een verborgen <img> element dat de browser native animeert
     * en captured elke frame naar een canvas texture
     */
    AFRAME.registerComponent('gif', {
        schema: {
            src: { type: 'string', default: '' },
            autoplay: { type: 'boolean', default: true }
        },
        
        init: function() {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            this.texture = null;
            this.img = null;
            this.isLoaded = false;
            this.isPlaying = false;
            this.lastDrawTime = 0;
            this.updateInterval = 50; // Update texture elke 50ms (20 fps)
            this.loadedSrc = null; // Track welke src al geladen is
            
            // Laad GIF als src is opgegeven
            if (this.data.src) {
                this.loadGif(this.data.src);
            }
        },
        
        update: function(oldData) {
            // ALLEEN herladen als src ECHT veranderd is (niet bij eerste init)
            if (oldData.src && oldData.src !== this.data.src && this.data.src) {
                this.loadGif(this.data.src);
            }
        },
        
        loadGif: function(src) {
            // Voorkom dubbel laden van dezelfde src
            if (this.loadedSrc === src) {
                console.log('[gif-component] Skip dubbel laden:', src);
                return;
            }
            this.loadedSrc = src;
            
            console.log('[gif-component] Laden:', src);
            
            // Check cache eerst
            if (imageCache.has(src)) {
                const cachedImg = imageCache.get(src);
                if (cachedImg.complete && cachedImg.naturalWidth > 0) {
                    console.log('[gif-component] Uit cache:', src);
                    this.setupFromImage(cachedImg);
                    return;
                }
            }
            
            // Cleanup vorige img als die bestaat
            if (this.img && !imageCache.has(this.img.src)) {
                this.img.onload = null;
                this.img.onerror = null;
            }
            
            // Maak nieuw img element
            this.img = new Image();
            this.img.crossOrigin = 'anonymous';
            
            this.img.onload = () => {
                // Zet in cache
                imageCache.set(src, this.img);
                this.setupFromImage(this.img);
                
                // Dispatch event zodat app.js weet dat GIF geladen is
                window.dispatchEvent(new CustomEvent('gif-loaded', { 
                    detail: { src: src } 
                }));
            };
            
            this.img.onerror = (e) => {
                console.error('[gif-component] Laden mislukt:', src);
                // Dispatch error event
                window.dispatchEvent(new CustomEvent('gif-error', { 
                    detail: { src: src } 
                }));
            };
            
            // Start laden
            this.img.src = src;
        },
        
        setupFromImage: function(img) {
            console.log('[gif-component] Geladen:', img.naturalWidth, 'x', img.naturalHeight);
            
            // Stel canvas grootte in (max 512px voor performance op mobiel)
            const maxSize = 512;
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            
            if (width > maxSize || height > maxSize) {
                const scale = maxSize / Math.max(width, height);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
            }
            
            // Zet canvas grootte
            this.canvas.width = width;
            this.canvas.height = height;
            
            // Teken eerste frame
            this.ctx.drawImage(img, 0, 0, width, height);
            
            // Maak texture
            this.createTexture();
            this.isLoaded = true;
            
            // Start animatie capture
            if (this.data.autoplay) {
                this.isPlaying = true;
            }
        },
        
        createTexture: function() {
            // Verwijder oude texture
            if (this.texture) {
                this.texture.dispose();
            }
            
            // Maak nieuwe texture van canvas
            this.texture = new THREE.CanvasTexture(this.canvas);
            this.texture.minFilter = THREE.LinearFilter;
            this.texture.magFilter = THREE.LinearFilter;
            this.texture.format = THREE.RGBAFormat;
            this.texture.needsUpdate = true;
            
            // Pas texture toe op mesh
            const mesh = this.el.getObject3D('mesh');
            if (mesh && mesh.material) {
                mesh.material.map = this.texture;
                mesh.material.transparent = true;
                mesh.material.needsUpdate = true;
            }
        },
        
        tick: function(time) {
            // Alleen updaten als geladen en aan het spelen
            if (!this.isPlaying || !this.isLoaded || !this.img) return;
            
            // Beperk updates voor performance (elke 50ms = 20fps)
            if (time - this.lastDrawTime < this.updateInterval) return;
            this.lastDrawTime = time;
            
            try {
                // Teken huidige frame van img naar canvas
                // De browser animeert de GIF automatisch, wij capturen gewoon de huidige staat
                this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);
                
                // Update texture
                if (this.texture) {
                    this.texture.needsUpdate = true;
                }
            } catch (e) {
                // Stil falen bij CORS of andere issues
            }
        },
        
        play: function() {
            this.isPlaying = true;
        },
        
        pause: function() {
            this.isPlaying = false;
        },
        
        remove: function() {
            // Cleanup
            this.isPlaying = false;
            this.isLoaded = false;
            
            if (this.texture) {
                this.texture.dispose();
                this.texture = null;
            }
            
            // Img niet verwijderen - zit in cache
            this.img = null;
            this.canvas = null;
            this.ctx = null;
        }
    });
    
    console.log('[gif-component] Geregistreerd');
})();
