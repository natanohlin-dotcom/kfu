# Projektplan – KFU-arbetsytan (I-sektionen, Uppsala)

Gemensam arbetsyta för kapitalförvaltningsutskottet: portföljöversikt, bevakningar, analysarbete, analysverktyg (DCF, bolagsdata) och rapportgenerering via Google Apps Script.

Planen följer strukturen i `ARKITEKTUR-MALL.md` (§-hänvisningar nedan). Där inget annat står gäller mallen. Avvikelser och projektspecifika beslut är markerade med **Beslut**.

Skriven 2026-10-15. Status: utkast att stämma av i utskottet (se §14, öppna frågor).

---

## 0. Sammanfattning

- **Scope fas 1:** bara den inloggade admin-delen (`/admin`). Den publika sajten väntar, men vi lämnar plats för den (route group `(public)`).
- **Stack:** Next.js 16 + React 19 + Tailwind 4, **OpenNext (`@opennextjs/cloudflare`) på Cloudflare Workers med statiska tillgångar**, D1 som databas, allt på gratisnivån.
- **Modulärt:** varje funktion är en *modul* i ett register (`lib/modules.ts`). Registret styr sidomenyn, behörigheter och vilka widgets som visas på översikten. En ny funktion är en ny mapp plus en rad i registret.
- **Två roller:** `admin` och `member`. Initialt samma rättigheter, men all behörighetskontroll går redan från dag 1 genom `can(user, action)` så att skillnader kan införas på ett ställe.
- **Yahoo Finance** är datakällan, inkapslad bakom ett leverantörsgränssnitt och cachad i D1, så att vi kan byta källa eller lägga in en reserv utan att röra resten.
- **DCF-modellen** (`monte-dcf.py`) porteras till TypeScript. Beräkningen körs **i webbläsaren** (Workers gratisnivå har 10 ms CPU per anrop, och Monte Carlo med 10 000 banor ryms inte där).

---

## 1. Plattform: "Pages" vs Workers

**Beslut:** OpenNext på **Workers**, inte `next-on-pages` på Pages.

- `next-on-pages` är avvecklat. Cloudflares nya väg för Next.js är OpenNext, och den deployar till **Workers med statiska tillgångar**. Det är Cloudflares efterträdare till Pages: statiska filer på CDN och serverkoden som Worker, alltså samma upplägg i praktiken.
- Det du tänkte dig med "Pages + D1, gratisnivå" fungerar likadant: D1-bindning, git-kopplad deploy (Workers Builds), gratisnivå.
- Vi slipper `export const runtime = 'edge'` och får Node-kompatibel runtime (`nodejs_compat`).

**Gratisnivån, gränser som påverkar designen** (verifiera vid setup):

| Gräns | Värde | Konsekvens |
|---|---|---|
| Worker-storlek (gzip) | **3 MiB** gratis / 10 MiB betald | Håll serverberoenden små. Kontrollera storleken redan i fas 0. Tunga bibliotek (diagram, editor) bara i klientkod. |
| CPU per anrop | ~10 ms | Inga tunga beräkningar på servern. DCF/Monte Carlo körs i klienten. PBKDF2 ~20 000 iterationer (mall §7). |
| Anrop | 100 000/dygn | Gott om marginal för ett utskott. |
| D1 | 5 GB, ~5 M radläsningar/dygn, ~100 000 skrivningar/dygn | Räcker gott. Cacha kurshistorik per dag, inte per anrop. |
| Cron Triggers | några få per konto | En daglig kursuppdatering räcker. |

---

## 2. Stack och beroenden

Enligt mall §2, plus:

| Paket | Varför | Var det körs |
|---|---|---|
| `@opennextjs/cloudflare` | Adapter (mall §1) | bygg |
| `jose` | JWT-session (mall §7) | server |
| `recharts` | Portfölj- och indexgraf, histogram, känslighetsmatris | klient |
| `react-markdown` + `remark-gfm` | Förhandsvisning av analystext | klient |
| `zod` | Validering av indata i API-routes | server och klient |
| `vitest` (dev) | Enhetstester, särskilt DCF-porten (golden tests mot Python) | dev |
| `lucide-react`, `tw-animate-css` | Enligt mall | klient |
| `@google/clasp` (dev) | Apps Script-rapporter (mall §8) | dev |

Inget `yahoo-finance2` till att börja med: en egen tunn klient (§8) håller Worker-storleken nere och ger kontroll över cookie/crumb-hanteringen. Paketet kan provas i fas 0 om det visar sig enklare.

---

## 3. Mappstruktur

```
app/
  (public)/                    ← reserverad för den publika sajten senare
  admin/
    layout.tsx                 ← noindex, ingen nav (inloggningssidan)
    page.tsx                   ← inloggning
    byt-losenord/page.tsx
    (app)/                     ← allt bakom inloggning, gemensam skal-layout
      layout.tsx               ← AppShell: sidomeny (från modulregistret) + toppfält
      oversikt/page.tsx        ← välkomstsida: graf portfölj vs index + widgets
      portfolj/
        page.tsx               ← innehav, fördelning, avkastning
        transaktioner/page.tsx
      bevakningar/
        page.tsx               ← lista/tavla per status
        [id]/page.tsx          ← bolagssida: kurs, nyckeltal, tes, analyser, DCF-modeller
      analyser/
        page.tsx
        [id]/page.tsx          ← analysredigeraren
      verktyg/
        dcf/page.tsx           ← DCF + scenarier + känslighet + Monte Carlo
        dcf/[id]/page.tsx      ← sparad modell
        bolagsdata/page.tsx    ← sök bolag → finansiell översikt
      rapporter/page.tsx
      installningar/
        page.tsx               ← profil, lösenord
        jamforelseindex/page.tsx
        anvandare/page.tsx     ← användarhantering (admin)
  api/
    auth/{login,logout,me,change-password}/route.ts
    portfolio/{transactions,holdings,performance}/…
    securities/{route.ts,search,[id]}/…
    market/{quote,history,financials}/route.ts     ← Yahoo via cache
    watchlist/…, analyses/…, dcf-models/…, reports/…, benchmarks/…, users/…
    cron/prices/route.ts       ← skyddad med secret (reserv om Cron Trigger krånglar)
components/
  ui/                          ← Button, Field, Card, Dialog, Table, Tabs, Badge, EmptyState
  shell/                       ← Sidebar, Topbar, CommandPalette (tickersök), UserMenu
  charts/                      ← PerformanceChart, Histogram, SensitivityHeatmap
  portfolio/, watchlist/, analysis/, dcf/
lib/
  db.ts                        ← getDb() via getCloudflareContext()
  auth.ts, permissions.ts      ← session, roller, can()
  modules.ts                   ← modulregistret
  market/                      ← provider-gränssnitt, yahoo.ts, cache.ts, fx.ts
  portfolio/                   ← innehav från transaktioner, TWR, valutaomräkning
  dcf/                         ← porten av monte-dcf.py (rena funktioner)
  analysis/                    ← sektionsmallar, statusar
  reports/                     ← Apps Script-klient (idempotent, mall §8)
migrations/                    ← 0001_init.sql …
apps-script/                   ← rapportmallar (clasp)
custom-worker.ts               ← fetch från OpenNext + scheduled() för kurs-cron
scripts/                       ← seed, import av transaktioner från CSV
```

