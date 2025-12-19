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
});
