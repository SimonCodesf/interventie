export function initLayerUI() {
    const container = document.getElementById('layers-container');
    if (!container) return;
    
    container.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
        const layerHtml = `
            <div class="layer-accordion" style="border: 0.5px solid var(--dim); margin-bottom: 1rem; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; border-bottom: 0.5px solid var(--dim); padding-bottom: 0.5rem;">
                    <h4 style="margin: 0; font-family: var(--font-data); color: var(--white);">LAYER_${i}</h4>
                    <label style="font-size: 0.8rem; color: var(--dim); font-family: var(--font-data);"><input type="checkbox" name="layer_${i}_exclusion" value="1"> EXCLUSION_MODE</label>
                </div>
                
                <div class="form-group">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--white); font-family: var(--font-data); font-size: 0.85rem;">SOURCE_FILE (PNG)</label>
                    <input type="file" name="layer_${i}_image" accept="image/png" class="form-control" style="width: 100%; background: var(--black); border: 0.5px solid var(--dim); color: var(--white); padding: 0.5rem; font-family: var(--font-data);">
                </div>

                <div class="form-group">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--white); font-family: var(--font-data); font-size: 0.85rem;">Z_INDEX (DEPTH)</label>
                    <input type="number" name="layer_${i}_z" class="form-control" step="0.001" value="${(i-1)*0.01}" style="width: 100%; background: var(--black); border: 0.5px solid var(--dim); color: var(--white); padding: 0.5rem; font-family: var(--font-data);">
                </div>

                <details style="margin-top: 1rem;">
                    <summary style="cursor: pointer; color: var(--dim); font-size: 0.8rem; font-family: var(--font-data);">[+] ANIMATION_PARAMS</summary>
                    <div style="padding: 1rem; border: 0.5px solid var(--dim); margin-top: 0.5rem; background: rgba(255,255,255,0.05);">
                        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <input type="number" name="layer_${i}_anim_x" placeholder="X" step="0.001" class="form-control" style="flex: 1; background: var(--black); border: 0.5px solid var(--dim); color: var(--white); padding: 0.5rem; font-family: var(--font-data);">
                            <input type="number" name="layer_${i}_anim_y" placeholder="Y" step="0.001" class="form-control" style="flex: 1; background: var(--black); border: 0.5px solid var(--dim); color: var(--white); padding: 0.5rem; font-family: var(--font-data);">
                            <input type="number" name="layer_${i}_anim_z" placeholder="Z" step="0.001" class="form-control" style="flex: 1; background: var(--black); border: 0.5px solid var(--dim); color: var(--white); padding: 0.5rem; font-family: var(--font-data);">
                        </div>
                        <input type="number" name="layer_${i}_anim_duration" placeholder="DURATION (MS)" class="form-control" style="width: 100%; background: var(--black); border: 0.5px solid var(--dim); color: var(--white); padding: 0.5rem; font-family: var(--font-data);">
                    </div>
                </details>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', layerHtml);
    }
}
