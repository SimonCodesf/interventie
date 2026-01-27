/**
 * A-Frame GIF Component - Met echte frame parsing
 * 
 * Parsed GIF bestanden en wisselt tussen frames.
 * Werkt op alle browsers inclusief iOS Safari.
 */

(function() {
    'use strict';
    
    if (typeof AFRAME === 'undefined') {
        console.error('[gif-component] AFRAME niet beschikbaar');
        return;
    }
    
    // Cache voor geparsede GIFs
    const gifCache = new Map();
    
    /**
     * Parse een GIF bestand naar individuele frames
     * Gebaseerd op gtk2k's gif parser
     */
    function parseGIF(arrayBuffer) {
        return new Promise((resolve, reject) => {
            const gif = new Uint8Array(arrayBuffer);
            let pos = 0;
            const delayTimes = [];
            let loadCnt = 0;
            let graphicControl = null;
            const frames = [];
            let loopCnt = 0;
            
            // Check GIF89a header
            if (gif[0] === 0x47 && gif[1] === 0x49 && gif[2] === 0x46 &&
                gif[3] === 0x38 && gif[4] === 0x39 && gif[5] === 0x61) {
                
                pos += 13 + +!!(gif[10] & 0x80) * Math.pow(2, (gif[10] & 0x07) + 1) * 3;
                const gifHeader = gif.subarray(0, pos);
                
                while (gif[pos] && gif[pos] !== 0x3b) {
                    const offset = pos;
                    const blockId = gif[pos];
                    
                    if (blockId === 0x21) {
                        const label = gif[++pos];
                        if ([0x01, 0xfe, 0xf9, 0xff].indexOf(label) !== -1) {
                            if (label === 0xf9) {
                                delayTimes.push((gif[pos + 3] + (gif[pos + 4] << 8)) * 10);
                            }
                            if (label === 0xff) {
                                loopCnt = gif[pos + 15] + (gif[pos + 16] << 8);
                            }
                            while (gif[++pos]) {
                                pos += gif[pos];
                            }
                            if (label === 0xf9) {
                                graphicControl = gif.subarray(offset, pos + 1);
                            }
                        } else {
                            reject(new Error('Unknown GIF label'));
                            return;
                        }
                    } else if (blockId === 0x2c) {
                        pos += 9;
                        pos += 1 + +!!(gif[pos] & 0x80) * (Math.pow(2, (gif[pos] & 0x07) + 1) * 3);
                        while (gif[++pos]) {
                            pos += gif[pos];
                        }
                        const imageData = gif.subarray(offset, pos + 1);
                        frames.push(URL.createObjectURL(new Blob([gifHeader, graphicControl, imageData])));
                    } else {
                        reject(new Error('Unknown GIF block'));
                        return;
                    }
                    pos++;
                }
            } else {
                reject(new Error('Not a GIF89a file'));
                return;
            }
            
            if (frames.length === 0) {
                reject(new Error('No frames found'));
                return;
            }
            
            // Laad alle frames als Image objecten EN composite op wit
            const loadedFrames = new Array(frames.length);
            let loaded = 0;
            
            // Temporary canvas voor compositing
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            let previousFrame = null;
            
            frames.forEach((blobUrl, i) => {
                const img = new Image();
                img.onload = () => {
                    // Set canvas size op eerste frame
                    if (i === 0) {
                        tempCanvas.width = img.width;
                        tempCanvas.height = img.height;
                    }
                    
                    // Composite frame op vorige frame (GIF animatie gedrag)
                    // Of op wit als eerste frame
                    if (i === 0 || !previousFrame) {
                        tempCtx.fillStyle = '#FFFFFF';
                        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    } else {
                        tempCtx.drawImage(previousFrame, 0, 0);
                    }
                    
                    // Teken nieuw frame eroverheen
                    tempCtx.drawImage(img, 0, 0);
                    
                    // Maak nieuwe Image van gecomposite frame
                    const compositeImg = new Image();
                    compositeImg.onload = () => {
                        loadedFrames[i] = compositeImg;
                        previousFrame = compositeImg;
                        loaded++;
                        
                        if (loaded === frames.length) {
                            // Cleanup blob URLs
                            frames.forEach(url => URL.revokeObjectURL(url));
                            
                            resolve({
                                frames: loadedFrames,
                                delays: delayTimes,
                                loopCount: loopCnt,
                                width: loadedFrames[0].width,
                                height: loadedFrames[0].height
                            });
                        }
                    };
                    compositeImg.src = tempCanvas.toDataURL();
                };
                img.onerror = () => {
                    reject(new Error('Failed to load frame ' + i));
                };
                img.src = blobUrl;
            });
        });
    }
    
    /**
     * Laad en parse een GIF
     */
    async function loadGIF(src) {
        // Check cache
        if (gifCache.has(src)) {
            return gifCache.get(src);
        }
        
        const response = await fetch(src);
        if (!response.ok) {
            throw new Error('Failed to fetch GIF: ' + response.status);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const gifData = await parseGIF(arrayBuffer);
        
        // Cache het resultaat
        gifCache.set(src, gifData);
        
        return gifData;
    }
    
    AFRAME.registerComponent('gif', {
        schema: {
            src: { type: 'string', default: '' },
            autoplay: { type: 'boolean', default: true }
        },
        
        init: function() {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
            this.texture = null;
            this.gifData = null;
            this.currentFrame = 0;
            this.lastFrameTime = 0;
            this.isPlaying = false;
            this.isLoaded = false;
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
        
        loadGif: async function(src) {
            if (this.loadedSrc === src) {
                return;
            }
            this.loadedSrc = src;
            
            console.log('[gif-component] Laden:', src);
            
            try {
                this.gifData = await loadGIF(src);
                
                console.log('[gif-component] Geparsed:', this.gifData.frames.length, 'frames,', 
                    this.gifData.width, 'x', this.gifData.height);
                
                // Setup canvas - kleinere max size voor betere performance
                const maxSize = 384; // Was 512, nu 384 voor snelheid
                let width = this.gifData.width;
                let height = this.gifData.height;
                
                if (width > maxSize || height > maxSize) {
                    const scale = maxSize / Math.max(width, height);
                    width = Math.floor(width * scale);
                    height = Math.floor(height * scale);
                }
                
                this.canvas.width = width;
                this.canvas.height = height;
                this.scaledWidth = width;
                this.scaledHeight = height;
                
                // Teken eerste frame
                this.drawFrame(0);
                
                // Maak texture
                this.createTexture();
                this.isLoaded = true;
                
                if (this.data.autoplay && this.gifData.frames.length > 1) {
                    this.isPlaying = true;
                    this.lastFrameTime = performance.now();
                }
                
                // Dispatch loaded event
                window.dispatchEvent(new CustomEvent('gif-loaded', { 
                    detail: { src: src } 
                }));
                
            } catch (err) {
                console.error('[gif-component] Parse fout:', err.message);
                window.dispatchEvent(new CustomEvent('gif-error', { 
                    detail: { src: src, error: err.message } 
                }));
            }
        },
        
        drawFrame: function(index) {
            if (!this.gifData || index >= this.gifData.frames.length) return;
            
            const frame = this.gifData.frames[index];
            
            // Frames zijn al gecomposite met witte achtergrond tijdens parsing
            // Gewoon direct tekenen zonder extra fill
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(frame, 0, 0, this.scaledWidth, this.scaledHeight);
        },
        
        createTexture: function() {
            if (this.texture) {
                this.texture.dispose();
            }
            
            this.texture = new THREE.CanvasTexture(this.canvas);
            this.texture.minFilter = THREE.LinearFilter;
            this.texture.magFilter = THREE.LinearFilter;
            this.texture.format = THREE.RGBAFormat; // MOET RGBAFormat zijn
            this.texture.needsUpdate = true;
            
            const mesh = this.el.getObject3D('mesh');
            if (mesh && mesh.material) {
                mesh.material.map = this.texture;
                // Canvas heeft witte achtergrond, dus geen transparantie nodig
                mesh.material.transparent = false;
                mesh.material.depthWrite = true;
                mesh.material.needsUpdate = true;
            }
        },
        
        tick: function(time) {
            if (!this.isPlaying || !this.isLoaded || !this.gifData) return;
            if (this.gifData.frames.length <= 1) return;
            
            // Check of het tijd is voor het volgende frame
            const delay = this.gifData.delays[this.currentFrame] || 100;
            
            if (time - this.lastFrameTime >= delay) {
                this.lastFrameTime = time;
                
                // Volgende frame
                this.currentFrame = (this.currentFrame + 1) % this.gifData.frames.length;
                
                // Teken frame
                this.drawFrame(this.currentFrame);
                
                // Update texture
                if (this.texture) {
                    this.texture.needsUpdate = true;
                }
            }
        },
        
        play: function() {
            if (this.gifData && this.gifData.frames.length > 1) {
                this.isPlaying = true;
                this.lastFrameTime = performance.now();
            }
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
            
            this.gifData = null;
            this.canvas = null;
            this.ctx = null;
        }
    });
    
    console.log('[gif-component] Geregistreerd (frame parser)');
})();
