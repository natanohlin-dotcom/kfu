# Arkitekturmall – Next.js + Cloudflare (D1, Pages/Workers)

Instruktion till Claude: det här dokumentet beskriver den **tekniska grunden** från Batterilabbet-projektet (publik sajt + CRM/admin i samma app). Använd det för att sätta upp ett nytt projekt med samma arkitektur. Sidor, innehåll och design kommer från en separat designspecifikation – blanda inte in Batterilabbets sidor eller utseende.

Skrivet 2026-10-15 utifrån `my-site` (Next.js 16.2, React 19, Tailwind 4, Cloudflare Pages + D1).

---

## 1. Vad är vad?

| Del | Vad det är | Roll i projektet |
|---|---|---|
| **Node.js** | JavaScript-körmiljö på din dator | Kör verktygen: `npm`, Next-kompilatorn, `wrangler`, skript. Koden *körs inte* på Node i produktion (se Workers). |
| **React** | Bibliotek för UI-komponenter | Allt som syns: komponenter, state, formulär. |
| **Next.js** | Ramverk ovanpå React | Routing (mappstruktur = URL:er), server-rendering, API-routes, metadata/SEO, bildspråk för bygget. |
| **Cloudflare Workers** | Serverlös körmiljö på Cloudflares nät (V8-isolat, inte Node) | Kör serverkoden: sidor som renderas per anrop och alla `/api`-routes. Snabb kallstart, CPU-tidsgräns per anrop. |
| **Cloudflare Pages** | Hosting för statiska filer + "Functions" (som är Workers under huven) | Det här projektet: git push → Pages bygger → statiska filer på CDN, serverkoden som Workers. |
| **Cloudflare D1** | SQLite-databas som Workers når via en *binding* | All data (ordrar, kunder, produkter, användare). SQL, inga anslutningssträngar. |

Kort: **Node bygger, React ritar, Next organiserar, Workers kör, Pages levererar, D1 lagrar.**

### Pages eller Workers för nästa projekt?
- **Det här projektet** använder `@cloudflare/next-on-pages` på **Pages**. Det kräver att alla dynamiska routes kör `export const runtime = 'edge'` (begränsad runtime, inte full Node-kompatibilitet).
- **`next-on-pages` är avvecklat.** Cloudflare rekommenderar nu **`@opennextjs/cloudflare` (OpenNext) på Workers** med statiska tillgångar. Fördelar: Node-runtime (inget `runtime = 'edge'` behövs), bättre stöd för nya Next-funktioner, samma D1-bindings.
- **Rekommendation:** starta nytt projekt med **OpenNext + Workers**. Allt nedan om D1, auth, mönster och struktur gäller oförändrat; bara åtkomsten till bindings och byggkommandot skiljer (markerat **[Pages]** / **[OpenNext]**).
- Verifiera alltid mot aktuell dokumentation innan setup (Cloudflare och Next ändras snabbt). Next 16 har brytande ändringar – läs `node_modules/next/dist/docs/` (lägg samma `AGENTS.md`-instruktion i nya repot).

---

## 2. Stack och beroenden

**Kärna:** `next`, `react`, `react-dom`, `typescript`, `tailwindcss@4` + `@tailwindcss/postcss`, `eslint` + `eslint-config-next`.

**Cloudflare:** `wrangler` (CLI: dev, D1, secrets, deploy) + adapter: **[OpenNext]** `@opennextjs/cloudflare` / **[Pages]** `@cloudflare/next-on-pages`.

**Används i projektet och värda att ta med:**
| Paket | Varför |
|---|---|
| `jose` | JWT för inloggningssession (fungerar i Workers, Web Crypto) |
| `lucide-react` | Ikoner |
| `tw-animate-css` | `animate-in`/`fade-in`-klasser (måste importeras i CSS, annars gör klasserna inget) |
| `@tailwindcss/typography` | `prose` för textsidor |
| `qrcode` | QR-koder lokalt (skicka inte data till tredjepartstjänster) |
| `sharp` (dev) | Skript som skapar bildvarianter |
| `@google/clasp` (dev) | Om Google Apps Script används (se §8) |

