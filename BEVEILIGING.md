# 🔒 BEVEILIGING - POSTER WEBSITE

## Geïmplementeerde beveiligingsmaatregelen

### ✅ Niveau 1: Basis Hardening (ACTIEF)

#### 1. **Rate Limiting & Brute Force Bescherming**
- Maximum 5 login pogingen per IP-adres
- 15 minuten lockout na te veel pogingen
- 2 seconden vertraging bij fout wachtwoord (slow down attacks)
- Automatische cleanup van oude login attempts

#### 2. **Veilige Sessie Beheer**
- Echte tokens (niet wachtwoord als token!)
- Session timeout na 1 uur inactiviteit
- Automatische session regeneratie na login
- HttpOnly cookies (JavaScript kan niet bij cookies)
- Secure cookies (alleen via HTTPS)
- SameSite=Strict (CSRF bescherming)

#### 3. **Wachtwoord Beveiliging**
- Wachtwoord NIET meer in JavaScript zichtbaar
- Constant-time comparison (voorkomt timing attacks)
- Server-side verificatie alleen

#### 4. **Sessie Timeout Waarschuwing**
- Waarschuwing na 55 minuten
- Automatische logout na 1 uur
- Client-side timer voor UX

#### 5. **Logout Functionaliteit**
- Expliciete logout knop
- Session destroy op server
- Clear alle client-side data

## 📋 Wat je moet doen

### 🔴 BELANGRIJK: Verander het wachtwoord!

Open `/config.php` en verander deze regel:

```php
define('ADMIN_PASSWORD', 'BETA');
```

Naar een sterk wachtwoord:

```php
define('ADMIN_PASSWORD', 'JouwSterkeWachtwoord2024!@#');
```

**Sterk wachtwoord vereisten:**
- Minimaal 12 tekens
- Hoofdletters EN kleine letters
- Cijfers
- Speciale karakters (!@#$%^&*)
- Geen veelvoorkomende woorden

### 🟡 Aanbevolen: Extra beveiliging

#### 1. **Bestand beveiliging via .htaccess**

Voeg toe aan `.htaccess`:

```apache
# Bescherm gevoelige bestanden
<FilesMatch "(config\.php|security\.php|login_attempts\.json|posters\.db)$">
    Order allow,deny
    Deny from all
</FilesMatch>
```

#### 2. **Admin pagina op geheime URL**

Hernoem `admin.html` naar iets onvoorspelbaars:
```
admin-geheim-xyz123.html
```

En update de link in je code (als je die hebt).

## 🔐 Hoe het werkt

### Login Flow:
1. User voert wachtwoord in
2. Server checkt IP rate limiting
3. Als OK: verifieer wachtwoord (constant-time)
4. Bij success: genereer random token, start sessie
5. Token wordt opgeslagen in sessionStorage (NIET wachtwoord!)
6. Alle API calls gebruiken dit token + session cookies

### Session Management:
- PHP sessie op server houdt login status bij
- Client krijgt secure session cookie (HttpOnly, Secure, SameSite)
- Token wordt meegegeven in Authorization header
- Server checkt BEIDE: session én token
- Na 1 uur: automatische logout

### Rate Limiting:
- Stored in `login_attempts.json` (op server)
- Per IP-adres bijgehouden
- Na 5 pogingen: 15 min lockout
- Automatische cleanup van oude entries

## 🚀 Volgende stap: Google Authenticator (2FA)

Wil je nog meer beveiliging? Twee-factor authenticatie toevoegen:

### Wat je krijgt:
- Wachtwoord + 6-cijferige code van je telefoon
- Zelfs als wachtwoord lekt, kunnen ze niet inloggen
- Werkt met Google Authenticator, Microsoft Authenticator, Authy

### Setup tijd: ~30 minuten
- PHP library installeren (via composer of handmatig)
- QR code generatie
- TOTP verificatie
- Backup codes systeem

**Klaar om 2FA te implementeren?** Laat het me weten!

## 📝 Testing Checklist

- [x] Login met correct wachtwoord werkt
- [ ] Login met fout wachtwoord geeft error
- [ ] Na 5 foute pogingen: 15 min lockout
- [ ] Session timeout na 1 uur inactiviteit
- [ ] Logout knop werkt
- [ ] Upload werkt nog steeds
- [ ] Delete werkt nog steeds
- [ ] Geen wachtwoord zichtbaar in browser JavaScript

## ⚠️ Veiligheidsnotities

1. **Wachtwoord in config.php is nog plain text** - Voor productie zou je een hash moeten gebruiken
2. **Geen email verificatie** - Voor hogere security: email/SMS bij nieuwe login
3. **Geen IP whitelist** - Je kunt admin pagina beperken tot specifieke IP's
4. **Geen audit log** - Voor professionele setup: log alle admin acties

## 🆘 Als je uitgelogd bent:

Lockout verwijderen:
```bash
# Via cPanel File Manager of SSH:
rm /pad/naar/website/login_attempts.json
```

Session reset:
- Sluit alle browser tabs
- Open incognito/private window
- Log opnieuw in

## 📚 Meer lezen

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [PHP Session Security](https://www.php.net/manual/en/session.security.php)
- [Rate Limiting Best Practices](https://blog.logrocket.com/rate-limiting-node-js/)
