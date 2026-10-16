# AutoAds

Aplicație web progresivă (PWA) pentru pregătirea materialelor publicitare de pe telefon sau desktop.

## Funcții implementate în prototip

- Încărcarea mai multor fotografii și videoclipuri și selectarea materialului activ.
- Previzualizare cu formate 9:16, 4:5, 1:1 și 16:9, poziție și stil pentru text.
- Generarea unui text publicitar pe bază de șabloane, cu titlu, descriere și hashtaguri.
- Export PNG pentru reclame foto, cu formatul și stilul selectat.
- Salvarea proiectelor și a fișierelor media în IndexedDB, local în browser.
- Calendar local pentru planificarea postărilor, cu marcare ca finalizate și ștergere.
- Service worker și manifest PWA pentru instalare și utilizare offline de bază.
- Pagini de termeni și confidențialitate.

## Limitări actuale

- Textul publicitar este generat cu șabloane locale; integrarea unui model AI real nu este încă activă.
- Calendarul este doar pentru planificare locală. **Nu publică automat** pe TikTok, Instagram sau Google.
- Exportul video cu text imprimat permanent nu este implementat. Clipurile pot fi previzualizate și distribuite ca fișiere originale.
- Proiectele și calendarul nu se sincronizează între dispozitive și pot fi șterse dacă utilizatorul șterge datele site-ului din browser.
- Publicarea directă pe platforme și fluxurile OAuth nu sunt implementate.

## Teste

Necesită Node.js 22 sau mai nou:

```bash
node tests/smoke.mjs
```

Testele verifică sintaxa JavaScript, identificatorii HTML, referințele locale, manifestul PWA și fișierele necesare. Ele nu înlocuiesc testarea manuală în browser.

## Publicare pe Cloudflare

Configurația este în `wrangler.jsonc`. Comanda indicată pentru deploy este:

```bash
npx wrangler deploy
```

Verifică rezultatul build-ului în Cloudflare înainte de publicare. Nu include chei API, tokenuri sau alte secrete în repository.
