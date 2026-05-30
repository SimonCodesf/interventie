import { BASE_URL } from './config.js';

export function renderPosterGrid(posters, onPosterClick) {
    const grid = document.getElementById('poster-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    posters.forEach(poster => {
        const card = document.createElement('div');
        card.className = 'poster-card';
        card.onclick = () => onPosterClick(poster);
        
        const img = document.createElement('img');
        img.src = poster.thumbnail.startsWith('http') ? poster.thumbnail : `${BASE_URL}${poster.thumbnail}`;
        img.alt = poster.title;
        img.loading = 'lazy';
        
        const info = document.createElement('div');
        info.className = 'poster-info';
        info.innerHTML = `<h3>${poster.title}</h3>`;
        
        card.appendChild(img);
        card.appendChild(info);
        grid.appendChild(card);
    });
}

export function showGalleryOverlay(poster) {
    // Create overlay if not exists
    let overlay = document.getElementById('gallery-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'gallery-overlay';
        overlay.className = 'gallery-overlay';
        document.body.appendChild(overlay);
    }
    
    // Populate overlay
    overlay.innerHTML = `
        <div class="overlay-header">
            <h2 class="overlay-title">${poster.title}</h2>
            <button class="close-overlay-btn" onclick="document.getElementById('gallery-overlay').style.display='none'">×</button>
        </div>
        <div class="overlay-content">
            <img src="${poster.jpeg_filename ? `/uploads/${poster.jpeg_filename}` : poster.thumbnail}" alt="${poster.title}">
            <p>${poster.description || ''}</p>
            <div class="download-buttons">
                <a href="/api/download/${poster.id}?format=jpeg" class="btn">Download JPEG</a>
                <a href="/api/download/${poster.id}?format=pdf&size=A3" class="btn">Download A3 PDF</a>
                <a href="/api/download/${poster.id}?format=pdf&size=A0" class="btn">Download A0 PDF</a>
            </div>
        </div>
    `;
    
    overlay.style.display = 'flex';
}
