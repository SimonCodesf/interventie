# 🔐 ADMIN FOLDER SETUP - cPanel Password Protection

## 📋 Setup Instructies

### Stap 1: Upload bestanden

Upload deze nieuwe folder structuur naar je cPanel:

```
/interventie.org/
├── admin/                    ← NIEUWE FOLDER
│   ├── .htaccess            ← Password protection
│   ├── index.html           ← Admin interface (was admin.html)
│   └── admin.js             ← Admin JavaScript
├── security.php             ← Security functies
├── config.php               ← Update versie
├── api.php                  ← Update versie met logging
└── ... (rest blijft hetzelfde)
```

### Stap 2: cPanel Password Protection instellen

1. **Log in op cPanel**
2. **Ga naar "Password Protect Directories"** (of "Directory Privacy")
3. **Selecteer de interventie.org folder**
4. **Klik op de "admin" folder**
5. **Vink aan "Password protect this directory"**
6. **Stel een naam in:** "Admin Area - Restricted Access"
7. **Klik "Save"**

### Stap 3: Gebruiker aanmaken

1. **Scroll naar beneden naar "Create User"**
2. **Username:** `admin` (of jouw voorkeur)
3. **Password:** Kies een STERK wachtwoord (anders dan je PHP wachtwoord!)
4. **Klik "Add/modify authorized user"**

### Stap 4: Test de beveiliging

1. **Ga naar:** `https://www.interventie.org/admin/`
2. **Je zou een popup moeten zien:** "Admin Area - Restricted Access"
3. **Log in met je cPanel username/password**
4. **Dan zie je de normale admin login pagina**
5. **Log in met je PHP wachtwoord (uit config.php)**

## 🔒 Nu heb je DUBBELE beveiliging:

1. **Laag 1:** cPanel .htaccess password (HTTP Basic Auth)
2. **Laag 2:** PHP applicatie login met rate limiting

## 🛡️ Extra security features toegevoegd:

### File Upload Validatie
- ✅ Echte MIME type checking
- ✅ File size limits (5MB images, 20MB PDFs)
- ✅ Malicious content scanning
- ✅ Image integrity validation

### Activity Logging
- ✅ Alle admin acties worden gelogd in `admin_activity.log`
- ✅ IP adressen, timestamps, User-Agent
- ✅ Failed login attempts
- ✅ Upload attempts
- ✅ Unauthorized access attempts

### Security Headers
- ✅ X-Frame-Options (clickjacking protection)
- ✅ X-Content-Type-Options (MIME sniffing protection)
- ✅ X-XSS-Protection (XSS protection)
- ✅ Strict-Transport-Security (force HTTPS)

## 📊 Log Monitoring

Admin activiteiten worden gelogd in: `/interventie.org/admin_activity.log`

Voorbeeld log entries:
```
[2025-11-05 14:30:15] IP: 192.168.1.100 | Action: LOGIN_SUCCESS | Details: Token: a1b2c3d4... | User-Agent: Mozilla/5.0...
[2025-11-05 14:35:22] IP: 192.168.1.100 | Action: UPLOAD_SUCCESS | Details: Pakistan poster | User-Agent: Mozilla/5.0...
[2025-11-05 14:40:10] IP: 10.0.0.5 | Action: LOGIN_FAILED | Details: Wrong password attempt | User-Agent: curl/7.68.0
```

## 🔧 Admin URL Update

**Oude URL:** `https://www.interventie.org/admin.html`
**Nieuwe URL:** `https://www.interventie.org/admin/`

### Links updaten (als je die hebt):

Als je ergens links naar de admin pagina hebt, update deze naar:
```html
<a href="/admin/">Admin</a>
```

## ⚠️ Belangrijke Notities

1. **Twee verschillende wachtwoorden:**
   - cPanel password (HTTP Basic Auth)
   - PHP password (in config.php)

2. **Admin folder permissions:**
   - Folder: 0755 (rwxr-xr-x)
   - Bestanden: 0644 (rw-r--r--)

3. **Oude admin.html verwijderen:**
   Na testing kun je `admin.html` uit de root verwijderen voor extra beveiliging.

## 🧪 Testing Checklist

- [ ] cPanel password protection werkt (popup bij /admin/)
- [ ] PHP login werkt nog steeds
- [ ] Upload functionaliteit werkt
- [ ] Rate limiting werkt (5 foute pogingen = lockout)
- [ ] Activity logging werkt (check admin_activity.log)
- [ ] File validatie werkt (probeer .txt upload)
- [ ] Logout functie werkt

## 🚨 Troubleshooting

### "Internal Server Error" bij /admin/
- Check .htaccess syntax
- Verwijder .htaccess tijdelijk om te testen
- Check cPanel error logs

### "Unauthorized" bij PHP login
- Check of config.php correct is
- Check of sessies werken
- Clear browser cache/cookies

### Geen activity logs
- Check bestand permissions van admin_activity.log
- Check of PHP write permissions heeft

## 📈 Security Score

**Voor deze setup:** 🔒🔒🔒🔒🔒 (5/5)

Je hebt nu:
- ✅ Dubbele authenticatie (HTTP Basic + PHP login)
- ✅ Rate limiting & brute force protection
- ✅ File upload security
- ✅ Activity logging & monitoring
- ✅ Secure session management
- ✅ Security headers
- ✅ Input validation

Dit is **professioneel niveau beveiliging** voor een kleine website! 🎉