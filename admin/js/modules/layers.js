export function initLayerUI() {
    const container = document.getElementById('layers-container');
    if (!container) return;
    
    container.innerHTML = '';
    for (let i = 1; i <= 8; i++) {
        const layerHtml = `
            <div class="layer-accordion" style="border: 0.5px solid rgba(255,255,255,0.5); margin-bottom: 1rem; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; border-bottom: 0.5px solid rgba(255,255,255,0.5); padding-bottom: 0.5rem;">
                    <h4 style="margin: 0; font-family: 'Roboto Mono', monospace; color: #ffffff;">LAYER_${i}</h4>
                    <label style="font-size: 0.8rem; color: rgba(255,255,255,0.5); font-family: 'Roboto Mono', monospace;"><input type="checkbox" name="layer_${i}_exclusion" value="1"> EXCLUSION_MODE</label>
                </div>
                
                <div class="form-group">
                    <label style="display: block; margin-bottom: 0.5rem; color: #ffffff; font-family: 'Roboto Mono', monospace; font-size: 0.85rem;">SOURCE_FILE (PNG)</label>
                    <input type="file" name="layer_${i}_image" accept="image/png" class="form-control" style="width: 100%; background: #000000; border: 0.5px solid rgba(255,255,255,0.5); color: #ffffff; padding: 0.5rem; font-family: 'Roboto Mono', monospace;">
                </div>

                <div class="form-group">
                    <label style="display: block; margin-bottom: 0.5rem; color: #ffffff; font-family: 'Roboto Mono', monospace; font-size: 0.85rem;">Z_INDEX (DEPTH)</label>
                    <input type="number" name="layer_${i}_z" class="form-control" step="0.001" value="${(i-1)*0.01}" style="width: 100%; background: #000000; border: 0.5px solid rgba(255,255,255,0.5); color: #ffffff; padding: 0.5rem; font-family: 'Roboto Mono', monospace;">
                </div>

                <details style="margin-top: 1rem;">
                    <summary style="cursor: pointer; color: rgba(255,255,255,0.5); font-size: 0.8rem; font-family: 'Roboto Mono', monospace;">[+] ANIMATION_PARAMS</summary>
                    <div style="padding: 1rem; border: 0.5px solid rgba(255,255,255,0.5); margin-top: 0.5rem; background: rgba(255,255,255,0.05);">
                        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <input type="number" name="layer_${i}_anim_x" placeholder="X" step="0.001" class="form-control" style="flex: 1; background: #000000; border: 0.5px solid rgba(255,255,255,0.5); color: #ffffff; padding: 0.5rem; font-family: 'Roboto Mono', monospace;">
                            <input type="number" name="layer_${i}_anim_y" placeholder="Y" step="0.001" class="form-control" style="flex: 1; background: #000000; border: 0.5px solid rgba(255,255,255,0.5); color: #ffffff; padding: 0.5rem; font-family: 'Roboto Mono', monospace;">
                            <input type="number" name="layer_${i}_anim_z" placeholder="Z" step="0.001" class="form-control" style="flex: 1; background: #000000; border: 0.5px solid rgba(255,255,255,0.5); color: #ffffff; padding: 0.5rem; font-family: 'Roboto Mono', monospace;">
                        </div>
                        <input type="number" name="layer_${i}_anim_duration" placeholder="DURATION (MS)" class="form-control" style="width: 100%; background: #000000; border: 0.5px solid rgba(255,255,255,0.5); color: #ffffff; padding: 0.5rem; font-family: 'Roboto Mono', monospace;">
                    </div>
                </details>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', layerHtml);
    }
}