Undvik paket som kräver Node-API:er som inte finns i Workers (fs, net, native moduler) i serverkod som körs per anrop.

---

## 3. Mappstruktur

```
app/
  (public)/            ← route group: publika sidor med gemensam layout (nav, footer, cookie-banner)
    layout.tsx
    page.tsx
  (standalone)/        ← sidor utan huvudnavigering (kassa, betalning, bekräftelse)
  admin/               ← CRM/backend (egen layout, robots: noindex)
    page.tsx           ← inloggning
    dashboard/…        ← skyddade vyer
  api/                 ← route handlers (route.ts) – JSON-API för både publikt och admin
    auth/{login,logout,me,change-password}/route.ts
    <resurs>/route.ts           ← GET (lista) / POST (skapa)
    <resurs>/[id]/route.ts      ← PUT / DELETE
    <resurs>/public/route.ts    ← publika endpoints (validering + rate limit)
  layout.tsx           ← rot: <html lang>, typsnitt, viewport/themeColor
  globals.css          ← Tailwind + @theme-tokens
  sitemap.ts, robots.ts, not-found.tsx
components/
  ui/                  ← designsystemets byggstenar (Button, Field, Card …)
  <område>/            ← sidspecifika komponenter
lib/                   ← all logik utan UI: db-åtkomst, auth, statuslistor, mappers, externa klienter
scripts/               ← engångs-/underhållsskript (node scripts/x.mjs)
public/                ← statiska filer
wrangler.toml / wrangler.jsonc, env.d.ts, next.config.ts
```

**Regler:**
- `lib/` är källan till sanning för domänlogik (statusar, kategorier, prisberäkning, mappning rad → objekt). Sidor och API importerar därifrån – duplicera inte listor i komponenter.
- Route-filer (`route.ts`) får bara exportera HTTP-metoder och route-konfig. Hjälpfunktioner som delas läggs i `lib/`.
- Alias `@/*` → projektroten (tsconfig `paths`).

---

## 4. Konfiguration

**wrangler** (exempel för [Pages]; [OpenNext] har motsvarande `main`/`assets` enligt adapterns mall):
```toml
name = "projektnamn"
pages_build_output_dir = ".vercel/output/static"   # [Pages]
compatibility_date = "YYYY-MM-DD"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "projektnamn-db"
database_id = "<från wrangler d1 create>"
```

**env.d.ts** – typer för bindings:
```ts
interface CloudflareEnv { DB: D1Database; }
```
(Lägg till fler bindings här: R2-buckets, KV, rate limiters.)

**next.config.ts** [Pages]: lokalt laddas Cloudflare-miljön så att `DB` finns i `npm run dev`:
```ts
export default async () => {
  if (process.env.NODE_ENV === 'development') {
    const { setupDevPlatform } = await import('@cloudflare/next-on-pages/next-dev');
    await setupDevPlatform();
  }
  return nextConfig;
};
```
[OpenNext]: motsvarande `initOpenNextCloudflareForDev()` enligt adapterns dokumentation.

**Åtkomst till D1 i serverkod:**
- [Pages]: `import { getRequestContext } from '@cloudflare/next-on-pages'; const db = getRequestContext().env.DB;` + `export const runtime = 'edge'` i varje dynamisk route/sida.
- [OpenNext]: `import { getCloudflareContext } from '@opennextjs/cloudflare'; const db = getCloudflareContext().env.DB;`
- Kapsla in i en hjälpfunktion i `lib/db.ts` (`getDb()`), så att bytet av adapter bara rör en fil.

---

## 5. Data – D1

**Schema och migreringar**
- Här skapades tabeller med `ensureXTable(db)` (`CREATE TABLE IF NOT EXISTS` + `PRAGMA table_info` + `ALTER TABLE ADD COLUMN`) som körs första gången en funktion anropas, med en modulflagga så det bara sker en gång per isolat. Praktiskt (deploy = migrering), men svårt att överblicka.
- **Nytt projekt:** använd `wrangler d1 migrations` (numrerade SQL-filer i `migrations/`, körs med `wrangler d1 migrations apply <db> --local/--remote`). Behåll ensure-mönstret bara för små, självständiga tabeller om det förenklar.
- Döp kolumner entydigt från start (lärdom: `brand`/`model` betydde olika saker i olika delar av koden och gav buggar i flera vändor). Skriv en kommentar per tabell om vad varje kolumn innehåller.