---

## 4. Modulsystemet

Kärnan i att sidan ska kunna växa. Varje modul beskrivs på ett ställe:

```ts
// lib/modules.ts
export type ModuleDef = {
  id: 'oversikt' | 'portfolj' | 'bevakningar' | 'analyser' | 'dcf' | 'bolagsdata' | 'rapporter' | 'installningar';
  label: string;
  href: string;
  icon: LucideIconName;              // sträng, inte komponent (serialiserbart, mall §9)
  group: 'Portfölj' | 'Arbete' | 'Verktyg' | 'System';
  permission: Permission;            // t.ex. 'portfolio:read'
  widgets?: WidgetId[];              // widgets modulen bidrar med på översikten
  enabled: boolean;                  // feature-flagga
};
```

- **Sidomenyn** byggs från registret och filtreras med `can(user, m.permission)`.
- **Översikten** har en grid av widgets. Varje widget är en server component i `components/widgets/` med en egen datahämtning. Grafen "portfölj vs index" är fast överst, resten styrs av registret och kan senare bli valbart per användare (`user_preferences`).
- **Ny modul:** skapa `app/admin/(app)/<modul>/`, lägg till API under `app/api/<resurs>/`, lägg in en rad i registret och eventuellt en widget. Ingen annan kod behöver ändras.

---

## 5. Roller och autentisering

Enligt mall §7 (användarnamn + lösenord, PBKDF2, JWT i httpOnly-cookie, `ADMIN_KEYS` för första inloggning, `mustChange`, `pwc`-ogiltigförklaring).

**Tillägg:**
- `users.role` ∈ `'admin' | 'member'`, med i JWT:n men **alltid kontrollerad mot databasen** i `requireUser()` (rollbyte ska slå igenom direkt).
- `lib/permissions.ts`:
  ```ts
  const MATRIX: Record<Role, Permission[]> = {
    admin:  ALL_PERMISSIONS,
    member: ALL_PERMISSIONS,                          // samma rättigheter i början
  };
  export const can = (u: SessionUser, p: Permission) => MATRIX[u.role].includes(p);
  ```
- Varje API-route börjar med `const user = await requireUser(req, 'analyses:write')`, som ger 401/403.
- **Första naturliga skillnaden** (förslag): bara `admin` får hantera användare, registrera/ändra transaktioner och ändra jämförelseindex. Det är en ändring på en rad i matrisen när ni bestämmer er.
- `ADMIN_KEYS` får ett rollfält: `Namn:användarnamn:roll:sha256(...)`.
- Utskottet byts ut varje år, så användare **inaktiveras** (`disabled_at`) i stället för att raderas, så att författarskap på analyser finns kvar.

---

## 6. Data – D1 (`migrations/0001_init.sql`)

Mall §5 gäller: `wrangler d1 migrations`, parametriserade frågor, mappers i `lib/`, entydiga kolumnnamn med kommentarer. Belopp lagras som REAL i värdepapperets valuta plus `fx_rate_to_sek` vid transaktionstillfället. Datum lagras som ISO-text (`YYYY-MM-DD`), tidsstämplar som ISO 8601 UTC.

| Tabell | Innehåll (urval av kolumner) |
|---|---|
| `users` | `id, username, display_name, role, password_hash, password_changed_at, must_change, disabled_at, last_login_at` |
| `securities` | Gemensamt register över allt vi följer: `id, yahoo_symbol` (unik, t.ex. `NOVO-B.CO`, `^OMX`, `USDSEK=X`), `name, kind` (`stock/etf/fund/index/fx`), `currency, exchange, country, sector, manual_shares_json` (manuellt aktieantal som i Python-skriptets `MANUAL_SHARES`, med källa) |
| `transactions` | **Källan till sanning för portföljen.** `id, security_id, type` (`buy/sell/dividend/fee/deposit/withdrawal`), `trade_date, quantity, price, currency, fx_rate_to_sek, fees_sek, note, created_by` |
| `price_history` | `security_id, date, close, adj_close`, PK `(security_id, date)`. Dagliga stängningskurser för innehav, bevakningar, index och valutor. |
| `market_cache` | `key, payload_json, fetched_at, ttl_seconds`. Cache för Yahoo-svar (quote, nyckeltal, finansiella rapporter). |
| `app_state` | `key, value, updated_at`, t.ex. Yahoo cookie/crumb och senaste cron-körning |
| `benchmarks` | `id, security_id, label, color, is_default, sort_order`. Jämförelseindex som läggs in via inställningar. |
| `watchlist_items` | `id, security_id, status` (`ide/bevakning/analys/beslut_kop/beslut_avstar/arkiverad`), `thesis, target_price, trigger_note, owner_id, created_at, updated_at` |
| `analyses` | `id, security_id, watchlist_item_id, title, kind` (`initial/uppfoljning/salj`), `status` (`utkast/granskning/klar`), `recommendation` (`kop/behall/salj/avvakta`), `target_price, author_id, version, updated_at` |
| `analysis_sections` | `analysis_id, section_key, content_md, updated_by, updated_at, version`. En rad per avsnitt i rapportmallen. |
| `analysis_collaborators` | `analysis_id, user_id`. Medförfattare. |
| `dcf_models` | `id, security_id, analysis_id, name, inputs_json` (scenarier, WACC, g, gridar, skattemetod, seed), `snapshot_json` (historikdata som användes), `results_json` (värde/aktie per scenario, MC-percentiler), `created_by, created_at` |
| `reports` | `id, analysis_id, template, request_id` (unik, för idempotens), `status, doc_url, pdf_url, error, created_by, created_at` |
| `activity_log` | `id, user_id, action, entity, entity_id, summary, created_at`. Flöde på översikten och spårbarhet. |

