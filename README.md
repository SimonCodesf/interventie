# Wekelijkse Poster Website

Een complete website voor het wekelijks uploaden en distribueren van gratis downloadbare posters.

## 🎨 Features

- **Flex Grid Gallery**: Responsive postergalerij met alle geüploade posters
- **Multi-formaat Downloads**: 
  - JPEG (hoge kwaliteit)
  - PDF Scherm (A4, A3, A2, A1, A0)
  - PDF Drukklaar (A4-A0, 300 DPI, CMYK)
- **Download Tracking**: Publiekelijk zichtbare download counter per poster
- **Admin Dashboard**: Veilig upload systeem met authenticatie
- **Responsive Design**: Werkt perfect op desktop, tablet en mobiel

## 📋 Vereisten

- Node.js (versie 16 of hoger)
- npm (komt met Node.js)

## 🚀 Installatie

1. **Installeer Node.js** (als je het nog niet hebt):
   - Ga naar https://nodejs.org/
   - Download en installeer de LTS versie

2. **Open Terminal** in de projectmap:
   ```bash
   cd "/Users/simon/Library/CloudStorage/OneDrive-Persoonlijk/LUCA/Atelier/Interventie/Website"
   ```

3. **Installeer dependencies**:
   ```bash
   npm install
   ```

## ▶️ Server Starten

```bash
npm start
```

De website is nu beschikbaar op:
- **Hoofdpagina**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin.html

## 🔐 Admin Toegang

**Standaard wachtwoord**: `admin123`

⚠️ **BELANGRIJK**: Verander dit wachtwoord in `server.js` (regel 13):
```javascript
const ADMIN_PASSWORD = 'jouw-veilige-wachtwoord';
```

## 📤 Posters Uploaden

1. Ga naar http://localhost:3000/admin.html
2. Log in met het admin wachtwoord
3. Vul de poster titel in (verplicht)
4. Voeg een beschrijving toe (optioneel)
5. Upload een hoge resolutie afbeelding (JPEG/PNG)
   - Aanbevolen: minimaal 3508 x 4961 pixels (A4 bij 300 DPI)
6. Klik op "Upload Poster"

## 🎯 Logo Toevoegen

Plaats je logo in de `img/` map met de naam `logo.png` of pas de bestandsnaam aan in `index.html` (regel 13).

## 📁 Projectstructuur

```
Website/
├── index.html          # Hoofdpagina met postergrid
├── admin.html          # Admin upload dashboard
├── style.css           # Alle styling
├── main.js             # Client-side JavaScript voor hoofdpagina
├── admin.js            # Client-side JavaScript voor admin
├── server.js           # Node.js backend server
├── package.json        # Project dependencies
├── README.md           # Deze handleiding
├── img/                # Logo en afbeeldingen
├── uploads/            # Geüploade posters (wordt automatisch aangemaakt)
│   └── thumbnails/     # Thumbnail afbeeldingen
└── posters.json        # Database met poster informatie
```

## 🔧 Gebruik voor Ontwikkeling

Voor auto-reload tijdens ontwikkeling:

```bash
npm run dev
```

## 📝 Download Formaten

### JPEG
- Hoge kwaliteit (95%)
- Originele afbeelding resolutie

### PDF Scherm
- Geoptimaliseerd voor schermweergave
- Formaten: A4, A3, A2, A1, A0
- RGB kleurruimte

### PDF Drukklaar
- 300 DPI resolutie
- Formaten: A4, A3, A2, A1, A0
- Geschikt voor professionele drukwerk

## 🐛 Troubleshooting

### Server start niet
- Controleer of Node.js correct is geïnstalleerd: `node --version`
- Controleer of alle dependencies zijn geïnstalleerd: `npm install`

### Kan geen posters zien
- Zorg dat de server draait (`npm start`)
- Check de browser console voor errors (F12)

### Upload werkt niet
- Controleer of je bent ingelogd in het admin dashboard
- Controleer bestandsgrootte (max 50MB)
- Alleen JPEG en PNG bestanden worden geaccepteerd

### Logo niet zichtbaar
- Zorg dat het logobestand bestaat in de `img/` map
- Controleer de bestandsnaam in `index.html`

## 🌐 Deployment (Online Zetten)

Voor productie gebruik, overweeg:
- Een sterker admin wachtwoord
- HTTPS certificaat
- Hosting op platforms zoals:
  - Heroku
  - DigitalOcean
  - Railway
  - Render

## 📞 Support

Voor vragen of problemen, check:
1. Deze README
2. Console logs in de browser (F12)
3. Server terminal output

## 📄 Licentie

Dit project is gemaakt voor persoonlijk gebruik.

---

**Veel succes met je wekelijkse poster project! 🎨🚀**
# Fase 4 Afgerond - 16 Dec 2025
🚀 Force AR files sync to cPanel
