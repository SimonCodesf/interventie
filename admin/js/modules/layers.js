export function initLayerUI() {
    const container = document.getElementById('layers-container');
    if (!container) return;
    
    container.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
        const layerHtml = `
            <div class="layer-group">
                <h4>Laag ${i}</h4>
                <input type="file" name="layer_${i}_image" accept="image/png">
                <input type="number" name="layer_${i}_z" placeholder="Z-positie (m)" step="0.001" value="${(i-1)*0.01}">
                <label><input type="checkbox" name="layer_${i}_exclusion" value="1"> Exclusion</label>
                
                <details>
                    <summary>Animatie</summary>
                    <input type="number" name="layer_${i}_anim_x" placeholder="X" step="0.001">
                    <input type="number" name="layer_${i}_anim_y" placeholder="Y" step="0.001">
                    <input type="number" name="layer_${i}_anim_z" placeholder="Z" step="0.001">
                    <input type="number" name="layer_${i}_anim_duration" placeholder="Duur (ms)">
                </details>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', layerHtml);
    }
}