**Samtidig redigering:** avsnitten sparas var för sig med optimistisk låsning (`WHERE version = ?`). Vid konflikt visas båda versionerna och användaren väljer. Det räcker för ett utskott och kräver ingen realtidsinfrastruktur.

**Portföljberäkning (`lib/portfolio/`):**
- Innehav = summan av transaktioner per värdepapper (antal, GAV i SEK).
- Dagligt portföljvärde = innehav × `price_history.close` × valutakurs (från `USDSEK=X` m.fl. i samma tabell).
- Avkastning mot index: **tidsviktad avkastning (TWR)** så att insättningar och uttag inte ser ut som avkastning. Både portfölj och index indexeras till 100 vid periodens start.
- Notera att `^OMX` (OMXS30) är ett prisindex utan utdelningar. Om ni vill jämföra mot ett totalavkastningsindex (t.ex. OMXS30GI) behöver vi se om Yahoo har det, annars en ETF som proxy. Därför är jämförelseindex konfigurerbara.

---

## 7. Sidor och utseende

Gemensamt skal: **sidomeny till vänster** (fälls ihop till ikoner, blir en låda på mobil), **toppfält** med tickersök (`⌘K`, kommandopalett mot Yahoos sökning) och användarmeny. Lugn, datatät stil: neutrala ytor, en accentfärg, grönt/rött bara för upp/ner. Tokens i `@theme` (mall §9), tabulära siffror (`font-variant-numeric: tabular-nums`) i alla tabeller.

### `/admin` – inloggning
Centrerat kort med logga, användarnamn, lösenord. Sedan `/admin/byt-losenord` vid `mustChange`, annars `/admin/oversikt`.

### `/admin/oversikt` – välkomstsidan
```
┌────────────┬──────────────────────────────────────────────────────────┐
│ KFU        │  God morgon, Natan                       ⌘K Sök ticker   │
│            ├──────────────────────────────────────────────────────────┤
│ Översikt   │ ┌Portföljvärde┐┌Avk. i år ┐┌vs OMXS30 ┐┌Kassa      ┐      │
│ PORTFÖLJ   │ │ 412 300 kr  ││ +8,4 %   ││ +2,1 %-e ││ 23 100 kr │      │
│  Innehav   │ └─────────────┘└──────────┘└──────────┘└───────────┘      │
│  Transakt. │ ┌ Portfölj vs jämförelseindex ─── 1M 3M YTD 1Å 3Å Max ┐   │
│ ARBETE     │ │  ╱╲    ╱‾‾╲╱‾  ── Portfölj                          │   │
│  Bevakn.   │ │ ╱  ╲╱‾╱        ── OMXS30   ── + Lägg till index     │   │
│  Analyser  │ │╱                (indexerat till 100)                │   │
│ VERKTYG    │ └──────────────────────────────────────────────────────┘   │
│  DCF       │ ┌ Bevakningar: störst rörelse ┐┌ Pågående analyser   ┐    │
│  Bolagsdata│ │ NOVO-B  −3,2 %  mål 520     ││ Atlas Copco · utkast│    │
│ Rapporter  │ │ VOLV-B  +2,1 %              ││ Novo · granskning   │    │
│ ────────   │ └─────────────────────────────┘└─────────────────────┘    │
│ Inställn.  │ ┌ Senaste aktivitet ─────────────────────────────────┐    │
│ ☺ Natan ▾  │ │ Sara skapade DCF-modell för NOVO-B · 2 h sedan     │    │
└────────────┴──────────────────────────────────────────────────────────┘
```
- Grafen: serier per index (färg från `benchmarks.color`), periodväljare, tooltip med datum och värden. "+ Lägg till index" öppnar en dialog (sök ticker → spara som benchmark).
- Widgets under grafen kommer från modulregistret (§4).

### `/admin/portfolj`
Tabell över innehav (namn, antal, GAV, kurs, värde SEK, andel, avkastning kr/%, dagens förändring), fördelning per sektor/land/valuta, samma prestandagraf som på översikten. Undersidan **Transaktioner** har lista, formulär för ny transaktion och **CSV-import** (Avanza/Nordnet-export, se öppna frågor).

### `/admin/bevakningar` och `/admin/bevakningar/[id]`
- Listvy med statusfilter, alternativt en tavla med kolumnerna Idé → Bevakning → Analys → Beslut. Kolumner i listan: kurs, dagens %, målkurs, avstånd till mål, ansvarig.
- "Inled bevakning": sök ticker → kort formulär (tes, triggers, målkurs, ansvarig).
- **Bolagssidan** är navet per bolag: kursgraf, nyckeltal (P/E, EV/EBIT, marginaler, tillväxt), tes och anteckningar, länkade analyser, sparade DCF-modeller och knapparna "Ny analys" och "Ny DCF". Används även för innehav.

