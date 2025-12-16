# Wekelijkse Poster Website - AI Agent Instructions

## 🇳🇱 Taal & Communicatie

**BELANGRIJK**: 
- Communiceer altijd in het **Nederlands** met de developer
- **Alle code comments dienen in Nederlands** te zijn (geen Engels)
- **Frontend tekst/UI dient in Nederlands** te zijn (variable names/code kunnen Engels blijven)
- Alle responses, uitleg, en feedback dienen in het Nederlands te zijn

---

## Project Overview
Een interactieve webapplicatie voor wekelijkse poster distributie met twee interfaces:
- **Desktop/File Manager UI** (retro terminal-stijl grid interface)
- **Mobile AR View** (augmented reality marker detectie met A-Frame/AR.js)

Combineert PHP backend API, vanilla JavaScript frontend en WebAR mogelijkheden voor responsieve poster weergave en admin beheer.

---

## Architecture Essentials

### Core Stack
- **Backend**: PHP 7+ (api.php, config.php, security.php)
- **Frontend**: Vanilla JS (ES6 modules) + A-Frame 1.x + MindAR/AR.js
- **Data**: JSON-based (ar-settings.json, assets/dpdb.json)
- **Styling**: CSS Grid + Flexbox (retro terminal esthetiek)

### Belangrijkste bestanden & verantwoordelijkheden

| Bestand | Doel |
|---------|------|
| **app.js** | Hoofd AR orchestrator: loader systeem, scene init, target tracking, GIF handling (2800+ regels) |
| **file-manager.js** | Desktop UI: terminal-stijl window manager, drag-drop, bestand browsing (759 regels) |
| **api.php** | REST endpoints: poster CRUD, authenticatie, AR instellingen, download tracking |
| **admin/js/main.js** | Admin panel: authenticatie, poster upload, layer beheer |
| **js/modules/api.js** | Client-side API wrapper (fetchPosters, fetchPoster, fetchARSettings) |
| **style.css** | Alle styling: zowel desktop grid als AR mobile views |

### Dataflow
1. **Publieke weergave**: Browser → app.js → api.php → posters data → file-manager.js renders grid
2. **AR Detectie**: A-Frame scene → targetFound event → Match poster via targetIndex → AR layers tonen
3. **Admin Upload**: Form submission → uploadPoster API → security checks → File system + DB update

---

## Kritieke patronen & conventies

