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
            
            // Laad GIF als src is opgegeven
            if (this.data.src) {
                this.loadGif(this.data.src);
            }
        },
        
        update: function(oldData) {
            // Als src veranderd is, herlaad
            if (oldData.src !== this.data.src && this.data.src) {
                this.loadGif(this.data.src);
            }
        },
        
        loadGif: function(src) {
            console.log('[gif-component] Laden:', src);
            
            // Cleanup vorige img als die bestaat
            if (this.img) {
                this.img.onload = null;
                this.img.onerror = null;
                this.img = null;
            }
            
            // Maak nieuw img element
            this.img = new Image();
            this.img.crossOrigin = 'anonymous';
            
            this.img.onload = () => {
                console.log('[gif-component] Geladen:', this.img.naturalWidth, 'x', this.img.naturalHeight);
                
                // Stel canvas grootte in (max 512px voor performance op mobiel)
                const maxSize = 512;
                let width = this.img.naturalWidth;
                let height = this.img.naturalHeight;
                
                if (width > maxSize || height > maxSize) {
                    const scale = maxSize / Math.max(width, height);
                    width = Math.floor(width * scale);
                    height = Math.floor(height * scale);
                }
                
                // Zet canvas grootte
                this.canvas.width = width;
                this.canvas.height = height;
                
                // Teken eerste frame
                this.ctx.drawImage(this.img, 0, 0, width, height);
                
                // Maak texture
                this.createTexture();
                this.isLoaded = true;
                
                // Start animatie capture
                if (this.data.autoplay) {
                    this.isPlaying = true;
                }
            };
            
            this.img.onerror = (e) => {
                console.error('[gif-component] Laden mislukt:', src);
            };
            
            // Start laden
            this.img.src = src;
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
                console.warn('[gif-component] Frame capture fout:', e.message);
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
            
            if (this.img) {
                this.img.onload = null;
                this.img.onerror = null;
                this.img = null;
            }
            
            this.canvas = null;
            this.ctx = null;
        }
    });
    
    console.log('[gif-component] Geregistreerd');
})();