**Åtkomstmönster**
- Alltid parametriserade frågor: `db.prepare("… WHERE id = ?").bind(id).first() / .all() / .run()`.
- Flera frågor som hör ihop: `db.batch([...])`.
- Mappa rader till typade objekt i `lib/` (t.ex. `rowToProduct(row)`) – en plats för städning av data, beräknade fält och reservvärden.
- Listor med fasta värden (statusar, kategorier) i `lib/<domän>.ts` med typer, etiketter och grupper; spara bara id:t i databasen.
- D1 tillåter ~2 MB per värde. Lagra inte bilder/filer i D1 (här gjordes det med base64 som nödlösning) – använd **R2** för uppladdningar i nya projekt.

**Lokalt vs produktion**
- Lokal D1 ligger i `.wrangler/` (ska *inte* committas). Seed med `wrangler d1 execute <db> --local --file=seed.sql`.
- Produktionsläsningar/-skrivningar via `--remote` görs medvetet och manuellt – aldrig i automatiska skript.

---

## 6. API-routes

**Konvention**
```ts
export const runtime = 'edge'; // [Pages]
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) return NextResponse.json({ error: "Obehörig" }, { status: 401 });
  try {
    const db = getDb();
    const { results } = await db.prepare("SELECT …").all();
    return NextResponse.json({ success: true, data: results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```
- Svarsform: `{ success: true, data }` eller `{ error }` + rätt HTTP-status. Klienten kollar `res.ok && result.success`.
- Admin-endpoints: auth-kontroll först på varje route.
- Publika endpoints (formulär, beställningar):
  - **Validera och tvätta** all indata på servern (längd, format, tillåtna värden).
  - **Räkna pris på servern** utifrån databasen – lita aldrig på belopp eller rabatter från klienten.
  - Skapa id/ordernummer på servern.
  - Rate limiting: här en in-memory `Map` per isolat (svagt skydd). I nytt projekt: Cloudflares **Rate Limiting-binding** eller räknare i D1/KV.
  - Honeypot-fält i formulär mot bottar.
- Långsamma sidoeffekter (mejl) efter svaret: `ctx.waitUntil(promise)`.

---

## 7. Autentisering (admin)

Beprövat upplägg från projektet, utan extern auth-tjänst:
- **Inloggning:** användarnamn + lösenord → `POST /api/auth/login` → JWT (jose, HS256) i en **httpOnly, Secure, SameSite=Lax**-cookie (30 dagar).
- **Användare:** tabell `admin_users` med **PBKDF2**-hash (Web Crypto). ~20 000 iterationer ryms i Workers CPU-gräns (gratisnivån ~10 ms); antalet sparas i hashen så det kan höjas senare.
- **Första inloggning:** tillfälliga lösenord i en secret (`ADMIN_KEYS` = `Namn:användarnamn:sha256(användarnamn:lösenord)`), med `mustChange` → användaren tvingas välja eget lösenord (längd- och teckenkrav).
- **Ogiltigförklara sessioner** vid lösenordsbyte: `password_changed_at` i token (`pwc`) jämförs mot databasen.
- `AUTH_SECRET` läses vid anrop (inte vid import) och saknas den vägrar servern logga in – ingen reservsträng i koden.
- Formulär för autofyll: `autocomplete="username"` / `current-password` / `new-password`, riktiga `<form>` med submit.
- Admin-layout: `robots: { index: false }`.

---

## 8. Externa tjänster och hemligheter

**Hemligheter**
- Produktion: `npx wrangler pages secret put NAMN` [Pages] / `npx wrangler secret put NAMN` [Workers] eller via Cloudflare-dashboarden.
- Lokalt: `.env.local` (Next) / `.dev.vars` (wrangler). `.env*` och `.dev.vars` i `.gitignore` – committas aldrig.
- Läs via `process.env.NAMN` (fungerar för Pages/OpenNext-secrets) – kontrollera vid anrop, kasta tydligt fel om de saknas.

