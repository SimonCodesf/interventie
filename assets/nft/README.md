# NFT Marker Testing Guide

## Current Setup

You now have **working NFT tracking** integrated! 🎯

### Test Files

In `AR_test_01/`:
- `trex.fset`, `trex.fset3`, `trex.iset` - NFT marker descriptors
- `trex.gif` - The target image you scan with your phone

## How to Test NFT Tracking

1. **Start your PHP server** (if not running):
   ```bash
   cd /Users/simon/Library/CloudStorage/OneDrive-Persoonlijk/LUCA/Atelier/Interventie/Website
   php -S 0.0.0.0:8000
   ```

2. **Open on HTTPS** (required for camera):
   - Upload to your web host with HTTPS
   - OR use ngrok/similar to create HTTPS tunnel

3. **Print or display the trex.gif image**:
   - Open `assets/nft/AR_test_01/trex.gif` on another screen
   - OR print it on paper (A4 size works well)

4. **Point your phone camera at the trex image**:
   - You should see a **green box** and "NFT Tracking Works!" text appear!

## What's Working

✅ AR.js NFT tracking integrated
✅ Camera shows on HTTPS
✅ Test NFT marker ready (trex)
✅ markerFound/markerLost events working

## Next Steps: Generate Your Own NFT Markers

### Problem Encountered
Both the NFT-Marker-Creator web and node versions currently have bugs that prevent generating all 3 required files.

### Alternative Solutions

1. **Wait for the bug fix** in NFT-Marker-Creator
2. **Use a working online service**:
   - Search for "AR.js NFT marker generator online"
   - Some third-party tools may work better

3. **Build from source** (advanced):
   - The NFT-Marker-Creator uses C++ compiled to WASM
   - If you're comfortable with C++/Emscripten, you can recompile

### For Your Poster (AR_test_01.png)

Once you have working NFT files:
1. Generate 3 files: `AR_test_01.fset`, `AR_test_01.fset3`, `AR_test_01.iset`
2. Replace the `trex.*` files with your `AR_test_01.*` files
3. Update `main.js` line with NFT marker URL:
   ```javascript
   nftMarker.setAttribute('url', 'assets/nft/AR_test_01/AR_test_01');
   ```
4. Point camera at your actual poster!

## Tips for Good NFT Tracking

From AR.js documentation:
- ✅ **High DPI** (300+) = very stable tracking
- ✅ **Lots of detail/contrast** in the image
- ✅ **Avoid plain colors** or very simple images
- ✅ **Good lighting** when scanning

Your `AR_test_01.png` has:
- 150 DPI (good, not amazing)
- Lots of contrast (collage style) ✅
- Text and images (interesting features) ✅

Should work well once you get proper NFT files generated!
