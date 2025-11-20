import { deletePoster } from './api.js';

export function renderPosterList(posters, token, onRefresh) {
    const list = document.getElementById('admin-poster-list');
    if (!list) return;
    
    list.innerHTML = '';
    posters.forEach(poster => {
        const item = document.createElement('div');
        item.className = 'poster-item';
        item.innerHTML = `
            <img src="${poster.thumbnail}" alt="${poster.title}" width="50">
            <span>${poster.title}</span>
            <button class="delete-btn">Verwijder</button>
        `;
        
        item.querySelector('.delete-btn').onclick = async () => {
            if (confirm('Zeker weten?')) {
                try {
                    await deletePoster(poster.id, token);
                    onRefresh();
                } catch (e) {
                    alert(e.message);
                }
            }
        };
        
        list.appendChild(item);
    });
}
