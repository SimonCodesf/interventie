# Fase 4: Maintenance & DevOps - Gedetailleerd Plan

## 1. Backup (✅ Voltooid)
- Git branch `phase-4-cleanup` aangemaakt.
- Lokale cPanel backup gestart door gebruiker.

## 2. Cleanup & Reorganisatie (✅ Voltooid)

### Stap 2a: Verwijderen ongebruikte bestanden (✅)
De volgende bestanden zijn verwijderd:
- `style_backup.css`
- `main-backup.js`
- `debug.php`
- `ADMIN_SETUP.md` & `AR-MARKER-SETUP.md`
- `tools/` map en inhoud
- `assets/dpdb.json`

### Stap 2b: Structuur Verbetering (✅)
Bestanden zijn verplaatst en paden zijn bijgewerkt in `index.html`, `api.php` en `.htaccess`.

**CSS:**
- `style.css` -> `css/style.css`
- `file-manager.css` -> `css/file-manager.css`
- `loader.css` -> `css/loader.css`

**JS:**
- `app.js` -> `js/app.js`
- `file-manager.js` -> `js/file-manager.js`

**Backend (PHP) & Data:**
- `config.php` -> `includes/config.php`
- `security.php` -> `includes/security.php`
- `posters.db` -> `data/posters.db`

### Stap 2c: Code Cleanup (✅)
- `js/app.js`: Logs opgeschoond, `logToLoader` vertaald naar NL, debug functies verwijderd.
- `js/file-manager.js`: Init logs verwijderd, comments vertaald.

## 3. Automatisering (DevOps) (✅ Deels Voltooid)
- **Backup Script**: `scripts/backup.sh` gemaakt (Light versie: data/uploads/config).
  - Test geslaagd: Backup gemaakt (~112MB).
- **GitHub Actions**: Workflow `deploy.yml` aangemaakt voor auto-deploy naar cPanel.
  - **Nog te doen**: Secrets (FTP_SERVER, FTP_USERNAME, FTP_PASSWORD) instellen in GitHub repository settings.

## 4. Afronding (✅ Voltooid)
- [x] Admin JS cleanup (`admin/js/main.js`)
- [x] Laatste check van alle functionaliteit.

**Fase 4 is hiermee afgerond.**
De website is nu:
1.  **Gestructureerd**: Duidelijke mappen (`css`, `js`, `includes`, `data`).
2.  **Schoon**: Geen ongebruikte bestanden of rommelige logs.
3.  **Veilig**: Gevoelige bestanden in `.gitignore`.
4.  **Beheersbaar**: Backup script en deployment workflow klaar.

We kunnen nu terugkeren naar **Fase 1 (Bugfixes)** of **Fase 2 (Admin)**.

---

## Actiepunten voor Gebruiker
1. **Goedkeuring verwijderen**: Mag ik de lijst onder "Stap 2a" verwijderen?
2. **Goedkeuring verplaatsen**: Ben je akkoord met de voorgestelde mappenstructuur in "Stap 2b"?
✅ Fase 4 voltooid - Auto-deploy actief
🚀 Deploy test met correct FTP server (ftp.beelsimon.com)
🚀 Fase 4 - Cleanup voltooid op cPanel, sync-state reset
✅ FTP account home directory gecorrigeerd naar /home/beelkstc/interventie.org/
✅ Server schoongemaakt - alleen essentiële mappen behouden (uploads, data, logs)
