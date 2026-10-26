const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '..');
const SIGNS_JSON_PATH = path.join(ROOT_DIR, 'verkeersborden/data/signs.json');
const IMAGES_DIR = path.join(ROOT_DIR, 'verkeersborden/images');

const signsData = JSON.parse(fs.readFileSync(SIGNS_JSON_PATH, 'utf8'));
const signs = signsData.signs;

if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function fetchBuffer(url, maxRedirects = 6) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

        const client = url.startsWith('https:') ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'MemeBordenBot/1.0 (https://interventie.org; educational research; mailto:admin@interventie.org)',
                'Accept': 'image/png,image/*;q=0.8,*/*;q=0.5'
            },
            timeout: 20000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('//')) redirectUrl = 'https:' + redirectUrl;
                return resolve(fetchBuffer(redirectUrl, maxRedirects - 1));
            }

            if (res.statusCode === 429) {
                const retrySec = parseInt(res.headers['retry-after'] || '5', 10);
                return reject({ rateLimit: true, retrySec });
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.on('error', reject);
    });
}

async function searchCommonsFilename(query) {
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json`;
    try {
        const buf = await fetchBuffer(apiUrl);
        const data = JSON.parse(buf.toString('utf8'));
        const results = data.query?.search || [];
        for (const item of results) {
            const title = item.title.replace(/^File:/, '').replace(/ /g, '_');
            if (title.endsWith('.svg') || title.endsWith('.png')) {
                return title;
            }
        }
    } catch (e) {}
    return null;
}

async function tryDownloadSign(sign) {
    const candidates = [sign.wiki_filename];
    if (sign.wiki_filename) {
        if (sign.wiki_filename.startsWith('Belgian_road_sign_')) {
            candidates.push(sign.wiki_filename.replace('Belgian_road_sign_', 'Belgian_traffic_sign_'));
        } else if (sign.wiki_filename.startsWith('Belgian_traffic_sign_')) {
            candidates.push(sign.wiki_filename.replace('Belgian_traffic_sign_', 'Belgian_road_sign_'));
        }
    }

    // Try standard candidate names
    for (const cand of candidates) {
        if (!cand) continue;
        const redirectUrl = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(cand)}?width=512`;
        try {
            const buf = await fetchBuffer(redirectUrl);
            if (buf && buf.length > 500) {
                return { success: true, buffer: buf, filename: cand };
            }
        } catch (err) {
            if (err.rateLimit) throw err;
        }
    }

    // Fallback: search Commons for this sign id
    const queries = [
        `Belgian road sign ${sign.id}`,
        `Belgian traffic sign ${sign.id}`,
        `Belgian sign ${sign.id}`
    ];

    for (const q of queries) {
        const found = await searchCommonsFilename(q);
        if (found) {
            const redirectUrl = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(found)}?width=512`;
            try {
                const buf = await fetchBuffer(redirectUrl);
                if (buf && buf.length > 500) {
                    return { success: true, buffer: buf, filename: found };
                }
            } catch (err) {
                if (err.rateLimit) throw err;
            }
        }
    }

    return { success: false };
}

async function run() {
    console.log('=== START AUTOMATISCHE BORDEN DOWNLOADER ===');
    const missing = signs.filter(s => {
        const p = path.join(IMAGES_DIR, `${s.id}.png`);
        return !fs.existsSync(p) || fs.statSync(p).size === 0;
    });

    console.log(`Totaal borden in catalogus: ${signs.length}`);
    console.log(`Al aanwezig: ${signs.length - missing.length}`);
    console.log(`Te downloaden: ${missing.length}`);

    let downloaded = 0;
    let failed = [];

    for (let i = 0; i < missing.length; i++) {
        const sign = missing[i];
        const dest = path.join(IMAGES_DIR, `${sign.id}.png`);
        process.stdout.write(`[${i + 1}/${missing.length}] Bord ${sign.id} (${sign.wiki_filename})... `);

        let attempt = 0;
        let done = false;

        while (!done && attempt < 3) {
            attempt++;
            try {
                const res = await tryDownloadSign(sign);
                if (res.success) {
                    fs.writeFileSync(dest, res.buffer);
                    if (res.filename !== sign.wiki_filename) {
                        sign.wiki_filename = res.filename;
                    }
                    downloaded++;
                    console.log(`OK (${res.buffer.length} bytes, file: ${res.filename})`);
                } else {
                    console.log('NIET GEVONDEN');
                    failed.push(sign.id);
                }
                done = true;
            } catch (err) {
                if (err.rateLimit) {
                    console.log(`\nRate limit bereikt. Wachten ${err.retrySec + 2} seconden...`);
                    await new Promise(r => setTimeout(r, (err.retrySec + 2) * 1000));
                } else {
                    console.log(`Fout: ${err.message}`);
                    if (attempt >= 3) failed.push(sign.id);
                }
            }
        }

        // Vriendelijke pauze tussen requests (1200ms)
        await new Promise(r => setTimeout(r, 1200));
    }

    console.log('\n=== DOWNLOAD VOLTOOID ===');
    console.log(`Succesvol gedownload: ${downloaded}`);
    console.log(`Mislukt: ${failed.length} (${failed.join(', ')})`);

    // Sla bijgewerkte signs.json op
    fs.writeFileSync(SIGNS_JSON_PATH, JSON.stringify(signsData, null, 2), 'utf8');
    console.log('signs.json geüpdatet.');
}

run().catch(console.error);
