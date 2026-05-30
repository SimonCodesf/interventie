import { deletePoster } from './api.js';

export function renderPosterList(posters, token, onRefresh) {
    const list = document.getElementById('admin-poster-list');
    if (!list) return;
    
    list.innerHTML = '';
    posters.forEach(poster => {
        const item = document.createElement('div');
        item.className = 'sidebar-poster-item';
        // Removed inline styles for CSS control
        item.innerHTML = `
            <div class="poster-item-header">
                <h4 class="poster-item-title">${poster.title}</h4>
                <button class="delete-btn">[DEL]</button>
            </div>
            <p class="poster-item-meta">
                ID: ${poster.id}
            </p>
        `;
        
        item.querySelector('.delete-btn').onclick = async (e) => {
            e.stopPropagation();
            if (confirm('CONFIRM_DELETE: ' + poster.title + '?')) {
                try {
                    await deletePoster(poster.id, token);
                    onRefresh();
                } catch (e) {
                    alert('ERROR: ' + e.message);
                }
            }
        };
        
        // Add click handler for editing
        item.onclick = (e) => {
            // Only trigger if not clicking delete button
            if (!e.target.classList.contains('delete-btn')) {
                // Populate form with poster data
                document.getElementById('poster-title').value = poster.title;
                document.getElementById('poster-description').value = poster.description || '';
                
                // Scroll to top to show form
                const content = document.querySelector('.window-content');
                if (content) content.scrollTop = 0;
                
                // Visual feedback
                document.querySelectorAll('.sidebar-poster-item').forEach(el => el.style.background = 'transparent');
                item.style.background = 'rgba(255, 255, 255, 0.1)';
            }
        };
        
        list.appendChild(item);
    });
}
