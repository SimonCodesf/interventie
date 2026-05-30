# AR Marker Setup Instructies

## Probleem
Momenteel gebruikt het systeem één hardcoded `.mind` bestand (`AR_test_01.mind`). Als je meerdere posters hebt, moet elk een eigen marker kunnen hebben die de juiste AR content triggert.

## Oplossing: Multi-Target .mind Bestand

### Stap 1: Maak voor elke poster een individuele marker
Voor elke nieuwe poster moet je een `.mind` bestand genereren met de NFT Marker Creator:

```bash
cd nft-generator
node app.js -i path/to/poster-image.jpg
```

Dit genereert `.fset`, `.fset3`, en `.iset` bestanden.

### Stap 2: Compileer alle markers in één .mind bestand

MindAR ondersteunt multi-target tracking. Je moet alle posters samenvoegen in één `.mind` bestand:

1. **Handmatig (aanbevolen voor nu):**
   - Gebruik de MindAR compiler tool om individuele markers samen te voegen
   - Elk target krijgt een `targetIndex` (0, 1, 2, etc.)

2. **Of: Gebruik meerdere <a-entity mindar-image-target> elementen:**
   ```html
   <!-- Target 0 = Drone poster -->
   <a-entity mindar-image-target="targetIndex: 0">
       <!-- AR layers voor Drone -->
   </a-entity>
   
   <!-- Target 1 = Tweede poster -->
   <a-entity mindar-image-target="targetIndex: 1">
       <!-- AR layers voor tweede poster -->
   </a-entity>
   ```

### Stap 3: Link posters aan targetIndex in database

In het admin panel selecteer je nu:
- **AR Marker**: De naam van het marker target (bijv. "AR_test_01", "pinball", "trex")
- Dit wordt opgeslagen in database als `ar_marker`

### Stap 4: Dynamische AR Content Loading

Het main.js script moet:
1. Alle posters laden met hun `ar_marker` veld
2. Bij detectie van een target (via `targetFound` event):
   - Bepaal welk poster-marker is gedetecteerd
   - Toon de bijbehorende poster info in de footer
   - Laad de correcte AR layers (Drone_1.png, Drone_2.png, etc.)

## Huidige Implementatie

### Database
- ✅ `ar_marker` kolom toegevoegd aan `posters` tabel
- ✅ Admin panel heeft dropdown voor marker selectie
- ✅ API slaat `ar_marker` op bij upload en edit

### Frontend
- ⚠️ **NOG TE DOEN:** Dynamisch .mind bestand laden op basis van poster.ar_marker
- ⚠️ **NOG TE DOEN:** Multi-target setup in index.html
- ⚠️ **NOG TE DOEN:** Target detection koppelen aan juiste poster via ar_marker matching

## Quick Fix (voor nu)

**Tijdelijke oplossing:** Gebruik één .mind bestand met alle posters:

1. Genereer voor elke poster een marker
2. Compileer ze samen in `assets/all-posters.mind`
3. Gebruik volgorde (targetIndex) om te matchen:
   - targetIndex 0 = eerste poster in database
   - targetIndex 1 = tweede poster in database
   - etc.

4. Match in main.js via:
```javascript
// targetFound event geeft targetIndex
scene.addEventListener('targetFound', (event) => {
    const targetIndex = event.detail.targetIndex;
    const matchedPoster = window.allPosters[targetIndex];
    showDetectedPosterDetails(matchedPoster);
});
```

## Beste Oplossing (voor productie)

Genereer **dynamisch** een .mind bestand wanneer admin nieuwe posters upload:
1. Admin upload poster JPEG
2. Genereer automatisch NFT marker (via node nft-generator)
3. Voeg toe aan compiled `all-posters.mind` bestand
4. Update targetIndex mapping in database

Dit vereist backend integratie met de NFT Marker Creator.
