import { detectMobileDevice, checkARSupport } from './modules/utils.js';
import { fetchPosters } from './modules/api.js';
import { renderPosterGrid, showGalleryOverlay } from './modules/ui.js';
import { startAR } from './modules/ar.js';

document.addEventListener('DOMContentLoaded', async () => {
    const isMobile = detectMobileDevice();
    const desktopView = document.getElementById('desktop-view');
    const arView = document.getElementById('ar-view');
    
    try {
        const posters = await fetchPosters();
        
        if (isMobile && checkARSupport()) {
            // Mobile AR Mode
            if (desktopView) desktopView.style.display = 'none';
            if (arView) arView.style.display = 'block';
            
            await startAR(posters);
        } else {
            // Desktop Gallery Mode
            if (desktopView) desktopView.style.display = 'block';
            if (arView) arView.style.display = 'none';
            
            renderPosterGrid(posters, (poster) => {
                showGalleryOverlay(poster);
            });
        }
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Er is een fout opgetreden bij het laden van de applicatie.');
    }
});