### `/admin/analyser/[id]` – analysarbetsytan
```
┌ Novo Nordisk – initial analys     Status: Utkast ▾   Rek: Köp ▾  Mål 520 ┐
│ Avsnitt          │ ## Investeringstes                      [Förhandsvisa] │
│ ● Sammanfattning │ Markdown-redigerare, autosparar per avsnitt           │
│ ● Investeringstes│                                                       │
│ ○ Bolaget        │                                                       │
│ ○ Marknad        │ ┌ Infoga ───────────────────────────────┐             │
│ ○ Finansiell…    │ │ DCF-modell ▾  Nyckeltalstabell  Graf  │             │
│ ○ Värdering      │ └───────────────────────────────────────┘             │
│ ○ Risker         │                                                       │
│ ○ Rekommendation │ Senast sparat 14:02 av Sara                           │
│                  │                    [Skicka till granskning] [Skapa rapport] │
└──────────────────┴────────────────────────────────────────────────────────┘
```
- Avsnitten definieras av rapportmallen (`lib/analysis/templates.ts`), så det som skrivs i arbetsytan matchar platshållarna i Google Docs-mallen 1:1.
- Markdown med förhandsvisning till att börja med (lätt, fungerar bra mot Apps Script). En rikare editor kan bytas in senare utan att ändra datamodellen.
- Inbäddningar (DCF-resultat, nyckeltal) lagras som referenser (`{{dcf:12}}`) och fylls i med aktuell data vid rapportgenerering.

### `/admin/verktyg/dcf`
Flikar: **Data** (hämtad historik och drivare per år, valt aktieantal med alla kandidater och avvikelseflaggor, vald skattesats med källor, precis som skriptets utskrifter), **Scenarier** (Bear/Base/Bull med tillväxt, marginal och capex per år i ett redigerbart rutnät, WACC och g gemensamma), **Resultat** (prognostabell per scenario, EV-brygga och implicit RONIC), **Känslighet** (WACC × g-värmekarta centrerad på dagens kurs), **Monte Carlo** (histogram med scenarielinjer och faktisk kurs). "Spara modell" sparar indata, datasnapshot och resultat, och modellen kan kopplas till en analys.

### `/admin/verktyg/bolagsdata`
Sök ticker → profil, kurs, nyckeltal, resultaträkning/balansräkning/kassaflöde 4 år (tabell + export till CSV), knappar "Inled bevakning" och "Öppna i DCF".

### `/admin/rapporter`
Lista över genererade rapporter (analys, mall, skapad av, länk till Google Doc/PDF, status). Ny rapport skapas från en analys.

### `/admin/installningar`
Profil och lösenord, jämförelseindex (lägg till/ta bort, färg, standardval) och användare (admin: skapa, ändra roll, inaktivera, återställ lösenord).

---

## 8. Externa tjänster

### Yahoo Finance (`lib/market/`)
Yahoo har inget officiellt API. Vi använder samma ändpunkter som `yfinance`:

| Behov | Ändpunkt | Kräver cookie/crumb |
|---|---|---|
| Kurshistorik (pris, index, valuta) | `query1.finance.yahoo.com/v8/finance/chart/{symbol}` | nej |
| Sök ticker | `query2.finance.yahoo.com/v1/finance/search` | nej |
| Aktuell kurs, nyckeltal, profil | `v7/finance/quote`, `v10/finance/quoteSummary` | ja |
| Resultat-/balans-/kassaflödesrader (det `ticker.financials` m.fl. ger) | `ws/fundamentals-timeseries/v1/finance/timeseries/{symbol}` | ja (verifiera) |

- **Gränssnitt:** `MarketDataProvider { search, quote, history, financials }`. `yahoo.ts` implementerar det. Resten av appen känner bara till gränssnittet.
- **Cache i D1:** kurs 15 min, nyckeltal/finansiella rapporter 24 h, historik som dagliga rader i `price_history` (hämtar bara saknade dagar).
- **Cookie/crumb** hämtas vid behov och sparas i `app_state`. Förnyas vid 401.
- **Daglig cron** (efter Stockholmsbörsens stängning, ca 18:00 svensk tid) uppdaterar `price_history` för innehav, bevakningar, index och valutor. Den läggs i `custom-worker.ts`, som exporterar OpenNexts `fetch` plus en egen `scheduled()`. Reserv: GitHub Actions-cron som anropar `/api/cron/prices` med `CRON_SECRET`.
- **Reservkällor:** utredda i `docs/datakallor.md` (EODHD, stooq, ECB m.fl.).
- **Risk:** Yahoo kan strypa (429) eller blockera anrop från Cloudflares IP-adresser. Det **testas först av allt** (fas 0). Om det inte fungerar: en GitHub Actions-körning med befintlig Python/`yfinance` som skickar data till en skyddad import-endpoint (`/api/import/market`). Appen påverkas inte eftersom allt redan läses från D1-cachen.
- Rapportvaluta vs handelsvaluta (som skriptet varnar för) hanteras explicit: `financialCurrency` och `currency` sparas och DCF-sidan räknar om med valutakursen.

### Google Apps Script – rapporter (`apps-script/`)
Enligt mall §8 (clasp, delad hemlighet `APPS_SCRIPT_SECRET`, `requestId`-idempotens, upp till 3 försök).
1. "Skapa rapport" i analysen → `POST /api/reports` → servern bygger en payload: metadata, avsnitt som Markdown, DCF-tabeller, nyckeltal, diagram som PNG (renderade i klienten och skickade med).
2. Apps Script kopierar mallen (Google Docs) i sektionens Drive, ersätter `{{platshållare}}`, konverterar Markdown till Docs-formatering, infogar tabeller och bilder, exporterar PDF och returnerar `docUrl` och `pdfUrl`.
3. Raden i `reports` uppdateras. Rapporten syns i listan och på analysen.

Anropet tar ofta några sekunder. Det är väntetid, inte CPU-tid, så det ryms inom gratisnivån. Vid långa svar körs det med `ctx.waitUntil` och klienten pollar status.

### Hemligheter
`AUTH_SECRET`, `ADMIN_KEYS`, `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET`, `CRON_SECRET`. `wrangler secret put` i produktion, `.dev.vars` lokalt (mall §8, §12.11).

---

## 9. DCF-porten (`lib/dcf/`)

Python-skriptet porteras funktion för funktion till rena TypeScript-funktioner utan I/O, så att de kan köras i klienten och testas isolerat:

