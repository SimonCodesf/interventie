import { API_URL } from './config.js';

export async function login(password) {
    const response = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    if (!response.ok) throw new Error('Login failed');
    return await response.json();
}

export async function uploadPoster(formData, token) {
    const response = await fetch(`${API_URL}/admin/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Upload failed');
    }
    return await response.json();
}

export async function fetchPosters() {
    const response = await fetch(`${API_URL}/posters`);
    return await response.json();
}

export async function deletePoster(id, token) {
    const response = await fetch(`${API_URL}/admin/posters/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Delete failed');
}