### 1. **Dual-UI Architectuur**
- **Desktop (#desktop-view)**: File manager met grid galerij en sidebar navigatie
- **Mobile (#mobile-ar-view)**: A-Frame AR scene (display: none op desktop, getoond op mobiel via media query)
- **Naadloos schakelen**: Dezelfde databron, UI context bepaalt wat te tonen

```javascript
// Patroon: Voorwaardelijke rendering op basis van viewport
const isDesktop = window.innerWidth > 768;
if (isDesktop) {
    document.getElementById('desktop-view').style.display = 'block';
    document.getElementById('mobile-ar-view').style.display = 'none';
}
```

### 2. **Loader Systeem** (Nederlandse lokalisatie)
- Aangepaste hacker-stijl loader (#hacker-loader) met log queue
- Alle UI-tekst vertaald naar Nederlands met emoji verwijdering
- Patroon: `logToLoader('bericht')` voegt logs toe met willekeurige 20-400ms vertragingen
- Loader verborgen na `SYSTEM_READY` bericht

### 3. **Module Structuur**
- Client modules in `js/modules/`: api.js, ar.js, config.js, ui.js, utils.js
- Admin modules in `admin/js/modules/`: api.js, config.js, layers.js, ui.js
- Elke module heeft specifieke verantwoordelijkheid (geen god files)
- Gebruik ES6 imports: `import { functieNaam } from './config.js'`

### 4. **API Patronen**
- **Posters ophalen**: GET `/api.php?action=posters` → Array van poster objecten met id, title, image, downloads, ar_marker
- **Auth flow**: POST met wachtwoord → security.php rate limits & validatie → Returns token
- **AR instellingen**: GET `/api.php?action=settings&type=ar-tracking` → JSON met filterMinCF, filterBeta, etc.
- Alle responses zijn JSON; errors bevatten message veld

### 5. **Window/File Manager Systeem**
- Windows zijn Map objecten met ID als key
- Elke window is verplaatsbaar, verstelbaar, heeft Z-index beheer
- Sidebar filters: "all", "recent", "ar" (AR-enabled posters alleen)
- Bestand representatie: posters tonen als bestanden met metadata (titel, downloads, ar status)

---

## Beveiligingsimplementatie

### Authenticatie & Rate Limiting
- **Rate Limiting**: Max 5 pogingen per IP, 15-min lockout (security.php)
- **Session tokens**: Willekeurige tokens opgeslagen in sessionStorage (NIET wachtwoord)
- **Constant-time password vergelijking**: Voorkomt timing attacks
- **Session timeout**: 1 uur met auto-logout waarschuwing op 55 minuten
- **HttpOnly, Secure, SameSite cookies**: CSRF + XSS bescherming

### Bestanden om te begrijpen
- [config.php](config.php): Definieer `ADMIN_PASSWORD` (moet veranderd van 'BETA')
- [security.php](security.php): `isRateLimited()`, `recordFailedAttempt()`, `validateToken()`
- [api_utils.php](includes/api_utils.php): Database init, poster CRUD
- [BEVEILIGING.md](BEVEILIGING.md): Volledige beveiligingsdocumentatie

⚠️ **NOOIT**: Wachtwoord in frontend blootstellen, tokens in localStorage zonder HttpOnly opslaan, of rate limiting checks overslaan.

---

## AR Systeem Bijzonderheden

### MindAR Integratie
- **Multi-target support**: `.mind` bestand kan meerdere markers bevatten (targetIndex 0, 1, 2...)
- **Huidige beperking**: Gebruikt enkel gecompileerd `.mind` bestand; dynamische generatie nog niet geïmplementeerd
- **Target matching**: `targetFound` event geeft `targetIndex` → match aan poster via array positie
- **GIF support**: Aangepaste shader (aframe-gif-shader.js) handelt geanimeerde GIF afspeling op AR objecten af

### AR-Specifieke Code Patronen
```javascript
// Typische AR target detectie
scene.addEventListener('targetFound', (event) => {
    const targetIndex = event.detail.targetIndex;
    const poster = window.allPosters[targetIndex];
    // Poster info tonen, GIFs laden, UI updaten
});

// GIF handling (kritiek voor geanimeerde AR layers)
const gifLoader = new GIFLoader();
gifLoader.load('path/to/image.gif', (texture) => {
    // Update A-Frame material met GIF texture
});
```

### Bekende issues & TODOs
- [ ] Dynamisch `.mind` bestanden genereren bij poster upload (momenteel handmatig)
- [ ] Multi-chunk .mind laden (assets/chunks/ bestaat maar niet volledig geïntegreerd)
- [ ] iOS AR sessie state beheer (wat WebGL cleanup nodig)

---

## Veelvoorkomende taken & commando's

### GitHub & Deployment Workflow

**Repository**: `SimonCodesf/interventie` (public)
**Huidige branch**: `main` (default branch)
**Workflow**: 
1. **Lokale wijzigingen** → Branch aanmaken (bijv. `phase-1-fixes`)
2. **Commit + Push** → GitHub
3. **Direct Mergen**: Merge de branch direct naar `main` om te deployen.
4. **Auto-Deploy**: GitHub Actions (FTP-Deploy-Action) pusht automatisch naar `interventie.org`
5. **Live testen** → Wijzigingen direct zichtbaar op productie

**BELANGRIJK**: Zorg dat er altijd direct naar de productie website wordt gepushed (via merge naar main).

**Branch naamgeving**:
- `phase-1-fixes` - Mobile & Desktop UI fixes
- `phase-2-admin-security` - Admin panel & beveiliging
- `phase-3-features` - Nieuwe features
- `phase-4-devops` - Backup & automatisering

**Push naar GitHub**:
```bash
git add .
git commit -m "Fix: beschrijving van wijziging"
git push origin [branch-naam]
```

### Server Environment & AR Generation (CRITICAL)

⚠️ **BELANGRIJK**: De AR-functionaliteit is afhankelijk van server-side Node.js scripts.

- **Server Node Path**: `/opt/alt/alt-nodejs20/root/usr/bin/node` (CloudLinux environment)
- **Tools Directory**: `/tools/` bevat `merge_mind_files.js`
- **Node Modules**: `/tools/node_modules/` **MOET** op de server staan, maar **MAG NIET** in Git.
    - Deze map bevat `@msgpack/msgpack` nodig voor AR-generatie.
    - **NOOIT** de server "opschonen" door alles te verwijderen wat niet in Git staat, want dan verwijder je deze dependencies.
    - Als AR stopt met werken (geen nieuwe posters), controleer of `tools/node_modules` bestaat op de server.

**AR Update Flow**:
1. PHP `poster_controller.php` roept `triggerMindMerge()` aan na upload/delete.
2. `triggerMindMerge()` voert `node tools/merge_mind_files.js` uit via `exec()`.
3. Node script scant `assets/nft/`, bouwt chunks, en update `assets/chunks/manifest.json`.
4. Frontend laadt nieuwe manifest automatisch.

### cPanel Bestanden Structuur
- Public HTML root: `/public_html/` (waar live bestanden staan)
- PHP moet draaien: Zorg dat api.php, config.php, security.php correct ingesteld zijn
- Uploads directory: Zorg dat `/uploads/` directory schrijfbaar is (chmod 755)
- Session/Temp files: Login_attempts.json en cache bestanden moeten schrijfbar zijn

### Lokale Ontwikkeling vs. Production

**BELANGRIJK**: Dit project heeft **twee aparte omgevingen**:

1. **Lokale ontwikkeling** (`/Users/simon/.../Website/`)
   - Dient hoofdzakelijk als Git repository en code editor
   - **Lokale databases/uploads/node_modules kunnen NIET voorkomen** (geen lokale server)
   - Gebruik Git + GitHub voor samenwerking

2. **Production server** (`interventie.org` via cPanel/FTP)
   - Dit is waar de website **echt draait**
   - Alle databases, uploads, en data staan hier
   - Dit is waar eindgebruikers posters uploaden
   - Dit is waar je moet testen of dingen werken

**Workflow**:
- **Code wijzigingen**: Lokaal aanpassen → Git commit → GitHub push
- **Auto-deploy**: GitHub Actions ziet push → FTP upload naar server
- **Testing**: Altijd op de **live server** (`interventie.org`) testen, niet lokaal
- **Data/uploads**: Staan **ALLEEN op de server** (`/home/beelkstc/interventie.org/`)
  
**Dus**: Als je een bug onderzoekt met uploads of databases → Check altijd op `interventie.org`, nooit lokaal.

### Lokale Setup (Code-only)
```bash
# Repo klonen/updaten
git pull origin main

# Code aanpassen in je editor (VS Code)
# Commit wijzigingen
git add .
git commit -m "Fix: beschrijving"
git push origin main

# WAARSCHUWING: NOOIT proberen een lokale server/database op te zetten
# De website draait ALLEEN op interventie.org
```

**Testing**: Altijd via `http://interventie.org/` (live server), nooit lokaal.

**Admin Panel Testen**:
- Live URL: http://interventie.org/admin
- Default wachtwoord: 'BETA' (VERANDER DIT IN config.php!)
- Database: /home/beelkstc/interventie.org/data/posters.db (server-side)

### Bestandsstructuur Conventies
- **assets/nft/**: Individuele poster marker bestanden (.fset, .iset, .fset3)
- **assets/chunks/**: Gecompileerde chunk manifests voor lazy-loading markers
- **uploads/**: Door gebruiker geüploade posters (auto-aangemaakt, bevat thumbnails/ submap)
- **admin/**: Aparte admin panel interface
- **js/vendor/**: Third-party libraries (aframe.min.js, mindar-image-aframe.prod.js, gif.js)

### AR Features Testen
1. Test marker genereren: Gebruik MindAR compiler op JPEG poster
2. `ar-settings.json` updaten indien filter parameters afstellen
3. Mobile detectie testen: Media queries gebruiken max-width: 768px breakpoint
4. Debug logs: Controleer browser console voor loader berichten (Nederlandse tekst)

---

## 📋 Huidig Fase-Plan (December 2025)

Dit project wordt afgebouwd in 4 fasen. Zie `TODO.md` in de root voor gedetailleerde voortgang.

### Fase 1: Critical Fixes & UI Polish (Mobile & Desktop)
**Status**: IN PROGRESS
**Focus**: Zichtbare bugs en gebruiksvriendelijkheid

- [x] **Desktop**: Download count bug fixen (string concat → numeric sum)
- [ ] **Mobile/AR**: Camera feed positie centreren (tussen logo en bottom)
- [ ] **Mobile/AR**: Gallery UI/Swipe up verbeteren (desktop stijl, logo overlap fixen)
- [ ] **Desktop**: Log integratie beter maken (strakker aan onderkant pagina)
- [ ] **Desktop**: Tabel header spacing optimaliseren
- [ ] **General**: Frontend logs vertalen (EN → NL) en opschonen
- [ ] **Mobile**: "Play" knop verwijderen op AR video's (autoplay policy issue)

**Waarom eerst**: Gebruikers zien dit direct; kleine fixes, grote impact.

### Fase 2: Admin Panel Overhaul & Security
**Status**: NOT STARTED
**Focus**: Backend bruikbaarheid en veiligheid

- [ ] **Admin UI**: Gelijktrekken met "hacker" stijl (desktop terminal look)
- [ ] **Admin**: Upload editing fixen (consistentie met uploaden)
- [ ] **Security**: Beveiliging aanscherpen (review auth, headers, validatie)
- [ ] **Analytics**: Cookie Consent + basis analytics (GDPR compliant)
- [ ] **Analytics**: Gebruikerslokatie, download tracking, paginaviews

**Waarom hierna**: Afhankelijk van fase 1 UI patterns; nodig voor betrouwbaarheid.

### Fase 3: Advanced Features & AR Enhancements
**Status**: NOT STARTED
**Focus**: Nieuwe mogelijkheden

- [ ] **AR Options**: Meer interactieve AR layers/effects
- [ ] **Desktop**: Random tab opening bij startup (Welkom, Instructies, Manifest, etc.)
- [ ] **Mobile**: Camera permission persistence onderzoeken (minder prompts)
- [ ] **Mobile**: Better AR video handling (looping, controls)

**Waarom later**: Nice-to-haves; niet kritiek voor basisfunctionaliteit.

### Fase 4: Maintenance & DevOps
**Status**: IN PROGRESS
**Focus**: Codebase gezondheid en automatisering

- [x] **Cleanup**: Ongebruikte bestanden verwijderen (backup_*.js, test files, etc.)
- [x] **Structure**: Bestanden beter organiseren (css/, js/, assets/ opschoning)
- [ ] **Backup**: Lokaal backup systeem (dagelijks snapshots)
- [x] **DevOps**: GitHub Actions → Auto-push naar cPanel (CI/CD pipeline)
- [ ] **Docs**: README + API documentatie afmaken

**Waarom last**: Ondersteunend; eerst features werkend krijgen.

---

**Voortgang bijhouden**: `TODO.md` gebruiken voor dagelijks werk. Na elke fase checklist afmaken voordat naar volgende fase overgaan.

---

## Testing & Quality Checklist (Voor elke commit)

Voordat je iets pusht naar `main`:

### 1. Desktop Testing (Browser DevTools)
- [ ] Grid laadt correct (3 kolommen)
- [ ] Sidebar filters werken (all, ar, recent, by location)
- [ ] Drag/drop windows werken
- [ ] Download count is numeric (niet string concat)
- [ ] Log aan onderkant is leesbaar geïntegreerd
- [ ] Console heeft geen errors

### 2. Mobile Testing (DevTools → Device Emulation)
- [ ] AR view laadt in plaats van desktop
- [ ] Camera feed is gecentreerd (niet te ver omlaag)
- [ ] Gallery/swipe bar is niet achter logo
- [ ] Geen "Play" knop op AR video
- [ ] Console tekst is Nederlands

### 3. AR Testing (Fysieke device of mobile emulator)
- [ ] AR scene initialiseert
- [ ] Detecteert poster markers correct
- [ ] Layers verschijnen op juiste positie
- [ ] GIF animaties werken
- [ ] Geen crashes bij target found/lost

### 4. Security/Performance
- [ ] Rate limiting niet omzeild
- [ ] Session tokens niet in localStorage
- [ ] Geen hardcoded wachtwoorden
- [ ] Afbeeldingen geoptimaliseerd
- [ ] Geen console warnings

### 5. GitHub Checklist
- [ ] Juiste branch gebruikt (niet direct op main)
- [ ] Commit message duidelijk Nederlands
- [ ] Geen node_modules/ of sensitive files committed
- [ ] Pull request template ingevuld (indien PR)

---

## Voor wijzigingen controleren

### Check deze eerst
1. **Is dit PHP of JS?** → Backend wijzigingen nodig `api.php`, `security.php`, `config.php` review
2. **Beïnvloedt AR?** → Begrijp MindAR targetIndex systeem en A-Frame scene structuur
3. **Beïnvloedt auth?** → Review rate limiting in `security.php` en session handling
4. **Alleen admin?** → Wijzigingen waarschijnlijk in `admin/js/main.js` of API endpoint validatie
5. **UI change?** → Overweeg zowel desktop (#desktop-view) als mobile (#mobile-ar-view) contexten

### Altijd verifiëren
- ✅ Geen hardcoded wachtwoorden (gebruik config.php `ADMIN_PASSWORD`)
- ✅ API endpoints bestaan in api.php (controleer route parsing)
- ✅ Nederlandse tekst in loader is correct emoji-verwijderd
- ✅ AR code gebruikt targetIndex consistent met poster array volgorde
- ✅ Rate limiting is gecontroleerd voor login pogingen (niet omzeild)
- ✅ Bestandspaden gebruiken relatieve URLs voor cross-domain compatibiliteit

---

## Externe Afhankelijkheden

### Kritieke Bibliotheken
- **A-Frame 1.x**: 3D/AR scene framework (js/vendor/aframe.min.js)
- **MindAR**: Image-based AR tracking (js/vendor/mindar-image-aframe.prod.js)
- **GIF.js**: GIF parsing & animatie (js/vendor/gif.js)
- **PHP 7+**: Backend requirement (rate limiting, password hashing)

### AR Marker Bestanden
- Opgeslagen in `assets/nft/` (individuele markers) of `assets/all-posters.mind` (gecompileerd multi-target)
- Elke poster kan aangepast `ar_marker` veld hebben dat naar marker naam verwijst
- Generator: Aangepast Node script in `tools/` (nft-generator) - momenteel handmatig proces

---

## � Troubleshooting & Known Issues

### AR Generatie Werkt Niet
Als nieuwe posters wel uploaden maar AR niet werkt (geen nieuwe markers):
1. **Check Node Modules op Server**: De map `tools/node_modules` MOET bestaan op de server.
   - Deze staat in `.gitignore` dus wordt NIET meegepusht.
   - Als deze ontbreekt: Upload handmatig via FTP (NIET via Git).
2. **Check Server Node Path**: Het script gebruikt `/opt/alt/alt-nodejs20/root/usr/bin/node`.
3. **Test Script**: Draai een test PHP script dat `exec('node tools/merge_mind_files.js')` doet om de output te zien.

### Deployment Issues
- **FTP Errors**: Check GitHub Actions logs.
- **Bestanden niet zichtbaar**: Leeg browser cache of Cloudflare cache.

---

## Veelvoorkomende Foutmeldingen

1. **"Poster laadt niet"** → Controleer api.php routes, zorg dat posters.json bestaat
2. **"AR detecteert niet"** → Verifieer .mind bestand, controleer targetIndex matcht poster volgorde, test met bekend marker
3. **"Admin login mislukt"** → Controleer rate limiting (login_attempts.json), verifieer ADMIN_PASSWORD in config.php
4. **"UI rendert niet"** → Controleer desktop vs mobile detectie, bevestig element IDs matchen (#desktop-view, #mobile-ar-view)
5. **"GIF animateert niet"** → Verifieer aframe-gif-shader.js geladen, controleer GIF MIME type is correct

---

**Laatst bijgewerkt**: December 2025 | **Taal**: Nederlands (UI en Comments), Engelse variable/function namen
