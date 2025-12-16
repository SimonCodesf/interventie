# Fase 4: Maintenance & DevOps - Gedetailleerd Plan

## 1. Backup (✅ Voltooid)
- Git branch `phase-4-cleanup` aangemaakt.
- Lokale cPanel backup gestart door gebruiker.

## 2. Cleanup & Reorganisatie (🚧 In Progress)

### Stap 2a: Verwijderen ongebruikte bestanden
De volgende bestanden lijken overbodig en worden verwijderd na goedkeuring:
- `style_backup.css` (Oude backup)
- `main-backup.js` (Oude backup)
- `debug.php` (Indien niet meer nodig voor productie)
- `ADMIN_SETUP.md` & `AR-MARKER-SETUP.md` (Inhoud samenvoegen in README of docs map, daarna verwijderen)
- `.github/copilot-instructions_20251216145929.md` (Oude versie)
- `interventie_clean.zip` (Oude zip)

### Stap 2b: Structuur Verbetering (Verplaatsen)
Om de root op te schonen, verplaatsen we bestanden naar logische submappen.
**Let op:** Dit vereist aanpassingen in `index.html` en PHP `require` paden.

**CSS:**
- `style.css` -> `css/style.css`
- `file-manager.css` -> `css/file-manager.css`
- `loader.css` -> `css/loader.css`

**JS:**
- `app.js` -> `js/app.js`
- `file-manager.js` -> `js/file-manager.js`

**Backend (PHP):**
- `config.php` -> `includes/config.php` (of `config/config.php`)
- `security.php` -> `includes/security.php`
- `ar-settings.json` -> `assets/ar-settings.json` (of `config/`)

### Stap 2c: Code Cleanup
- Verwijderen van `console.log` (behalve errors/kritieke info).
- Verwijderen van uitgecommentarieerde code blokken.
- Vertalen van Engelse comments naar Nederlands (zoals in instructies).

## 3. Automatisering (DevOps)
- **Backup Script**: Shell script voor lokale backups.
- **GitHub Actions**: Workflow voor auto-deploy naar cPanel.

---

## Actiepunten voor Gebruiker
1. **Goedkeuring verwijderen**: Mag ik de lijst onder "Stap 2a" verwijderen?
2. **Goedkeuring verplaatsen**: Ben je akkoord met de voorgestelde mappenstructuur in "Stap 2b"?
