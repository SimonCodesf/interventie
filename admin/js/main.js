import { login, uploadPoster, fetchPosters } from './modules/api.js';
import { renderPosterList } from './modules/ui.js';
import { initLayerUI } from './modules/layers.js';

let authToken = sessionStorage.getItem('auth_token');

document.addEventListener('DOMContentLoaded', async () => {
    const loginSection = document.getElementById('login-section');
    const uploadSection = document.getElementById('upload-section');
    const loginForm = document.getElementById('login-form');
    const uploadForm = document.getElementById('upload-form');
    
    // Init UI
    initLayerUI();
    
    // Check auth
    if (authToken) {
        showUpload();
    }
    
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            const pwd = document.getElementById('admin-password').value;
            const res = await login(pwd);
            authToken = res.token;
            sessionStorage.setItem('auth_token', authToken);
            showUpload();
        } catch (err) {
            document.getElementById('login-error').textContent = err.message;
        }
    };
    
    uploadForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('upload-btn');
        btn.disabled = true;
        btn.textContent = 'Bezig...';
        
        try {
            const formData = new FormData(uploadForm);
            await uploadPoster(formData, authToken);
            alert('Upload geslaagd!');
            uploadForm.reset();
            refreshPosters();
        } catch (err) {
            alert('Fout: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Poster Uploaden';
        }
    };
    
    function showUpload() {
        loginSection.style.display = 'none';
        uploadSection.style.display = 'flex';
        refreshPosters();
        // Wire analytics button (after UI visible)
        const analyticsBtn = document.getElementById('analytics-btn');
        if (analyticsBtn) analyticsBtn.onclick = async () => { await renderAnalytics(); };
    }
    
    // Posters verversen
    async function refreshPosters() {
        const posters = await fetchPosters();
        renderPosterList(posters, authToken, refreshPosters);
    }
    
    // Uitloggen
    document.getElementById('logout-btn').onclick = () => {
        sessionStorage.removeItem('auth_token');
        location.reload();
    };

    // Render basic analytics into the analytics panel
    async function renderAnalytics() {
        try {
            const posters = await fetchPosters();
            const panel = document.getElementById('analytics-panel');
            const content = document.getElementById('analytics-content');
            if (!panel || !content) return;
            // Compute totals
            const totalDownloads = posters.reduce((s,p) => s + (parseInt(p.downloads)||0), 0);
            const avgDownloads = posters.length ? Math.round(totalDownloads / posters.length) : 0;
            const top = posters.slice().sort((a,b)=> (parseInt(b.downloads)||0) - (parseInt(a.downloads)||0)).slice(0,10);

            let html = '';
            html += `<div class="analytics-summary"><div><strong>Totaal downloads:</strong> ${totalDownloads}</div>`;
            html += `<div><strong>Aantal posters:</strong> ${posters.length}</div>`;
            html += `<div><strong>Gem. downloads per poster:</strong> ${avgDownloads}</div></div>`;

            html += '<h4 style="margin-top:1rem;">Top 10 posters (downloads)</h4>';
            html += '<ol class="analytics-toplist">';
            top.forEach(p => {
                const d = parseInt(p.downloads) || 0;
                html += `<li style="margin-bottom:0.3rem;"><strong>${d}</strong> — ${p.title || p.id}</li>`;
            });
            html += '</ol>';

            content.innerHTML = html;
            panel.style.display = 'block';
            panel.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            console.error('Analytics laden mislukt', err);
            const content = document.getElementById('analytics-content');
            if (content) content.innerHTML = `<p style="color: #f55;">Fout bij laden analytics: ${err.message}</p>`;
        }
    }
});
