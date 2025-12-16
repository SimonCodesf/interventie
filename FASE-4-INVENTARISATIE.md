# Fase 4: Cleanup & Reorganisatie - Inventarisatie

## 1. Database Situatie
- **Actief**: `posters.db` (SQLite) wordt gebruikt door `api.php` en `config.php`.
- **Overbodig**: `assets/dpdb.json` (Lijkt een restje van een oude Node.js versie of externe library).
- **Actie**: `assets/dpdb.json` kan waarschijnlijk weg.

## 2. JavaScript Bestanden
- **Actief**: `app.js` (Main AR logic) en `file-manager.js` (Desktop UI).
- **Overbodig**: `js/main.js` (Lijkt een oude entry point, importeert modules maar `index.html` gebruikt `app.js` en `file-manager.js` direct).
- **Actie**: `js/main.js` kan waarschijnlijk weg.

## 3. Tools Map (`tools/`)
Deze map bevat hulpprogramma's voor development/maintenance.
- `merge_mind_files.js`: **BEWAREN**. Wordt aangeroepen door `includes/poster_controller.php` (`triggerMindMerge`) om AR markers samen te voegen.
- `optimize_images.php`: **BEWAREN**. Handig script voor onderhoud.
- `package.json` & `node_modules`: **BEWAREN**. Nodig voor `merge_mind_files.js` (gebruikt `@msgpack/msgpack`).
- `inspect_mind.js` & `inspect_mind_v2.js`: **VRAAG**. Waarschijnlijk debug scripts. Mogen deze weg?
- `create_clean_zip.sh`: **VRAAG**. Lijkt een eenmalig script. Mag dit weg?

## 4. Overige Bestanden
- `ar-settings.json`: Config bestand. Verplaatsen naar `config/` of `assets/`.
- `posters.db`: **CRITICAAL**. Database bestand. NIET verwijderen, maar misschien verplaatsen naar een `data/` map (en config updaten) voor veiligheid?

---

## Vragen voor Gebruiker

1.  **Mag `assets/dpdb.json` weg?** (Lijkt ongebruikt)
2.  **Mag `js/main.js` weg?** (Lijkt ongebruikt, `index.html` gebruikt `app.js`)
3.  **Mogen `tools/inspect_mind*.js` en `tools/create_clean_zip.sh` weg?**
4.  **Database verplaatsen?** Wil je `posters.db` verplaatsen naar een beveiligde `data/` map (buiten web root indien mogelijk, of met .htaccess beveiliging)?

Na jouw antwoord voer ik de verwijderingen uit en ga ik door met het verplaatsen van CSS/JS bestanden.
