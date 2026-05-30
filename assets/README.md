# Assets Directory

## Files die hier moeten komen:

### all-posters.mind
Dit is het gecompileerde MindAR tracking bestand dat alle poster-afbeeldingen bevat.

**Hoe te genereren:**
1. Verzamel alle poster JPEG bestanden
2. Gebruik de MindAR Image Compiler: https://hiukim.github.io/mind-ar-js-doc/tools/compile
3. Upload de afbeeldingen in de juiste volgorde (moet matchen met de API response)
4. Download het gegenereerde .mind bestand
5. Plaats het hier als `all-posters.mind`

**Belangrijk:** De volgorde van afbeeldingen in de compiler moet exact matchen met de volgorde in `GET /api.php/posters` (gesorteerd op `upload_date`).

## Test Setup

Voor testing zonder het echte .mind bestand:
- Je kunt een enkele test afbeelding gebruiken
- Gebruik de MindAR compiler om een test.mind te genereren
- Update de src in index.html naar `assets/test.mind`