**Google Apps Script som microservice (valfritt)**
Användes för mejl (Gmail), PDF-fakturor och Drive-dokument utan egen mejlserver.
- Kod i `apps-script/` hanteras med `clasp` (`npx clasp push`, `npx clasp update-deployment <id>` – samma URL efter uppdatering). Exkludera mappen från ESLint.
- Delad hemlighet (`APPS_SCRIPT_SECRET`) i varje anrop; skriptet kollar mot Script Properties.
- **Idempotens:** varje anrop har ett `requestId`; skriptet cachar svaret per id och klienten försöker igen upp till 3 gånger (Google tappar ibland svaret). Ger aldrig dubbla mejl/fakturor.
- Alternativ i nytt projekt: en mejl-API-tjänst (t.ex. Resend/Postmark) direkt från Workers är enklare om Google-integrationen inte behövs.

**Betalning**
- Swish manuellt (deeplink + QR genererad lokalt) med kundbekräftelse och manuell avstämning. Behövs automatisk verifiering: Swish Handel-API eller Stripe/Klarna med webhooks till en API-route.

---

## 9. Frontend-arkitektur

- **Server components som standard.** Sidor hämtar data direkt från D1 på servern; interaktivitet i små `"use client"`-komponenter.
- **Server → klient:** bara serialiserbara props (inga funktioner – skicka listor/värden, t.ex. `alt={["…"]}` i stället för `alt={(i) => …}`).
- `useSearchParams` i klientkomponent kräver en `<Suspense>`-gräns runt komponenten.
- Dynamiska sidor som läser databasen: `export const dynamic = 'force-dynamic'` (+ `runtime = 'edge'` på [Pages]).
- **Route groups** för olika layouter (publik / fristående / admin). Layouten äger toppmarginal och `<main>`; sidorna använder `<div>` (en `<main>` per sida).
- **Scroll vid sidbyte:** Next scrollar bara fram början av den nya sidans innehåll (och inte alls om den redan syns). Lägg en `ScrollToTop`-komponent i layouten som går till toppen vid vanliga sidbyten men låter bakåt/framåt och `#ankare` vara.
- **Designsystem från start:**
  - `globals.css`: `@theme` med färg- och typsnittstokens (inga hårdkodade hex i komponenter), basregler i `@layer base`, återanvändbara klasser i `@layer components`/`@utility`. Undvik `!important`.
  - `components/ui/Button.tsx` med `buttonStyles({ variant, size })` – en knappstil överallt. Knappar ska kunna radbryta (inte `whitespace-nowrap`) så att lång text inte gör sidan bredare än mobilskärmen.
  - Radieskala (t.ex. 16/24/32 px) och få storlekar på allt.
- **Tillgänglighet som standard:** kopplade `<label htmlFor>`, `aria-invalid`/`aria-describedby` på fält, inbyggd `<dialog>` för modaler, `:focus-visible`-ring, `prefers-reduced-motion` och `prefers-reduced-transparency`, tryckrespons med `:active`, 16 px i fält (annars zoomar iOS).
- **Bilder:** skript som skapar 800/1600 px WebP-varianter + manifest → `srcset`/`sizes`; `loading="lazy"` utom bilden ovanför vecket (`fetchPriority="high"`); fasta bildförhållanden mot layoutskift.
- Typsnitt via `next/font` (CSS-variabel → `@theme`).

---

## 10. SEO

- `metadata`/`generateMetadata` per sida (titel, beskrivning, canonical, Open Graph med absolut bild-URL).
- `app/sitemap.ts` som läser publika poster från D1 + statiska sidor.
- Strukturerad data (JSON-LD) renderad **på servern** i ett block per sida (inte i klientkomponenter med `window`).
- Produkt-/detaljsidor: `notFound()` för okända id (riktig 404) + egen `not-found.tsx`.
- Riktiga `<Link>` till detaljsidor i listor (crawlbara), inte `div` med `onClick`.

---

## 11. Utvecklingsflöde och deploy