| Python | TypeScript | Kommentar |
|---|---|---|
| `fetch_financial_data` | `lib/market` → `toDcfHistory()` | Data hämtas via API-routen (cachad). Mappningen av rader (`Total Revenue`, `EBIT`, …) ligger i `lib/dcf/history.ts`. |
| `calculate_historical_drivers` | `historicalDrivers()` | |
| `resolve_share_count` | `resolveShareCount()` | Returnerar *alla kandidater* plus val och källa så att UI:t visar samma transparens som utskrifterna. `MANUAL_SHARES` flyttar till `securities.manual_shares_json`. |
| `resolve_tax_rate` | `resolveTaxRate()` | `STATUTORY_TAX` blir `lib/dcf/tax.ts`. |
| `calculate_classic_dcf` | `classicDcf()` | |
| `sensitivity_matrix` | `sensitivity()` | |
| `simulate_fcff` + `calculate_valuation` | `monteCarlo({ seed })` | Seedad PRNG (t.ex. mulberry32 + Box–Muller), så att en sparad modell ger samma resultat igen. Körs i en Web Worker så att UI:t inte fryser. |
| matplotlib-plottar | `components/charts/*` | Recharts |

**Korrekthet:** golden tests i Vitest. Kör Python-skriptet på en fryst datamängd (exportera `hist_data` för t.ex. NOVO-B.CO till JSON i `tests/fixtures/`). Spara resultaten (värde per aktie per scenario, känslighetsmatris) och kräv att TS-versionen stämmer på 1e-6 när. Monte Carlo jämförs statistiskt (medel/percentiler inom tolerans), eftersom slumptalen skiljer sig.

Python-skriptet behålls i `tools/python/` som referens.

---

## 10. Frontend och designsystem

