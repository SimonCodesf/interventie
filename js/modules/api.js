import { API_URL } from './config.js';

export async function fetchPosters() {
    const response = await fetch(`${API_URL}/posters`);
    if (!response.ok) throw new Error('Cannot fetch posters');
    return await response.json();
}

export async function fetchPoster(id) {
    const response = await fetch(`${API_URL}/posters/${id}`);
    if (!response.ok) throw new Error('Cannot fetch poster');
    return await response.json();
}

export async function fetchARSettings() {
    try {
        const response = await fetch(`${API_URL}/settings/ar-tracking`);
        if (response.ok) return await response.json();
    } catch (e) {
        console.warn('Could not fetch AR settings', e);
    }
    return null;
}