**Lokalt**
```bash
npm install
npx wrangler d1 execute <db> --local --file=schema.sql   # eller: wrangler d1 migrations apply <db> --local
npm run dev                                              # Next med lokal D1 via dev-plattformen
```

**Deploy**
- [Pages]: GitHub-repo kopplat till Pages-projektet; push till `main` → bygger med `npx @cloudflare/next-on-pages` → live på ~2–4 min.
- [OpenNext]: `npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy`, eller Workers Builds kopplat till GitHub.
- Före push: `npx tsc --noEmit`, `npx next build`, och ESLint på källmapparna (`npx eslint app components lib`).
- Efter push: kontrollera live (statuskoder, en nyckelsida) innan uppgiften räknas som klar.

**Användbara kommandon**
```bash
npx wrangler d1 create <db>
npx wrangler d1 execute <db> --local --command "SELECT …"
npx wrangler d1 execute <db> --remote --command "…"     # produktion – bara medvetet
npx wrangler pages secret put NAMN                       # [Pages]
npx wrangler secret put NAMN                             # [Workers/OpenNext]
```

---

## 12. Fallgropar vi gått i (undvik från start)

1. **Turbopack-cachen** i dev serverar ibland gammal CSS efter ändringar i `globals.css` → `rm -rf .next/dev` och starta om, eller verifiera mot `next build`.
2. **Edge-runtime [Pages]:** inga Node-API:er; vissa paket fungerar inte. (Försvinner med OpenNext.)
3. **Route-filer** får inte exportera egna hjälpfunktioner → lägg dem i `lib/`.
4. **Funktioner som props** från server- till klientkomponent kraschar.
5. **Kolumnnamn som betyder olika saker** i databas, admin och publik kod (se §5).
6. **Alltid renderade, osynliga element** (t.ex. en mobilmeny i en `fixed` nav) kan fånga tryck på sidan under → `pointer-events-none` på behållaren.
7. **`tw-animate-css` måste importeras**, annars gör `animate-in` ingenting – utan felmeddelande.
8. **Tailwinds `gray` är kall** och drar mot blått mot varma bakgrunder → välj tokens/`stone` medvetet.
9. **In-memory rate limiting** nollställs per isolat → använd binding/D1.
10. **Mejl i lokala tester:** låt externa anrop (mejl, betalning) vara avstängbara lokalt så att tester aldrig skickar riktiga mejl.
11. **Hemligheter:** aldrig i git (även `.wrangler/`), aldrig i chatt/loggar, aldrig reservvärden i kod.

---

## 13. Kickstart-checklista för nästa projekt

1. Läs designspecifikationen; lista entiteter (tabeller), roller (vem loggar in) och flöden (formulär, betalning, mejl).
2. `npx create-next-app@latest` (TypeScript, App Router, Tailwind, ESLint) → lägg till Cloudflare-adapter (**OpenNext rekommenderas**) och `wrangler`.
3. `AGENTS.md` med instruktionen att läsa `node_modules/next/dist/docs/` + `CLAUDE.md` som pekar på den.
4. `wrangler d1 create`, binding `DB` i wrangler-konfig, `env.d.ts`, `lib/db.ts` (`getDb()`).
5. `migrations/0001_init.sql` med tabellerna från punkt 1 (tydliga kolumnnamn + kommentarer); applicera lokalt.
6. `lib/auth.ts` + `/api/auth/*` + admin-inloggning enligt §7; secrets `AUTH_SECRET`, `ADMIN_KEYS`.
7. `globals.css` med `@theme`-tokens från designspecen, `components/ui/Button.tsx`, typsnitt via `next/font`, `ScrollToTop`, route groups med layouter.
8. API-routes per resurs enligt §6; publika endpoints med validering, serverberäkning och rate limit.
9. SEO-grund: metadata, `sitemap.ts`, `robots.ts`, `not-found.tsx`.
10. `.gitignore` (inkl. `.env*`, `.dev.vars`, `.wrangler`), koppla GitHub → Cloudflare, sätt secrets, första deploy och livekontroll.
11. Skriv `PROJEKT.md` i nya repot med projektets egna beslut (som denna fil, men specifik).