**Designriktningen står i `DESIGN.md` och gäller hela projektet:** Hedvig-inspirerat, kritvitt och stilrent, i KFU:s grafiska profil (Cormorant Garamond/Lato, #14213D, #1F4990, #FE9A04). Enligt mall §9. Projektspecifikt:
- `components/ui/` byggs först: Button, Field, Select, Card, Table (sorterbar, tabulära siffror), Tabs, Dialog (`<dialog>`), Badge (status), EmptyState, Skeleton.
- Talformat på ett ställe (`lib/format.ts`): `Intl.NumberFormat('sv-SE')`, procent med tecken, valutor, "mdr"/"mn".
- Färgsemantik och serie-färger enligt `DESIGN.md` §2.
- Mörkt läge är valfritt, men tokens förbereds för det.
- Sidor är server components som läser D1 direkt. Formulär, grafer, DCF och editor är klientkomponenter.

---

## 11. Utvecklingsflöde och deploy

```bash
npm create cloudflare@latest -- kfu --framework=next     # sätter upp Next + OpenNext + wrangler.jsonc
npx wrangler d1 create kfu-db
npx wrangler d1 migrations apply kfu-db --local
npm run dev                                               # next dev med lokal D1 (initOpenNextCloudflareForDev)
npm run preview                                           # bygger med OpenNext och kör i workerd lokalt
```
- `wrangler.jsonc`: `main` → `custom-worker.ts` (för cron), `assets` enligt OpenNext-mallen, `d1_databases` med binding `DB`, `triggers.crons`, `compatibility_flags: ["nodejs_compat"]`.
- Deploy: Workers Builds kopplat till GitHub (push till `main`) eller `npm run deploy`.
- Före push: `tsc --noEmit`, `vitest run`, `eslint`, `opennextjs-cloudflare build`. **Kontrollera Worker-storleken (gzip) mot 3 MiB.**

---

## 12. Genomförande i faser

Varje fas ska ge något som går att använda i produktion.

| Fas | Innehåll | Klart när |
|---|---|---|
| **0. Grund och spikar** | Repo, Next 16 + OpenNext, D1, `custom-worker.ts` med cron, första deploy. **Spike 1:** hämta chart, quote och timeseries för NOVO-B.CO och ^OMX *från den deployade Workern*. **Spike 2:** mät Worker-storlek. | Hello world live. Vet att Yahoo fungerar från Cloudflare (eller har valt reserv). |
| **1. Skal och auth** | Migrering `users`, login/logout/byt lösenord, roller + `can()`, modulregister, AppShell med sidomeny, tom översikt, designsystemets grundkomponenter. | Alla i utskottet kan logga in. |
| **2. Marknadsdata** | `securities`, `price_history`, `market_cache`, Yahoo-klient, tickersök (⌘K), daglig cron, jämförelseindex i inställningar. | Kurser uppdateras själva varje dag. |
| **3. Portfölj och översikt** | Transaktioner (formulär + CSV-import), innehav, TWR, **graf portfölj vs index**, KPI-kort, widgets. | Välkomstsidan visar riktig portfölj mot valda index. |
| **4. Bevakningar** | Lista/tavla, inled bevakning, bolagssida, aktivitetslogg. | Bevakningar ersätter dagens kalkylark/dokument. |
| **5. Bolagsdata + DCF** | Finansiell översikt per bolag. DCF-porten med golden tests, DCF-sidan, Monte Carlo i Web Worker, spara modeller. | DCF:er görs i webben i stället för i Python. |
| **6. Analysarbetsyta** | Analyser, avsnitt enligt mall, autosparning, konflikthantering, status och granskning, inbäddning av DCF. | Analyser skrivs i arbetsytan. |
| **7. Rapporter** | Apps Script-mall, `/api/reports`, rapportlista. | En klar analys blir en formaterad rapport med ett klick. |
| **8. Därefter** | Skilja roller åt, beslutslogg/mötesprotokoll, notiser vid målkurs, publika sajten. | – |

Fas 4 och 5 är oberoende av varandra och kan byggas parallellt av olika personer.

---

## 13. Risker

| Risk | Sannolikhet | Hantering |
|---|---|---|
| Yahoo blockerar/stryper Cloudflare-anrop eller ändrar ändpunkter | Medel–hög | Provider-gränssnitt, D1-cache, testas i fas 0, reserv via GitHub Actions + `yfinance` |
| Worker > 3 MiB (gzip) | Medel | Tunga paket bara i klienten, mät i fas 0 och vid varje större beroende |
| CPU-gränsen 10 ms | Medel | Beräkningar i klienten, cache, inga stora JSON-transformer per anrop (förbearbeta vid cron) |
| DCF-porten räknar annorlunda än Python | Låg–medel | Golden tests mot Python-utdata |
| Kunskapen försvinner när utskottet byts ut | Hög (årligen) | `PROJEKT.md`, kommenterad kod, inga manuella steg utan dokumentation, användare inaktiveras i stället för att raderas |

---

## 14. Öppna frågor till utskottet

1. **Portföljdata:** vilken bank/mäklare (Avanza, Nordnet, …)? Finns transaktionshistorik att exportera som CSV, eller ska vi börja från ett startinnehav?
2. **Basvaluta:** SEK för allt?
3. **Jämförelseindex:** vilka som standard (OMXS30, OMXSPI, MSCI World via ETF)? Pris- eller totalavkastningsindex?
4. **Rapportmall:** finns det en Google Docs-mall i dag? Vilka avsnitt har en analys (styr `lib/analysis/templates.ts`)?
5. **Google-konto:** vilket konto/Drive äger Apps Script och rapporterna (ett sektionskonto, inte någons privata)?
6. **Antal användare** och vem som blir `admin`.
7. **Domän/namn** för sajten (påverkar Worker-namn och senare den publika delen).

---

## 15. Fas 0 – resultat (2026-10-15)

**Uppsatt:** Next 16.4.2 + React 19.3 + Tailwind 4, `@opennextjs/cloudflare` 1.20, wrangler 4.151. Worker `kfu` på https://kfu.natan-ohlin.workers.dev (Natans personliga Cloudflare-konto, se öppen fråga nedan). D1 `kfu-db` (id `b310b90d-…`, region EEUR) med migreringen `0001_grund.sql` (`app_state`, `market_cache`), lokalt och remote. `custom-worker.ts` exporterar OpenNexts `fetch` plus `scheduled()`. Cron `30 16 * * 1-5` (UTC).

**Yahoo från Cloudflare: fungerar.** Körd mot den deployade Workern (colo ARN/Stockholm), 6 körningar och 3 marknader (NOVO-B.CO/^OMX, VOLV-B.ST/^OMXSPI, AAPL/^GSPC), alla 200 OK, 30–330 ms per anrop:

| Ändpunkt | Resultat |
|---|---|
| v8 chart (aktie, index, valuta `USDSEK=X`) | OK, ~250 handelsdagar/år |
| v1 search | OK |
| cookie (`fc.yahoo.com` → A3) + `getcrumb` | OK direkt, ingen EU-samtyckesvägg. Sparas i `app_state` och återanvänds i 12 h. |
| v7 quote, v10 quoteSummary | OK med crumb |
| fundamentals-timeseries (alla 11 DCF-rader, räkenskapsår 2022–2025) | OK, **även utan crumb** |

→ Datalagret blir som i §8. Reserven via GitHub Actions behövs inte nu men finns kvar som plan B.

**Iakttagelser att ta med till fas 2/5:**
- Novo: `sharesOutstanding` 3,34 mdr vs `impliedSharesOutstanding` 4,41 mdr. Samma A/B-problem som Python-skriptet hanterar med `MANUAL_SHARES`, så transparensen i `resolveShareCount()` behövs.
- `financialCurrency` (DKK för Novo) finns i quoteSummary och räcker för valutavarningen.

**Övrigt:**
- Worker-storlek: **995 KiB gzip av 3 MiB** (33 %) med tom app.
- **`cacheComponents: true` (standard i Next 16-mallen) hänger sig i Workers-runtimen** (felet 1101, "Next.js cannot guarantee … `setTimeout()`") och är därför avstängt i `next.config.ts`. Slå inte på det igen utan att testa deployat.
- Cloudflare Images-bindningen som `migrate` lade till är borttagen (`images.unoptimized`).
- Första sekunderna efter en deploy kan ge 500 tills versionen har spridits. Vänta innan livekontrollen.
- Cron-vägen är verifierad lokalt (`wrangler dev --test-scheduled`). I produktion körs den första gången 2026-10-16 16:30 UTC. Kontrollera med `GET /api/spike/yahoo?last=cron` (rubrik `x-spike-secret`).
- `/api/spike/yahoo` och `SPIKE_SECRET` tas bort när fas 2 ersätter spiken.

**Beslut:** Workern och D1 ligger tillfälligt på Natans personliga Cloudflare-konto och **flyttas till ett annat konto** som ska äga databas och deploy. GitHub-repot ligger kvar på Natans GitHub. Flytten görs **före fas 1**, medan D1 bara innehåller spikdata och inget behöver migreras. Se §15.1.

### 15.1 Byte av Cloudflare-konto

Rekommenderat upplägg: det nya kontot ägs av sektionen/utskottet, och Natan (och efterträdare) bjuds in som medlemmar (*Manage Account → Members*). Då kan var och en köra `wrangler` med sin egen inloggning, och kontot överlever personbyten.

1. **Nytt konto:** bjud in Natan som medlem (Administrator eller Workers/D1-behörighet). Notera konto-id:t (Workers & Pages → höger kolumn).
2. **Lås wrangler till kontot:** lägg till `"account_id": "<nytt konto-id>"` i `wrangler.jsonc`. Annars kan en användare med flera konton deploya till fel konto.
3. **Ny databas:** `npx wrangler d1 create kfu-db` och byt `database_id` i `wrangler.jsonc`. Kör `npx wrangler d1 migrations apply kfu-db --remote`.
4. **Data:** ingen behöver flyttas i dag (bara `app_state` med spik/crumb). Om det finns riktig data vid bytet: `npx wrangler d1 export kfu-db --remote --output=dump.sql` på gamla kontot, sedan `npx wrangler d1 execute kfu-db --remote --file=dump.sql` på nya (efter migreringarna, med bara `INSERT`-raderna).
5. **Hemligheter:** sätt om alla med `npx wrangler secret put …` (i dag bara `SPIKE_SECRET`). Hemligheter följer inte med vid flytt.
6. **Deploy:** `npm run deploy` och kontrollera den nya `*.workers.dev`-adressen (eller egen domän på det nya kontot). Koppla eventuellt Workers Builds till GitHub-repot från det nya kontot (Cloudflares GitHub-app måste få åtkomst till repot på Natans GitHub).
7. **Städa gamla kontot** när det nya är verifierat: ta bort Workern `kfu` och D1 `kfu-db` på Natans personliga konto.

## 16. Fas 1 – resultat (2026-10-15)

Byggt och testat lokalt (`next dev` och `workerd` via `wrangler dev`). Inte deployat, eftersom det väntar på kontobytet (§15.1).

- **Auth** enligt mall §7: `/api/auth/{login,logout,me,change-password}`, PBKDF2 (20 000 iterationer), JWT i httpOnly-cookie `kfu_session`, `ADMIN_KEYS` med roll (`Namn:användarnamn:roll:sha256`) och `scripts/admin-key.mjs` som skapar poster. Första inloggningen tvingar fram ett lösenordsbyte. Ett byte ogiltigförklarar andra sessioner (`pwc`). Det tillfälliga lösenordet slutar gälla när ett eget är valt.
- **Spärr mot gissning** i D1 (`login_attempts`): 8 misslyckanden per användarnamn eller IP ger 15 minuters spärr.
- **Behörighet** enligt Next 16:s rekommendation: ingen `proxy.ts` och ingen kontroll i layouter (de körs inte om vid navigering). `lib/auth/dal.ts` har `getSessionUser()` (cachad per anrop, läser alltid användaren från D1), `requireUser(permission)` för sidor och `requireApiUser(permission)` för routes.
- **Roller:** `lib/auth/permissions.ts` med `can()`. Båda rollerna har samma rättigheter.
- **Modulregister** `lib/modules.ts` styr menyn (moduler som inte är byggda visas som "Snart" med fas) och översiktens widgets.
- **Designsystem:** reviderat efter Fas 1 till Hedvig-stil i KFU:s grafiska profil, se `DESIGN.md`. Tokens i `app/globals.css`, Lato + Cormorant Garamond, logotyp i `public/brand/`, `components/ui/` (Button, Field, Card, Badge, EmptyState, PageHeader), `lib/format.ts` (svensk tid/format).
- **Sidor:** `/admin` (inloggning), `/admin/byt-losenord`, `/admin/oversikt` (hälsning, KPI-kort, platshållare för grafen och widgets), `/admin/installningar` (profil, byt lösenord). `/` leder till `/admin`.
- **Tester:** `npm test` (Vitest, 10 tester för lösenord, ADMIN_KEYS, roller och modulregister) plus ett manuellt end-to-end-test av hela inloggningsflödet, sessionsogiltigförklaring och spärr.
- Worker-storlek: 1,2 MiB gzip av 3 MiB.
- **Hemligheter i produktion** när kontot är på plats: `AUTH_SECRET` (minst 32 tecken) och `ADMIN_KEYS`.

## 17. Fas 2 – resultat (2026-10-16)

Byggt och testat lokalt (`next dev` och `workerd`). Inte deployat, eftersom det väntar på kontobytet (§15.1).

- **Datamodell** (`0003_marknadsdata.sql`): `securities`, `price_history` (daglig stängning + justerad kurs, PK `(security_id, date)`), `benchmarks` (OMXS30 förvalt som standard). `market_cache` från fas 0 används för Yahoo-svar.
- **Provider-gränssnitt** `lib/market/types.ts` (`search`, `quotes`, `history`, `profile`, `details`). `lib/market/index.ts` väljer källa, och ingen annan kod känner till Yahoo:
  - `yahoo-provider.ts` + `yahoo-details.ts`: kurs och profil via chart (kräver ingen crumb), med quote/quoteSummary när de svarar.
  - `demo-provider.ts`: påhittade men deterministiska kurser och nyckeltal för lokal utveckling (`MARKET_PROVIDER=demo`). Gränssnittet visar "Demodata" i menyn och på bolagssidan.
  - `cache.ts`: D1-cache per källa (sök 24 h, kurs 15 min, historik och nyckeltal 6 h, profil 7 d). Vid fel från källan används utgångna värden hellre än inget.
- **Kurssynk** `lib/market/prices.ts`: ett nytt värdepapper får tio års historik; därefter hämtas bara dagarna sedan senaste kurs (minsta Yahoo-intervall). Daglig cron (`custom-worker.ts`) tar högst 40 värdepapper per körning, äldst synkade först, eftersom gratisnivån tillåter 50 utgående anrop. Värdepapper i utländsk valuta får automatiskt sin valutakurs mot SEK (`DKKSEK=X` …), vilket behövs för fas 3.
- **API:** `/api/securities/search`, `/api/market/quotes`, `/api/market/refresh` (GET senaste körning, POST kör nu), `/api/benchmarks` (GET/POST) och `/api/benchmarks/[id]` (PATCH namn/färg/standard, DELETE).
- **UI:**
  - ⌘K/Ctrl+K-sök (även knapp i menyn och sökikon på mobil) leder till bolagssidan.
  - **Bolagssidan** `/admin/bolag/[symbol]` i Avanzas omfattning: kurs, graf med perioder (1 v–5 år), avkastningsrad, nyckeltal (börsvärde, P/E, P/E framåt, P/S, P/EK, EV/EBITDA, EV/S, PEG, direktavkastning, vinst/aktie, beta), handel, lönsamhet och tillväxt, finansiell ställning, utdelning, aktien och kalender (nästa rapport, antal aktier inkl. alla aktieslag), ägare och om bolaget. **Analytiker** som Avanza: rekommendation, fördelning starkt köp/köp/behåll/sälj/starkt sälj med trend för fyra månader (`recommendationTrend`), riktkursintervall med dagens kurs inprickad och uppsida, samt vinst- och omsättningsestimat för innevarande och nästa kvartal och år (`earningsTrend`). Sektioner utan data döljs, och för index tar handelsdatan nyckeltalens plats.
  - Inställningar har flikarna Konto och **Jämförelseindex** (lägg till via sök, byt namn och färg, standardindex, ta bort, kör kursuppdatering).
  - Översiktens förklaring visar de riktiga indexen med avkastning i år.
- **Robusthet:** cachenycklarna är versionerade (`CACHE_VERSION` i `lib/market/cache.ts`; höj vid formatändring), och `app/admin/(app)/error.tsx` visar en felsida med menyn kvar.
- **Alternativa datakällor:** se `docs/datakallor.md`. Slutsatsen: behåll Yahoo, med EODHD (studentrabatt) som betald reserv och stooq/ECB som gratis nödreserv för kurser. Svenska ägarlistor finns inte gratis, så de matas förslagsvis in manuellt.
- **Tester:** 32 i Vitest (Yahoo-normalisering med fixtur i quoteSummary-format, analytikertrend och estimat, tidszoner, periodavkastning, synkintervall, symbolvalidering, demodata, färger).
- Worker-storlek: 1,35 MiB gzip av 3 MiB.

**Inte verifierat mot riktig Yahoo:** universitetsnätet (130.243.x.x) får 429 från alla Yahoo-ändpunkter sedan 2026-10-16. Det gäller även med cookie, så det är en spärr på nätet och inte i koden. Fas 0 visade att Yahoo svarar från Cloudflare. **Kör en kontroll** efter deploy eller från ett annat nät: sätt `MARKET_PROVIDER` till något annat än `demo` (eller ta bort raden), töm lokal cache (`DELETE FROM market_cache; DELETE FROM price_history;`) och öppna några bolagssidor. Kontrollera särskilt fälten i `yahoo-details.ts` mot riktiga svar.

**Kända begränsningar i källan:**
- Yahoos ägardata omfattar främst institutioner som rapporterar till amerikanska SEC. Svenska ägarlistor (som Avanza visar från Holdings/Modular Finance) finns inte gratis och skulle kräva en betald källa. Sidan säger detta.
- Bolagsbeskrivningen är på engelska.

## 18. Fas 3 – resultat (2026-10-16)

Byggt och testat lokalt med demodata (`next dev` och `workerd`). Inte deployat, eftersom det väntar på kontobytet (§15.1). Ingen CSV-import, eftersom det inte finns några befintliga innehav; allt registreras manuellt.

- **Datamodell** (`0004_transaktioner.sql`): `transactions` är den enda källan till sanning. Innehav, kassa och avkastning räknas fram, inget lagras dubbelt. Kassapåverkan (`cash_sek`) och valutakurs räknas på servern.
- **Bokföring** `lib/portfolio/ledger.ts` (rena funktioner, testade):
  - Genomspelning i datumordning med **GAV-metoden** (courtage ingår i anskaffningsvärdet) ger realiserat resultat och utdelningar per innehav.
  - **Validering mot hela historiken:** köp utan täckning, försäljning av mer än innehavet och borttagning som gör en senare affär omöjlig nekas med tydligt besked.
  - **Daglig värdering i SEK** med valutaomräkning (DKKSEK=X …). Saknade kurser fylls framåt.
  - **TWR** (tidsviktad avkastning): insättningar och uttag påverkar inte avkastningen.
- **Formulär:** sex typer (insättning, köp, sälj, utdelning, uttag, avgift).
  - Vid köp och sälj väljs värdepapper via sök, och valuta och aktuell kurs fylls i automatiskt.
  - Valutakursen hämtas för affärsdagen ur kurshistoriken om den lämnas tom.
  - Svenska tal ("1 234,56") fungerar, och index och valutor går inte att handla.
- **API:** `GET/POST /api/portfolio/transactions`, `DELETE /api/portfolio/transactions/[id]` (`portfolio:write`).
- **Sidor:**
  - `/admin/portfolj` (Innehav): nyckeltal, innehavstabell (antal, GAV, kurs, idag, värde, andel, orealiserat), likvida medel, utvecklingsgraf, fördelning per sektor och kapitalsammanställning.
  - `/admin/portfolj/transaktioner`: formulär och historik med borttagning.
  - **Översikten** visar riktiga nyckeltal: portföljvärde, avkastning i år, mot standardindex i procentenheter över samma tidsspann, och likvida medel.
- **Graf** `components/charts/PerformanceChart.tsx` (Recharts):
  - Utveckling i procent från periodens start (1M–Max), en y-axel och tunna linjer.
  - Hårkors med tooltip för alla serier, förklaring med periodens utveckling som direktetikett, och tabellvy.
  - Portföljen räknas som TWR och index med utdelningsjusterade kurser.
- **Seriefärger** omgjorda så att de klarar dataviz-validatorn (DESIGN.md §2): #2b5aa6, #db8400, #11977a, #9065d6, #cf4f84.
- **Tester:** 39 i Vitest (nya: kassapåverkan, GAV, realiserat, validering, TWR med insättning mitt i perioden, valutaomräkning, helger).
- Worker-storlek: 1,54 MiB gzip av 3 MiB. Recharts renderas även på servern.

**Att hålla koll på:**
- Värderingen räknas vid varje sidvisning (alla transaktioner × handelsdagar). För utskottets storlek tar det några millisekunder. Om CPU-gränsen (10 ms) någon gång nås i produktion: spara serien dagligen i en tabell `portfolio_daily` från cron och läs den i stället.
- Lokal testdata från utvecklingen ligger bara i `.wrangler/` (lokal D1) och följer inte med till produktion.

## 19. Nästa steg

1. Stäm av §7 (sidorna) och §14 (öppna frågor) i utskottet.
2. Fas 0: sätt upp repot och kör Yahoo-spiken från Cloudflare. Svaret där avgör om datalagret blir som i §8 eller går via reserven.
3. Skriv `PROJEKT.md`, `AGENTS.md` och `CLAUDE.md` i repot enligt mall §13.
