/**
 * A-Frame GIF Component - Met DOM-gebaseerde animatie
 * 
 * iOS Safari animeert GIFs alleen als ze in de DOM zitten.
 * Deze component voegt een verborgen img toe aan de body,
 * en captured de animatie naar een WebGL texture.
 */

(function() {
    'use strict';
    
    if (typeof AFRAME === 'undefined') {
        console.error('[gif-component] AFRAME niet beschikbaar');
        return;
    }
    
    // Container voor alle GIF images (verborgen)
    let gifContainer = null;
    
    function getGifContainer() {
        if (!gifContainer) {
            gifContainer = document.createElement('div');
            gifContainer.id = 'gif-animation-container';
            gifContainer.style.cssText = `
                position: fixed;
                left: -9999px;
                top: -9999px;
                width: 1px;
                height: 1px;
                overflow: hidden;
                pointer-events: none;
                visibility: hidden;
            `;
            document.body.appendChild(gifContainer);
        }
        return gifContainer;
    }
    
    // Cache voor geladen images
    const imageCache = new Map();
    
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
            this.updateInterval = 33; // ~30fps voor vloeiendere animatie
            this.loadedSrc = null;
            
            if (this.data.src) {
                this.loadGif(this.data.src);
            }
        },
        
        update: function(oldData) {
            if (oldData.src && oldData.src !== this.data.src && this.data.src) {
                this.loadGif(this.data.src);
            }
        },
        
        loadGif: function(src) {
            if (this.loadedSrc === src) {
                return;
            }
            this.loadedSrc = src;
            
            console.log('[gif-component] Laden:', src);
            
            // Check cache
            if (imageCache.has(src)) {
                const cached = imageCache.get(src);
                if (cached.complete && cached.naturalWidth > 0) {
                    console.log('[gif-component] Uit cache:', src);
                    this.img = cached;
                    this.setupFromImage(cached);
                    return;
                }
            }
            
            // Maak nieuw img element IN DE DOM
            const container = getGifContainer();
            this.img = document.createElement('img');
            this.img.crossOrigin = 'anonymous';
            this.img.style.cssText = 'width: auto; height: auto;';
            
            // Unieke ID voor tracking
            const imgId = 'gif-' + Math.random().toString(36).substr(2, 9);
            this.img.id = imgId;
            
            this.img.onload = () => {
                console.log('[gif-component] Geladen in DOM:', this.img.naturalWidth, 'x', this.img.naturalHeight);
                imageCache.set(src, this.img);
                this.setupFromImage(this.img);
                
                window.dispatchEvent(new CustomEvent('gif-loaded', { 
                    detail: { src: src } 
                }));
            };
            
            this.img.onerror = () => {
                console.error('[gif-component] Laden mislukt:', src);
                window.dispatchEvent(new CustomEvent('gif-error', { 
                    detail: { src: src } 
                }));
            };
            
            // BELANGRIJK: Eerst aan DOM toevoegen, dan src zetten
            // Dit zorgt dat de browser de GIF gaat animeren
            container.appendChild(this.img);
            this.img.src = src;
        },
        
        setupFromImage: function(img) {
            const maxSize = 512;
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            
            if (width > maxSize || height > maxSize) {
                const scale = maxSize / Math.max(width, height);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);
            }
            
            this.canvas.width = width;
            this.canvas.height = height;
            
            // Teken eerste frame
            this.ctx.drawImage(img, 0, 0, width, height);
            
            this.createTexture();
            this.isLoaded = true;
            
            if (this.data.autoplay) {
                this.isPlaying = true;
            }
        },
        
        createTexture: function() {
            if (this.texture) {
                this.texture.dispose();
            }
            
            this.texture = new THREE.CanvasTexture(this.canvas);
            this.texture.minFilter = THREE.LinearFilter;
            this.texture.magFilter = THREE.LinearFilter;
            this.texture.format = THREE.RGBAFormat;
            this.texture.needsUpdate = true;
            
            const mesh = this.el.getObject3D('mesh');
            if (mesh && mesh.material) {
                mesh.material.map = this.texture;
                mesh.material.transparent = true;
                mesh.material.needsUpdate = true;
            }
        },
        
        tick: function(time) {
            if (!this.isPlaying || !this.isLoaded || !this.img) return;
            
            // Update elke 33ms (~30fps)
            if (time - this.lastDrawTime < this.updateInterval) return;
            this.lastDrawTime = time;
            
            try {
                // De img in de DOM wordt door de browser geanimeerd
                // Wij capturen gewoon de huidige staat
                this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);
                
                if (this.texture) {
                    this.texture.needsUpdate = true;
                }
            } catch (e) {
                // Negeer CORS of andere fouten
            }
        },
        
        play: function() {
            this.isPlaying = true;
        },
        
        pause: function() {
            this.isPlaying = false;
        },
        
        remove: function() {
            this.isPlaying = false;
            this.isLoaded = false;
            
            if (this.texture) {
                this.texture.dispose();
                this.texture = null;
            }
            
            // Verwijder img NIET uit DOM - kan gecached zijn voor andere entities
            this.img = null;
            this.canvas = null;
            this.ctx = null;
        }
    });
    
    console.log('[gif-component] Geregistreerd (DOM-gebaseerd)');
})();
