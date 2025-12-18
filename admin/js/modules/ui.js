import { deletePoster } from './api.js';

export function renderPosterList(posters, token, onRefresh) {
    const list = document.getElementById('admin-poster-list');
    if (!list) return;
    
    list.innerHTML = '';
    posters.forEach(poster => {
        const item = document.createElement('div');
        item.className = 'sidebar-poster-item';
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="font-family: var(--font-data); font-size: 0.85rem; color: var(--white);">${poster.title}</h4>
                <button class="delete-btn" style="background: none; border: none; color: #ff5555; cursor: pointer; font-family: var(--font-data); font-size: 0.7rem;">[DEL]</button>
            </div>
            <p style="font-family: var(--font-data); font-size: 0.7rem; color: var(--dim); margin-top: 0.2rem;">
                ID: ${poster.id} | DL: ${poster.downloads || 0}
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
        
        list.appendChild(item);
    });
}
