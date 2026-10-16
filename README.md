# AutoAds

Aplicație web progresivă (PWA) pentru pregătirea materialelor publicitare de pe telefon sau desktop.

## Funcții

- Încărcarea mai multor fotografii și videoclipuri și selectarea materialului activ.
- Previzualizare cu formate 9:16, 4:5, 1:1 și 16:9, poziție și stil pentru text.
- Generare de texte publicitare prin Cloudflare Workers AI, cu fallback local dacă AI nu este disponibil.
- Export PNG pentru reclame foto.
- Export WebM pentru videoclipuri de maximum 120 de secunde, cu text imprimat și, când browserul permite, sunet.
- Salvarea proiectelor și a fișierelor media în IndexedDB, local în browser.
- Calendar local pentru planificarea postărilor; nu publică automat.
- Service worker și manifest PWA pentru instalare și utilizare offline de bază.
- Pagini de termeni și confidențialitate.

## Limitări cunoscute

- Publicarea automată pe TikTok, Instagram sau Google nu este implementată. Butoanele de partajare deschid meniul nativ al dispozitivului sau copiază textul.
- Exportul video depinde de suportul browserului pentru MediaRecorder/WebM; unele browsere pot exporta fără audio sau pot să nu suporte funcția.
- Proiectele și calendarul nu se sincronizează între dispozitive și pot fi șterse dacă utilizatorul șterge datele site-ului.
- Datele operatorului și adresa de contact din paginile legale trebuie completate înainte de lansarea comercială.
- Nu este inclusă autentificare sau stocare de proiecte pe server.

## Teste

Necesită Node.js 22 sau mai nou:

```bash
node tests/smoke.mjs
```

Testele verifică sintaxa JavaScript, identificatorii HTML, fișierele publicate, configurarea PWA și comportamentul de bază al endpoint-ului Worker cu AI simulată. Ele nu înlocuiesc testarea manuală în browser și testarea cu Cloudflare Workers AI real.

## Cloudflare

Configurarea este în `wrangler.jsonc`. Worker-ul folosește binding-urile `AI` și `ASSETS`. Fișierele publice se află în `public/`, pentru a nu publica sursele și fișierele de test din rădăcina repository-ului.

Comanda de deploy:

```bash
npx wrangler deploy
```

Nu include chei API, tokenuri sau alte secrete în repository.
